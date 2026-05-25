import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";
import type { DreamInductionIntent } from "../src/types";

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

const intent: DreamInductionIntent = {
  scenario: "Re-examine yesterday's buggy code; find the off-by-one.",
  desiredLearning: "Verify loop bounds before submitting.",
  inducedBy: "maic",
};

describe("LocalMaic — dream induction", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-induction-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  });

  it("induceDream queues a pending ticket and emits a dream-induce audit event", async () => {
    const ticket = await maic.induceDream("nhe-1", intent);
    expect(ticket.status).toBe("pending");
    expect(ticket.intent.scenario).toBe(intent.scenario);

    const events = await collect(maic.queryAudit({ kind: "dream-induce" }));
    expect(events).toHaveLength(1);
    expect((events[0]?.data as { nheId: string }).nheId).toBe("nhe-1");
  });

  it("listPendingInductions returns only pending tickets for the given NHE", async () => {
    const t1 = await maic.induceDream("nhe-1", intent);
    await maic.induceDream("nhe-2", intent);
    const t3 = await maic.induceDream("nhe-1", intent);
    await maic.consumeInduction(t1.id);

    const pending = await maic.listPendingInductions("nhe-1");
    expect(pending.map((t) => t.id)).toEqual([t3.id]);
  });

  it("consumeInduction transitions pending → consumed + emits audit", async () => {
    const t = await maic.induceDream("nhe-1", intent);
    const updated = await maic.consumeInduction(t.id);
    expect(updated.status).toBe("consumed");

    const events = await collect(maic.queryAudit({ kind: "dream-consume" }));
    expect(events).toHaveLength(1);
    expect((events[0]?.data as { ticketId: string }).ticketId).toBe(t.id);
  });

  it("cancelInduction transitions pending → cancelled with reason + emits audit", async () => {
    const t = await maic.induceDream("nhe-1", intent);
    const updated = await maic.cancelInduction(t.id, "deprecated path");
    expect(updated.status).toBe("cancelled");
    expect(updated.cancelReason).toBe("deprecated path");

    const events = await collect(maic.queryAudit({ kind: "dream-cancel" }));
    expect(events).toHaveLength(1);
    expect((events[0]?.data as { reason: string }).reason).toBe("deprecated path");
  });

  it("consume on a consumed ticket throws", async () => {
    const t = await maic.induceDream("nhe-1", intent);
    await maic.consumeInduction(t.id);
    await expect(maic.consumeInduction(t.id)).rejects.toThrow(/not pending|consumed/i);
  });

  it("cancel on a cancelled ticket throws", async () => {
    const t = await maic.induceDream("nhe-1", intent);
    await maic.cancelInduction(t.id);
    await expect(maic.cancelInduction(t.id)).rejects.toThrow(/not pending|cancelled/i);
  });

  it("inductions persist across MAIC reopen", async () => {
    const t = await maic.induceDream("nhe-persist", intent);
    const reopened = await LocalMaic.open({
      storeDir: dir,
      creatorPublicKey: kr.publicKey(),
    });
    const fetched = await reopened.getInduction(t.id);
    expect(fetched?.id).toBe(t.id);
    expect(fetched?.status).toBe("pending");
  });
});
