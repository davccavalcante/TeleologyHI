import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";
import { atomicWriteFile } from "../src/stores/atomic-write";
import type { BirthSignature } from "../src/types";

const bsig = (id: string): BirthSignature => ({
  himId: id,
  bornAt: new Date().toISOString(),
  primaryArchetype: "aries-sun",
  modifiers: [],
  primordialAxiomIds: [],
});

// M2-4: a single corrupt record file must not brick LocalMaic.open, and every
// record persist is atomic (temp + rename).
describe("M2-4: store robustness parity", () => {
  let dir: string;
  let kr: CreatorKeyring;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-robust-"));
    kr = CreatorKeyring.generate();
  });

  it("skips a corrupt axiom file with a warning and still opens", async () => {
    const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    await maic.seed(kr);
    // Plant a corrupt file in the axiom store directory.
    await writeFile(join(dir, "axioms", "creator", "corrupt.json"), "{ not valid json", "utf-8");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const reopened = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    warn.mockRestore();
    // The healthy seed axioms still load; open did not throw.
    expect((await reopened.listAxioms()).length).toBeGreaterThan(0);
  });

  it("skips a corrupt induction ticket with a warning and still opens", async () => {
    const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    await maic.induceDream("nhe-1", { inducedBy: "maic", scenario: "s", desiredLearning: "l" });
    await writeFile(join(dir, "inductions", "corrupt.json"), "}{", "utf-8");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const reopened = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    warn.mockRestore();
    expect(await reopened.listPendingInductions("nhe-1")).toHaveLength(1);
  });

  it("skips a corrupt proposal file with a warning and still opens", async () => {
    const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    const b = bsig("him.p");
    await maic.registerHim(b, kr.sign(b, 1));
    await maic.proposeAxiomEvolution("him.p", {
      proposedBy: "him-self",
      derivedFromDreamIds: [],
      derivedFromInteractionIds: [],
      candidate: {
        rank: "secondary",
        statement: "s",
        weight: 0.5,
        flexibility: 0.5,
        immutable: false,
      },
      reasoningTrace: [],
    });
    await writeFile(join(dir, "proposals", "corrupt.json"), "not json", "utf-8");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const reopened = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    warn.mockRestore();
    expect(await reopened.listAxiomProposals({ himId: "him.p" })).toHaveLength(1);
  });
});

describe("M2-4: atomicWriteFile", () => {
  it("writes content atomically and leaves no temp file behind", async () => {
    const dir = await mkdtemp(join(tmpdir(), "maic-atomic-"));
    await mkdir(dir, { recursive: true });
    const target = join(dir, "record.json");
    await atomicWriteFile(target, '{"a":1}');
    const entries = await readdir(dir);
    expect(entries).toEqual(["record.json"]);
    expect(entries.some((e) => e.endsWith(".tmp"))).toBe(false);
  });
});
