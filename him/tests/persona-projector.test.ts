import type { Axiom } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import { BirthSignatureBuilder } from "../src/birth/builder";
import { PersonaProjector } from "../src/persona/projector";
import { DISPOSITION_AXES } from "../src/types";

const baseSig = () =>
  BirthSignatureBuilder.now()
    .withHimId("him.test")
    .withPrimaryArchetype("aries-sun")
    .withModifier({ kind: "moon", value: "cancer", weight: 0.7 })
    .build();

const fixtureAxiom = (id: string, weight: number, flexibility: number): Axiom => ({
  id,
  rank: "primary",
  statement: `Statement for ${id}`,
  weight,
  flexibility,
  source: "creator",
  immutable: false,
  createdAt: new Date().toISOString(),
});

describe("PersonaProjector (deterministic, hash-based)", () => {
  const projector = new PersonaProjector();

  it("is deterministic: same input → same embedding bytes", () => {
    const sig = baseSig();
    const a = projector.project(sig, []);
    const b = projector.project(sig, []);
    expect(Array.from(a.embedding)).toEqual(Array.from(b.embedding));
  });

  it("the persona fragment is substrate-agnostic (never names a provider or model, Arena F2)", () => {
    // The immortal HIM spirit is independent of the body substrate it reincarnates
    // into; the substrate anchor lives downstream in the NHE body, never in the
    // spirit projection. This guards against a base-model provider name leaking
    // into the persona fragment.
    const fragment = projector.project(baseSig(), []).systemPromptFragment.toLowerCase();
    for (const forbidden of [
      "openai",
      "gpt",
      "chatgpt",
      "gemini",
      "google",
      "claude",
      "anthropic",
      "llama",
      "mistral",
      "deepseek",
      "grok",
    ]) {
      expect(fragment, `fragment must not name substrate "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("changes the embedding when the archetype changes", () => {
    const a = projector.project(
      BirthSignatureBuilder.now().withHimId("h").withPrimaryArchetype("aries-sun").build(),
      [],
    );
    const b = projector.project(
      BirthSignatureBuilder.now().withHimId("h").withPrimaryArchetype("virgo-sun").build(),
      [],
    );
    const equal =
      a.embedding.length === b.embedding.length &&
      Array.from(a.embedding).every((v, i) => v === b.embedding[i]);
    expect(equal).toBe(false);
  });

  it("produces an L2-normalized embedding", () => {
    const v = projector.project(baseSig(), []);
    let sumSq = 0;
    for (let i = 0; i < v.embedding.length; i++) sumSq += v.embedding[i]! ** 2;
    const norm = Math.sqrt(sumSq);
    expect(norm).toBeGreaterThan(0.999);
    expect(norm).toBeLessThan(1.001);
  });

  it("emits a disposition score in [-1, 1] for every axis", () => {
    const v = projector.project(baseSig(), []);
    for (const axis of DISPOSITION_AXES) {
      const score = v.dispositions[axis];
      expect(score).toBeGreaterThanOrEqual(-1);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("axioms shape the embedding when included", () => {
    const sig = baseSig();
    const a = projector.project(sig, []);
    const b = projector.project(sig, [fixtureAxiom("ax.cynic.candor", 1, 0)]);
    const equal = Array.from(a.embedding).every((v, i) => v === b.embedding[i]);
    expect(equal).toBe(false);
  });

  it("axiom flexibility=1 means the axiom does not bias the vector", () => {
    const sig = baseSig();
    const a = projector.project(sig, []);
    const b = projector.project(sig, [fixtureAxiom("ax.fully-flexible", 1, 1)]);
    const equal = Array.from(a.embedding).every((v, i) => v === b.embedding[i]);
    expect(equal).toBe(true);
  });

  it("systemPromptFragment is non-empty and mentions the archetype", () => {
    const v = projector.project(baseSig(), []);
    expect(v.systemPromptFragment.length).toBeGreaterThan(0);
    expect(v.systemPromptFragment.length).toBeLessThan(2000);
    expect(v.systemPromptFragment.toLowerCase()).toContain("aries-sun");
  });

  it("provenance is a stub (empty arrays per axis)", () => {
    const v = projector.project(baseSig(), []);
    for (const axis of DISPOSITION_AXES) {
      expect(v.provenance[axis]).toEqual([]);
    }
  });

  it("custom dimension is honored", () => {
    const p = new PersonaProjector({ dimension: 128 });
    const v = p.project(baseSig(), []);
    expect(v.embedding.length).toBe(128);
  });
});
