import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALL_AUDIT_EVENT_KINDS } from "@teleologyhi-sdk/maic";
import { runPhiPrime } from "../src/index";

/**
 * Coverage regression — `C` is computed as
 *   `mean(1 − uncoveredKinds.length / ALL_AUDIT_EVENT_KINDS.length)` across
 * the two shipped compliance frameworks. The hardcoded denominator was
 * the original drift vector (F3 in the 2026-05-24 eval audit) — `eval`
 * used to ship a frozen 17-kind array while maic shipped 39 kinds, so `C`
 * was numerically inflated. This test fixes the contract:
 *
 *   1. `ALL_AUDIT_EVENT_KINDS` is imported live from maic — single source
 *      of truth, no drift possible.
 *   2. As long as `ComplianceMapper.summarize` returns a non-empty string
 *      for every kind in `ALL_AUDIT_EVENT_KINDS`, `C` stays at 1.0.
 *   3. If maic adds a new kind and forgets to map it, `report.uncoveredKinds`
 *      grows, and `C` drops below 1.0 — the Φ′ gate immediately sees the
 *      regression.
 *
 * This test asserts (3) by invoking the runner with the live MAIC bundle:
 * if every kind is mapped, `C` is 1.0; if any kind regresses, this fails
 * before it lands in production.
 */
describe("Φ′ compliance-coverage regression", () => {
  it("ALL_AUDIT_EVENT_KINDS has at least 39 kinds (trinity baseline floor)", () => {
    // Lower bound — future cuts may grow this but never shrink it
    // without an explicit deprecation + audit-trail update.
    expect(ALL_AUDIT_EVENT_KINDS.length).toBeGreaterThanOrEqual(39);
  });

  it("C is 1.0 against the canonical compliance mapper (no uncovered kinds)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "phi-prime-cov-"));
    const fp = join(dir, "scores.json");
    const now = new Date().toISOString();
    await writeFile(
      fp,
      JSON.stringify({
        P: 0.9,
        R: 0.95,
        D: 0.5,
        provenance: {
          P: { source: "test", asOf: now },
          R: { source: "test", asOf: now },
          D: { source: "test", asOf: now },
        },
      }),
    );
    const r = await runPhiPrime({ fixturesPath: fp });
    expect(r.components.C).toBe(1.0);
  });
});
