/**
 * Pluggable embedder interface (D-H4).
 *
 * The default `PersonaProjector` ships a deterministic hash-based embedder
 * that produces a 256-dimensional unit vector with zero runtime dependencies.
 * That choice keeps the bundle small and lets persona projection work in
 * any Node/browser environment without model weights.
 *
 * Operators who need a learned embedding, for example to drive RAG over a
 * library of HIM personas, or to compare personas against natural-language
 * descriptions, can provide a custom embedder that conforms to this
 * interface. A reference ONNX implementation backed by Transformers.js is
 * tracked under TASK.md D-H4 but is not shipped here: the choice of model
 * (MiniLM, mpnet, BGE, etc.) and the bundle-size trade-off should be the
 * operator's, not the framework's.
 */

export interface Embedder {
  /** Stable id surfaced in logs / audit so different embedders are distinguishable. */
  readonly id: string;
  /** Output dimensionality. The `PersonaProjector` honours this. */
  readonly dimension: number;
  /**
   * Embed a single string. Implementations MUST return a Float32Array of
   * length `dimension` with L2-norm equal to 1 (or close enough that
   * downstream cosine-similarity calculations are well-defined).
   */
  embed(text: string): Promise<Float32Array> | Float32Array;
}

/**
 * Cosine similarity between two L2-normalised embeddings of the same
 * dimension. Returns NaN when dimensions disagree. Assumes normalised inputs
 * (it does not re-normalise) and clamps the result to [-1, 1] so a
 * floating-point overshoot on unit vectors cannot leak a value outside the
 * cosine range, matching the internal clamp in `PersonaProjector`.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return Number.NaN;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return Math.max(-1, Math.min(1, dot));
}
