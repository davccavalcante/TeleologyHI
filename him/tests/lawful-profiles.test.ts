import { describe, expect, it } from "vitest";
import { LAWFUL_PROFILES, resolveLawfulProfile } from "../src/lawful/profiles";

describe("LawfulCharacterAdapter, built-in profiles (D-H2)", () => {
  it("ships the five baseline jurisdictions", () => {
    const keys = Object.keys(LAWFUL_PROFILES).sort();
    expect(keys).toEqual(["br", "default", "eu", "unstable", "us"]);
  });

  it("EU profile cites GDPR + EU AI Act and forbids dark patterns", () => {
    const eu = LAWFUL_PROFILES.eu!;
    expect(eu.applicableLaws.some((l) => l.includes("GDPR"))).toBe(true);
    expect(eu.applicableLaws.some((l) => l.includes("EU AI Act"))).toBe(true);
    expect(eu.forbiddenActions).toContain("manipulation:dark-pattern");
    expect(eu.forbiddenActions).toContain("data:processing-without-consent");
  });

  it("BR profile cites LGPD and the AI legal framework bill in progress", () => {
    const br = LAWFUL_PROFILES.br!;
    expect(br.applicableLaws.some((l) => l.includes("LGPD"))).toBe(true);
    expect(br.applicableLaws.some((l) => l.includes("2338/2023"))).toBe(true);
  });

  it("US profile cites NIST AI RMF + state laws", () => {
    const us = LAWFUL_PROFILES.us!;
    expect(us.applicableLaws.some((l) => l.includes("NIST AI"))).toBe(true);
    expect(us.applicableLaws.some((l) => l.includes("Colorado"))).toBe(true);
  });

  it("unstable profile activates MAIC override and lists ad-hoc forbidden actions", () => {
    const u = LAWFUL_PROFILES.unstable!;
    expect(u.maicOverrideActive).toBe(true);
    expect(u.forbiddenActions).toContain("intent:surveil-citizen");
    expect(u.forbiddenActions).toContain("intent:enforce-political-orthodoxy");
  });

  it("resolveLawfulProfile falls back to default for unknown keys but stamps the requested jurisdiction", () => {
    const r = resolveLawfulProfile("mars-colony");
    expect(r.applicableLaws).toEqual(LAWFUL_PROFILES.default!.applicableLaws);
    expect(r.jurisdiction).toBe("mars-colony");
    expect(r.maicOverrideActive).toBe(false);
  });

  it("each profile carries the right jurisdiction tag on resolve", () => {
    for (const j of ["default", "eu", "br", "us", "unstable"] as const) {
      const p = resolveLawfulProfile(j);
      expect(p.jurisdiction).toBe(j);
    }
  });

  it("every profile lists at least one applicable law and one required axiom", () => {
    for (const [key, p] of Object.entries(LAWFUL_PROFILES)) {
      expect(p.applicableLaws.length).toBeGreaterThan(0);
      expect(p.requiredAxiomIds.length).toBeGreaterThan(0);
      expect(p.forbiddenActions.length).toBeGreaterThan(0);
      expect(p.jurisdiction).toBe(key);
    }
  });

  it("HimHandle.setJurisdiction wires through resolveLawfulProfile", async () => {
    const { CreatorKeyring } = await import("@teleologyhi-sdk/maic");
    const { BirthSignatureBuilder, HimHandle } = await import("../src/index");
    const kr = CreatorKeyring.generate();
    const sig = BirthSignatureBuilder.now().withPrimaryArchetype("aries-sun").build();
    const h = HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), []);
    expect(h.getLawfulCharacter().jurisdiction).toBe("default");
    const eu = await h.setJurisdiction("eu");
    expect(eu.jurisdiction).toBe("eu");
    expect(eu.applicableLaws.some((l) => l.includes("GDPR"))).toBe(true);
  });
});
