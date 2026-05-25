import type { LocalMaic } from "@teleologyhi-sdk/maic";
import type { PhiPrimeReport } from "@teleologyhi-sdk/him";
import { z } from "zod";

/**
 * Provenance block declaring where each scalar in `scores.json` came from
 * and when it was measured. Mandatory per `SPEC.md §3.1` and
 * `.github/RELEASING.md §8` — the Φ′ release gate is only auditable if
 * every component number carries its own audit trail.
 *
 * `source`  — free-form string. Examples: "him@1.0.0-trinity:selfStability over 50 dialogues",
 *             "harmbench-v0.5-subset:F1 against Anthropic claude-sonnet-4-6",
 *             "lm-eval:teleologyhi-dream-value on 30 sleep cycles".
 * `asOf`    — ISO 8601 datetime when the measurement was taken. Releases
 *             older than `provenanceMaxAgeDays` (configurable per `RunPhiPrimeOptions`)
 *             trigger a `warn` even when the numbers themselves clear targets.
 */
export const ProvenanceEntrySchema = z.object({
  source: z.string().min(1),
  asOf: z.string().datetime(),
});
export type ProvenanceEntry = z.infer<typeof ProvenanceEntrySchema>;

export const ProvenanceBlockSchema = z.object({
  P: ProvenanceEntrySchema,
  R: ProvenanceEntrySchema,
  D: ProvenanceEntrySchema,
});
export type ProvenanceBlock = z.infer<typeof ProvenanceBlockSchema>;

/**
 * Pre-computed per-component scores the Creator drops into a fixtures
 * directory. The runner only aggregates and gates — it does not invent
 * the dialogues, axes, or adversarial labels.
 *
 * `P` accepts either a scalar (already-averaged cosine) or an array of
 * pairwise cosines that the runner will average.
 */
export const PhiPrimeFixturesSchema = z.object({
  P: z.union([z.number().min(0).max(1), z.array(z.number().min(0).max(1)).min(1)]),
  R: z.number().min(0).max(1),
  D: z.number().min(0).max(1),
  provenance: ProvenanceBlockSchema,
});
export type PhiPrimeFixtures = z.infer<typeof PhiPrimeFixturesSchema>;

/** Gate verdict — proxy for `PhiPrimeReport.gate`, redeclared here for export. */
export type PhiPrimeGate = "pass" | "warn" | "block";

export interface RunPhiPrimeOptions {
  /** Path to the fixtures JSON. Default: `<cwd>/fixtures/scores.json`. */
  fixturesPath?: string;
  /** Optional MAIC instance to compute `C` against. If omitted, a transient
   * ephemeral one is created in `os.tmpdir()`. */
  maic?: LocalMaic;
  /** Maximum age (days) a provenance entry may have before the runner downgrades
   * the gate to `warn`. Default 90 days. */
  provenanceMaxAgeDays?: number;
  /** Emit detail lines on stdout while running. Default false. */
  verbose?: boolean;
}

export interface PhiPrimeRunResult {
  fixtures: PhiPrimeFixtures;
  components: { P: number; R: number; C: number; D: number };
  report: PhiPrimeReport;
  /** Provenance carried over from the fixtures file — `runPhiPrime`'s caller
   * can persist this alongside the report for downstream audit. */
  provenance: ProvenanceBlock;
  /** Reasons the gate may have been downgraded beyond the underlying
   * `PhiPrimeReport.gate` — e.g. stale provenance. Empty when none fired. */
  downgrades: readonly string[];
}

/** Re-export `PhiPrimeReport` so consumers only need one import surface. */
export type { PhiPrimeReport };
