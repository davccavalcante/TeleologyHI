import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HimStore } from "../src/hims/store";
import { CreatorKeyring } from "../src/creator/keyring";
import type { Axiom, BirthSignature } from "../src/types";

const ax = (id: string): Axiom => ({
  id,
  rank: "primary",
  statement: `Statement for ${id}`,
  weight: 0.7,
  flexibility: 0.2,
  source: "creator",
  immutable: false,
  createdAt: new Date().toISOString(),
});

const bsig = (id: string, archetype = "aries-sun"): BirthSignature => ({
  himId: id,
  bornAt: new Date().toISOString(),
  primaryArchetype: archetype,
  modifiers: [],
  primordialAxiomIds: [],
});

describe("HimStore", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let store: HimStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-him-store-"));
    kr = CreatorKeyring.generate();
    store = await HimStore.open(dir, kr.publicKey());
  });

  it("starts empty", async () => {
    expect(await store.list()).toEqual([]);
  });

  it("registers a HIM with a valid Creator signature", async () => {
    const sig = bsig("him.test.1");
    const creatorSig = kr.sign(sig, 1);
    const axioms = [ax("ax.a"), ax("ax.b")];
    const record = await store.register(sig, creatorSig, axioms);
    expect(record.himId).toBe("him.test.1");
    expect(record.axiomsSnapshot).toHaveLength(2);
    expect(record.registeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("rejects a HIM registration with an invalid signature", async () => {
    const sig = bsig("him.test.2");
    const impostor = CreatorKeyring.generate();
    const badSig = impostor.sign(sig, 1);
    await expect(store.register(sig, badSig, [])).rejects.toThrow(/signature/i);
  });

  it("rejects a duplicate himId", async () => {
    const sig = bsig("him.dup");
    await store.register(sig, kr.sign(sig, 1), []);
    const sig2 = bsig("him.dup", "virgo-sun");
    await expect(store.register(sig2, kr.sign(sig2, 2), [])).rejects.toThrow(
      /already registered/i,
    );
  });

  it("retrieves a registered HIM record by id", async () => {
    const sig = bsig("him.get");
    await store.register(sig, kr.sign(sig, 1), [ax("ax.x")]);
    const got = await store.get("him.get");
    expect(got).not.toBeNull();
    expect(got?.himId).toBe("him.get");
    expect(got?.axiomsSnapshot[0]?.id).toBe("ax.x");
  });

  it("returns null for unknown himId", async () => {
    expect(await store.get("him.nope")).toBeNull();
  });

  it("persists records across reopen", async () => {
    const sig = bsig("him.persist");
    await store.register(sig, kr.sign(sig, 1), [ax("ax.x")]);

    const reopened = await HimStore.open(dir, kr.publicKey());
    const got = await reopened.get("him.persist");
    expect(got?.himId).toBe("him.persist");
    expect(got?.axiomsSnapshot[0]?.id).toBe("ax.x");

    await rm(dir, { recursive: true, force: true });
  });

  it("lists all registered HIMs", async () => {
    const s1 = bsig("h1");
    const s2 = bsig("h2");
    await store.register(s1, kr.sign(s1, 1), []);
    await store.register(s2, kr.sign(s2, 2), []);
    const all = await store.list();
    expect(all).toHaveLength(2);
    expect(all.map((r) => r.himId).sort()).toEqual(["h1", "h2"]);
  });
});
