/**
 * Tests for applyAffectBias / affectRefusalDensity / decayAffectBias
 * (J-N11 — Entries 20 + 22).
 */
import { describe, expect, it } from "vitest";
import type { WakeAffectBias } from "@teleologyhi-sdk/maic";
import {
  affectRefusalDensity,
  applyAffectBias,
  decayAffectBias,
} from "../src/index.js";

function bias(over: Partial<WakeAffectBias> = {}): WakeAffectBias {
  return {
    affect: "serenity",
    intensity: 1,
    decayHalfLife: 10,
    appliedAt: new Date().toISOString(),
    derivedFromDreamId: "drm-test",
    expressedOpenly: true,
    ...over,
  };
}

describe("applyAffectBias (J-N11)", () => {
  it("raises temperature for joy", () => {
    const r = applyAffectBias({ temperature: 0.7 }, bias({ affect: "joy" }));
    expect(r.config.temperature).toBeGreaterThan(0.7);
  });

  it("lowers temperature for fear", () => {
    const r = applyAffectBias({ temperature: 0.7 }, bias({ affect: "fear" }));
    expect(r.config.temperature).toBeLessThan(0.7);
  });

  it("clamps temperature into [0, 2]", () => {
    const r = applyAffectBias({ temperature: 1.95 }, bias({ affect: "joy" }));
    expect(r.config.temperature).toBeLessThanOrEqual(2);
  });

  it("returns an empty moodLine when bias is expressed privately", () => {
    const r = applyAffectBias({}, bias({ expressedOpenly: false }));
    expect(r.systemPromptMoodLine).toBe("");
  });

  it("returns a non-empty moodLine when bias is expressed openly", () => {
    const r = applyAffectBias({}, bias({ affect: "joy", expressedOpenly: true }));
    expect(r.systemPromptMoodLine.length).toBeGreaterThan(0);
  });

  it("scales modulation by intensity", () => {
    const full = applyAffectBias({ temperature: 0.7 }, bias({ affect: "joy", intensity: 1 }));
    const half = applyAffectBias({ temperature: 0.7 }, bias({ affect: "joy", intensity: 0.5 }));
    expect(full.config.temperature).toBeGreaterThan(half.config.temperature!);
  });

  it("uses default baseline (0.7 / 0.9) when base config omits them", () => {
    const r = applyAffectBias({}, bias({ affect: "serenity" }));
    expect(typeof r.config.temperature).toBe("number");
    expect(typeof r.config.topP).toBe("number");
  });
});

describe("affectRefusalDensity (J-N11)", () => {
  it("raises density for fear (>1)", () => {
    expect(affectRefusalDensity(bias({ affect: "fear" }))).toBeGreaterThan(1);
  });

  it("lowers density for serenity (<1)", () => {
    expect(affectRefusalDensity(bias({ affect: "serenity" }))).toBeLessThan(1);
  });

  it("is 1.0 when intensity is 0", () => {
    expect(affectRefusalDensity(bias({ affect: "fear", intensity: 0 }))).toBe(1);
  });
});

describe("decayAffectBias (J-N11)", () => {
  it("halves intensity at the half-life", () => {
    const b = bias({ intensity: 1, decayHalfLife: 10 });
    const decayed = decayAffectBias(b, 10 * 60 * 1000);
    expect(decayed.intensity).toBeCloseTo(0.5, 3);
  });

  it("returns the input unchanged when elapsed time is 0", () => {
    const b = bias({ intensity: 0.7 });
    expect(decayAffectBias(b, 0)).toEqual(b);
  });

  it("preserves the rest of the bias fields", () => {
    const b = bias({ intensity: 1 });
    const decayed = decayAffectBias(b, 60_000);
    expect(decayed.affect).toBe(b.affect);
    expect(decayed.decayHalfLife).toBe(b.decayHalfLife);
    expect(decayed.expressedOpenly).toBe(b.expressedOpenly);
  });
});
