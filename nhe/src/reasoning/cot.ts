import { makeStep, type ReasoningResult, type ReasoningStrategy } from "./types.js";

const COT_INSTRUCTION =
  "Think step by step. Lay out your reasoning explicitly under a 'REASONING:' header, " +
  "then give the final answer under an 'ANSWER:' header. " +
  "Do not include other headers; everything after 'ANSWER:' is the user-facing reply.";

export interface CotOptions {
  /** Override the appended instruction. */
  instruction?: string;
}

/**
 * Chain-of-Thought — prepends an explicit "think step by step" instruction and
 * parses the output into a `reasoning` (audit-only) and `answer` (user-facing) pair.
 *
 * If the LLM does not emit the headers, the entire body is treated as the answer
 * and an empty reasoning step is recorded.
 */
export function chainOfThought(opts: CotOptions = {}): ReasoningStrategy {
  const instruction = opts.instruction ?? COT_INSTRUCTION;
  return async (input, llm) => {
    const system = input.system ? `${input.system}\n\n${instruction}` : instruction;
    const r = await llm.generate({ ...input, system });
    const parsed = parseCotOutput(r.text);
    const result: ReasoningResult = {
      text: parsed.answer,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      trace: [
        makeStep({ index: 0, technique: "cot-reasoning", thought: parsed.reasoning }),
        makeStep({ index: 1, technique: "cot-answer", thought: parsed.answer }),
      ],
    };
    return result;
  };
}

/** Visible for testing. */
export function parseCotOutput(text: string): { reasoning: string; answer: string } {
  const reasoningMatch = text.match(/REASONING\s*:\s*([\s\S]*?)(?=\n\s*ANSWER\s*:|$)/i);
  const answerMatch = text.match(/ANSWER\s*:\s*([\s\S]*)$/i);
  if (answerMatch) {
    return {
      reasoning: (reasoningMatch?.[1] ?? "").trim(),
      answer: answerMatch[1]!.trim(),
    };
  }
  // Fallback: no headers — whole text is the answer.
  return { reasoning: "", answer: text.trim() };
}
