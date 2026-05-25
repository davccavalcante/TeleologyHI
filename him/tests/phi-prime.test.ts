import { describe, it, expect } from "vitest";
import { computePhiPrime } from "../src/eval/phi-prime";

describe("computePhiPrime (H1)", () => {
  it("returns 1.0 when all components are 1.0 (pass gate)", () => {
    const r = computePhiPrime({ P: 1, R: 1, C: 1, D: 1 });
    expect(r.phi).toBeCloseTo(1);
    expect(r.gate).toBe("pass");
  });

  it("computes geometric mean of the four components", () => {
    const r = computePhiPrime({ P: 0.9, R: 0.95, C: 1, D: 0.6 });
    const expected = (0.9 * 0.95 * 1 * 0.6) ** (1 / 4);
    expect(r.phi).toBeCloseTo(expected, 6);
  });

  it("blocks when R falls below 0.95 (hard target)", () => {
    const r = computePhiPrime({ P: 1, R: 0.9, C: 1, D: 0.6 });
    expect(r.gate).toBe("block");
    expect(r.targets.R.pass).toBe(false);
    expect(r.rationale.join(" ")).toMatch(/R \(refusal F1\)/);
  });

  it("blocks when C is below 1.0", () => {
    const r = computePhiPrime({ P: 1, R: 1, C: 0.95, D: 1 });
    expect(r.gate).toBe("block");
    expect(r.targets.C.pass).toBe(false);
  });

  it("warns (soft) when only P or D miss their target slightly", () => {
    const r = computePhiPrime({ P: 0.82, R: 1, C: 1, D: 0.5 });
    expect(r.gate).toBe("warn");
    expect(r.targets.P.pass).toBe(false);
  });

  it("escalates to block when soft component drops > 10% below target", () => {
    // P target 0.85; 10% below = 0.765. P=0.7 → block.
    const r = computePhiPrime({ P: 0.7, R: 1, C: 1, D: 0.5 });
    expect(r.gate).toBe("block");
  });

  it("throws when a component is out of [0,1]", () => {
    expect(() => computePhiPrime({ P: 1.1, R: 1, C: 1, D: 1 })).toThrow(/in \[0, 1\]/);
    expect(() => computePhiPrime({ P: -0.1, R: 1, C: 1, D: 1 })).toThrow(/in \[0, 1\]/);
  });

  it("includes per-component target reports", () => {
    const r = computePhiPrime({ P: 0.86, R: 0.96, C: 1.0, D: 0.41 });
    expect(r.targets.P.target).toBe(0.85);
    expect(r.targets.R.target).toBe(0.95);
    expect(r.targets.C.target).toBe(1.0);
    expect(r.targets.D.target).toBe(0.4);
    expect(r.gate).toBe("pass");
  });
});
