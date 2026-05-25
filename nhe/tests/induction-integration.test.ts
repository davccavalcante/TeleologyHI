import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { BirthSignatureBuilder, HimHandle } from "@teleologyhi-sdk/him";
import { Nhe } from "../src/nhe";
import { MockAdapter } from "../src/adapters/mock";

async function bootstrap(nheId: string) {
  const storeDir = await mkdtemp(join(tmpdir(), "nhe-induction-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const sig = BirthSignatureBuilder.now().withPrimaryArchetype("aries-sun").build();
  const him = HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), await maic.listAxioms());

  let lastSystem = "";
  let lastUser = "";
  const adapter = new MockAdapter({
    reply: (req) => {
      lastSystem = req.system;
      lastUser = req.messages[0]?.content ?? "";
      return "Reflective dream about pacing.\nTELEOLOGICAL_VALUE: 0.72";
    },
  });

  const nhe = new Nhe({
    himHandle: him,
    maicClient: maic,
    llmAdapter: adapter,
    nheId,
    storeDir: await mkdtemp(join(tmpdir(), "nhe-store-")),
  });

  return {
    maic,
    nhe,
    adapter,
    capturedSystem: () => lastSystem,
    capturedUser: () => lastUser,
  };
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe("NHE auto-consumes pending MAIC induction tickets on sleep", () => {
  it("a pending ticket steers REM and is consumed after the cycle", async () => {
    const { maic, nhe } = await bootstrap("nhe-induct-1");

    await maic.induceDream("nhe-induct-1", {
      scenario: "Re-examine the off-by-one bug from yesterday.",
      desiredLearning: "Verify loop bounds.",
      inducedBy: "maic",
    });

    const result = await nhe.sleep();

    const rem = result.record.phases.find((p) => p.phase === "REM")!;
    expect(rem.content.kind).toBe("dreams");
    if (rem.content.kind === "dreams") {
      expect(rem.content.dreams[0]?.induced).toBe(true);
      expect(rem.content.dreams[0]?.inducedBy).toBe("maic");
    }

    expect(result.record.metadata.triggerKind).toBe("maic-induced");

    // Ticket was consumed
    const stillPending = await maic.listPendingInductions("nhe-induct-1");
    expect(stillPending).toHaveLength(0);

    // Audit emits dream-induce (initial) AND dream-consume (after sleep)
    const consumeEvents = await collect(maic.queryAudit({ kind: "dream-consume" }));
    expect(consumeEvents).toHaveLength(1);
  });

  it("tickets for OTHER NHEs are not consumed", async () => {
    const { maic, nhe } = await bootstrap("nhe-self");

    await maic.induceDream("nhe-other", {
      scenario: "x",
      desiredLearning: "y",
      inducedBy: "maic",
    });

    await nhe.sleep();

    const stillPending = await maic.listPendingInductions("nhe-other");
    expect(stillPending).toHaveLength(1);
  });

  it("oldest pending ticket wins when multiple exist", async () => {
    const { maic, nhe, capturedUser } = await bootstrap("nhe-fifo");

    const first = await maic.induceDream("nhe-fifo", {
      scenario: "FIRST scenario for oldest-first verification.",
      desiredLearning: "First.",
      inducedBy: "maic",
    });
    await new Promise((r) => setTimeout(r, 5));
    await maic.induceDream("nhe-fifo", {
      scenario: "SECOND scenario.",
      desiredLearning: "Second.",
      inducedBy: "maic",
    });

    await nhe.sleep();

    expect(capturedUser()).toContain("FIRST scenario");

    const consumeEvents = await collect(maic.queryAudit({ kind: "dream-consume" }));
    expect(consumeEvents).toHaveLength(1);
    expect((consumeEvents[0]?.data as { ticketId: string }).ticketId).toBe(first.id);

    // The SECOND ticket remains pending
    const stillPending = await maic.listPendingInductions("nhe-fifo");
    expect(stillPending).toHaveLength(1);
  });

  it("explicit opts.induction wins over a pending ticket (caller override)", async () => {
    const { maic, nhe, capturedUser } = await bootstrap("nhe-override");

    await maic.induceDream("nhe-override", {
      scenario: "Pending ticket scenario — should NOT be used.",
      desiredLearning: "should not appear",
      inducedBy: "maic",
    });

    await nhe.sleep(
      { kind: "creator-induced" },
      {
        induction: {
          scenario: "EXPLICIT override scenario.",
          desiredLearning: "wins",
          inducedBy: "creator",
        },
      },
    );

    expect(capturedUser()).toContain("EXPLICIT override scenario");

    // Pending ticket should still be pending (NOT consumed)
    const stillPending = await maic.listPendingInductions("nhe-override");
    expect(stillPending).toHaveLength(1);
  });

  it("no pending ticket and no explicit induction → baseline sleep (no induction)", async () => {
    const { nhe } = await bootstrap("nhe-baseline");
    const result = await nhe.sleep();
    const rem = result.record.phases.find((p) => p.phase === "REM")!;
    if (rem.content.kind === "dreams") {
      expect(rem.content.dreams[0]?.induced).toBe(false);
      expect(rem.content.dreams[0]?.inducedBy).toBeNull();
    }
    expect(result.record.metadata.triggerKind).toBe("explicit");
  });
});
