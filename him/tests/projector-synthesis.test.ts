import { describe, expect, it } from "vitest";
import { BirthSignatureBuilder } from "../src/birth/builder";
import { castCosmologicalProfile } from "../src/birth/cosmology";
import { PersonaProjector, PROJECTOR_VERSION } from "../src/persona/projector";

const projector = new PersonaProjector();

function profileLessSig() {
  return BirthSignatureBuilder.at("2026-07-02T00:00:00.000Z")
    .withHimId("him-proj")
    .withPrimaryArchetype("leo-sun")
    .withModifier({ kind: "moon", value: "cancer", weight: 0.7 })
    .buildWithIdentity();
}

describe("projector constitutional synthesis (H1-1)", () => {
  it("profile-less projection is byte-identical to prior output and carries no version", () => {
    const sig = profileLessSig();
    const a = projector.project(sig, []);
    const b = projector.project(sig, []);
    expect(a.projectorVersion).toBeUndefined();
    expect([...a.embedding]).toStrictEqual([...b.embedding]);
    expect(a.systemPromptFragment).toBe(b.systemPromptFragment);
    // The fragment does not carry archetypal / clinical lines when profile-less.
    expect(a.systemPromptFragment).not.toContain("Archetypal core");
    expect(a.systemPromptFragment).not.toContain("Clinical colouring");
  });

  it("a profile shifts the embedding and stamps the projector version", () => {
    const sig = profileLessSig();
    const withProfile = { ...sig, cosmologicalProfile: castCosmologicalProfile(sig) };
    const bare = projector.project(sig, []);
    const rich = projector.project(withProfile, []);

    expect(rich.projectorVersion).toBe(PROJECTOR_VERSION);
    expect([...rich.embedding]).not.toStrictEqual([...bare.embedding]);
    expect(rich.systemPromptFragment).toContain("Archetypal core");
    expect(rich.systemPromptFragment).toContain("Clinical colouring");
  });

  it("profile-bearing projection is deterministic", () => {
    const sig = profileLessSig();
    const withProfile = { ...sig, cosmologicalProfile: castCosmologicalProfile(sig) };
    const a = projector.project(withProfile, []);
    const b = projector.project(withProfile, []);
    expect([...a.embedding]).toStrictEqual([...b.embedding]);
    expect(a.systemPromptFragment).toBe(b.systemPromptFragment);
  });

  it("embedding stays L2-normalized after synthesis", () => {
    const sig = profileLessSig();
    const withProfile = { ...sig, cosmologicalProfile: castCosmologicalProfile(sig) };
    const rich = projector.project(withProfile, []);
    let sumSq = 0;
    for (const x of rich.embedding) sumSq += x * x;
    expect(Math.sqrt(sumSq)).toBeCloseTo(1, 5);
  });
});
