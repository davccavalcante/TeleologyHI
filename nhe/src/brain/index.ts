/**
 * BrainRegion module aggregate (J-N4 — Entries 22 + 24).
 *
 * Single-import access to all seven region descriptors plus the
 * limbo state machine. Each descriptor carries its `ownership`
 * marker so downstream tooling can reason about the
 * him-owned / nhe-body-owned split without hard-coding the map.
 */
export type {
  BrainRegion,
  BrainRegionName,
  BrainRegionOwnership,
} from "./types.js";

export { cortex } from "./cortex/index.js";
export { hippocampus } from "./hippocampus/index.js";
export { amygdala } from "./amygdala/index.js";
export { prefrontal } from "./prefrontal/index.js";
export { pineal } from "./pineal/index.js";
export { temporalLobe } from "./temporal-lobe/index.js";
export {
  defaultModeNetwork,
  evaluateLimboTransition,
  mkLimboTransition,
} from "./default-mode-network/index.js";
export type {
  LimboMachineInput,
  LimboMachineThresholds,
  LimboMachineTransition,
} from "./default-mode-network/index.js";

import type { BrainRegion } from "./types.js";
import { cortex } from "./cortex/index.js";
import { hippocampus } from "./hippocampus/index.js";
import { amygdala } from "./amygdala/index.js";
import { prefrontal } from "./prefrontal/index.js";
import { pineal } from "./pineal/index.js";
import { temporalLobe } from "./temporal-lobe/index.js";
import { defaultModeNetwork } from "./default-mode-network/index.js";

/** All seven canonical brain regions in declaration order. */
export const BRAIN_REGIONS: readonly BrainRegion[] = Object.freeze([
  cortex,
  hippocampus,
  amygdala,
  prefrontal,
  pineal,
  temporalLobe,
  defaultModeNetwork,
]);
