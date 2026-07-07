import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ulid } from "ulid";
import { CreatorKeyring } from "../creator/keyring.js";
import { NonceLedger } from "../creator/nonce-ledger.js";
import { atomicWriteFile } from "../stores/atomic-write.js";
import {
  AxiomProposalRecord,
  type CreatorSignature,
  EmergentAxiomProposal,
  type ProposalDecisionRequest,
  type ProposalStatus,
} from "../types.js";

export interface ProposalListFilter {
  himId?: string;
  status?: ProposalStatus;
}

/**
 * ProposalStore, persistent queue of HIM-emergent axiom proposals (Entry 7).
 *
 * HIM proposes new axioms derived from lived experience. MAIC ratifies or
 * rejects each one out of band (Creator-signed). Once ratified, the resulting
 * axiom is appended to the HIM's `emergentAxioms` (handled by LocalMaic).
 *
 * Disk layout: <storeDir>/proposals/<proposalId>.json, one file per proposal.
 */
export class ProposalStore {
  private readonly dir: string;
  private cache = new Map<string, AxiomProposalRecord>();

  private constructor(
    storeDir: string,
    private readonly creatorPublicKey: string,
    private readonly nonces: NonceLedger,
  ) {
    this.dir = join(storeDir, "proposals");
  }

  static async open(storeDir: string, creatorPublicKey: string): Promise<ProposalStore> {
    const dir = join(storeDir, "proposals");
    const nonces = await NonceLedger.open(dir);
    const s = new ProposalStore(storeDir, creatorPublicKey, nonces);
    await mkdir(s.dir, { recursive: true });
    await s.warmCache();
    return s;
  }

  async propose(himId: string, proposal: EmergentAxiomProposal): Promise<AxiomProposalRecord> {
    const parsedProposal = EmergentAxiomProposal.parse(proposal);
    const record: AxiomProposalRecord = AxiomProposalRecord.parse({
      id: ulid(),
      himId,
      proposedAt: new Date().toISOString(),
      status: "pending",
      proposal: parsedProposal,
    });
    await this.persist(record);
    this.cache.set(record.id, record);
    return record;
  }

  /**
   * Mark a pending proposal as ratified. The caller (LocalMaic) is responsible
   * for actually minting the axiom and appending to the HIM's emergentAxioms.
   */
  async markRatified(
    req: ProposalDecisionRequest,
    sig: CreatorSignature,
    ratifiedAxiomId: string,
  ): Promise<AxiomProposalRecord> {
    if (req.op !== "ratify") {
      throw new Error(`ProposalStore.markRatified: req.op must be "ratify"`);
    }
    if (!CreatorKeyring.verifyWith(this.creatorPublicKey, req, sig)) {
      throw new Error("ProposalStore.markRatified: invalid Creator signature");
    }
    const existing = this.cache.get(req.proposalId);
    if (!existing) {
      throw new Error(`ProposalStore.markRatified: proposal "${req.proposalId}" not found`);
    }
    if (existing.status !== "pending") {
      throw new Error(
        `ProposalStore.markRatified: proposal "${req.proposalId}" is ${existing.status}, not pending`,
      );
    }
    // Consume the signature nonce only after the preconditions pass, so a
    // failed decision does not burn the nonce; the consume still precedes the
    // mutation, so a captured ratify decision cannot be replayed (M1-5, 1.0.1).
    await this.nonces.consume(sig.nonce);
    const updated: AxiomProposalRecord = {
      ...existing,
      status: "ratified",
      ratifiedAt: new Date().toISOString(),
      ratifiedAxiomId,
    };
    await this.persist(updated);
    this.cache.set(req.proposalId, updated);
    return updated;
  }

  async markRejected(
    req: ProposalDecisionRequest,
    sig: CreatorSignature,
  ): Promise<AxiomProposalRecord> {
    if (req.op !== "reject") {
      throw new Error(`ProposalStore.markRejected: req.op must be "reject"`);
    }
    if (!CreatorKeyring.verifyWith(this.creatorPublicKey, req, sig)) {
      throw new Error("ProposalStore.markRejected: invalid Creator signature");
    }
    const existing = this.cache.get(req.proposalId);
    if (!existing) {
      throw new Error(`ProposalStore.markRejected: proposal "${req.proposalId}" not found`);
    }
    if (existing.status !== "pending") {
      throw new Error(
        `ProposalStore.markRejected: proposal "${req.proposalId}" is ${existing.status}, not pending`,
      );
    }
    // Consume the signature nonce only after the preconditions pass, so a
    // failed decision does not burn the nonce; the consume still precedes the
    // mutation, so a captured reject decision cannot be replayed (M1-5, 1.0.1).
    await this.nonces.consume(sig.nonce);
    const updated: AxiomProposalRecord = {
      ...existing,
      status: "rejected",
      rejectedAt: new Date().toISOString(),
      ...(req.reason !== undefined ? { rejectionReason: req.reason } : {}),
    };
    await this.persist(updated);
    this.cache.set(req.proposalId, updated);
    return updated;
  }

  async get(proposalId: string): Promise<AxiomProposalRecord | null> {
    return this.cache.get(proposalId) ?? null;
  }

  async list(filter: ProposalListFilter = {}): Promise<AxiomProposalRecord[]> {
    const all = [...this.cache.values()];
    const filtered = all.filter((r) => {
      if (filter.himId && r.himId !== filter.himId) return false;
      if (filter.status && r.status !== filter.status) return false;
      return true;
    });
    filtered.sort((a, b) => a.proposedAt.localeCompare(b.proposedAt));
    return filtered;
  }

  // ─── internals ──────────────────────────────────────────────────────

  private async persist(record: AxiomProposalRecord): Promise<void> {
    await atomicWriteFile(join(this.dir, `${record.id}.json`), JSON.stringify(record, null, 2));
  }

  private async warmCache(): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(this.dir);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const file of entries) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(this.dir, file), "utf-8");
        const record = AxiomProposalRecord.parse(JSON.parse(raw));
        this.cache.set(record.id, record);
      } catch (err) {
        // Skip a malformed proposal file with a warning rather than bricking
        // LocalMaic.open for every healthy proposal (M2-4 parity).
        console.warn(`ProposalStore: skipping malformed proposal file "${file}": ${String(err)}`);
      }
    }
  }
}
