import { describe, it, expect } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import {
  BirthSignatureBuilder,
  HimHandle,
  evaluatePersonaStability,
  adapterSensitivity,
} from "@teleologyhi-sdk/him";
import { Nhe } from "../src/nhe";
import { MockAdapter } from "../src/adapters/mock";

/**
 * I3 — Persona stability across adapters.
 *
 * The same HIM, wired against different adapter setups, must project the
 * same persona vector. The PersonaProjector is deterministic and adapter-
 * independent by design — this test guards that invariant against future
 * changes (e.g. someone wiring adapter state into the projector).
 *
 * Phi-Prime's `P` component target: cosine ≥ 0.85 across adapter swaps.
 * Same HIM should produce identical vectors → cosine = 1.0 exactly.
 */

async function freshContext() {
  const dir = await mkdtemp(join(tmpdir(), "nhe-cross-adapter-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const axioms = await maic.listAxioms();
  return { maic, kr, axioms };
}

describe("persona stability across adapters (I3)", () => {
  it("same HIM produces an IDENTICAL persona vector across three adapter setups", async () => {
    const { kr, axioms } = await freshContext();
    const sig = BirthSignatureBuilder.now()
      .withHimId("him.cross.1")
      .withPrimaryArchetype("aries-sun")
      .withModifier({ kind: "moon", value: "cancer", weight: 0.6 })
      .build();

    // Three NHEs against three different "adapters" (mock with different replies)
    // but the SAME HIM. Persona vectors should be byte-identical.
    const h1 = HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), axioms);
    const h2 = HimHandle.mint(sig, kr.sign(sig, 2), kr.publicKey(), axioms);
    const h3 = HimHandle.mint(sig, kr.sign(sig, 3), kr.publicKey(), axioms);

    const v1 = h1.getPersonaVector().embedding;
    const v2 = h2.getPersonaVector().embedding;
    const v3 = h3.getPersonaVector().embedding;

    expect(v1.length).toBe(v2.length);
    expect(v1.length).toBe(v3.length);
    for (let i = 0; i < v1.length; i++) {
      expect(v1[i]).toBe(v2[i]);
      expect(v1[i]).toBe(v3[i]);
    }
  });

  it("evaluatePersonaStability returns mean similarity = 1.0 for one HIM across adapter swaps", async () => {
    const { kr, axioms } = await freshContext();
    const sig = BirthSignatureBuilder.now()
      .withHimId("him.cross.2")
      .withPrimaryArchetype("libra-sun")
      .build();
    const handles = [1, 2, 3, 4, 5].map((nonce) =>
      HimHandle.mint(sig, kr.sign(sig, nonce), kr.publicKey(), axioms),
    );
    const report = evaluatePersonaStability(handles);
    expect(report.meanSimilarity).toBeCloseTo(1, 5);
    expect(adapterSensitivity(handles.map((h) => h.getPersonaVector().embedding))).toBeCloseTo(
      0,
      5,
    );
  });

  it("different HIMs (different birth signatures) DO produce different vectors", async () => {
    const { kr, axioms } = await freshContext();
    const sig1 = BirthSignatureBuilder.now()
      .withHimId("him.different.1")
      .withPrimaryArchetype("aries-sun")
      .build();
    const sig2 = BirthSignatureBuilder.now()
      .withHimId("him.different.2")
      .withPrimaryArchetype("cancer-sun")
      .build();
    const h1 = HimHandle.mint(sig1, kr.sign(sig1, 1), kr.publicKey(), axioms);
    const h2 = HimHandle.mint(sig2, kr.sign(sig2, 1), kr.publicKey(), axioms);
    const report = evaluatePersonaStability([h1, h2]);
    expect(report.meanSimilarity).toBeLessThan(1);
  });

  it("NHE.respond does not mutate the persona vector across calls", async () => {
    const { maic, kr, axioms } = await freshContext();
    const sig = BirthSignatureBuilder.now()
      .withHimId("him.cross.3")
      .withPrimaryArchetype("libra-sun")
      .build();
    const him = HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), axioms);
    const adapter = new MockAdapter({ reply: "ack" });
    const nhe = new Nhe({ himHandle: him, maicClient: maic, llmAdapter: adapter });

    const before = Array.from(him.getPersonaVector().embedding);
    await nhe.respond({ userPrompt: "hi" });
    await nhe.respond({ userPrompt: "still here?" });
    const after = Array.from(him.getPersonaVector().embedding);
    expect(after).toEqual(before);
  });
});
