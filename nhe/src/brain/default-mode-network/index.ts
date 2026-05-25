/**
 * Default-mode-network region (Entry 24 — limbo state machine).
 *
 * Ships the ownership descriptor + the limbo state machine
 * (`src/brain/default-mode-network/limbo-state.ts`, J-N9). Entry into
 * deep-coma costs zero compute by design — the NHE simply stops
 * scheduling work. Return from limbo emits the `reunion` affect (the
 * ninth canonical affect introduced by `@teleologyhi-sdk/maic`).
 *
 * Ownership: `nhe-body-owned`. The limbo machine is bound to this
 * incarnation; on `return-from-limbo` the HIM persists and the body
 * resumes scheduling. On unrecoverable deep-coma the operator may
 * choose to reincarnate the HIM into a new body via
 * `@teleologyhi-sdk/maic`'s `reincarnateHim` API (see
 * `@teleologyhi-sdk/him`'s `reincarnate({ lifecycle: "return-from-limbo" })`).
 */
import type { BrainRegion } from "../types.js";

export const defaultModeNetwork: BrainRegion = {
  name: "default-mode-network",
  ownership: "nhe-body-owned",
  role:
    "Limbo state machine. Tracks four states: awake | drifting | " +
    "deep-coma | returning. Entry into deep-coma costs zero compute. " +
    "Return emits the reunion affect (9th canonical, Entry 24). Zeros " +
    "on reincarnation.",
  entries: [24],
};

export { evaluateLimboTransition, mkLimboTransition } from "./limbo-state.js";
export type {
  LimboMachineInput,
  LimboMachineThresholds,
  LimboMachineTransition,
} from "./limbo-state.js";
