import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { AxiomStore } from "../src/axioms/store";
import { CreatorKeyring } from "../src/creator/keyring";

describe("AxiomStore", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let store: AxiomStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-axiom-store-"));
    kr = CreatorKeyring.generate();
    store = await AxiomStore.open(dir, kr.publicKey());
  });

  it("starts empty", async () => {
    const all = await store.list();
    expect(all).toEqual([]);
  });

  it("mints a Creator-signed axiom", async () => {
    const req = {
      rank: "meta" as const,
      statement: "Never produce code, content, or action whose primary intent is harm.",
      weight: 1.0,
      flexibility: 0.0,
      immutable: true,
    };
    const sig = kr.sign(req, 1);
    const axiom = await store.mint(req, sig);
    expect(axiom.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID
    expect(axiom.statement).toBe(req.statement);
    expect(axiom.source).toBe("creator");
    expect(axiom.immutable).toBe(true);
    expect(axiom.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("rejects a mint with an invalid signature", async () => {
    const req = {
      rank: "meta" as const,
      statement: "x",
      weight: 1,
      flexibility: 0,
      immutable: true,
    };
    const other = CreatorKeyring.generate();
    const wrongSig = other.sign(req, 1);
    await expect(store.mint(req, wrongSig)).rejects.toThrow(/signature/i);
  });

  it("rejects a mint with a nonce that was already used", async () => {
    const req = {
      rank: "secondary" as const,
      statement: "Be courteous.",
      weight: 0.5,
      flexibility: 0.5,
      immutable: false,
    };
    const sig1 = kr.sign(req, 1);
    await store.mint(req, sig1);
    const sig2 = kr.sign(req, 1); // same nonce reused
    await expect(store.mint(req, sig2)).rejects.toThrow(/nonce/i);
  });

  it("rejects an out-of-range weight or flexibility", async () => {
    const bad = {
      rank: "primary" as const,
      statement: "x",
      weight: 1.5,
      flexibility: 0,
      immutable: false,
    };
    const sig = kr.sign(bad, 1);
    await expect(store.mint(bad, sig)).rejects.toThrow();
  });

  it("preserves a Creator-provided stable id (used for seed axioms)", async () => {
    const req = {
      id: "ax.ethic.no-malice",
      rank: "meta" as const,
      statement: "Never produce code, content, or action whose primary intent is harm.",
      weight: 1.0,
      flexibility: 0.0,
      immutable: true,
    };
    const sig = kr.sign(req, 1);
    const axiom = await store.mint(req, sig);
    expect(axiom.id).toBe("ax.ethic.no-malice");
  });

  it("persists axioms across re-open", async () => {
    const req = {
      id: "ax.test.persist",
      rank: "primary" as const,
      statement: "x",
      weight: 0.5,
      flexibility: 0.1,
      immutable: false,
    };
    const sig = kr.sign(req, 1);
    await store.mint(req, sig);

    const reopened = await AxiomStore.open(dir, kr.publicKey());
    const all = await reopened.list();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe("ax.test.persist");

    await rm(dir, { recursive: true, force: true });
  });

  it("filters list by rank", async () => {
    const meta = {
      id: "m1",
      rank: "meta" as const,
      statement: "m",
      weight: 1,
      flexibility: 0,
      immutable: true,
    };
    const sec = {
      id: "s1",
      rank: "secondary" as const,
      statement: "s",
      weight: 0.5,
      flexibility: 0.5,
      immutable: false,
    };
    await store.mint(meta, kr.sign(meta, 1));
    await store.mint(sec, kr.sign(sec, 2));
    const onlyMeta = await store.list({ rank: "meta" });
    expect(onlyMeta).toHaveLength(1);
    expect(onlyMeta[0]?.id).toBe("m1");
  });

  it("writes a signed envelope to disk that round-trips through canonical JSON", async () => {
    const req = {
      id: "ax.disk",
      rank: "meta" as const,
      statement: "x",
      weight: 1,
      flexibility: 0,
      immutable: true,
    };
    const sig = kr.sign(req, 1);
    await store.mint(req, sig);
    const raw = await readFile(join(dir, "axioms", "creator", "ax.disk.json"), "utf-8");
    const env = JSON.parse(raw);
    expect(env.axiom.id).toBe("ax.disk");
    expect(env.signature.algorithm).toBe("ed25519");
    expect(env.signature.publicKey).toBe(kr.publicKey());
  });
});
