import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { CreatorKeyring } from "../creator/keyring.js";
import { NonceLedger } from "../creator/nonce-ledger.js";
import { atomicWriteFile } from "../stores/atomic-write.js";
import {
  Axiom,
  BirthSignatureWithIdentity,
  type CreatorSignature,
  NheBodyRef,
  type ReincarnationRequest,
} from "../types.js";

/**
 * HimRecord, the persistent record MAIC keeps for a registered HIM.
 *
 * Per Entry 3 (Creator interview), HIM is born with a fixed signature and
 * inherits an axiom snapshot from MAIC at the moment of registration. Future
 * axiom mints in MAIC do NOT retroactively change a HIM's snapshot.
 *
 * Per Entry 4, when an NHE upgrades, the same HIM is re-embodied. The
 * `bodyHistory` records each body that has hosted this HIM in order, with the
 * previous body's `endedAt`/`endedReason` set at the moment of reincarnation.
 */
export interface HimRecord {
  himId: string;
  birthSignature: BirthSignatureWithIdentity;
  axiomsSnapshot: readonly Axiom[];
  registeredAt: string;
  registeredAuditId?: string;
  /** Bodies that have hosted this HIM, oldest first. Empty until first reincarnation. */
  bodyHistory: readonly NheBodyRef[];
  /**
   * Emergent axioms ratified post-birth (Entry 7). `axiomsSnapshot` is frozen
   * at registration; `emergentAxioms` grows as MAIC ratifies HIM-self proposals.
   * Empty until the first ratification.
   */
  emergentAxioms: readonly Axiom[];
}

/**
 * HimStore, persistent registry of HIMs created in this MAIC instance.
 *
 * Storage layout (under <storeDir>):
 *   hims/<himId>/birth-signature.json    (signed envelope)
 *   hims/<himId>/axioms-snapshot.json    (array of Axiom)
 *   hims/<himId>/metadata.json           (registeredAt, registeredAuditId)
 *   hims/<himId>/body-history.json       (array of NheBodyRef; absent before first reincarnation)
 *
 * Registration requires a valid Creator signature over the BirthSignature.
 * Reincarnation requires a valid Creator signature over the ReincarnationRequest.
 */
export class HimStore {
  private readonly himsDir: string;
  private cache = new Map<string, HimRecord>();

  private constructor(
    storeDir: string,
    private readonly creatorPublicKey: string,
    private readonly nonces: NonceLedger,
  ) {
    this.himsDir = join(storeDir, "hims");
  }

  static async open(storeDir: string, creatorPublicKey: string): Promise<HimStore> {
    const himsDir = join(storeDir, "hims");
    const nonces = await NonceLedger.open(himsDir);
    const s = new HimStore(storeDir, creatorPublicKey, nonces);
    await mkdir(s.himsDir, { recursive: true });
    await s.warmCache();
    return s;
  }

  /**
   * Validate that a birth signature is registerable (valid Creator signature,
   * himId not already taken) WITHOUT persisting anything or touching the audit
   * chain. `LocalMaic.registerHim` calls this before it appends the
   * `him-register` audit event, so a rejected registration never pollutes the
   * tamper-evident log (M1-1, 1.0.1). `register` re-runs the same checks, so it
   * remains safe to call directly.
   */
  assertRegisterable(
    birthSignature: BirthSignatureWithIdentity,
    creatorSig: CreatorSignature,
  ): void {
    if (!CreatorKeyring.verifyWith(this.creatorPublicKey, birthSignature, creatorSig)) {
      throw new Error("HimStore.register: invalid Creator signature");
    }
    if (this.cache.has(birthSignature.himId)) {
      throw new Error(`HimStore.register: himId "${birthSignature.himId}" is already registered`);
    }
  }

  async register(
    birthSignature: BirthSignatureWithIdentity,
    creatorSig: CreatorSignature,
    axiomsSnapshot: readonly Axiom[],
    registeredAuditId?: string,
  ): Promise<HimRecord> {
    this.assertRegisterable(birthSignature, creatorSig);

    const record: HimRecord = {
      himId: birthSignature.himId,
      birthSignature,
      axiomsSnapshot: [...axiomsSnapshot],
      registeredAt: new Date().toISOString(),
      ...(registeredAuditId !== undefined ? { registeredAuditId } : {}),
      bodyHistory: [],
      emergentAxioms: [],
    };

    const dir = join(this.himsDir, birthSignature.himId);
    await mkdir(dir, { recursive: true });
    await atomicWriteFile(
      join(dir, "birth-signature.json"),
      JSON.stringify({ birthSignature, signature: creatorSig }, null, 2),
    );
    await atomicWriteFile(
      join(dir, "axioms-snapshot.json"),
      JSON.stringify(axiomsSnapshot, null, 2),
    );
    await atomicWriteFile(
      join(dir, "metadata.json"),
      JSON.stringify({ registeredAt: record.registeredAt, registeredAuditId }, null, 2),
    );

    this.cache.set(birthSignature.himId, record);
    return record;
  }

  /**
   * Atomically transition a HIM into a new NHE body (Entry 4):
   *   - If req.fromNheId is provided AND matches the last body still open,
   *     that entry gets `endedAt: now` + `endedReason: req.reason ?? "upgrade"`.
   *   - The new body (`req.toBody`) is appended.
   *   - Persisted to body-history.json atomically.
   *
   * Requires a Creator signature over the canonical request payload.
   */
  async reincarnate(req: ReincarnationRequest, creatorSig: CreatorSignature): Promise<HimRecord> {
    if (!CreatorKeyring.verifyWith(this.creatorPublicKey, req, creatorSig)) {
      throw new Error("HimStore.reincarnate: invalid Creator signature");
    }
    const current = this.cache.get(req.himId);
    if (!current) {
      throw new Error(`HimStore.reincarnate: himId "${req.himId}" not registered`);
    }
    // Validate toBody early.
    const toBody = NheBodyRef.parse(req.toBody);

    // Consume the signature nonce after the retriable preconditions (a
    // not-registered himId or an invalid toBody throw above, so they do not burn
    // the nonce and the request can be retried once fixed) and before the
    // mutation, so a captured request cannot be replayed: a same-request replay
    // is rejected here as an already-used nonce (M1-5, 1.0.1).
    await this.nonces.consume(creatorSig.nonce);

    const updatedHistory: NheBodyRef[] = current.bodyHistory.map((b) => ({ ...b }));

    if (req.fromNheId !== undefined) {
      const matchIdx = updatedHistory.findIndex(
        (b) => b.nheId === req.fromNheId && b.endedAt === undefined,
      );
      if (matchIdx < 0) {
        throw new Error(`HimStore.reincarnate: no open body matching fromNheId "${req.fromNheId}"`);
      }
      const reason = req.reason ?? "upgrade";
      updatedHistory[matchIdx] = {
        ...updatedHistory[matchIdx]!,
        endedAt: new Date().toISOString(),
        endedReason: reason,
      };
    }

    // Reject reincarnating into a body id that is already open, so the same
    // NHE body cannot be double-registered under one HIM (M1-5, 1.0.1).
    if (updatedHistory.some((b) => b.nheId === toBody.nheId && b.endedAt === undefined)) {
      throw new Error(
        `HimStore.reincarnate: toBody nheId "${toBody.nheId}" already has an open body`,
      );
    }

    updatedHistory.push(toBody);

    const updated: HimRecord = {
      ...current,
      bodyHistory: updatedHistory,
    };

    const dir = join(this.himsDir, req.himId);
    await atomicWriteFile(join(dir, "body-history.json"), JSON.stringify(updatedHistory, null, 2));
    this.cache.set(req.himId, updated);
    return updated;
  }

  /**
   * Append a ratified emergent axiom to the HIM's `emergentAxioms` (Entry 7).
   * Called by LocalMaic after a Creator-signed `ratifyAxiomProposal`.
   * Persists `<himId>/emergent-axioms.json` atomically.
   */
  async appendEmergentAxiom(himId: string, axiom: Axiom): Promise<HimRecord> {
    const current = this.cache.get(himId);
    if (!current) {
      throw new Error(`HimStore.appendEmergentAxiom: himId "${himId}" not registered`);
    }
    // Idempotent by axiom id: a crash between this append and the proposal being
    // marked ratified can retry with the same deterministic axiom id, so skip a
    // re-append and one ratified proposal yields exactly one emergent axiom.
    if (current.emergentAxioms.some((a) => a.id === axiom.id)) {
      return current;
    }
    const updatedEmergent = [...current.emergentAxioms, axiom];
    const updated: HimRecord = { ...current, emergentAxioms: updatedEmergent };
    await atomicWriteFile(
      join(this.himsDir, himId, "emergent-axioms.json"),
      JSON.stringify(updatedEmergent, null, 2),
    );
    this.cache.set(himId, updated);
    return updated;
  }

  async get(himId: string): Promise<HimRecord | null> {
    return this.cache.get(himId) ?? null;
  }

  async list(): Promise<HimRecord[]> {
    return [...this.cache.values()];
  }

  // ─── internals ──────────────────────────────────────────────────────

  private async warmCache(): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(this.himsDir);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const himId of entries) {
      const dir = join(this.himsDir, himId);
      const sigPath = join(dir, "birth-signature.json");
      const axiomsPath = join(dir, "axioms-snapshot.json");
      const metaPath = join(dir, "metadata.json");
      const historyPath = join(dir, "body-history.json");
      const emergentPath = join(dir, "emergent-axioms.json");
      try {
        const sigRaw = await readFile(sigPath, "utf-8");
        const axiomsRaw = await readFile(axiomsPath, "utf-8");
        const metaRaw = await readFile(metaPath, "utf-8");
        const envelope = JSON.parse(sigRaw);
        const axioms = JSON.parse(axiomsRaw);
        const meta = JSON.parse(metaRaw);
        const birthSignature = BirthSignatureWithIdentity.parse(envelope.birthSignature);
        const axiomsSnapshot = Axiom.array().parse(axioms);
        let bodyHistory: NheBodyRef[] = [];
        try {
          const historyRaw = await readFile(historyPath, "utf-8");
          bodyHistory = NheBodyRef.array().parse(JSON.parse(historyRaw));
        } catch (err: unknown) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        }
        let emergentAxioms: Axiom[] = [];
        try {
          const emergentRaw = await readFile(emergentPath, "utf-8");
          emergentAxioms = Axiom.array().parse(JSON.parse(emergentRaw));
        } catch (err: unknown) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        }
        this.cache.set(birthSignature.himId, {
          himId: birthSignature.himId,
          birthSignature,
          axiomsSnapshot,
          registeredAt: meta.registeredAt,
          ...(meta.registeredAuditId ? { registeredAuditId: meta.registeredAuditId } : {}),
          bodyHistory,
          emergentAxioms,
        });
      } catch (err) {
        // Malformed HIM directory, surface a warning so operators see the
        // corruption rather than silently dropping a HIM record. We do NOT
        // throw here because that would block `LocalMaic.open` for every
        // other healthy HIM; instead the offending himId is left out of the
        // cache (so subsequent `get`/`list` won't return it) and an
        // operator can investigate the directory on disk.
        // eslint-disable-next-line no-console
        console.warn(
          `HimStore.warmCache: skipped malformed HIM "${himId}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
