import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { monotonicFactory } from "ulid";
import type { InteractionRecord } from "../sleep/types.js";

// Monotonic per-process: ULIDs generated within the same millisecond are
// guaranteed to compare in call order. Without this, lexicographic sort would
// not match chronology when multiple interactions land in the same ms.
const nextUlid = monotonicFactory();

/**
 * InteractionStore, append-only persistent log of NHE ↔ user exchanges.
 *
 * Without this, the NHE's `recentInteractions` buffer is RAM-only and is lost
 * on process restart. That breaks the cosmology: HIM (the spirit) persists in
 * MAIC, but its lived experience evaporates every crash.
 *
 * Disk layout: `<storeDir>/interactions/<ulid>.json`, one file per exchange.
 * ULID ordering matches chronology, so `loadMostRecent` is a lexicographic
 * tail-slice without any extra index.
 *
 * Retention: nothing is pruned on disk. The RAM buffer in `Nhe` is capped via
 * `recentInteractionsBufferSize` (default 32). For long-running deployments,
 * a retention/rotation policy can be layered without changing the public API.
 */
export class InteractionStore {
  private constructor(private readonly dir: string) {}

  static async open(storeDir: string): Promise<InteractionStore> {
    const dir = join(storeDir, "interactions");
    await mkdir(dir, { recursive: true });
    return new InteractionStore(dir);
  }

  async append(record: InteractionRecord): Promise<void> {
    const id = nextUlid();
    await writeFile(join(this.dir, `${id}.json`), JSON.stringify(record, null, 2), "utf-8");
  }

  async loadMostRecent(limit: number): Promise<InteractionRecord[]> {
    if (limit <= 0) return [];
    let entries: string[];
    try {
      entries = await readdir(this.dir);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const sorted = entries
      .filter((f) => f.endsWith(".json"))
      .sort()
      .slice(-limit);
    const out: InteractionRecord[] = [];
    for (const file of sorted) {
      try {
        const raw = await readFile(join(this.dir, file), "utf-8");
        out.push(JSON.parse(raw) as InteractionRecord);
      } catch {
        // Skip malformed entries silently, consistent with HimStore.warmCache.
      }
    }
    return out;
  }
}
