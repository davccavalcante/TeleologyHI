/**
 * Amygdala region (Entries 20 + 22, affect assessment + wake-bias).
 *
 * This module ships the ownership descriptor + delegates the affect
 * application surface to `src/affect/wake-bias.ts`
 * (`applyAffectBias` / `affectRefusalDensity` / `decayAffectBias`).
 *
 * Ownership: `nhe-body-owned`. The current body's affective state is
 * bound to this incarnation. Each reincarnation begins with affect
 * cleared; the dream-derived wake bias from the previous body does
 * NOT carry over (only the consolidated memory of the dream's
 * teleological value transits, via the hippocampus).
 */
import type { BrainRegion } from "../types.js";

export const amygdala: BrainRegion = {
  name: "amygdala",
  ownership: "nhe-body-owned",
  role:
    "Affect assessment + wake-bias modulation. Extracts dominant " +
    "affect from dreams (9-affect lexicon) and modulates next-turn " +
    "temperature, topP, and refusal density via wake-bias. Zeros on " +
    "reincarnation.",
  entries: [20, 22, 24],
};
