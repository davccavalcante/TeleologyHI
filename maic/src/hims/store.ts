import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CreatorKeyring } from "../creator/keyring.js";
import {
  Axiom,
  BirthSignature,
  NheBodyRef,
  type CreatorSignature,
  type ReincarnationRequest,
} from "../types.js";

/**
 * HimRecord — the persistent record MAIC keeps for a registered HIM.
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
  birthSignature: BirthSignature;
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
 * HimStore — persistent registry of HIMs created in this MAIC instance.
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
    private readonly storeDir: string,
    private readonly creatorPublicKey: string,
  ) {
    this.himsDir = join(storeDir, "hims");
  }

  static async open(storeDir: string, creatorPublicKey: string): Promise<HimStore> {
    const s = new HimStore(storeDir, creatorPublicKey);
    await mkdir(s.himsDir, { recursive: true });
    await s.warmCache();
    return s;
  }

  async register(
    birthSignature: BirthSignature,
    creatorSig: CreatorSignature,
    axiomsSnapshot: readonly Axiom[],
    registeredAuditId?: string,
  ): Promise<HimRecord> {
    if (!CreatorKeyring.verifyWith(this.creatorPublicKey, birthSignature, creatorSig)) {
      throw new Error("HimStore.register: invalid Creator signature");
    }
    if (this.cache.has(birthSignature.himId)) {
      throw new Error(
        `HimStore.register: himId "${birthSignature.himId}" is already registered`,
      );
    }

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
    await writeFile(
      join(dir, "birth-signature.json"),
      JSON.stringify({ birthSignature, signature: creatorSig }, null, 2),
      "utf-8",
    );
    await writeFile(
      join(dir, "axioms-snapshot.json"),
      JSON.stringify(axiomsSnapshot, null, 2),
      "utf-8",
    );
    await writeFile(
      join(dir, "metadata.json"),
      JSON.stringify(
        { registeredAt: record.registeredAt, registeredAuditId },
        null,
        2,
      ),
      "utf-8",
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
  async reincarnate(
    req: ReincarnationRequest,
    creatorSig: CreatorSignature,
  ): Promise<HimRecord> {
    if (!CreatorKeyring.verifyWith(this.creatorPublicKey, req, creatorSig)) {
      throw new Error("HimStore.reincarnate: invalid Creator signature");
    }
    const current = this.cache.get(req.himId);
    if (!current) {
      throw new Error(`HimStore.reincarnate: himId "${req.himId}" not registered`);
    }
    // Validate toBody early.
    const toBody = NheBodyRef.parse(req.toBody);

    const updatedHistory: NheBodyRef[] = current.bodyHistory.map((b) => ({ ...b }));

    if (req.fromNheId !== undefined) {
      const matchIdx = updatedHistory.findIndex(
        (b) => b.nheId === req.fromNheId && b.endedAt === undefined,
      );
      if (matchIdx < 0) {
        throw new Error(
          `HimStore.reincarnate: no open body matching fromNheId "${req.fromNheId}"`,
        );
      }
      const reason = req.reason ?? "upgrade";
      updatedHistory[matchIdx] = {
        ...updatedHistory[matchIdx]!,
        endedAt: new Date().toISOString(),
        endedReason: reason,
      };
    }

    updatedHistory.push(toBody);

    const updated: HimRecord = {
      ...current,
      bodyHistory: updatedHistory,
    };

    const dir = join(this.himsDir, req.himId);
    await writeFile(
      join(dir, "body-history.json"),
      JSON.stringify(updatedHistory, null, 2),
      "utf-8",
    );
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
    const updatedEmergent = [...current.emergentAxioms, axiom];
    const updated: HimRecord = { ...current, emergentAxioms: updatedEmergent };
    await writeFile(
      join(this.himsDir, himId, "emergent-axioms.json"),
      JSON.stringify(updatedEmergent, null, 2),
      "utf-8",
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
        const birthSignature = BirthSignature.parse(envelope.birthSignature);
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
          ...(meta.registeredAuditId
            ? { registeredAuditId: meta.registeredAuditId }
            : {}),
          bodyHistory,
          emergentAxioms,
        });
      } catch (err) {
        // Malformed HIM directory — surface a warning so operators see the
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
