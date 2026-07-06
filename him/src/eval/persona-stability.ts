import type { HimHandle } from "../handle/him-handle.js";
import { cosineSimilarity } from "../persona/embedder.js";

/**
 * Persona stability eval suite (D-H3).
 *
 * Three measurements:
 *
 *   - `crossHimSimilarity`, pairwise cosine similarity between N HimHandles.
 *     Lower is better when the HIMs are *meant* to be distinct (each one
 *     has a different archetype); higher is better when comparing the same
 *     HIM minted from a fresh body (reincarnation).
 *   - `selfStability`, given an array of pre-snapshot and post-snapshot
 *     persona vectors for the same HIM (e.g. before/after an upgrade), the
 *     mean cosine. Phi-Prime's `P` component (see ../../PHI_PRIME.md).
 *   - `adapterSensitivity`, given N persona vectors that should all
 *     describe the same HIM but were obtained against different LLM
 *     adapters, the variance of pairwise similarities. Smaller is better.
 *
 * No I/O. Plug a HIM list, get a number. Useful as a release gate (target
 * `selfStability ≥ 0.85` per Phi-Prime `P`).
 */

export interface PersonaStabilityReport {
  /** Number of HimHandles compared. */
  count: number;
  /** Pairwise similarity matrix. `pairs[i][j]` is the cosine between HIMs i and j. */
  pairs: number[][];
  /** Mean of the upper-triangle (i<j); diagonal excluded. */
  meanSimilarity: number;
  /** Min and max across the upper-triangle. */
  minSimilarity: number;
  maxSimilarity: number;
}

/**
 * Compute the pairwise cosine matrix between N HimHandles' persona vectors.
 */
export function evaluatePersonaStability(handles: readonly HimHandle[]): PersonaStabilityReport {
  const n = handles.length;
  const vectors = handles.map((h) => h.getPersonaVector().embedding);
  const pairs: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  const offDiag: number[] = [];
  for (let i = 0; i < n; i++) {
    pairs[i]![i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(vectors[i]!, vectors[j]!);
      pairs[i]![j] = sim;
      pairs[j]![i] = sim;
      offDiag.push(sim);
    }
  }

  if (offDiag.length === 0) {
    return { count: n, pairs, meanSimilarity: 1, minSimilarity: 1, maxSimilarity: 1 };
  }

  const sum = offDiag.reduce((s, x) => s + x, 0);
  return {
    count: n,
    pairs,
    meanSimilarity: sum / offDiag.length,
    minSimilarity: Math.min(...offDiag),
    maxSimilarity: Math.max(...offDiag),
  };
}

/**
 * Phi-Prime `P` component: mean cosine between snapshots of the same HIM
 * across N upgrade events. Pass the persona vectors taken before each
 * upgrade and after each upgrade in order; the function pairs them
 * positionally.
 */
export function selfStability(
  before: readonly Float32Array[],
  after: readonly Float32Array[],
): number {
  if (before.length === 0 || before.length !== after.length) return Number.NaN;
  let sum = 0;
  for (let i = 0; i < before.length; i++) {
    sum += cosineSimilarity(before[i]!, after[i]!);
  }
  return sum / before.length;
}

/**
 * Adapter sensitivity: given N persona vectors that all describe the same
 * HIM but were obtained against different adapter setups (e.g.
 * `AnthropicAdapter` + `GeminiAdapter` + `OllamaAdapter`), return the
 * variance of pairwise similarities. Smaller variance = more stable persona
 * across providers.
 */
export function adapterSensitivity(vectors: readonly Float32Array[]): number {
  if (vectors.length < 2) return 0;
  const sims: number[] = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      sims.push(cosineSimilarity(vectors[i]!, vectors[j]!));
    }
  }
  const mean = sims.reduce((s, x) => s + x, 0) / sims.length;
  const variance = sims.reduce((s, x) => s + (x - mean) * (x - mean), 0) / sims.length;
  return variance;
}
