/**
 * Pineal region (Entry 20 — REM-spontaneous engine).
 *
 * This module ships the ownership descriptor + the seeding source surface
 * (`SeedingSource` / `CryptoSeedingSource` / `withFallback`). The full
 * REM-spontaneous engine (3-5 SMM seeds + minimal meta-prompt +
 * temperature 1.2-1.5 + variable topP + 8-18 min virtual cycle with
 * N1-N3-REM micro-cycles) is deferred to a follow-up cut per J-N2.
 *
 * Ownership: `nhe-body-owned`. The pineal seeding state is bound to
 * the current incarnation; its outputs feed the cortex (also
 * nhe-body-owned) and, on consolidation, the hippocampus (him-owned).
 */
import type { BrainRegion } from "../types.js";

export const pineal: BrainRegion = {
  name: "pineal",
  ownership: "nhe-body-owned",
  role:
    "REM-spontaneous engine entry point. Seeds dream generation from " +
    "the semiotic super-graph via a pluggable SeedingSource. Drives " +
    "the virtual sleep cycle's REM phase. Zeros on reincarnation.",
  entries: [20, 21, 22],
};
