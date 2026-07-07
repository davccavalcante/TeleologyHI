import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ulid } from "ulid";
import { atomicWriteFile } from "../stores/atomic-write.js";
import { DreamInductionIntent, DreamInductionTicket, type InductionStatus } from "../types.js";

export interface ListFilter {
  nheId?: string;
  status?: InductionStatus;
}

/**
 * InductionStore, persistent queue of dream induction tickets (Entry 2).
 *
 * MAIC creates tickets ("induce this scenario into NHE X's next REM dream").
 * NHE consumes them on its next sleep cycle. Cancelled tickets remain on disk
 * for audit but are filtered out of `listPending`.
 *
 * Disk layout: <storeDir>/inductions/<ticketId>.json, one file per ticket.
 */
export class InductionStore {
  private readonly dir: string;
  private cache = new Map<string, DreamInductionTicket>();

  private constructor(storeDir: string) {
    this.dir = join(storeDir, "inductions");
  }

  static async open(storeDir: string): Promise<InductionStore> {
    const s = new InductionStore(storeDir);
    await mkdir(s.dir, { recursive: true });
    await s.warmCache();
    return s;
  }

  async induce(nheId: string, intent: DreamInductionIntent): Promise<DreamInductionTicket> {
    const parsedIntent = DreamInductionIntent.parse(intent);
    const ticket: DreamInductionTicket = DreamInductionTicket.parse({
      id: ulid(),
      nheId,
      intent: parsedIntent,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    await this.persist(ticket);
    this.cache.set(ticket.id, ticket);
    return ticket;
  }

  async consume(ticketId: string): Promise<DreamInductionTicket> {
    const existing = this.cache.get(ticketId);
    if (!existing) {
      throw new Error(`InductionStore.consume: ticket "${ticketId}" not found`);
    }
    if (existing.status !== "pending") {
      throw new Error(
        `InductionStore.consume: ticket "${ticketId}" is ${existing.status}, not pending`,
      );
    }
    const updated: DreamInductionTicket = {
      ...existing,
      status: "consumed",
      consumedAt: new Date().toISOString(),
    };
    await this.persist(updated);
    this.cache.set(ticketId, updated);
    return updated;
  }

  async cancel(ticketId: string, reason?: string): Promise<DreamInductionTicket> {
    const existing = this.cache.get(ticketId);
    if (!existing) {
      throw new Error(`InductionStore.cancel: ticket "${ticketId}" not found`);
    }
    if (existing.status !== "pending") {
      throw new Error(
        `InductionStore.cancel: ticket "${ticketId}" is already ${existing.status}, not pending`,
      );
    }
    const updated: DreamInductionTicket = {
      ...existing,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      ...(reason !== undefined ? { cancelReason: reason } : {}),
    };
    await this.persist(updated);
    this.cache.set(ticketId, updated);
    return updated;
  }

  async get(ticketId: string): Promise<DreamInductionTicket | null> {
    return this.cache.get(ticketId) ?? null;
  }

  async list(filter: ListFilter): Promise<DreamInductionTicket[]> {
    const all = [...this.cache.values()];
    const filtered = all.filter((t) => {
      if (filter.nheId && t.nheId !== filter.nheId) return false;
      if (filter.status && t.status !== filter.status) return false;
      return true;
    });
    filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return filtered;
  }

  /** Convenience: pending tickets for the given NHE, oldest first. */
  async listPending(nheId: string): Promise<DreamInductionTicket[]> {
    return this.list({ nheId, status: "pending" });
  }

  // ─── internals ──────────────────────────────────────────────────────

  private async persist(ticket: DreamInductionTicket): Promise<void> {
    await atomicWriteFile(join(this.dir, `${ticket.id}.json`), JSON.stringify(ticket, null, 2));
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
        const ticket = DreamInductionTicket.parse(JSON.parse(raw));
        this.cache.set(ticket.id, ticket);
      } catch (err) {
        // Skip a malformed ticket file with a warning rather than bricking
        // LocalMaic.open for every healthy ticket (M2-4 parity).
        console.warn(`InductionStore: skipping malformed ticket file "${file}": ${String(err)}`);
      }
    }
  }
}
