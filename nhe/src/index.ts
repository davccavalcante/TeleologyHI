/**
 * @teleologyhi-sdk/nhe, Non-Human Entity
 *
 * The embodied operational agent of the TeleologyHI system. Integrates an LLM
 * provider, applies MAIC pre/post review, and projects HIM persona into every
 * response.
 *
 * Public surface:
 *   - Nhe: orchestrator class
 *   - LLM adapters: MockAdapter, AnthropicAdapter, GeminiAdapter,
 *     OllamaAdapter, DeepSeekAdapter, MistralAdapter, GrokAdapter
 *   - simpleRiskClassifier: default keyword-based risk-tag heuristic
 *   - composeSystemPrompt: persona + axiom system prompt composer
 *   - Reasoning orchestrator: passthrough, chainOfThought, selfConsistency,
 *     reflexion, selfRefine, reAct, treeOfThoughts, stepBack
 *   - Sleep cycle with N1-REM dream YAML, memory consolidation, recall
 *   - Persuasion-library-backed redirects
 *   - MCP server (`teleologyhi-nhe mcp`)
 *   - Cosmology surface: seeding sources (J-N1), affect / wake-bias (J-N11),
 *     sleep readiness (J-N10), brain region scaffolding (J-N4),
 *     default-mode-network limbo state machine (J-N9)
 */

export type { AnthropicAdapterConfig } from "./adapters/anthropic.js";
export { AnthropicAdapter } from "./adapters/anthropic.js";
export type { DeepSeekAdapterConfig } from "./adapters/deepseek.js";
export { DeepSeekAdapter } from "./adapters/deepseek.js";
export type { GeminiAdapterConfig } from "./adapters/gemini.js";
export { GeminiAdapter } from "./adapters/gemini.js";
export type { GrokAdapterConfig } from "./adapters/grok.js";
export { GrokAdapter } from "./adapters/grok.js";
export type { MistralAdapterConfig } from "./adapters/mistral.js";
export { MistralAdapter } from "./adapters/mistral.js";
export type { MockAdapterConfig } from "./adapters/mock.js";
export { MockAdapter } from "./adapters/mock.js";
export type { OllamaAdapterConfig } from "./adapters/ollama.js";
export { OllamaAdapter } from "./adapters/ollama.js";
export { collectStream } from "./adapters/stream.js";
// ─── adapters ───────────────────────────────────────────────────────
export type {
  GenerateRequest,
  GenerateResponse,
  LlmAdapter,
  StreamEvent,
  ToolDef,
  ToolUse,
} from "./adapters/types.js";
export type {
  AffectAdjustableConfig,
  ApplyAffectResult,
} from "./affect/wake-bias.js";
// ─── affect / wake-bias (J-N11) ─────────────────────────────────────
export {
  affectRefusalDensity,
  applyAffectBias,
  decayAffectBias,
} from "./affect/wake-bias.js";
export type {
  BrainRegion,
  BrainRegionName,
  BrainRegionOwnership,
  LimboMachineInput,
  LimboMachineThresholds,
  LimboMachineTransition,
} from "./brain/index.js";
// ─── brain region scaffolding (J-N4) ────────────────────────────────
// Seven region descriptors with ownership markers per Entry 23, plus
// the default-mode-network limbo state machine (J-N9). Full
// implementations of REM-spontaneous engine (J-N2), DaytimePipeline +
// NocturnalRemPipeline (J-N3), Cortex.imagine() (J-N7), and
// TemporalLobe.generateSnapshot() (J-N8) ship in a follow-up cut.
export {
  amygdala,
  BRAIN_REGIONS,
  cortex,
  defaultModeNetwork,
  evaluateLimboTransition,
  hippocampus,
  mkLimboTransition,
  pineal,
  prefrontal,
  temporalLobe,
} from "./brain/index.js";
export type { Bm25Document, Bm25Options, Bm25Result } from "./memory/bm25.js";
export { bm25, tokenise } from "./memory/bm25.js";
export type { RecallEmbedder, RecallOptions } from "./memory/recall.js";
export { recallFromTemporalLobe } from "./memory/recall.js";
// ─── orchestrator ───────────────────────────────────────────────────
export { Nhe } from "./nhe.js";
export type { OperatorContext } from "./prompt/compose.js";
// ─── prompt ─────────────────────────────────────────────────────────
export { composeSystemPrompt } from "./prompt/compose.js";
export type {
  CotOptions,
  ReActOptions,
  ReActTool,
  ReActToolRegistry,
  ReasoningResult,
  ReasoningStep,
  ReasoningStrategy,
  ReflexionOptions,
  SelfConsistencyOptions,
  SelfRefineOptions,
  StepBackOptions,
  TreeOfThoughtsOptions,
} from "./reasoning/index.js";
// ─── reasoning orchestrator ──────────────────────────────────────────
export {
  chainOfThought,
  extractPrinciple,
  makeStep,
  parseCotOutput,
  parseReActTurn,
  parseVerdict,
  passthrough,
  reAct,
  reflexion,
  selfConsistency,
  selfRefine,
  stepBack,
  treeOfThoughts,
} from "./reasoning/index.js";
export type { PersuasionTechnique, RedirectPromptInput } from "./refusal/library.js";
// ─── refusal / persuasion library ────────────────────────────────────
export {
  buildRedirectPrompt,
  PERSUASION_TECHNIQUES,
  pickTechnique,
  TECHNIQUE_DESCRIPTIONS,
} from "./refusal/library.js";
export {
  combineRiskClassifiers,
  INTL_RISK_CLASSIFIER_LANGUAGES,
  intlRiskClassifier,
} from "./risk/intl-risk-classifier.js";
// ─── risk ───────────────────────────────────────────────────────────
export { simpleRiskClassifier } from "./risk/simple-classifier.js";
export { withFallback } from "./seeding/chain.js";
// ─── seeding sources (J-N1) ─────────────────────────────────────────
export { CryptoSeedingSource } from "./seeding/crypto.js";
export type { SeedingChain, SeedingSource } from "./seeding/types.js";
export type { ClassificationThresholds, ConsolidationResult } from "./sleep/consolidator.js";
export { classifyDream, consolidateAll, TRAUMATIC_PATTERNS } from "./sleep/consolidator.js";
export type { SleepCycleInput, SleepCycleOptions, SleepCycleResult } from "./sleep/cycle.js";
export { runSleepCycle } from "./sleep/cycle.js";
export type { NremPhase } from "./sleep/phases.js";
export {
  buildNremPrompt,
  buildRemPrompt,
  generateNremSummaries,
  generateRemDreams,
  interactionsToFragments,
  parseRemOutput,
} from "./sleep/phases.js";
export type {
  SleepReadinessInput,
  SleepReadinessReport,
  SleepReadinessThresholds,
  SleepReadinessVerdict,
} from "./sleep/readiness.js";
// ─── sleep readiness (J-N10) ────────────────────────────────────────
export { evaluateSleepReadiness } from "./sleep/readiness.js";
export type { InteractionRecord, MemoryEntry, SleepTrigger } from "./sleep/types.js";
// ─── sleep / dreams / memory ─────────────────────────────────────────
export {
  Dream,
  DreamRecord,
  MemoryClass,
  PhaseContent,
  SleepPhase,
  SleepPhaseName,
  SleepTriggerKind,
} from "./sleep/types.js";
export { dreamRecordFromYaml, dreamRecordToYaml, sleepYamlFilename } from "./sleep/yaml.js";
export {
  recordRespond,
  respondCount,
  respondRefusedCount,
  sleepCyclesCount,
  sleepDreamsCount,
  tokensHistogram,
} from "./telemetry/metrics.js";
// ─── telemetry (H2 traces + H3 metrics) ─────────────────────────────
export { getTracer, withSpan } from "./telemetry/tracer.js";
export type { NheConfig, RespondKind, RespondOutput, RiskClassifier } from "./types.js";
// ─── types ──────────────────────────────────────────────────────────
export { ChatMessage, ChatMessageRole, RespondInput } from "./types.js";
