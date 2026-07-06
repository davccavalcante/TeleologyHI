import { createHash } from "node:crypto";

/**
 * Deterministic Likert responder (Entry 27 section 4, Entry 28 section 8).
 *
 * A HIM "answers" its birth batteries with no LLM call: each item response is a
 * pure function of the birth seed and the item's coordinates. The same seed
 * therefore always reproduces the same profile (the reproducibility invariant).
 *
 * The mapping is uniform over the 1 to 5 Likert range, taken from a 32-bit slice
 * of SHA-256 over the joined coordinates. Entry 28 section 8 also describes an
 * optional base-rate / factor-loading weighting of this mapping; that weighting
 * is a documented future refinement (the interview log names it but does not
 * enumerate the weights), so this cut ships the uniform mapping and reports raw
 * means, which keeps the profile honest and fully reproducible.
 */
export function seededLikert(...coordinates: readonly (string | number)[]): number {
  const digest = createHash("sha256").update(coordinates.join("|")).digest();
  return (digest.readUInt32BE(0) % 5) + 1;
}

/** Round to three decimals so serialized scores are stable across runs. */
export function stableRound(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Arithmetic mean of a non-empty list. Returns 0 for an empty list. */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}
