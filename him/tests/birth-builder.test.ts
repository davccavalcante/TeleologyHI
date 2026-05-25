import { describe, it, expect } from "vitest";
import { BirthSignatureBuilder } from "../src/birth/builder";

describe("BirthSignatureBuilder", () => {
  it("builds a valid BirthSignature with archetype + modifiers + primordial axioms", () => {
    const sig = BirthSignatureBuilder.now()
      .withPrimaryArchetype("aries-sun")
      .withModifier({ kind: "moon", value: "cancer", weight: 0.7 })
      .withModifier({ kind: "ascendant", value: "scorpio", weight: 0.6 })
      .withPrimordialAxioms(["ax.ethic.no-malice", "ax.theos.teleology"])
      .build();

    expect(sig.himId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(sig.primaryArchetype).toBe("aries-sun");
    expect(sig.modifiers).toHaveLength(2);
    expect(sig.primordialAxiomIds).toEqual(["ax.ethic.no-malice", "ax.theos.teleology"]);
    expect(sig.bornAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("at(iso) accepts an explicit timestamp with timezone offset", () => {
    const sig = BirthSignatureBuilder.at("2026-05-15T17:00:00-03:00")
      .withPrimaryArchetype("virgo-sun")
      .build();
    expect(sig.bornAt).toContain("2026-05-15");
  });

  it("rejects build() without a primary archetype", () => {
    expect(() => BirthSignatureBuilder.now().build()).toThrow(/primaryArchetype/i);
  });

  it("preserves an explicit himId when provided", () => {
    const sig = BirthSignatureBuilder.now()
      .withHimId("him.test.fixed")
      .withPrimaryArchetype("libra-sun")
      .build();
    expect(sig.himId).toBe("him.test.fixed");
  });

  it("accepts notes", () => {
    const sig = BirthSignatureBuilder.now()
      .withPrimaryArchetype("aquarius-sun")
      .withNotes("dev fixture")
      .build();
    expect(sig.notes).toBe("dev fixture");
  });

  it("rejects an invalid modifier weight (out of [0,1])", () => {
    expect(() =>
      BirthSignatureBuilder.now()
        .withPrimaryArchetype("x")
        .withModifier({ kind: "moon", value: "y", weight: 2 })
        .build(),
    ).toThrow();
  });
});
