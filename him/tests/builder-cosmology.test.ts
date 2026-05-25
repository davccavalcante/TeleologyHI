/**
 * Tests for the BirthSignatureBuilder cosmology extensions:
 * `withNatalChart`, `withIdentity`, `buildWithIdentity`.
 *
 * The legacy `build()` path is covered by tests/birth-builder.test.ts;
 * this file only tests the new opt-in surface.
 */
import { describe, expect, it } from "vitest";
import {
  CreatorKeyring,
  signBirthSignature,
  verifyBirthSignature,
} from "@teleologyhi-sdk/maic";
import { BirthSignatureBuilder } from "../src/birth/builder.js";

describe("BirthSignatureBuilder cosmology extensions", () => {
  it("`buildWithIdentity()` omits identity and natalChart when not set", () => {
    const birth = BirthSignatureBuilder.now()
      .withPrimaryArchetype("virgo-sun")
      .buildWithIdentity();
    expect(birth.identity).toBeUndefined();
    expect(birth.natalChart).toBeUndefined();
    expect(birth.primaryArchetype).toBe("virgo-sun");
  });

  it("includes the identity layer when set via withIdentity()", () => {
    const birth = BirthSignatureBuilder.now()
      .withPrimaryArchetype("virgo-sun")
      .withIdentity({ name: "Lex", language: "en" })
      .buildWithIdentity();
    expect(birth.identity).toEqual({ name: "Lex", language: "en" });
  });

  it("includes the natal chart when set via withNatalChart()", () => {
    const birth = BirthSignatureBuilder.now()
      .withPrimaryArchetype("virgo-sun")
      .withNatalChart({ sun: "virgo", ascendant: "capricorn" })
      .buildWithIdentity();
    expect(birth.natalChart).toEqual({ sun: "virgo", ascendant: "capricorn" });
  });

  it("`withNatalChart()` rejects an invalid chart (out-of-range house)", () => {
    expect(() =>
      BirthSignatureBuilder.now()
        .withPrimaryArchetype("leo-sun")
        .withNatalChart({
          sun: "leo",
          ascendant: "aries",
          // House 13 is invalid (must be [1, 12]).
          positions: [{ planet: "sun", sign: "leo", house: 13 }],
        }),
    ).toThrow();
  });

  it("`withIdentity()` rejects an empty name", () => {
    expect(() =>
      BirthSignatureBuilder.now()
        .withPrimaryArchetype("aries-sun")
        .withIdentity({ name: "" }),
    ).toThrow();
  });

  it("buildWithIdentity output is signable + verifiable end-to-end", () => {
    const kr = CreatorKeyring.generate();
    const birth = BirthSignatureBuilder.now()
      .withPrimaryArchetype("virgo-sun")
      .withIdentity({ name: "Lex" })
      .withNatalChart({ sun: "virgo", ascendant: "capricorn" })
      .buildWithIdentity();
    const signed = signBirthSignature(birth, kr);
    expect(verifyBirthSignature(signed, kr.publicKey())).toBe(true);
  });

  it("`build()` (legacy path) does NOT include the cosmology surface", () => {
    const builder = BirthSignatureBuilder.now()
      .withPrimaryArchetype("virgo-sun")
      .withIdentity({ name: "Lex" })
      .withNatalChart({ sun: "virgo", ascendant: "capricorn" });
    const legacy = builder.build();
    // The legacy BirthSignature schema has no identity/natalChart fields,
    // so they're silently dropped by zod.
    expect((legacy as unknown as Record<string, unknown>).identity).toBeUndefined();
    expect((legacy as unknown as Record<string, unknown>).natalChart).toBeUndefined();
  });
});
