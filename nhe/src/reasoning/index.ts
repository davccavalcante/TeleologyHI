/**
 * Reasoning orchestrator strategies.
 *
 * Eight strategies ship in 1.0.0-trinity:
 *   - passthrough        (no wrapper; default)
 *   - chainOfThought     (CoT — explicit reasoning + parsed answer)
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

export type {
  ReasoningStrategy,
  ReasoningResult,
  ReasoningStep,
} from "./types.js";
export { makeStep } from "./types.js";

export { passthrough } from "./passthrough.js";
export { chainOfThought, parseCotOutput } from "./cot.js";
export type { CotOptions } from "./cot.js";
export { selfConsistency } from "./self-consistency.js";
export type { SelfConsistencyOptions } from "./self-consistency.js";
export { reflexion, parseVerdict } from "./reflexion.js";
export type { ReflexionOptions } from "./reflexion.js";
export { selfRefine } from "./self-refine.js";
export type { SelfRefineOptions } from "./self-refine.js";
export { reAct, parseReActTurn } from "./react.js";
export type { ReActOptions, ReActTool, ReActToolRegistry } from "./react.js";
export { treeOfThoughts } from "./tot.js";
export type { TreeOfThoughtsOptions } from "./tot.js";
export { stepBack, extractPrinciple } from "./step-back.js";
export type { StepBackOptions } from "./step-back.js";
