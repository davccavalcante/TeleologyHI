import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { SEED_AXIOMS } from "../src/axioms/seed";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";

describe("LocalMaic", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-local-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  });

  it("opens with zero axioms", async () => {
    const axioms = await maic.listAxioms();
    expect(axioms).toEqual([]);
  });

  it("seeds every Creator axiom in SEED_AXIOMS", async () => {
    const result = await maic.seed(kr);
    expect(result.minted).toBe(SEED_AXIOMS.length);
    expect(result.skipped).toBe(0);

    const all = await maic.listAxioms();
    expect(all).toHaveLength(SEED_AXIOMS.length);

    const seededIds = all.map((a) => a.id).sort();
    const expectedIds = SEED_AXIOMS.map((a) => a.id!).sort();
    expect(seededIds).toEqual(expectedIds);
  });

  it("seed() is idempotent, re-running does not duplicate", async () => {
    await maic.seed(kr);
    const second = await maic.seed(kr);
    expect(second.minted).toBe(0);
    expect(second.skipped).toBe(SEED_AXIOMS.length);

    const all = await maic.listAxioms();
    expect(all).toHaveLength(SEED_AXIOMS.length);
  });

  it("filters listAxioms by rank", async () => {
    await maic.seed(kr);
    const meta = await maic.listAxioms({ rank: "meta" });
    expect(meta.length).toBeGreaterThan(0);
    expect(meta.every((a) => a.rank === "meta")).toBe(true);
  });

  it("mintAxiom (custom) accepts an external Creator-signed axiom", async () => {
    const req = {
      id: "ax.custom.example",
      rank: "secondary" as const,
      statement: "An example custom axiom.",
      weight: 0.5,
      flexibility: 0.5,
      immutable: false,
    };
    const sig = kr.sign(req, 9999);
    const axiom = await maic.mintAxiom(req, sig);
    expect(axiom.id).toBe("ax.custom.example");
  });
});
