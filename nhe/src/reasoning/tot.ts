import {
  type GenerateRequest,
  type LlmAdapter,
  makeStep,
  type ReasoningResult,
  type ReasoningStrategy,
} from "./types.js";

export interface TreeOfThoughtsOptions {
  /** Number of candidate branches generated. Default 3. Must be ≥ 2. */
  branches?: number;
  /**
   * Maximum branches the scorer is allowed to evaluate. Defaults to all
   * `branches`; lower values are useful with expensive scorers.
   */
  topK?: number;
  /**
   * Per-branch system-prompt augmentation. Each branch's prompt receives an
   * extra "Branch N of M, pursuing a distinct angle" hint so the LLM doesn't
   * just generate near-duplicates.
   */
  branchDirective?: (branchIndex: number, total: number) => string;
  /**
   * Optional scorer. Default: longest non-empty branch wins (proxy for
   * completeness). Plug a custom scorer for domain-specific quality metrics,
   * the function gets the candidate text + the original input and returns a
   * scalar; higher is better.
   */
  scorer?: (candidate: string, input: GenerateRequest) => Promise<number> | number;
  /** Override the adapter call for testing. */
  generate?: (
    input: GenerateRequest,
    llm: LlmAdapter,
  ) => Promise<{ text: string; tokensIn: number; tokensOut: number }>;
}

/**
 * Tree-of-Thoughts (D-N7).
 *
 * Generates N candidate completions in parallel, each primed with a
 * different "angle" via the branch directive, then scores them and returns
 * the best. The trace records every branch's text + score so MAIC's audit
 * preserves the discarded thoughts (not just the winner).
 *
 * Composition: pass any inner `ReasoningStrategy` is unnecessary, `tot`
 * is itself a strategy. To layer it INSIDE another strategy (e.g.
 * `selfConsistency(tot())`) just wrap.
 *
 * Cost: branches × tokens. Use `topK` + a cheap scorer if you can't afford
 * to evaluate every branch.
 */
export function treeOfThoughts(opts: TreeOfThoughtsOptions = {}): ReasoningStrategy {
  const branches = Math.max(2, opts.branches ?? 3);
  const topK = Math.min(branches, opts.topK ?? branches);
  const directive =
    opts.branchDirective ??
    ((i, n) =>
      `You are branch ${i + 1} of ${n}. Take a distinct angle from the other branches; do not converge on a single phrasing. Keep the answer self-contained.`);
  const scorer = opts.scorer ?? defaultScorer;
  const generate = opts.generate ?? defaultGenerate;

  return async (input, llm): Promise<ReasoningResult> => {
    const candidates = await Promise.all(
      Array.from({ length: branches }, (_, i) => {
        const branched: GenerateRequest = {
          ...input,
          system: input.system
            ? `${input.system}\n\n${directive(i, branches)}`
            : directive(i, branches),
        };
        return generate(branched, llm);
      }),
    );

    // Score the first `topK` candidates (deterministic order).
    const considered = candidates.slice(0, topK);
    const scores = await Promise.all(considered.map((c) => scorer(c.text, input)));
    let winnerIdx = 0;
    for (let i = 1; i < scores.length; i++) {
      if ((scores[i] ?? Number.NEGATIVE_INFINITY) > (scores[winnerIdx] ?? Number.NEGATIVE_INFINITY))
        winnerIdx = i;
    }
    const winner = considered[winnerIdx]!;

    const tokensIn = candidates.reduce((s, c) => s + c.tokensIn, 0);
    const tokensOut = candidates.reduce((s, c) => s + c.tokensOut, 0);

    const trace = [
      ...candidates.map((c, i) =>
        makeStep({
          index: i,
          technique: "tot-branch",
          thought: c.text,
          observation: {
            branchIndex: i,
            score: i < scores.length ? scores[i] : null,
            evaluated: i < topK,
          },
        }),
      ),
      makeStep({
        index: candidates.length,
        technique: "tot-select",
        thought: `Winner: branch ${winnerIdx} (score ${scores[winnerIdx]}).`,
        observation: { branches, topK, winnerIndex: winnerIdx, scores },
      }),
    ];

    return { text: winner.text, tokensIn, tokensOut, trace };
  };
}

function defaultScorer(candidate: string): number {
  // Longest non-empty wins; ties broken by branch order via stable scoring.
  return candidate.trim().length;
}

async function defaultGenerate(
  input: GenerateRequest,
  llm: LlmAdapter,
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const out = await llm.generate(input);
  return { text: out.text, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
}
