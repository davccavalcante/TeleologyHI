/**
 * Sanity check that `@teleologyhi-sdk/maic` cosmology types are
 * re-exported from `@teleologyhi-sdk/him` (J-H1 + J-H2 — Entries 18, 19).
 *
 * The semantics of each type are owned by `@teleologyhi-sdk/maic` and tested
 * there. This file only verifies that downstream consumers can import
 * them from `@teleologyhi-sdk/him` directly without reaching into maic.
 */
import { describe, expect, it } from "vitest";
import { CreatorKeyring } from "@teleologyhi-sdk/maic";
import {
  Affect,
  IdentityLayer,
  META_AXIOM_ID,
  NatalChart,
  SIGNED_BIRTH_FIELDS,
  WakeAffectBias,
  projectOntologicalKernel,
  signBirthSignature,
  verifyBirthSignature,
} from "../src/index.js";
import type {
  BirthSignatureWithIdentity,
  OntologicalKernel,
  SignedBirthSignature,
} from "../src/index.js";

describe("cosmology re-exports from @teleologyhi-sdk/maic (J-H1 + J-H2)", () => {
  it("re-exports Affect with the canonical nine values", () => {
    for (const a of [
      "fear",
      "attachment",
      "serenity",
      "anger",
      "joy",
      "melancholy",
      "desire",
      "repulsion",
      "reunion",
    ] as const) {
      expect(Affect.parse(a)).toBe(a);
    }
  });

  it("re-exports IdentityLayer with the expected shape", () => {
    expect(IdentityLayer.parse({ name: "Lex" })).toEqual({ name: "Lex" });
  });

  it("re-exports NatalChart", () => {
    expect(
      NatalChart.parse({ sun: "virgo", ascendant: "capricorn" }),
    ).toEqual({ sun: "virgo", ascendant: "capricorn" });
  });

  it("re-exports SIGNED_BIRTH_FIELDS as the frozen tuple", () => {
    expect([...SIGNED_BIRTH_FIELDS]).toEqual([
      "himId",
      "bornAt",
      "primaryArchetype",
      "modifiers",
      "primordialAxiomIds",
      "natalChart",
    ]);
  });

  it("re-exports META_AXIOM_ID", () => {
    expect(META_AXIOM_ID).toBe("ax.theos.universe-as-god");
  });

  it("re-exports projectOntologicalKernel", () => {
    const kernel: OntologicalKernel = projectOntologicalKernel([]);
    expect(kernel.metaAxiomId).toBe(META_AXIOM_ID);
    expect(kernel.axioms).toEqual([]);
  });

  it("re-exports the Ed25519 BirthSignature signing helpers", () => {
    const kr = CreatorKeyring.generate();
    const birth: BirthSignatureWithIdentity = {
      himId: "him.test.lex",
      bornAt: new Date().toISOString(),
      primaryArchetype: "virgo-sun",
      modifiers: [],
      primordialAxiomIds: ["ax.theos.universe-as-god"],
      identity: { name: "Lex" },
      natalChart: { sun: "virgo", ascendant: "capricorn" },
    };
    const signed: SignedBirthSignature = signBirthSignature(birth, kr);
    expect(verifyBirthSignature(signed, kr.publicKey())).toBe(true);
  });

  it("re-exports WakeAffectBias", () => {
    const bias = {
      affect: "serenity" as const,
      intensity: 0.5,
      decayHalfLife: 10,
      appliedAt: new Date().toISOString(),
      derivedFromDreamId: "drm-test",
      expressedOpenly: true,
    };
    expect(WakeAffectBias.parse(bias)).toEqual(bias);
  });
});
