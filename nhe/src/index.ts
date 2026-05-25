/**
 * @teleologyhi-sdk/nhe — Non-Human Entity
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

// ─── types ──────────────────────────────────────────────────────────
export { ChatMessage, ChatMessageRole, RespondInput } from "./types.js";
export type { NheConfig, RespondKind, RespondOutput, RiskClassifier } from "./types.js";

// ─── refusal / persuasion library ────────────────────────────────────
export {
  PERSUASION_TECHNIQUES,
  TECHNIQUE_DESCRIPTIONS,
  buildRedirectPrompt,
  pickTechnique,
} from "./refusal/library.js";
export type { PersuasionTechnique, RedirectPromptInput } from "./refusal/library.js";

// ─── adapters ───────────────────────────────────────────────────────
export type {
  LlmAdapter,
  GenerateRequest,
  GenerateResponse,
  StreamEvent,
  ToolDef,
  ToolUse,
} from "./adapters/types.js";
export { collectStream } from "./adapters/stream.js";
export { MockAdapter } from "./adapters/mock.js";
export type { MockAdapterConfig } from "./adapters/mock.js";
export { AnthropicAdapter } from "./adapters/anthropic.js";
export type { AnthropicAdapterConfig } from "./adapters/anthropic.js";
export { GeminiAdapter } from "./adapters/gemini.js";
export type { GeminiAdapterConfig } from "./adapters/gemini.js";
export { OllamaAdapter } from "./adapters/ollama.js";
export type { OllamaAdapterConfig } from "./adapters/ollama.js";
export { DeepSeekAdapter } from "./adapters/deepseek.js";
export type { DeepSeekAdapterConfig } from "./adapters/deepseek.js";
export { MistralAdapter } from "./adapters/mistral.js";
export type { MistralAdapterConfig } from "./adapters/mistral.js";
export { GrokAdapter } from "./adapters/grok.js";
export type { GrokAdapterConfig } from "./adapters/grok.js";

// ─── risk ───────────────────────────────────────────────────────────
export { simpleRiskClassifier } from "./risk/simple-classifier.js";
export {
  intlRiskClassifier,
  combineRiskClassifiers,
  INTL_RISK_CLASSIFIER_LANGUAGES,
} from "./risk/intl-risk-classifier.js";

// ─── prompt ─────────────────────────────────────────────────────────
export { composeSystemPrompt } from "./prompt/compose.js";
export type { OperatorContext } from "./prompt/compose.js";

// ─── reasoning orchestrator ──────────────────────────────────────────
export {
  passthrough,
  chainOfThought,
  selfConsistency,
  reflexion,
  selfRefine,
  reAct,
  treeOfThoughts,
  stepBack,
  extractPrinciple,
  parseCotOutput,
  parseVerdict,
  parseReActTurn,
  makeStep,
} from "./reasoning/index.js";
export type {
  CotOptions,
  ReasoningResult,
  ReasoningStrategy,
  ReasoningStep,
  ReflexionOptions,
  SelfConsistencyOptions,
  SelfRefineOptions,
  ReActOptions,
  ReActTool,
  ReActToolRegistry,
  TreeOfThoughtsOptions,
  StepBackOptions,
} from "./reasoning/index.js";

// ─── orchestrator ───────────────────────────────────────────────────
export { Nhe } from "./nhe.js";

// ─── seeding sources (J-N1) ─────────────────────────────────────────
export { CryptoSeedingSource } from "./seeding/crypto.js";
export { withFallback } from "./seeding/chain.js";
export type { SeedingSource, SeedingChain } from "./seeding/types.js";

// ─── affect / wake-bias (J-N11) ─────────────────────────────────────
export {
  applyAffectBias,
  affectRefusalDensity,
  decayAffectBias,
} from "./affect/wake-bias.js";
export type {
  AffectAdjustableConfig,
  ApplyAffectResult,
} from "./affect/wake-bias.js";

// ─── sleep readiness (J-N10) ────────────────────────────────────────
export { evaluateSleepReadiness } from "./sleep/readiness.js";
export type {
  SleepReadinessVerdict,
  SleepReadinessInput,
  SleepReadinessThresholds,
  SleepReadinessReport,
} from "./sleep/readiness.js";

// ─── brain region scaffolding (J-N4) ────────────────────────────────
// Seven region descriptors with ownership markers per Entry 23, plus
// the default-mode-network limbo state machine (J-N9). Full
// implementations of REM-spontaneous engine (J-N2), DaytimePipeline +
// NocturnalRemPipeline (J-N3), Cortex.imagine() (J-N7), and
// TemporalLobe.generateSnapshot() (J-N8) ship in a follow-up cut.
export {
  BRAIN_REGIONS,
  cortex,
  hippocampus,
  amygdala,
  prefrontal,
  pineal,
  temporalLobe,
  defaultModeNetwork,
  evaluateLimboTransition,
  mkLimboTransition,
} from "./brain/index.js";
export type {
  BrainRegion,
  BrainRegionName,
  BrainRegionOwnership,
  LimboMachineInput,
  LimboMachineThresholds,
  LimboMachineTransition,
} from "./brain/index.js";

// ─── telemetry (H2 traces + H3 metrics) ─────────────────────────────
export { getTracer, withSpan } from "./telemetry/tracer.js";
export {
  respondCount,
  respondRefusedCount,
  tokensHistogram,
  sleepCyclesCount,
  sleepDreamsCount,
  recordRespond,
} from "./telemetry/metrics.js";

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
export type { InteractionRecord, MemoryEntry, SleepTrigger } from "./sleep/types.js";
export { dreamRecordFromYaml, dreamRecordToYaml, sleepYamlFilename } from "./sleep/yaml.js";
export {
  buildNremPrompt,
  buildRemPrompt,
  generateNremSummaries,
  generateRemDreams,
  interactionsToFragments,
  parseRemOutput,
} from "./sleep/phases.js";
export type { NremPhase } from "./sleep/phases.js";
export { runSleepCycle } from "./sleep/cycle.js";
export type { SleepCycleInput, SleepCycleOptions, SleepCycleResult } from "./sleep/cycle.js";
export { classifyDream, consolidateAll, TRAUMATIC_PATTERNS } from "./sleep/consolidator.js";
export type { ClassificationThresholds, ConsolidationResult } from "./sleep/consolidator.js";
export { recallFromTemporalLobe } from "./memory/recall.js";
export type { RecallOptions, RecallEmbedder } from "./memory/recall.js";
export { bm25, tokenise } from "./memory/bm25.js";
export type { Bm25Document, Bm25Options, Bm25Result } from "./memory/bm25.js";
