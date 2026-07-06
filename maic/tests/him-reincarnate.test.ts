import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { CreatorKeyring } from "../src/creator/keyring";
import { HimStore } from "../src/hims/store";
import type { BirthSignature, NheBodyRef, ReincarnationRequest } from "../src/types";

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

describe("HimStore.reincarnate", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let store: HimStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-reinc-"));
    kr = CreatorKeyring.generate();
    store = await HimStore.open(dir, kr.publicKey());
    const sig = bsig("him.r");
    await store.register(sig, kr.sign(sig, 1), []);
  });

  it("first reincarnation with no fromNheId appends the body", async () => {
    const req: ReincarnationRequest = {
      himId: "him.r",
      toBody: body("nhe-1"),
    };
    const updated = await store.reincarnate(req, kr.sign(req, 2));
    expect(updated.bodyHistory).toHaveLength(1);
    expect(updated.bodyHistory[0]?.nheId).toBe("nhe-1");
    expect(updated.bodyHistory[0]?.endedAt).toBeUndefined();
  });

  it("subsequent reincarnation closes the previous open body and appends new", async () => {
    const r1: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-1") };
    await store.reincarnate(r1, kr.sign(r1, 2));

    const r2: ReincarnationRequest = {
      himId: "him.r",
      fromNheId: "nhe-1",
      toBody: body("nhe-2", "anthropic:claude-sonnet-4-7"),
      reason: "upgrade",
    };
    const updated = await store.reincarnate(r2, kr.sign(r2, 3));
    expect(updated.bodyHistory).toHaveLength(2);
    expect(updated.bodyHistory[0]?.nheId).toBe("nhe-1");
    expect(updated.bodyHistory[0]?.endedAt).toMatch(/^\d{4}-/);
    expect(updated.bodyHistory[0]?.endedReason).toBe("upgrade");
    expect(updated.bodyHistory[1]?.nheId).toBe("nhe-2");
    expect(updated.bodyHistory[1]?.endedAt).toBeUndefined();
  });

  it("defaults endedReason to 'upgrade' when reason omitted", async () => {
    const r1: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-1") };
    await store.reincarnate(r1, kr.sign(r1, 2));
    const r2: ReincarnationRequest = {
      himId: "him.r",
      fromNheId: "nhe-1",
      toBody: body("nhe-2"),
    };
    const updated = await store.reincarnate(r2, kr.sign(r2, 3));
    expect(updated.bodyHistory[0]?.endedReason).toBe("upgrade");
  });

  it("rejects an invalid Creator signature", async () => {
    const impostor = CreatorKeyring.generate();
    const req: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-x") };
    await expect(store.reincarnate(req, impostor.sign(req, 99))).rejects.toThrow(/signature/i);
  });

  it("rejects when fromNheId does not match any open body", async () => {
    const r1: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-1") };
    await store.reincarnate(r1, kr.sign(r1, 2));
    const r2: ReincarnationRequest = {
      himId: "him.r",
      fromNheId: "nhe-missing",
      toBody: body("nhe-2"),
    };
    await expect(store.reincarnate(r2, kr.sign(r2, 3))).rejects.toThrow(/no open body/i);
  });

  it("rejects unknown himId", async () => {
    const req: ReincarnationRequest = { himId: "him.does-not-exist", toBody: body("x") };
    await expect(store.reincarnate(req, kr.sign(req, 2))).rejects.toThrow(/not registered/i);
  });

  it("persists bodyHistory across reopen", async () => {
    const r1: ReincarnationRequest = { himId: "him.r", toBody: body("nhe-1") };
    await store.reincarnate(r1, kr.sign(r1, 2));
    const r2: ReincarnationRequest = {
      himId: "him.r",
      fromNheId: "nhe-1",
      toBody: body("nhe-2"),
    };
    await store.reincarnate(r2, kr.sign(r2, 3));

    const reopened = await HimStore.open(dir, kr.publicKey());
    const got = await reopened.get("him.r");
    expect(got?.bodyHistory).toHaveLength(2);
    expect(got?.bodyHistory[1]?.nheId).toBe("nhe-2");
  });

  it("freshly registered HIM has empty bodyHistory", async () => {
    const got = await store.get("him.r");
    expect(got?.bodyHistory).toEqual([]);
  });
});
