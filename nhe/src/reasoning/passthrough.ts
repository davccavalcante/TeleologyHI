import { makeStep, type ReasoningResult, type ReasoningStrategy } from "./types.js";

/**
 * Passthrough — calls the LLM directly with no reasoning wrapper.
 * Used when `NheConfig.reasoning` is not configured.
 */
export const passthrough: ReasoningStrategy = async (input, llm) => {
  const r = await llm.generate(input);
  const result: ReasoningResult = {
    text: r.text,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    trace: [makeStep({ index: 0, technique: "passthrough", thought: r.text })],
  };
  return result;
};
