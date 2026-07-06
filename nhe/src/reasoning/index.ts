/**
 * Reasoning orchestrator strategies.
 *
 * Eight strategies ship in this release:
 *   - passthrough        (no wrapper; default)
 *   - chainOfThought     (CoT, explicit reasoning + parsed answer)
 *   - selfConsistency    (K-sample majority/longest vote)
 *   - reflexion          (generate → critique → revise loop)
 *   - selfRefine         (generate → critique → rewrite, single pass)
 *   - reAct              (Thought/Action/Observation loop with tools)
 *   - treeOfThoughts     (branch-and-prune search over reasoning paths)
 *   - stepBack           (abstract principle first, then apply concretely)
 *
 * 80+ additional techniques are catalogued in REASONING_PROCESS.md and PROMPTS_ENGINEERING.md
 * (Graph-of-Thought, Thread-of-Thought, Maieutic, Contrastive, Auto-CoT, etc.)
 * and can be added via the same `ReasoningStrategy` interface as needed. All
 * strategies are pure async functions; compose them by wrapping
 * (e.g., `selfConsistency(chainOfThought(), { k: 5 })`).
 */

export type { CotOptions } from "./cot.js";
export { chainOfThought, parseCotOutput } from "./cot.js";

export { passthrough } from "./passthrough.js";
export type { ReActOptions, ReActTool, ReActToolRegistry } from "./react.js";
export { parseReActTurn, reAct } from "./react.js";
export type { ReflexionOptions } from "./reflexion.js";
export { parseVerdict, reflexion } from "./reflexion.js";
export type { SelfConsistencyOptions } from "./self-consistency.js";
export { selfConsistency } from "./self-consistency.js";
export type { SelfRefineOptions } from "./self-refine.js";
export { selfRefine } from "./self-refine.js";
export type { StepBackOptions } from "./step-back.js";
export { extractPrinciple, stepBack } from "./step-back.js";
export type { TreeOfThoughtsOptions } from "./tot.js";
export { treeOfThoughts } from "./tot.js";
export type {
  ReasoningResult,
  ReasoningStep,
  ReasoningStrategy,
} from "./types.js";
export { makeStep } from "./types.js";
