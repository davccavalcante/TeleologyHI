import { JungianArchetype, type JungianProfile } from "@teleologyhi-sdk/maic";
import { seededLikert, stableRound } from "./deterministic.js";
import { JUNGIAN_ITEMS } from "./jungian-items.js";

/**
 * Jungian archetype casting engine (Entry 27 section 4 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md).
 *
 * PERSONA-SIMULATION, NOT ASSESSMENT. `castJungianProfile` administers the
 * 60-item Pearson-Marr battery to a deterministic stand-in derived from the
 * birth seed (no LLM call) and returns the archetypal axis of the HIM's
 * constitutional profile: a dominant archetype plus two secondaries. It is a
 * constitutional parameter for a synthetic non-corporeal entity, never a
 * psychological assessment of any person.
 *
 * Determinism: the same seed always yields the same profile. Scores are the
 * per-archetype mean of item responses, so the non-uniform item count per
 * archetype does not bias the ranking.
 */

/** Battery identity, stamped alongside profiles for provenance and versioning. */
export const JUNGIAN_BATTERY_VERSION = "thi-jungian-60-v1";

/** Canonical archetype order, used as a deterministic tie-break in ranking. */
const ARCHETYPE_ORDER: readonly JungianArchetype[] = JungianArchetype.options;

/**
 * Cast the archetypal axis from a birth seed.
 *
 * @param seed the birth-signature seed (see `birth/seed.ts`).
 * @returns a `JungianProfile` with `dominant`, two `secondaries`, and the full
 *   per-archetype `scores` map (each rounded to three decimals).
 */
export function castJungianProfile(seed: string): JungianProfile {
  const sums = new Map<JungianArchetype, number>();
  const counts = new Map<JungianArchetype, number>();

  for (const item of JUNGIAN_ITEMS) {
    const response = seededLikert(seed, item.id, item.archetype);
    sums.set(item.archetype, (sums.get(item.archetype) ?? 0) + response);
    counts.set(item.archetype, (counts.get(item.archetype) ?? 0) + 1);
  }

  const scores: Partial<Record<JungianArchetype, number>> = {};
  for (const archetype of ARCHETYPE_ORDER) {
    const count = counts.get(archetype) ?? 0;
    scores[archetype] = stableRound(count === 0 ? 0 : (sums.get(archetype) ?? 0) / count);
  }

  // Rank by score descending, breaking ties by canonical archetype order so the
  // result is fully deterministic.
  const ranked = [...ARCHETYPE_ORDER].sort((a, b) => {
    const diff = (scores[b] ?? 0) - (scores[a] ?? 0);
    if (diff !== 0) return diff;
    return ARCHETYPE_ORDER.indexOf(a) - ARCHETYPE_ORDER.indexOf(b);
  });

  return {
    dominant: ranked[0]!,
    secondaries: [ranked[1]!, ranked[2]!],
    scores: scores as Record<JungianArchetype, number>,
  };
}
