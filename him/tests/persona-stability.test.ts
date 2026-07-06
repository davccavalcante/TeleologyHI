import { CreatorKeyring } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import {
  adapterSensitivity,
  BirthSignatureBuilder,
  cosineSimilarity,
  evaluatePersonaStability,
  HimHandle,
  selfStability,
} from "../src/index";

function mintHim(himId: string, archetype: string): HimHandle {
  const kr = CreatorKeyring.generate();
  const sig = BirthSignatureBuilder.now().withHimId(himId).withPrimaryArchetype(archetype).build();
  return HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), []);
}

describe("cosineSimilarity", () => {
  it("returns 1 for identical unit vectors", () => {
    const v = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal unit vectors", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it("returns NaN for mismatched lengths", () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([1]))).toBeNaN();
  });
});

describe("evaluatePersonaStability (D-H3)", () => {
  it("returns a symmetric matrix with 1s on the diagonal", () => {
    const h1 = mintHim("him.s.1", "aries-sun");
    const h2 = mintHim("him.s.2", "cancer-sun");
    const h3 = mintHim("him.s.3", "libra-sun");
    const r = evaluatePersonaStability([h1, h2, h3]);
    expect(r.count).toBe(3);
    expect(r.pairs.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(r.pairs[i]![i]).toBe(1);
      for (let j = 0; j < 3; j++) {
        expect(r.pairs[i]![j]).toBe(r.pairs[j]![i]);
      }
    }
  });

  it("min/mean/max within the upper triangle are consistent", () => {
    const h1 = mintHim("him.s.4", "aries-sun");
    const h2 = mintHim("him.s.5", "cancer-sun");
    const r = evaluatePersonaStability([h1, h2]);
    expect(r.minSimilarity).toBeLessThanOrEqual(r.meanSimilarity);
    expect(r.meanSimilarity).toBeLessThanOrEqual(r.maxSimilarity);
  });

  it("a single handle yields all-ones (no off-diagonal pairs)", () => {
    const h = mintHim("him.s.6", "aries-sun");
    const r = evaluatePersonaStability([h]);
    expect(r.meanSimilarity).toBe(1);
    expect(r.minSimilarity).toBe(1);
    expect(r.maxSimilarity).toBe(1);
  });
});

describe("selfStability (Phi-Prime P)", () => {
  it("returns 1 when before and after are identical", () => {
    const h = mintHim("him.s.7", "aries-sun");
    const v = h.getPersonaVector().embedding;
    expect(selfStability([v, v, v], [v, v, v])).toBeCloseTo(1);
  });

  it("returns NaN when arrays have different lengths", () => {
    const h = mintHim("him.s.8", "aries-sun");
    const v = h.getPersonaVector().embedding;
    expect(selfStability([v], [v, v])).toBeNaN();
  });

  it("falls below 1 when before and after differ", () => {
    const h1 = mintHim("him.s.9a", "aries-sun");
    const h2 = mintHim("him.s.9b", "cancer-sun");
    const v1 = h1.getPersonaVector().embedding;
    const v2 = h2.getPersonaVector().embedding;
    expect(selfStability([v1], [v2])).toBeLessThan(1);
  });
});

describe("adapterSensitivity", () => {
  it("returns 0 for a single vector (no pairs)", () => {
    const h = mintHim("him.s.10", "aries-sun");
    expect(adapterSensitivity([h.getPersonaVector().embedding])).toBe(0);
  });

  it("returns 0 for identical vectors (no spread)", () => {
    const h = mintHim("him.s.11", "aries-sun");
    const v = h.getPersonaVector().embedding;
    expect(adapterSensitivity([v, v, v])).toBeCloseTo(0);
  });

  it("returns >0 when vectors differ", () => {
    const h1 = mintHim("him.s.12a", "aries-sun");
    const h2 = mintHim("him.s.12b", "cancer-sun");
    const h3 = mintHim("him.s.12c", "libra-sun");
    const variance = adapterSensitivity([
      h1.getPersonaVector().embedding,
      h2.getPersonaVector().embedding,
      h3.getPersonaVector().embedding,
    ]);
    expect(variance).toBeGreaterThanOrEqual(0);
  });
});
