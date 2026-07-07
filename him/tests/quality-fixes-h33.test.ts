import { describe, expect, it } from "vitest";
import { computePhiPrime } from "../src/eval/phi-prime";
import { cosineSimilarity } from "../src/persona/embedder";

describe("phi-prime rationale dedup (F-9)", () => {
  it("emits exactly one rationale line per failing hard target (no duplicate)", () => {
    // R far below its hard target: the dedicated hard-target check must report
    // it once, and the 10%-tolerance loop must not report it a second time.
    const report = computePhiPrime({ P: 0.9, R: 0.1, C: 1.0, D: 0.5 });
    expect(report.gate).toBe("block");
    const rLines = report.rationale.filter((line) => line.startsWith("R "));
    expect(rLines).toHaveLength(1);
  });

  it("still blocks and reports both R and C when both miss, one line each", () => {
    const report = computePhiPrime({ P: 0.9, R: 0.1, C: 0.1, D: 0.5 });
    expect(report.gate).toBe("block");
    expect(report.rationale.filter((l) => l.startsWith("R "))).toHaveLength(1);
    expect(report.rationale.filter((l) => l.startsWith("C "))).toHaveLength(1);
  });
});

describe("cosineSimilarity clamp", () => {
  it("clamps a floating-point overshoot to at most 1", () => {
    // Two identical unit-ish vectors whose dot product overshoots 1.0 slightly.
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([1.0000002, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeLessThanOrEqual(1);
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.99);
  });

  it("returns NaN on dimension mismatch", () => {
    expect(Number.isNaN(cosineSimilarity(new Float32Array([1]), new Float32Array([1, 0])))).toBe(
      true,
    );
  });
});
