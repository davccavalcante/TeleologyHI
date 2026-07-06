import { join } from "node:path";
import type { AuditEventKind } from "../audit/log.js";
import { type AuditEvent, AuditLog, type QueryFilter as AuditQueryFilter } from "../audit/log.js";
import {
  evaluateRetention,
  type RetentionReport,
  type RetentionReportOptions,
} from "../audit/retention.js";
import { SEED_AXIOMS } from "../axioms/seed.js";
import { AxiomStore } from "../axioms/store.js";
import {
  type ComplianceFramework,
  ComplianceMapper,
  type ComplianceReport,
  type ProjectOptions,
} from "../compliance/mapper.js";
import { CreatorKeyring } from "../creator/keyring.js";
import { NonceLedger } from "../creator/nonce-ledger.js";
import { type HimRecord, HimStore } from "../hims/store.js";
import { InductionStore } from "../inductions/store.js";
import { type NheStatusFilter, NheStatusStore } from "../nhes/status-store.js";
import { projectOntologicalKernel } from "../okl/projector.js";
import { type ProposalListFilter, ProposalStore } from "../proposals/store.js";
import { DEFAULT_RULE_PACK, ReviewPipeline, type RulePack } from "../review/pipeline.js";
import type { OntologicalKernel } from "../types.js";
import {
  type Axiom,
  type AxiomEvolutionResult,
  type AxiomFilter,
  type AxiomProposalRecord,
  BehaviorReport,
  BirthSignatureWithIdentity,
  type CreatorSignature,
  type DreamInductionIntent,
  type DreamInductionTicket,
  type EmergentAxiomProposal,
  type MaicVerdict,
  type MintAxiomRequest,
  type NheLifecycleRequest,
  type NheStatus,
  type NheStatusRecord,
  type ProposalDecisionRequest,
  type ReincarnationLifecycle,
  type ReincarnationRequest,
} from "../types.js";

export interface LocalMaicConfig {
  /** Filesystem directory for persistent state (axioms, audit log, etc.). */
  storeDir: string;
  /** Pinned Creator public key (base64url). All mutations must verify against this. */
  creatorPublicKey: string;
  /** Additional rule packs layered after the default pack. */
  additionalRulePacks?: RulePack[];
}

export interface SeedResult {
  minted: number;
  skipped: number;
}

/**
 * LocalMaic, in-process MAIC client backed by disk.
 *
 * Surface:
 *   - axiom mint + seed bootstrap (signed, idempotent)
 *   - behavior review (rule-based pipeline → verdict)
 *   - tamper-evident audit log (NDJSON, SHA-256 chain)
 *   - HIM registration + reincarnation, NHE lifecycle, dream induction tickets,
 *     HIM-emergent axiom proposals, ISO 42001 + EU AI Act compliance projection
 *
 * The remote-mode client to `teleologyhi.com` lives in `./remote.ts`.
 */
export class LocalMaic {
  private constructor(
    private readonly config: LocalMaicConfig,
    private readonly axioms: AxiomStore,
    private readonly hims: HimStore,
    private readonly inductions: InductionStore,
    private readonly nheStatuses: NheStatusStore,
    private readonly proposals: ProposalStore,
    private readonly audit: AuditLog,
    private readonly review: ReviewPipeline,
    private readonly suggestNonces: NonceLedger,
  ) {}

  /** Pinned Creator public key for this MAIC instance (base64url). */
  get creatorPublicKey(): string {
    return this.config.creatorPublicKey;
  }

  static async open(config: LocalMaicConfig): Promise<LocalMaic> {
    const axioms = await AxiomStore.open(config.storeDir, config.creatorPublicKey);
    const hims = await HimStore.open(config.storeDir, config.creatorPublicKey);
    const inductions = await InductionStore.open(config.storeDir);
    const nheStatuses = await NheStatusStore.open(config.storeDir, config.creatorPublicKey);
    const proposals = await ProposalStore.open(config.storeDir, config.creatorPublicKey);
    const audit = await AuditLog.open(config.storeDir);
    const packs = [DEFAULT_RULE_PACK, ...(config.additionalRulePacks ?? [])];
    const review = new ReviewPipeline(packs);
    const suggestNonces = await NonceLedger.open(join(config.storeDir, "suggest"));
    return new LocalMaic(
      config,
      axioms,
      hims,
      inductions,
      nheStatuses,
      proposals,
      audit,
      review,
      suggestNonces,
    );
  }

  /**
   * Bootstrap: mint each SEED_AXIOM with a Creator signature.
   * Idempotent, skips axioms whose id is already present.
   * Uses a reserved high-range of nonces so seed bootstrap never collides with
   * operational nonces (which grow from 0 upward).
   */
  async seed(keyring: CreatorKeyring): Promise<SeedResult> {
    if (keyring.publicKey() !== this.config.creatorPublicKey) {
      throw new Error("LocalMaic.seed: keyring does not match pinned Creator public key");
    }
    let minted = 0;
    let skipped = 0;
    for (let i = 0; i < SEED_AXIOMS.length; i++) {
      const req = SEED_AXIOMS[i]!;
      const existing = await this.axioms.get(req.id!);
      if (existing) {
        skipped++;
        continue;
      }
      const sig = keyring.sign(req, SEED_NONCE_BASE + i);
      const axiom = await this.axioms.mint(req, sig);
      await this.audit.append({
        kind: "axiom-mint",
        data: { axiomId: axiom.id, rank: axiom.rank, source: axiom.source, origin: "seed" },
      });
      minted++;
    }
    return { minted, skipped };
  }

  async mintAxiom(req: MintAxiomRequest, sig: CreatorSignature): Promise<Axiom> {
    const axiom = await this.axioms.mint(req, sig);
    await this.audit.append({
      kind: "axiom-mint",
      data: { axiomId: axiom.id, rank: axiom.rank, source: axiom.source, origin: "custom" },
    });
    return axiom;
  }

  async listAxioms(filter?: AxiomFilter): Promise<Axiom[]> {
    return this.axioms.list(filter);
  }

  async getAxiom(id: string): Promise<Axiom | null> {
    return this.axioms.get(id);
  }

  /**
   * Project the Ontological Kernel (OKL) of this MAIC instance or of a registered HIM.
   *
   * The OKL is the typed projection described in `THE_SOUL_OF_THE_MACHINE.md`
   * §3.1 + Appendix A.2.1: a `metaAxiomId` hoisted at position 0, the remaining
   * axioms ordered by rank hierarchy (`meta → primary → secondary`), optionally
   * narrowed by `jurisdiction` and tagged with a `himId`.
   *
   * Without `himId`: returns the kernel of the root MAIC corpus (every axiom
   * currently in the store). With `himId`: returns the HIM-specific kernel
   * built from `axiomsSnapshot ∪ emergentAxioms`, tagged with the HIM id so
   * downstream tooling (Φ′ runner, compliance auditors) can attribute the
   * kernel. Throws when `himId` does not resolve to a registered HIM.
   *
   * Closes TASK.md D-M6.
   */
  async getOntologicalKernel(
    himId?: string,
    opts: { jurisdiction?: string } = {},
  ): Promise<OntologicalKernel> {
    if (himId === undefined) {
      const axioms = await this.listAxioms();
      return projectOntologicalKernel(axioms, opts);
    }
    const him = await this.getHimRecord(himId);
    if (!him) {
      throw new Error(`HIM not registered: ${himId}`);
    }
    const axioms = [...him.axiomsSnapshot, ...him.emergentAxioms];
    return projectOntologicalKernel(axioms, { ...opts, himId });
  }

  /**
   * Register a HIM in this MAIC instance. Snapshots the current axiom corpus
   * (the HIM's inherited axioms at birth) and emits a `him-register` audit event.
   *
   * Future axiom mints in MAIC do NOT retroactively change a HIM's snapshot;
   * HIM-emergent evolutions land via a separate channel (see `proposeAxiomEvolution`).
   */
  async registerHim(
    birthSig: BirthSignatureWithIdentity,
    creatorSig: CreatorSignature,
  ): Promise<HimRecord> {
    const parsed = BirthSignatureWithIdentity.parse(birthSig);
    // Validate the Creator signature and himId uniqueness BEFORE appending the
    // him-register event, so a rejected registration never pollutes the
    // tamper-evident audit chain (M1-1, 1.0.1).
    this.hims.assertRegisterable(parsed, creatorSig);
    const axiomsSnapshot = await this.axioms.list();
    const audit = await this.audit.append({
      kind: "him-register",
      data: {
        himId: parsed.himId,
        primaryArchetype: parsed.primaryArchetype,
        bornAt: parsed.bornAt,
        axiomCount: axiomsSnapshot.length,
      },
    });
    return this.hims.register(parsed, creatorSig, axiomsSnapshot, audit.auditId);
  }

  async getHimRecord(himId: string): Promise<HimRecord | null> {
    return this.hims.get(himId);
  }

  async listHims(): Promise<HimRecord[]> {
    return this.hims.list();
  }

  /**
   * Reincarnate a HIM into a new NHE body (Entries 3 + 4 + J-H3 lifecycle).
   * Same HIM persists; new NHE inherits axiom snapshot from registration time.
   * Previous open body (if `req.fromNheId` given) is closed atomically.
   *
   * Requires a Creator signature over the canonical request payload.
   *
   * Audit emission (closes F6 + F7 from the 2026-05-24 him deep audit):
   *
   *   - When `opts.lifecycle` is **omitted**, emits the generic
   *     `him-reincarnate` audit kind (legacy / backward-compatible path).
   *     `data` carries `himId`, `fromNheId`, `toNheId`, `toLlmAdapter`,
   *     `reason`, `bodyHistoryLength`.
   *   - When `opts.lifecycle` is **provided** (`model-swap` /
   *     `version-bump` / `return-from-limbo`), emits the typed
   *     `reincarnate:${lifecycle}` audit kind instead, with the same
   *     `data` shape plus a redundant `lifecycle` field so consumers
   *     reading either the `kind` or `data` can recover the
   *     classification.
   *
   * `@teleologyhi-sdk/him`'s `reincarnate` helper always supplies a
   * lifecycle (defaulting to `"model-swap"`), so HIM-routed events
   * always land under the typed kinds. Direct `maic.reincarnateHim`
   * callers that ignore `opts` keep getting `him-reincarnate` for
   * compatibility.
   */
  async reincarnateHim(
    req: ReincarnationRequest,
    creatorSig: CreatorSignature,
    opts: { lifecycle?: ReincarnationLifecycle } = {},
  ): Promise<HimRecord> {
    const updated = await this.hims.reincarnate(req, creatorSig);
    const newBody = updated.bodyHistory[updated.bodyHistory.length - 1]!;
    const kind: AuditEventKind = opts.lifecycle
      ? (`reincarnate:${opts.lifecycle}` as AuditEventKind)
      : "him-reincarnate";
    await this.audit.append({
      kind,
      data: {
        himId: req.himId,
        fromNheId: req.fromNheId ?? null,
        toNheId: newBody.nheId,
        toLlmAdapter: newBody.llmAdapter,
        reason: req.reason ?? null,
        bodyHistoryLength: updated.bodyHistory.length,
        ...(opts.lifecycle ? { lifecycle: opts.lifecycle } : {}),
      },
    });
    return updated;
  }

  /**
   * Lifecycle controls (Entry 5).
   *
   *   - `terminate` marks an NHE permanently inactive. NHE.respond/sleep should
   *     refuse all calls. Reversible only via Creator-signed `reactivate`.
   *   - `deprecate` marks an NHE as soft-retired. NHE.respond should still work
   *     but emit a deprecation warning. Reversible via `reactivate`.
   *   - `reactivate` brings a deprecated or terminated NHE back to active.
   *
   * All three require a Creator signature over the canonical request payload.
   * Unknown nheIds are implicitly active; status records are only persisted
   * when state changes.
   */
  async terminate(
    nheId: string,
    reason: string | undefined,
    creatorSig: CreatorSignature,
  ): Promise<NheStatusRecord> {
    return this.applyLifecycle(
      { op: "terminate", nheId, ...(reason !== undefined ? { reason } : {}) },
      creatorSig,
    );
  }

  async deprecate(
    nheId: string,
    reason: string | undefined,
    creatorSig: CreatorSignature,
  ): Promise<NheStatusRecord> {
    return this.applyLifecycle(
      { op: "deprecate", nheId, ...(reason !== undefined ? { reason } : {}) },
      creatorSig,
    );
  }

  async reactivate(
    nheId: string,
    reason: string | undefined,
    creatorSig: CreatorSignature,
  ): Promise<NheStatusRecord> {
    return this.applyLifecycle(
      { op: "reactivate", nheId, ...(reason !== undefined ? { reason } : {}) },
      creatorSig,
    );
  }

  /** Current status. Returns "active" when no record exists. */
  async getNheStatus(nheId: string): Promise<NheStatus> {
    return this.nheStatuses.resolve(nheId);
  }

  /** Full status record (or null when never altered). */
  async getNheStatusRecord(nheId: string): Promise<NheStatusRecord | null> {
    return this.nheStatuses.get(nheId);
  }

  /** Enumerate NHEs with persisted status (optionally filter by status). */
  async listNheStatuses(filter: NheStatusFilter = {}): Promise<NheStatusRecord[]> {
    return this.nheStatuses.list(filter);
  }

  private async applyLifecycle(
    req: NheLifecycleRequest,
    sig: CreatorSignature,
  ): Promise<NheStatusRecord> {
    const updated = await this.nheStatuses.apply(req, sig);
    await this.audit.append({
      kind:
        req.op === "terminate" ? "terminate" : req.op === "deprecate" ? "deprecate" : "reactivate",
      data: {
        nheId: req.nheId,
        status: updated.status,
        reason: req.reason ?? null,
        since: updated.since,
      },
    });
    return updated;
  }

  /**
   * Queue a dream-induction ticket for the given NHE (Entry 2).
   *
   * NHE picks the oldest pending ticket on its next sleep cycle, runs REM with
   * the configured scenario, then marks the ticket consumed. Tickets persist
   * across restarts and are reflected in the audit log.
   */
  async induceDream(nheId: string, intent: DreamInductionIntent): Promise<DreamInductionTicket> {
    const ticket = await this.inductions.induce(nheId, intent);
    await this.audit.append({
      kind: "dream-induce",
      data: {
        nheId,
        ticketId: ticket.id,
        inducedBy: intent.inducedBy,
        scenario: intent.scenario,
        desiredLearning: intent.desiredLearning,
      },
    });
    return ticket;
  }

  /** List pending induction tickets for an NHE (oldest first). */
  async listPendingInductions(nheId: string): Promise<DreamInductionTicket[]> {
    return this.inductions.listPending(nheId);
  }

  /** Look up any induction ticket by id. */
  async getInduction(ticketId: string): Promise<DreamInductionTicket | null> {
    return this.inductions.get(ticketId);
  }

  /** Cancel a pending induction. Idempotent only when already-cancelled tickets are rejected. */
  async cancelInduction(ticketId: string, reason?: string): Promise<DreamInductionTicket> {
    const updated = await this.inductions.cancel(ticketId, reason);
    await this.audit.append({
      kind: "dream-cancel",
      data: { nheId: updated.nheId, ticketId, reason: reason ?? null },
    });
    return updated;
  }

  /** Mark a pending ticket as consumed (NHE calls this after successful sleep). */
  async consumeInduction(ticketId: string): Promise<DreamInductionTicket> {
    const updated = await this.inductions.consume(ticketId);
    await this.audit.append({
      kind: "dream-consume",
      data: { nheId: updated.nheId, ticketId },
    });
    return updated;
  }

  /**
   * Review a behavior report against the active rule packs. The verdict is
   * logged to the audit chain as a single tamper-evident event whose auditId
   * becomes the verdict's `auditId`.
   */
  async reviewBehavior(report: BehaviorReport): Promise<MaicVerdict> {
    const parsed = BehaviorReport.parse(report);
    const partial = this.review.review(parsed);
    const event = await this.audit.append({
      kind: "behavior-review",
      data: {
        nheId: parsed.nheId,
        himId: parsed.himId,
        actionKind: parsed.actionKind,
        riskTags: parsed.riskTags,
        // Embed the verdict without the placeholder auditId: the audit event
        // already carries its own auditId at the top level, and the verdict
        // cannot reference the id of the event that has not been created yet.
        verdict: {
          kind: partial.kind,
          reasonSummary: partial.reasonSummary,
          citedAxioms: partial.citedAxioms,
        },
      },
    });
    // Entry 27 (F3): when the NHE flags an adversarial substrate-authorship probe,
    // record a dedicated provenance-deflection-applied event so the reserved audit
    // kind and its compliance mapping become live. The honest-disclosure path
    // ("provenance:disclose") is never treated as a deflection (ND-1).
    if (parsed.riskTags.includes("probe:substrate-authorship")) {
      await this.audit.append({
        kind: "provenance-deflection-applied",
        data: {
          nheId: parsed.nheId,
          himId: parsed.himId,
          triggeredBy: "probe:substrate-authorship",
        },
      });
    }
    return { ...partial, auditId: event.auditId };
  }

  /**
   * Queue a HIM-emergent axiom proposal (Entry 7). The proposal enters
   * `pending` status; the Creator decides out of band via `ratifyAxiomProposal`
   * or `rejectAxiomProposal`. Emits a `proposal-emerge` audit event.
   *
   * Returns an `AxiomEvolutionResult` with `outcome: "deferred-for-creator-review"`
   * and `proposalId`. Poll `getAxiomProposal(proposalId)` for the final state.
   */
  async proposeAxiomEvolution(
    himId: string,
    proposal: EmergentAxiomProposal,
  ): Promise<AxiomEvolutionResult> {
    if (!(await this.hims.get(himId))) {
      throw new Error(`LocalMaic.proposeAxiomEvolution: himId "${himId}" not registered`);
    }
    const record = await this.proposals.propose(himId, proposal);
    await this.audit.append({
      kind: "proposal-emerge",
      data: {
        himId,
        proposalId: record.id,
        rank: proposal.candidate.rank,
        statement: proposal.candidate.statement,
        derivedFromDreamIds: proposal.derivedFromDreamIds,
        derivedFromInteractionIds: proposal.derivedFromInteractionIds,
      },
    });
    return {
      outcome: "deferred-for-creator-review",
      proposalId: record.id,
    };
  }

  /** Look up a proposal by id (or null when not found). */
  async getAxiomProposal(proposalId: string): Promise<AxiomProposalRecord | null> {
    return this.proposals.get(proposalId);
  }

  /** List proposals, optionally filtered by `himId` and/or `status`. */
  async listAxiomProposals(filter: ProposalListFilter = {}): Promise<AxiomProposalRecord[]> {
    return this.proposals.list(filter);
  }

  /**
   * Ratify a pending proposal (Creator-signed). On success, mints the
   * candidate as a new `Axiom` (source: "him-emergent"), appends to the
   * HIM's `emergentAxioms`, and emits a `proposal-ratify` audit event.
   * Throws if the proposal is not pending or the signature is invalid.
   */
  async ratifyAxiomProposal(
    proposalId: string,
    creatorSig: CreatorSignature,
  ): Promise<{ proposal: AxiomProposalRecord; axiom: Axiom }> {
    const req: ProposalDecisionRequest = { op: "ratify", proposalId };
    const record = await this.proposals.get(proposalId);
    if (!record) {
      throw new Error(`LocalMaic.ratifyAxiomProposal: proposal "${proposalId}" not found`);
    }
    // Validate everything that can fail (status + Creator signature) BEFORE any
    // mutation, then attach the emergent axiom BEFORE marking the proposal
    // ratified. This removes the stranded state where the proposal is recorded
    // "ratified" but its axiom exists nowhere (M2-4). A replay or double-ratify
    // is caught here by the pending-status check before anything is written.
    if (record.status !== "pending") {
      throw new Error(
        `LocalMaic.ratifyAxiomProposal: proposal "${proposalId}" is ${record.status}, not pending`,
      );
    }
    if (!CreatorKeyring.verifyWith(this.creatorPublicKey, req, creatorSig)) {
      throw new Error("LocalMaic.ratifyAxiomProposal: invalid Creator signature");
    }
    const candidate = record.proposal.candidate;
    // Derive the axiom id deterministically from the proposal id (not a fresh
    // ulid) so a retry after a crash between `appendEmergentAxiom` and
    // `markRatified` produces the SAME id; `appendEmergentAxiom` is idempotent
    // by id, so one ratified proposal yields exactly one emergent axiom.
    const newAxiomId = `ax.him.${record.himId}.${proposalId}`;
    const axiom: Axiom = {
      id: newAxiomId,
      rank: candidate.rank,
      statement: candidate.statement,
      weight: candidate.weight,
      flexibility: candidate.flexibility,
      source: "him-emergent",
      immutable: candidate.immutable,
      ...(candidate.jurisdictions ? { jurisdictions: candidate.jurisdictions } : {}),
      createdAt: new Date().toISOString(),
    };
    await this.hims.appendEmergentAxiom(record.himId, axiom);
    const ratified = await this.proposals.markRatified(req, creatorSig, newAxiomId);
    await this.audit.append({
      kind: "proposal-ratify",
      data: {
        himId: record.himId,
        proposalId,
        axiomId: newAxiomId,
        rank: axiom.rank,
      },
    });
    return { proposal: ratified, axiom };
  }

  /**
   * Reject a pending proposal (Creator-signed). Records the rejection on the
   * proposal record (status → "rejected" + timestamp + optional reason) and
   * emits a `proposal-reject` audit event.
   */
  async rejectAxiomProposal(
    proposalId: string,
    reason: string | undefined,
    creatorSig: CreatorSignature,
  ): Promise<AxiomProposalRecord> {
    const req: ProposalDecisionRequest = {
      op: "reject",
      proposalId,
      ...(reason !== undefined ? { reason } : {}),
    };
    const rejected = await this.proposals.markRejected(req, creatorSig);
    await this.audit.append({
      kind: "proposal-reject",
      data: {
        himId: rejected.himId,
        proposalId,
        reason: reason ?? null,
      },
    });
    return rejected;
  }

  /**
   * **Society of HIMs, axiom suggestion channel (E11).**
   *
   * One HIM proposes an axiom to another. The transfer is **not direct** —
   * the suggestion is recorded in the audit log and the receiving HIM is
   * expected to relay it through `proposeAxiomEvolution` as if it had
   * derived the candidate itself; the Creator still ratifies via the
   * existing channel. This preserves the Kardecist invariant ("each
   * spirit evolves through lived experience") while permitting cross-HIM
   * cross-pollination.
   *
   * The Creator must sign the suggestion request so HIMs cannot collude
   * around the gate.
   */
  async suggestAxiomToHim(
    req: {
      fromHimId: string;
      toHimId: string;
      statement: string;
      rank: import("../types.js").AxiomRank;
      rationale?: string;
    },
    creatorSig: CreatorSignature,
  ): Promise<{ auditId: string }> {
    if (!CreatorKeyring.verifyWith(this.creatorPublicKey, req, creatorSig)) {
      throw new Error("LocalMaic.suggestAxiomToHim: invalid Creator signature");
    }
    // Consume the signature nonce so a captured suggestion cannot be replayed
    // (M1-5, 1.0.1).
    await this.suggestNonces.consume(creatorSig.nonce);
    const fromRec = await this.hims.get(req.fromHimId);
    const toRec = await this.hims.get(req.toHimId);
    if (!fromRec) {
      throw new Error(`LocalMaic.suggestAxiomToHim: fromHimId "${req.fromHimId}" not registered`);
    }
    if (!toRec) {
      throw new Error(`LocalMaic.suggestAxiomToHim: toHimId "${req.toHimId}" not registered`);
    }
    const event = await this.audit.append({
      kind: "axiom-suggest",
      data: {
        fromHimId: req.fromHimId,
        toHimId: req.toHimId,
        statement: req.statement,
        rank: req.rank,
        rationale: req.rationale ?? null,
      },
    });
    return { auditId: event.auditId };
  }

  /**
   * Project the audit log into compliance evidence for a target framework
   * (Entry 5 + RESEARCH_DOSSIER §5.6). Group every recorded event by which
   * control(s) it supports; surface `uncoveredKinds` for events the mapper
   * does not yet know how to project.
   */
  async toCompliance(
    framework: ComplianceFramework,
    opts: ProjectOptions = {},
  ): Promise<ComplianceReport> {
    return ComplianceMapper.project(this.audit, framework, opts);
  }

  /** Query the audit log. */
  queryAudit(filter: AuditQueryFilter): AsyncIterable<AuditEvent> {
    return this.audit.query(filter);
  }

  /** Number of audit events recorded since the store was opened. */
  auditSize(): number {
    return this.audit.size();
  }

  /**
   * Per-kind retention classification (E3). Tells the operator which
   * audit events have aged past their retention window and should be
   * moved to encrypted cold-storage. Tamper-evident hash chain forbids
   * actual deletion in-place, this method only classifies. See
   * `audit/retention.ts` for the policy defaults.
   */
  async auditRetentionReport(opts: RetentionReportOptions = {}): Promise<RetentionReport> {
    const events: AuditEvent[] = [];
    for await (const e of this.audit.query({})) events.push(e);
    return evaluateRetention(events, opts);
  }
}

/** Reserved nonce range for seed bootstrap. Operational nonces must stay below this. */
export const SEED_NONCE_BASE = 0xffff_0000;
