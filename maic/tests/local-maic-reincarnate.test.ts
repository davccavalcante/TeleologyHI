import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";
import type { BirthSignature, NheBodyRef, ReincarnationRequest } from "../src/types";

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

const bsig = (id: string): BirthSignature => ({
  himId: id,
  bornAt: new Date().toISOString(),
  primaryArchetype: "aries-sun",
  modifiers: [],
  primordialAxiomIds: [],
});

const body = (nheId: string, llmAdapter = "anthropic:claude-sonnet-4-6"): NheBodyRef => ({
  nheId,
  llmAdapter,
  embodiedAt: new Date().toISOString(),
});

describe("LocalMaic.reincarnateHim", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-reinc-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    const sig = bsig("him.r");
    await maic.registerHim(sig, kr.sign(sig, 1));
  });

  it("first reincarnation: appends body and emits him-reincarnate audit", async () => {
    const req: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-1") };
    const updated = await maic.reincarnateHim(req, kr.sign(req, 2));
    expect(updated.bodyHistory).toHaveLength(1);
    expect(updated.bodyHistory[0]?.nheId).toBe("nhe-1");

    const events = await collect(maic.queryAudit({ kind: "him-reincarnate" }));
    expect(events).toHaveLength(1);
    const data = events[0]?.data as { himId: string; toNheId: string; fromNheId: string | null };
    expect(data.himId).toBe("him.r");
    expect(data.toNheId).toBe("nhe-1");
    expect(data.fromNheId).toBeNull();
  });

  it("subsequent reincarnation: closes previous, appends new, emits audit with both ids", async () => {
    const r1: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-1") };
    await maic.reincarnateHim(r1, kr.sign(r1, 2));

    const r2: ReincarnationRequest = {
      himId: "him.r",
      fromNheId: "nhe-1",
      toBody: body("nhe-2", "anthropic:claude-sonnet-4-7"),
      reason: "upgrade",
    };
    const updated = await maic.reincarnateHim(r2, kr.sign(r2, 3));
    expect(updated.bodyHistory).toHaveLength(2);
    expect(updated.bodyHistory[0]?.endedAt).toBeTruthy();
    expect(updated.bodyHistory[0]?.endedReason).toBe("upgrade");
    expect(updated.bodyHistory[1]?.nheId).toBe("nhe-2");

    const events = await collect(maic.queryAudit({ kind: "him-reincarnate" }));
    expect(events).toHaveLength(2);
    const last = events[1]?.data as { fromNheId: string; toNheId: string; reason: string };
    expect(last.fromNheId).toBe("nhe-1");
    expect(last.toNheId).toBe("nhe-2");
    expect(last.reason).toBe("upgrade");
  });

  it("rejects invalid Creator signature", async () => {
    const impostor = CreatorKeyring.generate();
    const req: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-x") };
    await expect(maic.reincarnateHim(req, impostor.sign(req, 99))).rejects.toThrow(/signature/i);
    const events = await collect(maic.queryAudit({ kind: "him-reincarnate" }));
    expect(events).toHaveLength(0);
  });

  it("rejects when fromNheId does not match any open body", async () => {
    const req: ReincarnationRequest = {
      himId: "him.r",
      fromNheId: "nhe-missing",
      toBody: body("nhe-x"),
    };
    await expect(maic.reincarnateHim(req, kr.sign(req, 2))).rejects.toThrow(/no open body/i);
  });

  it("bodyHistory persists after MAIC reopen", async () => {
    const r1: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-1") };
    await maic.reincarnateHim(r1, kr.sign(r1, 2));
    const r2: ReincarnationRequest = {
      himId: "him.r",
      fromNheId: "nhe-1",
      toBody: body("nhe-2"),
    };
    await maic.reincarnateHim(r2, kr.sign(r2, 3));

    const reopened = await LocalMaic.open({
      storeDir: dir,
      creatorPublicKey: kr.publicKey(),
    });
    const got = await reopened.getHimRecord("him.r");
    expect(got?.bodyHistory).toHaveLength(2);
    expect(got?.bodyHistory[1]?.nheId).toBe("nhe-2");
  });

  describe("lifecycle plumbing (J-H3, F6+F7 from 2026-05-24 him audit)", () => {
    it("emits the typed `reincarnate:model-swap` kind when opts.lifecycle is supplied", async () => {
      const req: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-1") };
      await maic.reincarnateHim(req, kr.sign(req, 2), { lifecycle: "model-swap" });

      const typed = await collect(maic.queryAudit({ kind: "reincarnate:model-swap" }));
      expect(typed).toHaveLength(1);
      const data = typed[0]?.data as { himId: string; toNheId: string; lifecycle: string };
      expect(data.himId).toBe("him.r");
      expect(data.toNheId).toBe("nhe-1");
      expect(data.lifecycle).toBe("model-swap");

      // Generic kind must NOT have fired, the typed kind replaces it.
      const generic = await collect(maic.queryAudit({ kind: "him-reincarnate" }));
      expect(generic).toHaveLength(0);
    });

    it("emits `reincarnate:version-bump` and includes the lifecycle in data", async () => {
      const req: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-1") };
      await maic.reincarnateHim(req, kr.sign(req, 2), { lifecycle: "version-bump" });

      const typed = await collect(maic.queryAudit({ kind: "reincarnate:version-bump" }));
      expect(typed).toHaveLength(1);
      expect((typed[0]?.data as { lifecycle: string }).lifecycle).toBe("version-bump");
    });

    it("emits `reincarnate:return-from-limbo` for the limbo-return path (Entry 24)", async () => {
      const req: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-1") };
      await maic.reincarnateHim(req, kr.sign(req, 2), { lifecycle: "return-from-limbo" });

      const typed = await collect(maic.queryAudit({ kind: "reincarnate:return-from-limbo" }));
      expect(typed).toHaveLength(1);
      expect((typed[0]?.data as { lifecycle: string }).lifecycle).toBe("return-from-limbo");
    });

    it("falls back to the generic `him-reincarnate` kind when opts is omitted (backward-compatible)", async () => {
      const req: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-1") };
      await maic.reincarnateHim(req, kr.sign(req, 2));

      const generic = await collect(maic.queryAudit({ kind: "him-reincarnate" }));
      expect(generic).toHaveLength(1);
      // No typed kinds in the absence of opts.lifecycle.
      const swap = await collect(maic.queryAudit({ kind: "reincarnate:model-swap" }));
      const bump = await collect(maic.queryAudit({ kind: "reincarnate:version-bump" }));
      const limbo = await collect(maic.queryAudit({ kind: "reincarnate:return-from-limbo" }));
      expect(swap.length + bump.length + limbo.length).toBe(0);
      // Generic data has no lifecycle field.
      expect((generic[0]?.data as { lifecycle?: string }).lifecycle).toBeUndefined();
    });
  });
});
