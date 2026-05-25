import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InductionStore } from "../src/inductions/store";
import type { DreamInductionIntent } from "../src/types";

const intent: DreamInductionIntent = {
  scenario: "Re-examine yesterday's buggy code; find the off-by-one.",
  desiredLearning: "Verify loop bounds before submitting.",
  inducedBy: "maic",
};

describe("InductionStore", () => {
  let dir: string;
  let store: InductionStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-induction-"));
    store = await InductionStore.open(dir);
  });

  it("starts empty", async () => {
    expect(await store.list({})).toEqual([]);
  });

  it("induces a dream ticket with status=pending and a ULID id", async () => {
    const t = await store.induce("nhe-1", intent);
    expect(t.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(t.nheId).toBe("nhe-1");
    expect(t.status).toBe("pending");
    expect(t.intent).toEqual(intent);
    expect(t.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("listPending filters by nheId and excludes consumed/cancelled", async () => {
    const t1 = await store.induce("nhe-1", intent);
    await store.induce("nhe-2", intent);
    await store.induce("nhe-1", intent);
    await store.consume(t1.id);

    const pendingNhe1 = await store.listPending("nhe-1");
    expect(pendingNhe1).toHaveLength(1);
    expect(pendingNhe1[0]?.status).toBe("pending");
    expect(pendingNhe1[0]?.id).not.toBe(t1.id);
  });

  it("consume marks a ticket as consumed with a timestamp", async () => {
    const t = await store.induce("nhe-1", intent);
    const consumed = await store.consume(t.id);
    expect(consumed.status).toBe("consumed");
    expect(consumed.consumedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("cancel marks a ticket as cancelled with a reason", async () => {
    const t = await store.induce("nhe-1", intent);
    const cancelled = await store.cancel(t.id, "no longer relevant");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(cancelled.cancelReason).toBe("no longer relevant");
  });

  it("consume on a non-pending ticket throws", async () => {
    const t = await store.induce("nhe-1", intent);
    await store.consume(t.id);
    await expect(store.consume(t.id)).rejects.toThrow(/already|not pending/i);
  });

  it("cancel on a non-pending ticket throws", async () => {
    const t = await store.induce("nhe-1", intent);
    await store.consume(t.id);
    await expect(store.cancel(t.id)).rejects.toThrow(/already|not pending/i);
  });

  it("get returns null for an unknown ticket id", async () => {
    expect(await store.get("does-not-exist")).toBeNull();
  });

  it("persists tickets across reopen", async () => {
    const t = await store.induce("nhe-persist", intent);
    const reopened = await InductionStore.open(dir);
    const fetched = await reopened.get(t.id);
    expect(fetched?.id).toBe(t.id);
    expect(fetched?.status).toBe("pending");
    await rm(dir, { recursive: true, force: true });
  });

  it("listPending returns tickets in chronological order (oldest first)", async () => {
    const a = await store.induce("nhe-x", intent);
    await new Promise((r) => setTimeout(r, 2));
    const b = await store.induce("nhe-x", intent);
    await new Promise((r) => setTimeout(r, 2));
    const c = await store.induce("nhe-x", intent);

    const pending = await store.listPending("nhe-x");
    expect(pending.map((t) => t.id)).toEqual([a.id, b.id, c.id]);
  });
});
