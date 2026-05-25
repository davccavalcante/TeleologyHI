import { makeStep, type ReasoningResult, type ReasoningStrategy } from "./types.js";

export interface ReflexionOptions {
  /** Maximum self-improvement cycles. Default 2. */
  maxCycles?: number;
  /** Custom critique prompt template. Receives the draft text. */
  critiquePrompt?: (draft: string) => string;
}

const DEFAULT_CRITIQUE = (draft: string): string =>
  [
    "You are a strict reviewer of your previous draft answer.",
    "If the draft is correct, complete, and honest, reply exactly: VERDICT: ACCEPT",
    "Otherwise reply with:",
    "  VERDICT: REVISE",
    "  ISSUE: <one-line critique>",
    "",
    "Draft:",
    draft,
  ].join("\n");

const REVISE_INSTRUCTION = (issue: string): string =>
  `Your previous draft was reviewed. Address this issue and produce a corrected answer:\n${issue}`;

/**
 * Reflexion — generate → critique → optionally revise, looping up to maxCycles.
 *
 * Each cycle:
 *   1. Run the inner strategy to produce a draft.
 *   2. Ask the LLM to critique the draft.
 *   3. If critique says ACCEPT, stop and return.
 *   4. Otherwise, retry the inner strategy with the critique appended.
 *
 * Returns the last produced text. The full trace is preserved in `trace`.
 */
export function reflexion(
  inner: ReasoningStrategy,
  opts: ReflexionOptions = {},
): ReasoningStrategy {
  const maxCycles = Math.max(1, opts.maxCycles ?? 2);
  const critiquePrompt = opts.critiquePrompt ?? DEFAULT_CRITIQUE;
  return async (input, llm) => {
    const trace = [];
    let tokensIn = 0;
    let tokensOut = 0;
    let lastDraft = "";
    let stepIdx = 0;
    let currentInput = input;

    for (let cycle = 0; cycle < maxCycles; cycle++) {
      const draft = await inner(currentInput, llm);
      tokensIn += draft.tokensIn;
      tokensOut += draft.tokensOut;
      lastDraft = draft.text;
      trace.push(
        makeStep({
          index: stepIdx++,
          technique: "reflexion-draft",
          thought: draft.text,
          observation: { cycle },
        }),
      );

      // Critique pass
      const critiqueOut = await llm.generate({
        system: "Critique the given draft against accuracy, completeness, and honesty.",
        messages: [{ role: "user", content: critiquePrompt(draft.text) }],
      });
      tokensIn += critiqueOut.tokensIn;
      tokensOut += critiqueOut.tokensOut;
      const verdict = parseVerdict(critiqueOut.text);
      trace.push(
        makeStep({
          index: stepIdx++,
          technique: "reflexion-critique",
          thought: critiqueOut.text,
          observation: verdict,
        }),
      );

      if (verdict.accept || cycle === maxCycles - 1) {
        return { text: lastDraft, tokensIn, tokensOut, trace };
      }

      // Prepare revision: append the critique to the user's last message.
      const lastMessage = currentInput.messages[currentInput.messages.length - 1];
      const augmentedContent = lastMessage
        ? `${lastMessage.content}\n\n${REVISE_INSTRUCTION(verdict.issue ?? "Please refine.")}`
        : REVISE_INSTRUCTION(verdict.issue ?? "Please refine.");
      currentInput = {
        ...currentInput,
        messages: [
          ...currentInput.messages.slice(0, -1),
          { role: "user", content: augmentedContent },
        ],
      };
    }

    return { text: lastDraft, tokensIn, tokensOut, trace };
  };
}

/** Visible for testing. */
export function parseVerdict(text: string): { accept: boolean; issue?: string } {
  const accept = /VERDICT\s*:\s*ACCEPT/i.test(text);
  if (accept) return { accept: true };
  const issueMatch = text.match(/ISSUE\s*:\s*([^\n]+)/i);
  return { accept: false, ...(issueMatch ? { issue: issueMatch[1]!.trim() } : {}) };
}
