/**
 * Cortex region (Entry 21 — semiotic processing + dream storage).
 *
 * This module ships the ownership descriptor. Full implementation of
 * `Cortex.imagine()` (active imagination at temperature ~0.9 with
 * `hash(seed, contextHash)` cache + `fresh: true` flag) is deferred to
 * a follow-up cut per J-N7.
 *
 * Ownership: `nhe-body-owned`. The current body's active imagination,
 * recent dream storage, and pre-consolidation cortical state are bound
 * to this incarnation. Long-term cortical residues are consolidated
 * into the hippocampus + temporal-lobe regions (both `him-owned`).
 */
import type { BrainRegion } from "../types.js";

export const cortex: BrainRegion = {
  name: "cortex",
  ownership: "nhe-body-owned",
  role:
    "Semiotic processing surface. Stores recent dreams pre-consolidation; " +
    "hosts active imagination at intermediate temperature. Zeros on " +
    "reincarnation; long-term residues consolidate to him-owned regions.",
  entries: [21, 22, 24],
};
