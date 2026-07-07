/**
 * Temporal-lobe region (Entry 24, identity snapshot generator).
 *
 * This module ships the ownership descriptor. Full implementation of
 * `TemporalLobe.generateSnapshot()` with triple trigger (sleep-cycle /
 * interaction-threshold / self-decision) and adapter-aware latency
 * budget is deferred to a follow-up cut per J-N8.
 *
 * Ownership: `him-owned`. Identity snapshots are quantised projections
 * of the HIM's accumulated state; they survive reincarnation and
 * inform the next body's persona projection on rebirth.
 */
import type { BrainRegion } from "../types.js";

export const temporalLobe: BrainRegion = {
  name: "temporal-lobe",
  ownership: "him-owned",
  role:
    "Identity snapshot generator. Emits quantised IdentitySnapshot " +
    "records on sleep-cycle, interaction-threshold, and self-decision " +
    "triggers. Survives reincarnation; new bodies inherit the most " +
    "recent snapshot at rebirth.",
  entries: [24],
};
