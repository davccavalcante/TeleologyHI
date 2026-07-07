import { makeStep, type ReasoningResult, type ReasoningStrategy } from "./types.js";

const DEFAULT_CRITIQUE_PROMPT = (draft: string): string =>
  [
    "Identify concrete weaknesses in the following draft answer (clarity, accuracy,",
    "tone, structure). Be specific. Reply as a short bulleted list. Do not rewrite.",
    "",
    "Draft:",
    draft,
  ].join("\n");

const DEFAULT_REFINE_PROMPT = (draft: string, critique: string): string =>
  [
    "Rewrite the draft below applying ALL of the critique's points.",
    "Return ONLY the rewritten answer; do not echo the critique.",
    "",
    "Draft:",
    draft,
    "",
    "Critique:",
    critique,
  ].join("\n");

export interface SelfRefineOptions {
  critiquePrompt?: (draft: string) => string;
  refinePrompt?: (draft: string, critique: string) => string;
}

/**
 * Self-Refine, generate → critique → rewrite. Single pass.
 *
 * Distinct from Reflexion: Self-Refine always rewrites (no accept short-circuit)
 * and runs exactly once. Use for guaranteed polish; use Reflexion for guarded retries.
 */
export function selfRefine(
  inner: ReasoningStrategy,
  opts: SelfRefineOptions = {},
): ReasoningStrategy {
  const critiquePrompt = opts.critiquePrompt ?? DEFAULT_CRITIQUE_PROMPT;
  const refinePrompt = opts.refinePrompt ?? DEFAULT_REFINE_PROMPT;
  return async (input, llm) => {
    const draft = await inner(input, llm);
    const critique = await llm.generate({
      system: "You are a strict reviewer producing concise critique.",
      messages: [{ role: "user", content: critiquePrompt(draft.text) }],
    });
    const refined = await llm.generate({
      system: "You apply critique faithfully and produce a single rewritten answer.",
      messages: [{ role: "user", content: refinePrompt(draft.text, critique.text) }],
    });

    const trace = [
      makeStep({ index: 0, technique: "self-refine-draft", thought: draft.text }),
      makeStep({ index: 1, technique: "self-refine-critique", thought: critique.text }),
      makeStep({ index: 2, technique: "self-refine-refined", thought: refined.text }),
    ];

    const result: ReasoningResult = {
      text: refined.text,
      tokensIn: draft.tokensIn + critique.tokensIn + refined.tokensIn,
      tokensOut: draft.tokensOut + critique.tokensOut + refined.tokensOut,
      trace,
    };
    return result;
  };
}
