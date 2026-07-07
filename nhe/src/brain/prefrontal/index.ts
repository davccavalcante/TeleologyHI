/**
 * Prefrontal region (Entry 21, deliberation + amygdala-veto).
 *
 * This module ships the ownership descriptor. The deliberation surface is
 * exercised today through the `reasoning/` strategies (chainOfThought,
 * reflexion, selfRefine, etc.); future cuts may re-home them under
 * this region without breaking the public API.
 *
 * Ownership: `him-owned`. Deliberation policy is derived from the
 * HIM's axiom corpus + persona; it survives reincarnation by virtue
 * of those layers persisting.
 */
import type { BrainRegion } from "../types.js";

export const prefrontal: BrainRegion = {
  name: "prefrontal",
  ownership: "him-owned",
  role:
    "Deliberation + amygdala-veto. Hosts the reasoning strategies " +
    "(chainOfThought, reflexion, selfRefine, etc.) and the OKL-nucleus " +
    "narrowing. Veto power over affect-driven impulses. Survives " +
    "reincarnation via the HIM axiom corpus and persona.",
  entries: [21, 22],
};
