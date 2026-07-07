/**
 * Tests for HimHandle.projectOntologicalKernel, the HIM-specific OKL
 * narrowing (the natural follow-up to `@teleologyhi-sdk/maic`'s
 * `projectOntologicalKernel`).
 *
 * The HimHandle owns the HIM context (id + primordialAxiomIds), so the
 * narrowing rule lives here. MAIC ships the generic projection; HIM
 * specialises it.
 */

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatorKeyring, LocalMaic, META_AXIOM_ID } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import { BirthSignatureBuilder } from "../src/birth/builder.js";
import { createHim } from "../src/create.js";

async function bootstrap(primordialAxiomIds: string[] = []) {
  const dir = await mkdtemp(join(tmpdir(), "him-okl-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const sig = BirthSignatureBuilder.now()
    .withPrimaryArchetype("virgo-sun")
    .withPrimordialAxioms(primordialAxiomIds)
    .build();
  const him = await createHim(maic, kr, sig);
  return { maic, kr, him };
}

describe("HimHandle.projectOntologicalKernel", () => {
  it("returns the full axiom corpus when primordialAxiomIds is empty", async () => {
    const { him } = await bootstrap([]);
    const kernel = him.projectOntologicalKernel();
    expect(kernel.metaAxiomId).toBe(META_AXIOM_ID);
    // Empty primordial list means no narrowing: the full seeded corpus, whose
    // size derives from the HIM's own axioms rather than a hardcoded count.
    expect(kernel.axioms.length).toBe(him.getAxioms().length);
  });

  it("narrows the kernel to primordialAxiomIds when present", async () => {
    const { him } = await bootstrap(["ax.ethic.no-malice", "ax.theos.spiritism-evolution"]);
    const kernel = him.projectOntologicalKernel();
    const ids = kernel.axioms.map((a) => a.id).sort();
    // Meta-axiom is always retained; plus the two primordials.
    expect(ids).toEqual(
      [META_AXIOM_ID, "ax.ethic.no-malice", "ax.theos.spiritism-evolution"].sort(),
    );
  });

  it("hoists the meta-axiom to position 0", async () => {
    const { him } = await bootstrap(["ax.ethic.no-malice"]);
    const kernel = him.projectOntologicalKernel();
    expect(kernel.axioms[0]?.id).toBe(META_AXIOM_ID);
  });

  it("tags the projection with the HIM id", async () => {
    const { him } = await bootstrap();
    const kernel = him.projectOntologicalKernel();
    expect(kernel.himId).toBe(him.id);
  });

  it("accepts a jurisdiction filter", async () => {
    const { him } = await bootstrap();
    const kernel = him.projectOntologicalKernel({ jurisdiction: "eu" });
    expect(kernel.jurisdiction).toBe("eu");
    // Seeded axioms have no jurisdictions; all should pass through.
    expect(kernel.axioms.length).toBe(him.getAxioms().length);
  });
});
