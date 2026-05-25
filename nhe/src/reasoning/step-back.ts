import {
  makeStep,
  type GenerateRequest,
  type LlmAdapter,
  type ReasoningResult,
  type ReasoningStrategy,
} from "./types.js";

export interface StepBackOptions {
  /** Override the abstraction prompt. */
  abstractionPrompt?: string;
  /** Use this strategy for the final answering step. Default: direct adapter call. */
  finalizer?: ReasoningStrategy;
}

const DEFAULT_ABSTRACTION =
  "Before answering directly, step back and identify the most general question or principle at stake. Reply on one line in the form `PRINCIPLE: <one sentence>` and nothing else.";

/**
 * Step-Back prompting (Zheng et al., 2023) — surface the abstract principle
 * behind the user's concrete question before answering. Common pattern in
 * complex reasoning where the model would otherwise solve the surface
 * problem with a brittle heuristic.
 *
 * Flow:
 *   1. Ask the model for the abstract principle behind the user's question.
 *   2. Inject the principle into the system prompt as additional context.
 *   3. Run the inner strategy (or a direct call) to produce the final answer.
 *
 * Trace records both the abstraction step and the final-answer step so
 * MAIC's audit can show the reasoning ladder.
 */
export function stepBack(opts: StepBackOptions = {}): ReasoningStrategy {
  const abstractionPrompt = opts.abstractionPrompt ?? DEFAULT_ABSTRACTION;
  return async (input, llm) => {
    const last = input.messages[input.messages.length - 1];
    const userText = last?.content ?? "";

    // Step 1: ask for the abstract principle
    const principleReq: GenerateRequest = {
      system: input.system,
      messages: [
        ...input.messages.slice(0, -1),
        { role: "user", content: `${userText}\n\n${abstractionPrompt}` },
      ],
      ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: 128 } : {}),
    };
    const principleOut = await llm.generate(principleReq);
    const principle = extractPrinciple(principleOut.text);

    // Step 2: finalize with the principle injected as additional system context
    const finalReq: GenerateRequest = {
      system: principle
        ? `${input.system}\n\nGuiding principle (derived via Step-Back): ${principle}`
        : input.system,
      messages: input.messages,
      ...(input.maxOutputTokens !== undefined
        ? { maxOutputTokens: input.maxOutputTokens }
        : {}),
    };

    const final = opts.finalizer
      ? await opts.finalizer(finalReq, llm)
      : {
          ...(await llm.generate(finalReq)),
          trace: [] as Awaited<ReturnType<ReasoningStrategy>>["trace"],
        };

    const result: ReasoningResult = {
      text: final.text,
      tokensIn: principleOut.tokensIn + final.tokensIn,
      tokensOut: principleOut.tokensOut + final.tokensOut,
      trace: [
        makeStep({
          index: 0,
          technique: "step-back-abstraction",
          thought: principleOut.text,
          observation: { principle },
        }),
        makeStep({
          index: 1,
          technique: "step-back-final",
          thought: final.text,
          observation: { tokensIn: final.tokensIn, tokensOut: final.tokensOut },
        }),
        ...final.trace,
      ],
    };
    return result;
  };
}

/**
 * Parse the abstraction step's output. Accepts `PRINCIPLE: <one-line>` or
 * — if the model didn't follow the format — falls back to the first line.
 */
export function extractPrinciple(text: string): string {
  const m = text.match(/PRINCIPLE:\s*(.+?)(?:\n|$)/i);
  if (m?.[1]) return m[1].trim();
  return text.split("\n")[0]?.trim() ?? "";
}
