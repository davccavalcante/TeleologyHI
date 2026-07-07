import type { ReasoningStep } from "@teleologyhi-sdk/maic";
import type { GenerateRequest, LlmAdapter } from "../adapters/types.js";

export type { GenerateRequest, LlmAdapter, ReasoningStep };

/** Output of a reasoning strategy. Carries text + token counts + structured trace. */
export interface ReasoningResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  trace: ReasoningStep[];
}

/**
 * A reasoning strategy wraps a single text-generation call with a particular
 * cognitive pattern. Strategies are pure async functions that take an input and
 * an adapter; composition is done by wrapping (e.g., selfConsistency(cot(...))).
 *
 * Every strategy MUST populate `trace` with one or more `ReasoningStep` entries
 * so that MAIC's audit log preserves the full chain of reasoning.
 */
export type ReasoningStrategy = (
  input: GenerateRequest,
  llm: LlmAdapter,
) => Promise<ReasoningResult>;

/** Helper to build a single ReasoningStep with auto timestamps. */
export function makeStep(args: {
  index: number;
  technique: string;
  thought: string;
  action?: { tool: string; args: unknown };
  observation?: unknown;
}): ReasoningStep {
  const step: ReasoningStep = {
    index: args.index,
    technique: args.technique,
    thought: args.thought,
    timestamp: new Date().toISOString(),
  };
  if (args.action !== undefined) step.action = args.action;
  if (args.observation !== undefined) step.observation = args.observation;
  return step;
}
