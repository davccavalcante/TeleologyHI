/**
 * BM25, Okapi BM25 ranking, dependency-free (D-N3 step 1).
 *
 * The previous `recallFromTemporalLobe` used a raw keyword count. That ranked
 * documents by how often a query token appeared, with no normalisation for
 * document length or term rarity. BM25 fixes both:
 *
 *   - **Document length normalisation** (b parameter) penalises long documents
 *     that just happen to contain a query term many times.
 *   - **Term saturation** (k1 parameter) caps the marginal benefit of repeating
 *     the same term.
 *   - **Inverse document frequency** weights rare terms more than common ones.
 *
 * This is a single-pass IR algorithm with no external dependencies.
 * Performance: O(N) per query over the corpus. Fine up to ~10k documents on
 * a laptop. For larger corpora the embedder hook (see ./recall.ts) plugs in
 * a sentence-transformer + an ANN index.
 *
 * Defaults: k1=1.5, b=0.75, the canonical Okapi values used by Elasticsearch
 * and Lucene. Override for domain-specific tuning.
 */

export interface Bm25Document {
  /** Stable id used to dedup/keep ordering predictable. */
  id: string;
  /** The text to score against the query. */
  text: string;
}

export interface Bm25Result<T extends Bm25Document> {
  doc: T;
  score: number;
}

export interface Bm25Options {
  /** Term frequency saturation. Default 1.5. */
  k1?: number;
  /** Document-length normalisation. Default 0.75. */
  b?: number;
}

/**
 * Score `docs` against `query` and return them sorted by descending BM25.
 * Zero-score documents are dropped so callers can rely on the result length.
 */
export function bm25<T extends Bm25Document>(
  query: string,
  docs: readonly T[],
  opts: Bm25Options = {},
): Bm25Result<T>[] {
  const k1 = opts.k1 ?? 1.5;
  const b = opts.b ?? 0.75;

  const tokens = tokenise(query);
  if (tokens.length === 0 || docs.length === 0) return [];

  // Pre-tokenise each document and cache its length + term-frequency map.
  const docTokens = docs.map((d) => tokenise(d.text));
  const docLengths = docTokens.map((t) => t.length);
  const avgDl = docLengths.reduce((s, l) => s + l, 0) / Math.max(1, docLengths.length);

  // For each query term, compute IDF and accumulate scores per document.
  const scores = new Array<number>(docs.length).fill(0);
  for (const term of new Set(tokens)) {
    const df = docTokens.reduce((n, terms) => n + (terms.includes(term) ? 1 : 0), 0);
    if (df === 0) continue;
    const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
    for (let i = 0; i < docs.length; i++) {
      const tf = docTokens[i]!.filter((t) => t === term).length;
      if (tf === 0) continue;
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + (b * docLengths[i]!) / avgDl);
      scores[i] = (scores[i] ?? 0) + idf * (numerator / denominator);
    }
  }

  const out: Bm25Result<T>[] = [];
  for (let i = 0; i < docs.length; i++) {
    if ((scores[i] ?? 0) > 0) {
      out.push({ doc: docs[i]!, score: scores[i] ?? 0 });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/**
 * Default tokenizer: lowercase + split on non-word characters + drop short
 * tokens. Exported so callers can build their own corpus for the same
 * scorer.
 */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((t) => t.length > 1);
}
