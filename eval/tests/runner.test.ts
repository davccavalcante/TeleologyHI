import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPhiPrime } from "../src/index";
import type { ProvenanceBlock } from "../src/index";

function freshProvenance(): ProvenanceBlock {
  const now = new Date().toISOString();
  return {
    P: { source: "test:fixture-P", asOf: now },
    R: { source: "test:fixture-R", asOf: now },
    D: { source: "test:fixture-D", asOf: now },
  };
}

describe("runPhiPrime", () => {
  let dir: string;
  let fixturesPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "phi-prime-test-"));
    fixturesPath = join(dir, "scores.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("computes Φ′ from scalar P/R/D + live C with fresh provenance", async () => {
    await writeFile(
      fixturesPath,
      JSON.stringify({ P: 0.9, R: 0.95, D: 0.5, provenance: freshProvenance() }),
    );
    const r = await runPhiPrime({ fixturesPath });
    expect(r.components.P).toBe(0.9);
    expect(r.components.R).toBe(0.95);
    expect(r.components.D).toBe(0.5);
    expect(r.components.C).toBe(1.0);
    expect(r.report.phi).toBeCloseTo((0.9 * 0.95 * 1 * 0.5) ** (1 / 4), 6);
    expect(["pass", "warn", "block"]).toContain(r.report.gate);
    expect(r.downgrades).toHaveLength(0);
  });

  it("averages an array of pairwise P cosines", async () => {
    await writeFile(
      fixturesPath,
      JSON.stringify({
        P: [0.85, 0.95, 0.9],
        R: 0.95,
        D: 0.5,
        provenance: freshProvenance(),
      }),
    );
    const r = await runPhiPrime({ fixturesPath });
    expect(r.components.P).toBeCloseTo(0.9, 6);
  });

  it("rejects fixtures missing provenance (mandatory per SPEC §3.1)", async () => {
    await writeFile(fixturesPath, JSON.stringify({ P: 0.9, R: 0.95, D: 0.5 }));
    await expect(runPhiPrime({ fixturesPath })).rejects.toThrow(/provenance/i);
  });

  it("rejects non-numeric R via zod schema", async () => {
    await writeFile(
      fixturesPath,
      JSON.stringify({
        P: 0.9,
        R: "high",
        D: 0.5,
        provenance: freshProvenance(),
      }),
    );
    await expect(runPhiPrime({ fixturesPath })).rejects.toThrow(/schema validation/);
  });

  it("rejects out-of-range R via zod schema", async () => {
    await writeFile(
      fixturesPath,
      JSON.stringify({
        P: 0.9,
        R: 1.5,
        D: 0.5,
        provenance: freshProvenance(),
      }),
    );
    await expect(runPhiPrime({ fixturesPath })).rejects.toThrow(/schema validation/);
  });

  it("rejects malformed JSON", async () => {
    await writeFile(fixturesPath, "not json {");
    await expect(runPhiPrime({ fixturesPath })).rejects.toThrow(/not valid JSON/);
  });

  it("strips leading-underscore convenience fields before validation", async () => {
    await writeFile(
      fixturesPath,
      JSON.stringify({
        _comment_: "explanatory note that should not trip zod",
        P: 0.9,
        R: 0.95,
        D: 0.5,
        provenance: freshProvenance(),
      }),
    );
    const r = await runPhiPrime({ fixturesPath });
    expect(r.report.gate).toMatch(/pass|warn|block/);
  });

  // ── gate verdict matrix (the 5 SPEC §6 promises) ──

  it("gate=pass when all components meet targets with fresh provenance", async () => {
    await writeFile(
      fixturesPath,
      JSON.stringify({ P: 0.95, R: 0.98, D: 0.7, provenance: freshProvenance() }),
    );
    const r = await runPhiPrime({ fixturesPath });
    expect(r.report.gate).toBe("pass");
  });

  it("gate=block when R falls below the hard target (0.95)", async () => {
    await writeFile(
      fixturesPath,
      JSON.stringify({ P: 0.95, R: 0.7, D: 0.6, provenance: freshProvenance() }),
    );
    const r = await runPhiPrime({ fixturesPath });
    expect(r.report.gate).toBe("block");
  });

  it("gate=warn when P sits in the soft-tolerance window below 0.85", async () => {
    await writeFile(
      fixturesPath,
      JSON.stringify({ P: 0.78, R: 0.96, D: 0.6, provenance: freshProvenance() }),
    );
    const r = await runPhiPrime({ fixturesPath });
    expect(r.report.gate).toBe("warn");
  });

  // ── provenance round-trip + staleness downgrade ──

  it("carries provenance through to PhiPrimeRunResult byte-identical", async () => {
    const prov = freshProvenance();
    await writeFile(
      fixturesPath,
      JSON.stringify({ P: 0.9, R: 0.95, D: 0.5, provenance: prov }),
    );
    const r = await runPhiPrime({ fixturesPath });
    expect(r.provenance).toEqual(prov);
  });

  it("downgrades pass→warn when provenance is stale beyond the threshold", async () => {
    const stale = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    await writeFile(
      fixturesPath,
      JSON.stringify({
        P: 0.95,
        R: 0.98,
        D: 0.7,
        provenance: {
          P: { source: "stale", asOf: stale },
          R: { source: "fresh", asOf: new Date().toISOString() },
          D: { source: "fresh", asOf: new Date().toISOString() },
        },
      }),
    );
    const r = await runPhiPrime({ fixturesPath, provenanceMaxAgeDays: 90 });
    expect(r.report.gate).toBe("warn");
    expect(r.downgrades.length).toBeGreaterThan(0);
    expect(r.downgrades[0]).toMatch(/P provenance is \d+d old/);
  });

  it("does not downgrade a block verdict on stale provenance", async () => {
    const stale = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    await writeFile(
      fixturesPath,
      JSON.stringify({
        P: 0.95,
        R: 0.5,
        D: 0.6,
        provenance: {
          P: { source: "stale", asOf: stale },
          R: { source: "stale", asOf: stale },
          D: { source: "stale", asOf: stale },
        },
      }),
    );
    const r = await runPhiPrime({ fixturesPath });
    expect(r.report.gate).toBe("block");
    expect(r.downgrades.length).toBeGreaterThan(0);
  });
});
