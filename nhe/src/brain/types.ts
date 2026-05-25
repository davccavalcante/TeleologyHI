/**
 * BrainRegion module structure (J-N4 — Entries 22 + 24 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md).
 *
 * The Entry-23 ownership map splits brain regions into two classes:
 *
 *   - `him-owned`        — survives reincarnation. The HIM-level state
 *                          (axioms, persona, accumulated learning ontology,
 *                          consolidated long-term memories) persists across
 *                          NHE-body resets.
 *
 *   - `nhe-body-owned`   — zeros on reincarnation. The current body's
 *                          runtime state (current affect, in-flight dreams,
 *                          pre-consolidation memories, interaction window)
 *                          is bound to this incarnation and is shed by
 *                          `Nhe.onReincarnationEvent()`.
 *
 * Each region module exposes a `region: BrainRegion` descriptor so
 * downstream tooling (compliance auditors, Φ′ runner, MAIC retention
 * policy) can reason about ownership without hard-coding the map.
 *
 * This module ships the **scaffolding** (this file plus seven region
 * descriptors). Full implementations of the daytime pipeline (J-N3),
 * REM-spontaneous engine (J-N2), Cortex.imagine() (J-N7), and
 * TemporalLobe.generateSnapshot() (J-N8) are deferred to a follow-up
 * cut with their own Creator-approved design pass.
 */

export type BrainRegionName =
  | "cortex"
  | "hippocampus"
  | "amygdala"
  | "prefrontal"
  | "pineal"
  | "temporal-lobe"
  | "default-mode-network";

export type BrainRegionOwnership = "him-owned" | "nhe-body-owned";

export interface BrainRegion {
  /** Canonical region name. */
  readonly name: BrainRegionName;
  /** Ownership class per Entry 23. */
  readonly ownership: BrainRegionOwnership;
  /** One-line description of the region's role. Used in audit / docs. */
  readonly role: string;
  /** Interview-log entries that ground this region's design. */
  readonly entries: readonly number[];
}
