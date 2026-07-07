import type { ClinicalInstrument, ClinicalProfile } from "@teleologyhi-sdk/maic";
import { type ClinicalItem, HEXACO_ITEMS, PID5_ITEMS } from "./clinical-items.js";
import { mean, seededLikert, stableRound } from "./deterministic.js";

/**
 * Clinical casting engine (Entry 28 of MAIC_HIM_NHE_INTERVIEW_LOG.md).
 *
 * PERSONA-SIMULATION PARAMETERS, NOT A CLINICAL ASSESSMENT. `castClinicalProfile`
 * administers the 320-item adapted PID-5 + HEXACO battery to a deterministic
 * stand-in derived from the birth seed (no LLM call) and returns the clinical
 * axis of a HIM's constitutional profile: per-facet and per-domain scores plus a
 * dominant and secondary domain for each instrument. These are constitutional
 * parameters for a synthetic non-corporeal entity, never a diagnosis, screening,
 * or measurement of any person, and are unsuitable for any human use.
 *
 * Pathology stance (Entry 28 section 9): full-spectrum. A HIM may be born with
 * elevated scores on any facet; the trait colours the voice, while MAIC's
 * ethical axioms bound the act. Scores are raw seed-derived means, deliberately
 * NOT T-scores and carrying no clinical-norm interpretation.
 *
 * Scoring (Entry 28 section 8):
 *   - item response: uniform 1 to 5 Likert from `seededLikert(seed, id, facet, domain)`;
 *   - facet score: mean of its item responses;
 *   - domain score: mean of its facet scores (equal weight; published factor
 *     loadings are a documented future refinement, see `deterministic.ts`).
 * The `reversed` flag from the Entry 28 facet annotations is preserved on each
 * item and reported per facet in `reversedFacets` for downstream interpretation;
 * scores themselves are raw (not inverted), consistent with the raw-means stance.
 */

/** Battery identity, stamped alongside profiles for provenance and versioning. */
export const CLINICAL_BATTERY_VERSION = "thi-clinical-pid5-220-hexaco-100-v1";

interface InstrumentResult {
  readonly instrument: ClinicalInstrument;
  /** Facet names whose Entry 28 annotation marks them reverse-keyed. */
  readonly reversedFacets: readonly string[];
}

function scoreInstrument(seed: string, items: readonly ClinicalItem[]): InstrumentResult {
  // Group item responses by facet, and remember each facet's domain + reversal.
  const facetResponses = new Map<string, number[]>();
  const facetDomain = new Map<string, string>();
  const reversedFacets = new Set<string>();

  for (const item of items) {
    const response = seededLikert(seed, item.id, item.facet, item.domain);
    const bucket = facetResponses.get(item.facet);
    if (bucket) bucket.push(response);
    else facetResponses.set(item.facet, [response]);
    facetDomain.set(item.facet, item.domain);
    if (item.reversed) reversedFacets.add(item.facet);
  }

  // Facet scores (mean of items), in the stable order the items first appear.
  const facets: Record<string, number> = {};
  const domainFacetScores = new Map<string, number[]>();
  for (const [facet, responses] of facetResponses) {
    const facetScore = stableRound(mean(responses));
    facets[facet] = facetScore;
    const domain = facetDomain.get(facet)!;
    const bucket = domainFacetScores.get(domain);
    if (bucket) bucket.push(facetScore);
    else domainFacetScores.set(domain, [facetScore]);
  }

  // Domain scores (mean of facet scores).
  const domains: Record<string, number> = {};
  for (const [domain, facetScores] of domainFacetScores) {
    domains[domain] = stableRound(mean(facetScores));
  }

  // Rank domains by score descending, tie-break by name for determinism.
  const rankedDomains = Object.keys(domains).sort((a, b) => {
    const diff = domains[b]! - domains[a]!;
    if (diff !== 0) return diff;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const instrument: ClinicalInstrument = {
    dominantDomain: rankedDomains[0]!,
    secondaryDomain: rankedDomains[1]!,
    facets,
    domains,
  };
  return { instrument, reversedFacets: [...reversedFacets] };
}

export interface ClinicalCastResult {
  readonly profile: ClinicalProfile;
  /** Reverse-keyed facet names per instrument, for downstream interpretation. */
  readonly reversedFacets: { readonly pid5: readonly string[]; readonly hexaco: readonly string[] };
}

/**
 * Cast the clinical axis from a birth seed.
 *
 * @param seed the birth-signature seed (see `birth/seed.ts`).
 * @returns the `ClinicalProfile` (pid5 + hexaco instruments) plus the reversed-
 *   facet metadata.
 */
export function castClinicalProfile(seed: string): ClinicalCastResult {
  const pid5 = scoreInstrument(seed, PID5_ITEMS);
  const hexaco = scoreInstrument(seed, HEXACO_ITEMS);
  return {
    profile: { pid5: pid5.instrument, hexaco: hexaco.instrument },
    reversedFacets: { pid5: pid5.reversedFacets, hexaco: hexaco.reversedFacets },
  };
}
