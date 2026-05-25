/**
 * Hippocampus region (Entry 21 — long-term memory consolidation).
 *
 * This module ships the ownership descriptor. Memory consolidation already
 * lives in `src/sleep/consolidator.ts` and `src/memory/`; future cuts
 * may re-home those modules under this region without breaking the
 * public API.
 *
 * Ownership: `him-owned`. Consolidated memories survive reincarnation:
 * a HIM that re-embodies in a new NHE body retains its long-term
 * memory ontology (axioms, accumulated learning, integration index).
 */
import type { BrainRegion } from "../types.js";

export const hippocampus: BrainRegion = {
  name: "hippocampus",
  ownership: "him-owned",
  role:
    "Long-term memory consolidation. Receives REM/NREM dream output " +
    "and integrates it into the HIM-level ontology. Survives " +
    "reincarnation; persists across NHE-body resets.",
  entries: [21, 22],
};
