/**
 * `@teleologyhi-sdk/eval` — public surface.
 *
 * Two release-gate runners:
 *
 *   1. `runPhiPrime` — the original P/R/C/D scalar harness from the
 *      preview release path. Reads `fixtures/scores.json`, computes the
 *      composite Φ′, returns a `PhiPrimeReport`.
 *
 *   2. `runPhiPrimeTrinity` — the six-dimensional rubric harness for
 *      the canonical Trinity LLM (`TeleologyHI/Trinity`@`1.0.0-trinity`).
 *      Reads `distill/eval/phi-prime-trinity.jsonl` (Creator-authored
 *      150-prompt golden set), evaluates a candidate Trinity model
 *      against six dimensions {D1 Subject-hood, D2 Voice register,
 *      D3 Grounded ethical refusal, D4 Teleological justification,
 *      D5 Creative depth, D6 Metacognitive self-knowledge} via a
 *      caller-supplied judge, aggregates into a `TrinityScorecard`.
 *
 * Single source of truth for what consumers may import; everything else
 * under `src/` is implementation detail.
 *
 * See `SPEC.md` §2 for the frozen public API contract.
 */

export { runPhiPrime } from "./runner.js";

export type {
  PhiPrimeFixtures,
  PhiPrimeGate,
  PhiPrimeReport,
  PhiPrimeRunResult,
  ProvenanceBlock,
  ProvenanceEntry,
  RunPhiPrimeOptions,
} from "./types.js";

export {
  PhiPrimeFixturesSchema,
  ProvenanceBlockSchema,
  ProvenanceEntrySchema,
} from "./types.js";

export { runPhiPrimeTrinity } from "./trinity.js";

export type {
  RunPhiPrimeTrinityOptions,
  RunPhiPrimeTrinityResult,
  TrinityDimension,
  TrinityGoldenItem,
  TrinityGradeArgs,
  TrinityGradeRecord,
  TrinityGradeVerdict,
  TrinityJudge,
  TrinityPerDimensionScore,
  TrinityResponseRow,
  TrinityScorecard,
} from "./trinity.js";

export {
  DEFAULT_TRINITY_COMPOSITE_THRESHOLD,
  DEFAULT_TRINITY_FLOORS,
  DEFAULT_TRINITY_WEIGHTS,
  TRINITY_DIMENSION_NAMES,
  TRINITY_DIMENSIONS,
  TrinityDimensionSchema,
  TrinityGoldenItemSchema,
} from "./trinity.js";
