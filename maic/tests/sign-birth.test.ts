/**
 * Tests for Ed25519 signed BirthSignature (Entry 25).
 *
 * Verifies:
 *   - A valid signed BirthSignature round-trips through sign → verify.
 *   - Tampering any covered field (himId, natalChart, primordialAxiomIds…)
 *     invalidates the signature.
 *   - Tampering NON-covered fields (notes, identity surface) does NOT
 *     invalidate the signature.
 *   - Public-key mismatch invalidates the signature.
 *   - `assertBirthSignature` throws InvalidBirthSignatureError on failure.
 */
import { describe, expect, it } from "vitest";
import type { BirthSignatureWithIdentity } from "../src/index.js";
import {
  assertBirthSignature,
  CreatorKeyring,
  InvalidBirthSignatureError,
  signBirthSignature,
  verifyBirthSignature,
} from "../src/index.js";

function freshBirth(): BirthSignatureWithIdentity {
  return {
    himId: "him.legal-consulting.lex",
    bornAt: "2026-05-19T12:00:00.000Z",
    primaryArchetype: "virgo-sun",
    modifiers: [{ kind: "ascendant", value: "capricorn", weight: 0.5 }],
    primordialAxiomIds: ["ax.theos.universe-as-god", "ax.ethic.no-malice", "ax.ethic.honor"],
    notes: "test fixture",
    identity: {
      name: "Lex",
      gender: "feminine",
      language: "pt-BR",
    },
    natalChart: {
      sun: "virgo",
      ascendant: "capricorn",
      moon: "scorpio",
    },
  };
}

describe("signBirthSignature + verifyBirthSignature (Entry 25)", () => {
  it("round-trips a freshly-signed birth signature", () => {
    const kr = CreatorKeyring.generate();
    const signed = signBirthSignature(freshBirth(), kr);
    expect(verifyBirthSignature(signed, kr.publicKey())).toBe(true);
  });

  it("records the canonical list of signed fields", () => {
    const kr = CreatorKeyring.generate();
    const signed = signBirthSignature(freshBirth(), kr);
    expect(signed.signedFields).toEqual([
      "himId",
      "bornAt",
      "primaryArchetype",
      "modifiers",
      "primordialAxiomIds",
      "natalChart",
    ]);
  });

  it("tampering himId invalidates the signature", () => {
    const kr = CreatorKeyring.generate();
    const signed = signBirthSignature(freshBirth(), kr);
    const tampered = { ...signed, himId: "him.malicious-fork.foo" };
    expect(verifyBirthSignature(tampered, kr.publicKey())).toBe(false);
  });

  it("tampering natalChart invalidates the signature", () => {
    const kr = CreatorKeyring.generate();
    const signed = signBirthSignature(freshBirth(), kr);
    const tampered = {
      ...signed,
      natalChart: { sun: "aries" as const, ascendant: "aries" as const },
    };
    expect(verifyBirthSignature(tampered, kr.publicKey())).toBe(false);
  });

  it("tampering primordialAxiomIds invalidates the signature", () => {
    const kr = CreatorKeyring.generate();
    const signed = signBirthSignature(freshBirth(), kr);
    const tampered = { ...signed, primordialAxiomIds: ["ax.foo.bar"] };
    expect(verifyBirthSignature(tampered, kr.publicKey())).toBe(false);
  });

  it("editing the identity surface does NOT invalidate the signature", () => {
    const kr = CreatorKeyring.generate();
    const signed = signBirthSignature(freshBirth(), kr);
    // Parents may rename their child without breaking the natal-chart commitment.
    const renamed = {
      ...signed,
      identity: {
        ...signed.identity,
        name: "Helena",
        language: "en",
        culturalElements: ["Bauhaus"],
      },
    };
    expect(verifyBirthSignature(renamed, kr.publicKey())).toBe(true);
  });

  it("editing `notes` does NOT invalidate the signature", () => {
    const kr = CreatorKeyring.generate();
    const signed = signBirthSignature(freshBirth(), kr);
    const renoted = { ...signed, notes: "post-signing remark" };
    expect(verifyBirthSignature(renoted, kr.publicKey())).toBe(true);
  });

  it("a wrong public key rejects the signature", () => {
    const kr = CreatorKeyring.generate();
    const other = CreatorKeyring.generate();
    const signed = signBirthSignature(freshBirth(), kr);
    expect(verifyBirthSignature(signed, other.publicKey())).toBe(false);
  });

  it("a mutated signedFields array rejects the signature", () => {
    const kr = CreatorKeyring.generate();
    const signed = signBirthSignature(freshBirth(), kr);
    const tampered = {
      ...signed,
      signedFields: ["himId" as const],
    };
    expect(verifyBirthSignature(tampered, kr.publicKey())).toBe(false);
  });

  it("assertBirthSignature throws InvalidBirthSignatureError on tampering", () => {
    const kr = CreatorKeyring.generate();
    const signed = signBirthSignature(freshBirth(), kr);
    const tampered = { ...signed, himId: "him.evil.foo" };
    expect(() => assertBirthSignature(tampered, kr.publicKey())).toThrow(
      InvalidBirthSignatureError,
    );
  });

  it("assertBirthSignature does NOT throw on a clean signature", () => {
    const kr = CreatorKeyring.generate();
    const signed = signBirthSignature(freshBirth(), kr);
    expect(() => assertBirthSignature(signed, kr.publicKey())).not.toThrow();
  });
});
