import type { BirthSignatureWithIdentity, CosmologicalProfile } from "@teleologyhi-sdk/maic";
import { castClinicalProfile } from "./clinical.js";
import { castJungianProfile } from "./jungian.js";
import { deriveBirthSeed } from "./seed.js";

/**
 * Constitutional profile casting (Entries 27 + 28 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md): synthesise the three-axis
 * `cosmologicalProfile` at the birth event.
 *
 * PERSONA-SIMULATION PARAMETERS, NOT ASSESSMENT. See `jungian.ts` and
 * `clinical.ts` for the per-axis disclaimers.
 *
 * Axes:
 *   - celestial: the natal chart, when the birth signature carries one. Full
 *     natal-chart computation is deferred (ephemeris library undecided, Entry 27
 *     section 3), so this cut passes through a chart only if the developer or
 *     MAIC already supplied one; otherwise the chart axis is absent.
 *   - archetypal: the Pearson-Marr Jungian profile cast from the birth seed.
 *   - clinical: the adapted PID-5 + HEXACO profile cast from the same seed.
 *
 * The seed is recorded on the profile so the reproducibility invariant is
 * externally checkable (see `verifyCosmologicalProfile`).
 */
export function castCosmologicalProfile(birth: BirthSignatureWithIdentity): CosmologicalProfile {
  const seed = deriveBirthSeed(birth);
  const profile: CosmologicalProfile = {
    jungian: castJungianProfile(seed),
    clinical: castClinicalProfile(seed).profile,
    seed,
  };
  if (birth.natalChart !== undefined) profile.chart = birth.natalChart;
  return profile;
}

/**
 * Verify that a persisted `cosmologicalProfile` is the deterministic product of
 * the birth signature it rides on (H2-2 of him/TASK.md).
 *
 * Because the profile is not part of `SIGNED_BIRTH_FIELDS` this cut (D-F5b), it
 * is not covered by the Creator signature. Recasting from the signed fields and
 * comparing the archetypal + clinical axes is the available integrity check: a
 * tampered profile fails, an authentic one passes. The `chart` axis is excluded
 * from the comparison because it is supplied, not cast.
 */
export function verifyCosmologicalProfile(birth: BirthSignatureWithIdentity): boolean {
  const persisted = birth.cosmologicalProfile;
  if (persisted === undefined) return false;
  const recast = castCosmologicalProfile(birth);
  return (
    persisted.seed === recast.seed &&
    JSON.stringify(persisted.jungian) === JSON.stringify(recast.jungian) &&
    JSON.stringify(persisted.clinical) === JSON.stringify(recast.clinical)
  );
}
