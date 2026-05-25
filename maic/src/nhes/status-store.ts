import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CreatorKeyring } from "../creator/keyring.js";
import {
  NheStatusRecord,
  type CreatorSignature,
  type NheLifecycleRequest,
  type NheStatus,
} from "../types.js";

export interface NheStatusFilter {
  status?: NheStatus;
}

/**
 * NheStatusStore — persistent lifecycle status for NHEs (Entry 5).
 *
 * Unknown nheIds are implicitly "active". Status records are only persisted
 * when the Creator explicitly changes state via terminate / deprecate / reactivate.
 *
 * Disk layout: <storeDir>/nhes/<nheId>/status.json
 *
 * Mutations require a Creator signature over the canonical `NheLifecycleRequest`.
 */
export class NheStatusStore {
  private readonly dir: string;
  private cache = new Map<string, NheStatusRecord>();

  private constructor(
    private readonly storeDir: string,
    private readonly creatorPublicKey: string,
  ) {
    this.dir = join(storeDir, "nhes");
  }

  static async open(
    storeDir: string,
    creatorPublicKey: string,
  ): Promise<NheStatusStore> {
    const s = new NheStatusStore(storeDir, creatorPublicKey);
    await mkdir(s.dir, { recursive: true });
    await s.warmCache();
    return s;
  }

  /** Returns the persisted record, or null when the NHE was never altered (implicitly active). */
  async get(nheId: string): Promise<NheStatusRecord | null> {
    return this.cache.get(nheId) ?? null;
  }

  /** Resolved status — defaults to "active" when no record exists. */
  async resolve(nheId: string): Promise<NheStatus> {
    return (this.cache.get(nheId)?.status ?? "active") as NheStatus;
  }

  async list(filter: NheStatusFilter = {}): Promise<NheStatusRecord[]> {
    const all = [...this.cache.values()];
    return filter.status
      ? all.filter((r) => r.status === filter.status)
      : all;
  }

  async apply(
    req: NheLifecycleRequest,
    sig: CreatorSignature,
  ): Promise<NheStatusRecord> {
    if (!CreatorKeyring.verifyWith(this.creatorPublicKey, req, sig)) {
      throw new Error("NheStatusStore.apply: invalid Creator signature");
    }
    const current = this.cache.get(req.nheId);

    // Terminated is terminal — only Creator-signed reactivate can revive it.
    if (current?.status === "terminated" && req.op !== "reactivate") {
      throw new Error(
        `NheStatusStore.apply: nhe "${req.nheId}" is terminated; only reactivate may proceed`,
      );
    }

    const nextStatus: NheStatus =
      req.op === "terminate"
        ? "terminated"
        : req.op === "deprecate"
        ? "deprecated"
        : "active";

    if (current?.status === nextStatus) {
      // No-op: do not rewrite the record, but return the current snapshot for the caller.
      return current;
    }

    const record: NheStatusRecord = NheStatusRecord.parse({
      nheId: req.nheId,
      status: nextStatus,
      since: new Date().toISOString(),
      ...(req.reason !== undefined ? { reason: req.reason } : {}),
    });

    const nheDir = join(this.dir, req.nheId);
    await mkdir(nheDir, { recursive: true });
    await writeFile(
      join(nheDir, "status.json"),
      JSON.stringify(record, null, 2),
      "utf-8",
    );
    this.cache.set(req.nheId, record);
    return record;
  }

  // ─── internals ──────────────────────────────────────────────────────

  private async warmCache(): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(this.dir);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const nheId of entries) {
      try {
        const raw = await readFile(join(this.dir, nheId, "status.json"), "utf-8");
        const record = NheStatusRecord.parse(JSON.parse(raw));
        this.cache.set(record.nheId, record);
      } catch (err) {
        // Malformed NHE status directory — surface a warning so operators
        // see the corruption rather than dropping a lifecycle record
        // silently. We do NOT throw because that would block
        // `LocalMaic.open` for every other healthy NHE; the offending
        // nheId is left out of the cache (so subsequent `get`/`resolve`
        // will report it as implicitly "active") and operators can
        // investigate the directory on disk.
        // eslint-disable-next-line no-console
        console.warn(
          `NheStatusStore.warmCache: skipped malformed NHE "${nheId}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
