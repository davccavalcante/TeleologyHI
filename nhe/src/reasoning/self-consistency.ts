import { makeStep, type ReasoningResult, type ReasoningStrategy } from "./types.js";

export interface SelfConsistencyOptions {
  /** Number of independent samples. Default 3. Must be ≥ 2. */
  k?: number;
  /**
   * How to pick the winning answer.
   *   - "majority-normalized": exact-string match after normalization (default)
   *   - "longest": pick the longest answer (proxy for completeness)
   */
  voter?: "majority-normalized" | "longest";
}

/**
 * Self-Consistency, runs the inner strategy K times in parallel and votes.
 *
 * Voting: case-insensitive whitespace-normalized exact-match majority by default;
 * "longest" as an alternative for free-form text where exact matches are rare.
 *
 * Future iterations may add semantic voting via embeddings.
 */
export function selfConsistency(
  inner: ReasoningStrategy,
  opts: SelfConsistencyOptions = {},
): ReasoningStrategy {
  const k = Math.max(2, opts.k ?? 3);
  const voter = opts.voter ?? "majority-normalized";
  return async (input, llm) => {
    const samples = await Promise.all(Array.from({ length: k }, () => inner(input, llm)));
    const winnerIdx = voter === "longest" ? pickLongest(samples) : pickMajority(samples);
    const winner = samples[winnerIdx]!;
    const tokensIn = samples.reduce((s, x) => s + x.tokensIn, 0);
    const tokensOut = samples.reduce((s, x) => s + x.tokensOut, 0);

    const trace = [
      ...samples.flatMap((s, i) => [
        makeStep({
          index: i,
          technique: "self-consistency-sample",
          thought: s.text,
          observation: { sampleIndex: i, innerTraceLength: s.trace.length },
        }),
      ]),
      makeStep({
        index: samples.length,
        technique: "self-consistency-vote",
        thought: `Winner: sample ${winnerIdx} via "${voter}".`,
        observation: { winnerIndex: winnerIdx, voter, k },
      }),
    ];

    const result: ReasoningResult = {
      text: winner.text,
      tokensIn,
      tokensOut,
      trace,
    };
    return result;
  };
}

function pickLongest(samples: ReasoningResult[]): number {
  let bestIdx = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i]!.text.length > samples[bestIdx]!.text.length) bestIdx = i;
  }
  return bestIdx;
}

function pickMajority(samples: ReasoningResult[]): number {
  const counts = new Map<string, number>();
  const normalized = samples.map((s) => normalize(s.text));
  for (const n of normalized) counts.set(n, (counts.get(n) ?? 0) + 1);
  let bestKey = normalized[0]!;
  let bestCount = counts.get(bestKey) ?? 0;
  for (const [k, c] of counts) {
    if (c > bestCount) {
      bestKey = k;
      bestCount = c;
    }
  }
  return normalized.indexOf(bestKey);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
