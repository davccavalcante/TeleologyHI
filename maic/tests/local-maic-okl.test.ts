/**
 * Tests for `LocalMaic.getOntologicalKernel(himId?)`, the integration
 * surface of TASK.md D-M6 closure.
 *
 * The standalone `projectOntologicalKernel(axioms, opts?)` function is
 * tested in `okl-projector.test.ts`. This file exercises the runtime
 * integration with the AxiomStore (root projection) and the HimStore
 * (HIM-narrowed projection with snapshot + emergent axioms).
 */

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { SEED_AXIOMS } from "../src/axioms/seed";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";
import { META_AXIOM_ID } from "../src/okl/projector";
import type { BirthSignature } from "../src/types";

const bsig = (id: string): BirthSignature => ({
  himId: id,
  bornAt: new Date().toISOString(),
  primaryArchetype: "aries-sun",
  modifiers: [],
  primordialAxiomIds: [],
});

describe("LocalMaic.getOntologicalKernel (TASK.md D-M6)", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-okl-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  });

  it("returns the root MAIC kernel when called without himId", async () => {
    await maic.seed(kr);
    const kernel = await maic.getOntologicalKernel();
    expect(kernel.metaAxiomId).toBe(META_AXIOM_ID);
    expect(kernel.axioms.length).toBe(SEED_AXIOMS.length);
    expect(kernel.himId).toBeUndefined();
    expect(kernel.jurisdiction).toBeUndefined();
  });

  it("hoists the meta-axiom to position 0 in the root kernel", async () => {
    await maic.seed(kr);
    const kernel = await maic.getOntologicalKernel();
    expect(kernel.axioms[0]?.id).toBe(META_AXIOM_ID);
  });

  it("returns a HIM-narrowed kernel when called with a registered himId", async () => {
    await maic.seed(kr);
    const sig = bsig("him.okl-1");
    await maic.registerHim(sig, kr.sign(sig, 1));

    const kernel = await maic.getOntologicalKernel("him.okl-1");
    expect(kernel.himId).toBe("him.okl-1");
    expect(kernel.metaAxiomId).toBe(META_AXIOM_ID);
    // HIM-narrowed kernel uses the snapshot taken at registration time
    expect(kernel.axioms.length).toBe(SEED_AXIOMS.length);
  });

  it("throws when himId does not resolve to a registered HIM", async () => {
    await maic.seed(kr);
    await expect(maic.getOntologicalKernel("him.does-not-exist")).rejects.toThrow(
      /HIM not registered/,
    );
  });

  it("forwards jurisdiction filter to the projection", async () => {
    await maic.seed(kr);
    // None of the seed axioms carry an explicit jurisdictions list, so the
    // jurisdiction-tagged kernel returns the same axioms but echoes the tag.
    const kernel = await maic.getOntologicalKernel(undefined, { jurisdiction: "eu" });
    expect(kernel.jurisdiction).toBe("eu");
    expect(kernel.axioms.length).toBe(SEED_AXIOMS.length);
  });

  it("includes emergent axioms in the HIM-narrowed kernel after ratification", async () => {
    await maic.seed(kr);
    const sig = bsig("him.okl-emergent");
    await maic.registerHim(sig, kr.sign(sig, 1));

    const before = await maic.getOntologicalKernel("him.okl-emergent");
    const baselineCount = before.axioms.length;

    // Propose and ratify an emergent axiom.
    const proposal = {
      proposedBy: "him-self" as const,
      derivedFromDreamIds: [],
      derivedFromInteractionIds: [],
      candidate: {
        rank: "secondary" as const,
        statement: "An emergent test axiom",
        weight: 0.4,
        flexibility: 0.5,
        immutable: false,
      },
      reasoningTrace: [],
    };
    const { proposalId } = await maic.proposeAxiomEvolution("him.okl-emergent", proposal);
    const ratifySig = kr.sign({ proposalId, op: "ratify" as const }, 2);
    await maic.ratifyAxiomProposal(proposalId, ratifySig);

    const after = await maic.getOntologicalKernel("him.okl-emergent");
    expect(after.axioms.length).toBe(baselineCount + 1);
    expect(after.axioms.some((a) => a.statement === "An emergent test axiom")).toBe(true);
  });
});
