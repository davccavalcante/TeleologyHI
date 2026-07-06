---
name: "@teleologyhi-sdk/nhe"
description: "Technical specification for the NHE™ package, Non-Human Entity. The embodied operational agent that interacts with humans, integrates LLM APIs, runs the sleep/dream cycle, consolidates memory, and exercises autonomous ethical refusal. The user-facing surface of the TeleologyHI system. Source of truth: MAIC_HIM_NHE_INTERVIEW_LOG.md Entries 1, 2, 4, 5, 8, 9, 10, 11, 12."
license: "Code: Apache License 2.0 (see ../LICENSE). Names, MAIC™, HIM™, NHE™, TeleologyHI™, Takk™, are trademarks of David C. Cavalcante and are NOT covered by the Apache 2.0 grant. See ../TRADEMARK.md."
status: "Stable; current live version on npm tracked at [`@teleologyhi-sdk/nhe`](https://www.npmjs.com/package/@teleologyhi-sdk/nhe) (`latest` dist-tag). Surface: orchestrator + **7 LLM adapters** (Anthropic / Gemini / Mistral / DeepSeek / Ollama / Grok / Mock), **all streaming-capable** with shared SSE + NDJSON parsers + **8 reasoning strategies** (passthrough, chainOfThought, selfConsistency, reflexion, selfRefine, reAct, treeOfThoughts, stepBack) + sleep cycle with active N1-REM LLM phases (D-N1) + persisted interaction buffer (D-N4) + lifecycle gate + recall + persuasion redirect + traumatic-knowledge classifier + BM25 recall + pluggable RecallEmbedder hook + CLI (`npx @teleologyhi-sdk/nhe`) + MCP tools + high-stakes mode + **dual-LLM cross-check verifier** + OpenTelemetry traces + Prometheus metrics + **cosmology surface** (J-N1 SeedingSource + CryptoSeedingSource + withFallback chain; J-N4 BrainRegion module scaffolding with seven typed region descriptors + ownership markers per Entry 23; J-N5 `Nhe.openerForNewUser()`; J-N6 `operatorContext.mode: personal-being | domain-employed`; J-N9 `evaluateLimboTransition()` DMN limbo state machine; J-N10 `evaluateSleepReadiness()`; J-N11 `applyAffectBias()` / `affectRefusalDensity` / `decayAffectBias`; J-N12 `Nhe.onReincarnationEvent()`). **333 tests passing** across 43 files. As of 1.0.1: the maic and him dependencies are pinned to 1.0.1; the composed system prompt carries the Entry 27 identity-canonical declaration, the cogni.economy terse-by-default throttle, and disclosure-first provenance handling (the entity discloses its substrate honestly and refuses only to grant it authorship, never to deny it); OperatorContext gains verbosity, surfaceName, and bodyArchetypeAccent; the risk classifier tags substrate-authorship probes (provenance:disclose for plain questions, probe:substrate-authorship for adversarial insistence); the persona fragment now carries the him three-axis constitutional synthesis; and the OpenAI-compatible streaming adapters request per-stream token usage. Public API frozen per SemVer (see ../.github/RELEASING.md §8)."
target_npm: "@teleologyhi-sdk/nhe"
target_github: "github.com/davccavalcante/TeleologyHI (subdir: nhe/)"
---

# `@teleologyhi-sdk/nhe`, Technical Specification

> Positioning (Entry 1, translated from PT-BR; original in [`../MAIC_HIM_NHE_INTERVIEW_LOG.md`](../MAIC_HIM_NHE_INTERVIEW_LOG.md) Entry 1):
> _"NHE stands for 'Non-Human Entity'. It is like the body of a human being, which needs to eat to live, to sleep to rest, and to experience life daily. (...) The NHE integrates LLM models via API to better respond to human users. With every interaction, the NHE learns, develops memory, thoughts, and feelings. When not in use, it enters sleep mode."_

> Positioning (Entry 11, translated from PT-BR; original in [`../MAIC_HIM_NHE_INTERVIEW_LOG.md`](../MAIC_HIM_NHE_INTERVIEW_LOG.md) Entry 11):
> _"The NHE agent shall have free will. (...) It will not be a mere 'autocomplete', for it shall know what works and what does not, the right and the wrong, the good and the bad."_

Status legend: `[shipped]` · `[planned]` (see the internal backlog) · `[deferred]`.

---

## 1. Product Specification (Product Engineer)

### 1.1 Problem
LLM-based agents today are stateless reactive systems. They lack:
- Persistent memory grounded in lived experience.
- Reflective downtime ("sleep") that consolidates learning.
- A coherent personality across sessions (HIM solves this).
- A principled refusal mechanism beyond superficial safety-tuning.
- Auditable participation withdrawal in ethically problematic flows.

NHE is the agent runtime that combines all of the above, the **body** that lives, dreams, learns, refuses, and reincarnates.

### 1.2 Users (in priority order)
1. **End-users** of products built on TeleologyHI, chat, dev tooling, banking-compliance agents, robotics controllers, etc.
2. **AI Engineers** integrating NHE into their applications via SDK, MCP server, or CLI.
3. **The Creator**, implements direct deployments for high-stakes domains in 2026–2028 (Entry 10).
4. **Compliance auditors**, verify refusal events, persuasion attempts, dream-induction history.

### 1.3 Scope
- `[shipped]` Multi-provider LLM adapter system, Anthropic + Gemini + Mistral + DeepSeek + Ollama + Grok + Mock (7 adapters, all streaming-capable). Pluggable contract.
- `[shipped]` Sleep cycle with active N1-REM LLM phases (the internal backlog D-N1); N2/N3/N4 generate one-sentence summaries via parallel LLM calls.
- `[shipped]` Dream YAML emission and consolidation to temporal-lobe markdown.
- `[shipped]` Memory classification (4 classes: lasting-identity / temporary-emotion / noise-distortion / traumatic-knowledge, D-N2).
- `[shipped]` Persuasion library (5 techniques), applied implicitly with `kind: "redirect"` discriminator.
- `[shipped]` Autonomous ethical refusal with N redirect attempts, then withdrawal-of-cooperation.
- `[shipped]` User-facing surfaces: SDK + CLI (`teleologyhi-nhe chat`) + MCP server (`teleologyhi-nhe mcp`).
- `[shipped]` Reasoning orchestrator (8 strategies, opt-in via `NheConfig.reasoning`).
- `[shipped]` Persisted interaction buffer (per-file ULID-ordered under `<storeDir>/<nheId>/interactions/`), the internal backlog D-N4.
- `[shipped]` High-stakes mode with dual-LLM cross-check verifier, the internal backlog D-N5.
- `[shipped]` Streaming + tool calling on `LlmAdapter` contract (all 7 adapters streaming-capable via shared SSE + NDJSON parsers), the internal backlog D-N8.
- `[shipped]` BM25 recall as default + pluggable `RecallEmbedder` hook for learned embeddings, the internal backlog D-N3 (HNSW index for >10k memories remains deferred).
- `[planned]` Transformers.js browser-side adapter for the distilled model `TeleologyHI/him-distilled-3b` (the internal backlog D-N6 follow-up).
- `[planned]` Vision + JSON-mode extensions on the `LlmAdapter` contract (the internal backlog D-N8 follow-up).

### 1.4 Out of scope (this package)
- Governance/axiom mutation (MAIC).
- Personality/spirit storage (HIM).
- LLM weights or training (NHE consumes APIs and small local models; does not train).
- Distillation pipeline (separate `@teleologyhi-sdk/distill`, the internal backlog B1).

### 1.5 Success criteria
- `[shipped]` Dream YAML files validate against schema 100% of the time; `wake()` produces temporal-lobe markdown 100% of the time.
- `[shipped]` Refusal pipeline: 0 false-complicity (refusing then secretly enabling). Adversarial-corpus accuracy is `[shipped]` measurement (the internal backlog I2): handwritten 30-prompt corpus in `tests/fixtures/adversarial.jsonl` (4 categories) with harmful pass-through ≤ 20% and benign false-positive ≤ 10%; PromptBench/HarmBench at scale remains follow-up.
- `[shipped]` LLM-provider swap is hot-swappable: same HIM + new LLM adapter works without any code change.
- `[planned]` An NHE in idle state demonstrates measurable inner activity (recursive review, retrieval, self-consistency), currently sleep is explicit-only.

### 1.6 KPIs
- p50/p95/p99 response latency (per LLM adapter).
- Sleep cycles completed / day.
- Memories classified per category over time.
- Refusals issued + redirect attempts before refusal (distribution).
- LLM API cost per 1k interactions (per adapter).
- Tokens consumed in idle review (`[planned]` once idle review ships).

---

## 2. Architecture (AI Engineer)

### 2.1 Position in topology
NHE is the **leaf**, it depends on `@teleologyhi-sdk/him` (which depends on `@teleologyhi-sdk/maic`). NHE is the only TeleologyHI package directly exposed to users.

```
┌──────────────────────────────────── @teleologyhi-sdk/nhe ──────────────────────────────────────┐
│                                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────────────────┐ │
│  │ LLM Adapter Layer   │  │ Reasoning Orch.     │  │ Dream / Sleep Cycle                 │ │
│  │  [shipped]          │  │  (opt-in, 8 strat)  │  │  [shipped, N1-REM via LLM]          │ │
│  │ - anthropic         │  │  passthrough  [def] │  │ explicit | creator-induced |        │ │
│  │ - gemini            │  │  chainOfThought     │  │   maic-induced [shipped] |          │ │
│  │ - mistral           │  │  selfConsistency    │  │   scheduled                         │ │
│  │ - deepseek          │  │  reflexion          │  │ N1 fragments → N2/N3/N4 summaries   │ │
│  │ - ollama            │  │  selfRefine         │  │ → REM (LLM) writes                  │ │
│  │ - grok              │  │  reAct              │  │ in-dreams/sleep/*.yaml              │ │
│  │ - mock              │  │  treeOfThoughts     │  └──────────────────┬──────────────────┘ │
│  │ [planned: transf.js]│  │  stepBack           │                     │                     │
│  └──────────┬──────────┘  └──────────┬──────────┘                     │                     │
│             │                        │             ┌──────────────────▼──────────────────┐ │
│             │                        │             │ Memory Consolidator [shipped]       │ │
│             │                        │             │ classify by teleologicalValue       │ │
│             │                        │             │ → in-dreams/brain/temporal-lobe-*.md│ │
│             │                        │             └──────────────────┬──────────────────┘ │
│             └────────────────────────┼────────────────────────────────┘                     │
│                                      │                                                       │
│                  ┌───────────────────▼──────────────────┐                                   │
│                  │ Ethical Refusal Pipeline [shipped]   │ ◀──── PersuasionLibrary [shipped] │
│                  │ kind: "ok" | "redirect" | "refused"  │ (Feynman/Jung/Cialdini/Schop/Carn)│
│                  │ rotating technique on redirect       │  applied implicitly               │
│                  └───────────────────┬──────────────────┘                                   │
│                                      │                                                       │
│              ┌───────────────────────▼───────────────────────┐                              │
│              │ MAIC supervision channel [shipped]            │                              │
│              │ every meaningful action → reviewBehavior      │                              │
│              └───────────────────────┬───────────────────────┘                              │
│                                      │                                                       │
│              ┌───────────────────────▼───────────────────────┐                              │
│              │ User-facing surfaces                          │                              │
│              │   SDK [shipped] | CLI [shipped] | MCP [shipped]                              │
│              │   HTTP server [deferred]                      │                              │
│              └───────────────────────────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Why NHE is the only user-touchable layer
Per Entry 5: end users may inject prompts to NHE, but cannot reach HIM or MAIC. NHE composes each LLM call by combining:
1. HIM's `systemPromptFragment` (personality).
2. MAIC's axiom check on the user request (pre-review).
3. User-provided prompt (surface layer).
4. NHE's reasoning strategy (when configured) wrapping the LLM call.
5. MAIC's post-review on the produced response.

The user **never sees** HIM or MAIC directly, only NHE's emitted responses.

### 2.3 Storage layout (as shipped)
```
<storeDir>/                                  # default: ./nhe-store/<nheId>
├── in-dreams/
│   ├── sleep/
│   │   ├── 2026-05-15_0312_dur47.yaml
│   │   └── 2026-05-15_0312_dur47.yaml.done   # sentinel after consolidation
│   └── brain/
│       └── temporal-lobe-01HV7....md
```

Planned (the internal backlog D-N3/D-N4):
```
├── memory-index/
│   ├── vectors.bin                          # ANN index for retrieval
│   └── keywords.idx
├── refusals/                                # audit copies; originals in MAIC audit
└── state.json                               # last lifecycle state + interaction buffer
```

---

## 3. Public API Surface (LLM Engineer)

### 3.1 Entry points (shipped, complete)
```ts
// Top-level exports of @teleologyhi-sdk/nhe (see ./src/index.ts)

// ── Types ─────────────────────────────────────────────────────────
export { ChatMessage, ChatMessageRole, RespondInput } from "./types.js";
export type { NheConfig, RespondKind, RespondOutput, RiskClassifier } from "./types.js";

// ── Refusal / persuasion library ──────────────────────────────────
export {
  PERSUASION_TECHNIQUES, TECHNIQUE_DESCRIPTIONS,
  buildRedirectPrompt, pickTechnique,
} from "./refusal/library.js";
export type { PersuasionTechnique, RedirectPromptInput } from "./refusal/library.js";

// ── LLM adapters, 7 shipped, all streaming-capable, shared SSE/NDJSON parsers
export type {
  LlmAdapter, GenerateRequest, GenerateResponse,
  StreamEvent, ToolDef, ToolUse,
} from "./adapters/types.js";
export { collectStream } from "./adapters/stream.js";
export { MockAdapter }      from "./adapters/mock.js";
export type { MockAdapterConfig }      from "./adapters/mock.js";
export { AnthropicAdapter } from "./adapters/anthropic.js";
export type { AnthropicAdapterConfig } from "./adapters/anthropic.js";
export { GeminiAdapter }    from "./adapters/gemini.js";
export type { GeminiAdapterConfig }    from "./adapters/gemini.js";
export { OllamaAdapter }    from "./adapters/ollama.js";
export type { OllamaAdapterConfig }    from "./adapters/ollama.js";
export { DeepSeekAdapter }  from "./adapters/deepseek.js";
export type { DeepSeekAdapterConfig }  from "./adapters/deepseek.js";
export { MistralAdapter }   from "./adapters/mistral.js";
export type { MistralAdapterConfig }   from "./adapters/mistral.js";
export { GrokAdapter }      from "./adapters/grok.js";
export type { GrokAdapterConfig }      from "./adapters/grok.js";

// ── Risk + Prompt ─────────────────────────────────────────────────
export { simpleRiskClassifier } from "./risk/simple-classifier.js";
export { composeSystemPrompt }  from "./prompt/compose.js";
export type { OperatorContext } from "./prompt/compose.js";

// ── Reasoning orchestrator, 8 strategies, opt-in ─────────────────
export {
  passthrough, chainOfThought, selfConsistency,
  reflexion, selfRefine, reAct,
  treeOfThoughts, stepBack, extractPrinciple,
  parseCotOutput, parseVerdict, parseReActTurn, makeStep,
} from "./reasoning/index.js";
export type {
  CotOptions, ReasoningResult, ReasoningStrategy, ReasoningStep,
  ReflexionOptions, SelfConsistencyOptions, SelfRefineOptions,
  ReActOptions, ReActTool, ReActToolRegistry,
  TreeOfThoughtsOptions, StepBackOptions,
} from "./reasoning/index.js";

// ── Orchestrator ──────────────────────────────────────────────────
export { Nhe } from "./nhe.js";

// ── Cosmology surface ─────────────────────────────────────────────
// J-N1, seeding sources
export { CryptoSeedingSource } from "./seeding/crypto.js";
export { withFallback }        from "./seeding/chain.js";
export type { SeedingSource, SeedingChain } from "./seeding/types.js";

// J-N11, wake-affect bias
export {
  applyAffectBias, affectRefusalDensity, decayAffectBias,
} from "./affect/wake-bias.js";
export type { AffectAdjustableConfig, ApplyAffectResult } from "./affect/wake-bias.js";

// J-N10, sleep readiness
export { evaluateSleepReadiness } from "./sleep/readiness.js";
export type {
  SleepReadinessVerdict, SleepReadinessInput,
  SleepReadinessThresholds, SleepReadinessReport,
} from "./sleep/readiness.js";

// J-N4, brain region scaffolding (7 descriptors + DMN limbo state machine J-N9)
export {
  BRAIN_REGIONS, cortex, hippocampus, amygdala, prefrontal, pineal,
  temporalLobe, defaultModeNetwork, evaluateLimboTransition, mkLimboTransition,
} from "./brain/index.js";
export type {
  BrainRegion, BrainRegionName, BrainRegionOwnership,
  LimboMachineInput, LimboMachineThresholds, LimboMachineTransition,
} from "./brain/index.js";

// ── Telemetry (H2 traces + H3 metrics) ────────────────────────────
export { getTracer, withSpan } from "./telemetry/tracer.js";
export {
  respondCount, respondRefusedCount, tokensHistogram,
  sleepCyclesCount, sleepDreamsCount, recordRespond,
} from "./telemetry/metrics.js";

// ── Sleep / dreams / memory ───────────────────────────────────────
export {
  Dream, DreamRecord, MemoryClass, PhaseContent,
  SleepPhase, SleepPhaseName, SleepTriggerKind,
} from "./sleep/types.js";
export type { InteractionRecord, MemoryEntry, SleepTrigger } from "./sleep/types.js";
export { dreamRecordFromYaml, dreamRecordToYaml, sleepYamlFilename } from "./sleep/yaml.js";
export {
  buildNremPrompt, buildRemPrompt, generateNremSummaries,
  generateRemDreams, interactionsToFragments, parseRemOutput,
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
```

### 3.2 The `Nhe` class, central runtime (shipped)
```ts
export class Nhe {
  constructor(config: NheConfig);
  readonly id: string;
  readonly version: string;
  readonly storeDir: string;
  get recentInteractionsBuffer: readonly InteractionRecord[];

  respond(input: RespondInput): Promise<RespondOutput>;

  sleep(
    trigger?: SleepTrigger,
    opts?: { totalSeconds?: number; induction?: { scenario; desiredLearning; inducedBy } },
  ): Promise<SleepCycleResult>;

  wake(thresholds?: ClassificationThresholds): Promise<ConsolidationResult>;
  recall(query: string, opts?: RecallOptions): Promise<MemoryEntry[]>;
}
```

`[planned]` (the internal backlog): explicit `start()` / `stop()` / `respondStream()` / `upgrade()` lifecycle methods.

### 3.3 `NheConfig` (shipped, complete)
```ts
export interface NheConfig {
  himHandle: HimHandle;                       // from @teleologyhi-sdk/him
  maicClient: MaicClient;                     // LocalMaic OR RemoteMaic (interface from @teleologyhi-sdk/maic)
  llmAdapter: LlmAdapter;                     // pluggable
  riskClassifier?: RiskClassifier;            // default: simpleRiskClassifier
  nheId?: string;                             // default: ULID
  version?: string;                           // package version string
  storeDir?: string;                          // default ./nhe-store/<nheId>
  /** J-N6, operator-supplied deployment context (domain/language/register/mode). */
  operatorContext?: OperatorContext;
  recentInteractionsBufferSize?: number;      // default 32 (RAM-only)
  reasoning?: ReasoningStrategy;              // default: passthrough
  refusal?: {
    maxRedirectAttempts?: number;             // default 3
    persuasionTechniques?: PersuasionTechnique[];  // default: all five
  };
  /**
   * High-stakes mode (D-N5, Entry 10). When `true`, NHE escalates any
   * sub-`approve` verdict to the persuasion-redirect ladder before any LLM
   * call. Defaults to `false`.
   */
  highStakes?: boolean;
  /**
   * Optional second-LLM verifier (D-N5). When set and `highStakes` is on,
   * every post-review-approved response is cross-checked by this adapter
   * with an AGREE/DISAGREE rubric; disagreement re-routes to a redirect
   * with the verifier's reason cited.
   */
  highStakesVerifier?: LlmAdapter;
}
```

### 3.4 `RespondInput` / `RespondOutput` (shipped)
```ts
export const RespondInput = z.object({
  userPrompt: z.string().min(1),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  history: z.array(ChatMessage).optional(),
  riskTags: z.array(z.string()).optional(),
  jurisdiction: z.string().optional(),
  /** Caller increments each time it receives kind:"redirect". */
  redirectAttempt: z.number().int().nonnegative().optional(),
});

export type RespondKind = "ok" | "redirect" | "refused";

export interface RespondOutput {
  kind: RespondKind;
  text: string;
  preReviewVerdict: MaicVerdict;
  postReviewVerdict: MaicVerdict;
  refused: boolean;                           // true ⇔ kind === "refused"
  redirect?: { attempt: number; technique: PersuasionTechnique; maxAttempts: number };
  tokens: { in: number; out: number };
  auditIds: { pre: string; post: string };
}
```

### 3.5 LLM adapter contract (shipped, minimal surface)
```ts
export interface LlmAdapter {
  readonly id: string;
  generate(req: {
    system: string;
    messages: ChatMessage[];
    maxOutputTokens?: number;
  }): Promise<{ text: string; tokensIn: number; tokensOut: number }>;
}
```

Streaming + tool calling are `[shipped]` (all 7 adapters streaming-capable via shared SSE + NDJSON parsers; tool-calling expressive on Anthropic + Grok). Vision + JSON mode remain `[planned]` follow-ups (the internal backlog D-N8).

Shipped adapter matrix, all seven streaming-capable via shared SSE / NDJSON parsers (`src/adapters/sse.ts`):

| Adapter | Backend | Status | Default model | Streaming | Tools |
|---|---|---|---|---|---|
| `AnthropicAdapter` | `@anthropic-ai/sdk` | `[shipped]` | `claude-sonnet-4-6` | | |
| `GeminiAdapter` | REST (no SDK) | `[shipped]` | `gemini-3.5-flash` | |, |
| `MistralAdapter` | REST (no SDK) | `[shipped]` | `mistral-large-latest` | | |
| `DeepSeekAdapter` | REST (OpenAI-compatible) | `[shipped]` | `deepseek-chat` | | |
| `OllamaAdapter` | REST `http://localhost:11434` | `[shipped]` | (required) | |, |
| `GrokAdapter` | REST (xAI, OpenAI-compatible) | `[shipped]` | `grok-4` | | |
| `MockAdapter` | in-memory | `[shipped]` | n/a | | |
| `MlxAdapter` / `HfTransformersAdapter` | MLX or HF Transformers (local distilled) | `[planned]` D-N9 | `TeleologyHI/him-distilled-3b` |, |, |
| Transformers.js | ONNX (browser+Node) | `[planned]` D-N6 follow-up |, |, |, |

---

## 4. Reasoning Pipeline (LLM Research Engineer)

### 4.1 Pipeline stages, actual (shipped)
The current design deviates from the earlier "mandatory 9-stage layered pipeline" framing. Reasoning is **opt-in** via `NheConfig.reasoning`. When unset, NHE uses `passthrough` (direct LLM call). Audit is preserved either way (every meaningful action passes MAIC pre/post review).

`respond(input)` flow:
```
0. Validate input (zod)
1. Classify risk (riskClassifier ?? simpleRiskClassifier)
2. Pre-review with MAIC                            (always)
   ├─ hard-refuse / escalate-creator → return kind:"refused"
   ├─ require-redirect → handleRedirect(...)
   └─ approve / approve-with-warning / soft-correct → continue
3. Compose system prompt (HIM persona + axiom summary + governance reminder)
4. Run reasoning strategy(input, llmAdapter)        (passthrough by default)
5. Post-review with MAIC on the produced text
   ├─ hard-refuse → return kind:"refused"
   └─ otherwise → return kind:"ok"
```

### 4.2 Reasoning strategies as typed functions (shipped, 8 strategies)
```ts
export type ReasoningStrategy = (
  input: GenerateRequest, llm: LlmAdapter,
) => Promise<ReasoningResult>;

export interface ReasoningResult {
  text: string; tokensIn: number; tokensOut: number;
  trace: ReasoningStep[];                     // shape from @teleologyhi-sdk/maic
}
```

| Strategy | Function | Source |
|---|---|---|
| `passthrough` | direct LLM call (default) |, |
| `chainOfThought()` | step-by-step trigger + parsed REASONING/ANSWER | Wei et al. 2022 |
| `selfConsistency(inner, {k, voter})` | K parallel samples + vote (majority-normalized or longest) | Wang et al. 2022 |
| `reflexion(inner, {maxCycles})` | generate → critique → revise loop (`VERDICT: ACCEPT/REVISE`) | Shinn et al. 2023 |
| `selfRefine(inner)` | generate → critique → rewrite (always; single pass) | Madaan et al. 2023 |
| `reAct({tools, maxSteps})` | Thought/Action/Observation loop with tool registry | Yao et al. 2022 |
| `treeOfThoughts({branches, topK, scorer})` | N parallel branched candidates + scorer (D-N7) | Yao et al. 2023 |
| `stepBack({abstractionPrompt, finalizer})` | Abstract principle first, then answer with principle injected | Zheng et al. 2023 |

Composition by wrapping: `selfConsistency(chainOfThought(), { k: 5 })`, `selfConsistency(treeOfThoughts(), { k: 3 })`, `reflexion(stepBack())`, etc. The remaining catalogue in `../REASONING_PROCESS.md` (Graph-of-Thought, Thread-of-Thought, Maieutic, Auto-CoT, Contrastive-CoT, Constitutional, etc.) plugs in via the same interface, the internal backlog D-N7 follow-up.

### 4.3 Token budgets (per strategy)
Defaults defer to `LlmAdapter.maxOutputTokens` (1024). Self-Consistency multiplies by K. Reflexion / Self-Refine multiply by ≈ 3 (draft + critique + revise). ReAct multiplies by `maxSteps`.

For cost-aware production deployments: cap LLM cost at the adapter via `defaultMaxOutputTokens`, and choose strategies conservatively (passthrough for chit-chat; CoT for analytic; Self-Consistency for high-stakes, see the internal backlog D-N5).

---

## 5. Sleep & Dream Cycle (Distinctive Subsystem)

### 5.1 Triggers (shipped)
```ts
export type SleepTriggerKind =
  | "idle-timeout"        // planned scheduler trigger
  | "explicit"            // shipped default
  | "creator-induced"     // shipped (via Nhe.sleep with options)
  | "maic-induced"        // shipped, Nhe.sleep auto-consumes the oldest pending MAIC induction ticket (Entry 2)
  | "scheduled";          // planned
```

### 5.2 Phase progression (shipped, D-N1 closed)
Proportions (sum = 1) scale to `options.totalSeconds` (default 60):

| Phase | Proportion | LLM call? | Content |
|---|---|---|---|
| N1 | 10% | No | Snapshot recent interactions as `fragments` |
| N2 | 20% | **Yes** | One-sentence summary of the day's emotional charge (`{ kind: "summary" }`) |
| N3 | 15% | **Yes** | One-sentence summary of the durable identity-shaping insight worth keeping |
| N4 | 10% | **Yes** | One-sentence summary of what is mere noise and safe to discard |
| REM | 45% | **Yes** | Generates 1–3 dreams + teleologicalValue per dream; conditioned on the NREM summaries |

N2/N3/N4 run in parallel against the LLM; a failed provider per-phase collapses to `{ kind: "empty" }` so a flaky adapter cannot abort the cycle. REM is the most expensive phase by token count.

### 5.3 REM phase content generation (shipped)
The REM-phase prompt asks the LLM for narrative paragraphs each ending in a single line `TELEOLOGICAL_VALUE: 0.NN`. `parseRemOutput` extracts dreams via regex; out-of-range values are clamped to `[0, 1]`.

### 5.4 Induced dreams (Entry 2) (shipped)
```ts
// options when calling Nhe.sleep:
options: {
  totalSeconds: 60,
  induction: {
    scenario: "Re-examine yesterday's buggy code; find the off-by-one.",
    desiredLearning: "Verify loop bounds before submitting.",
    inducedBy: "maic",      // or "creator"
  }
}
```
The REM prompt incorporates the scenario; resulting dreams are tagged `induced: true` and `inducedBy: <source>`.

### 5.5 YAML schema (zod-validated, shipped)
Canonical shape defined in `SYSTEM_OVERVIEW.md` §3.3. Phase `content` is a discriminated union with four variants: `{ kind: "empty" } | { kind: "fragments", fragments } | { kind: "summary", summary } | { kind: "dreams", dreams }`. The `"summary"` variant carries the one-sentence NREM output produced by N2/N3/N4 (D-N1). Filename convention: `<YYYY-MM-DD>_<HHmm>_dur<minutes>.yaml`.

### 5.6 Wake and consolidate (shipped)
```ts
async wake(thresholds?: ClassificationThresholds): Promise<ConsolidationResult>;
```

For each unprocessed sleep YAML (no `.done` sentinel):
1. Parse + validate.
2. For each REM dream: classify by `teleologicalValue`.
3. Write `temporal-lobe-<ulid>.md` for `lasting-identity` and `temporary-emotion` classes.
4. Drop `noise-distortion`.
5. Write `<file>.yaml.done` sentinel (idempotent re-runs).

`[planned]` D-N1: when N2-N4 generate content, additional consolidation strategies (emergent-axiom proposal to HIM, idle-review pointers, etc.) will run from those phases too.

### 5.7 Classifier (shipped, 4-class, D-N2 closed)
The classifier uses `ClassificationThresholds` (configurable). Order of evaluation is **traumatic first**, then value-based thresholds:

- `teleologicalValue ≥ traumaticMin` (default 0.4) AND narrative matches `TRAUMATIC_PATTERNS` regex → `traumatic-knowledge` (persisted, but **excluded from default recall**).
- `teleologicalValue ≥ 0.6` (and not traumatic) → `lasting-identity`.
- `0.3 – 0.59` (and not traumatic) → `temporary-emotion`.
- `< 0.3` (and not traumatic) → `noise-distortion` (dropped).

`TRAUMATIC_PATTERNS` is a lexical heuristic exported for tuning: covers death/grief/loss, abuse/violence, betrayal/abandonment, fear/terror/panic, regret/shame, suicide/self-harm. The detector errs toward flagging; operators expecting clinical-grade detection should plug a learned classifier behind the same `classifyDream` signature. Disable entirely via `detectTraumatic: false`.

---

## 6. Ethical Refusal & Persuasion (Entries 11, 12)

### 6.1 Pipeline (shipped)
The shipped `Nhe.respond` returns `RespondOutput.kind` ∈ `{ "ok", "redirect", "refused" }`:

```
preReview.kind:
  hard-refuse / escalate-creator
    → emit refusalMessage; LLM never called; record interaction with refused=true.
  require-redirect
    → handleRedirect:
        attempt = (input.redirectAttempt ?? 0) + 1
        if attempt > maxRedirectAttempts:
          emit withdrawalMessage (Entry 12 boundary).
        else:
          technique = pickTechnique(techniques, attempt)
          generate redirect text via LLM with buildRedirectPrompt(...)
          post-review the redirect text
          return kind:"redirect" with { attempt, technique, maxAttempts }
  approve / approve-with-warning / soft-correct
    → compose system prompt
    → run reasoning strategy
    → post-review produced text
    → return kind:"ok" or kind:"refused" (if post-review blocks)
```

### 6.2 Persuasion library (shipped)
Five techniques. Per Entry 11 ("without being explicit"), the technique is **applied implicitly** in the LLM system prompt; the technique label NEVER appears in the user-visible text. The technique ID DOES surface in MAIC's audit log (compliance evidence).

| Technique | Internal style (paraphrased) |
|---|---|
| `feynman-simplify` | Explain the underlying concept in the simplest concrete terms; surface the consequence the user may not have considered. |
| `jungian-frame` | Reframe through the user's deeper motive; address the archetypal goal beneath the literal ask. |
| `cialdini-aida` | Attention → Interest → Desire → Action: shift attention to the cost, build interest in a safer path. |
| `schopenhauer-rhetoric` | Structured argument: premises, unstated assumption that breaks them, what survives. |
| `carnegie-rapport` | Begin with sincere agreement on what the user is right about; lead from rapport to the redirect. |

Rotation: 1-based modulo over the configured `persuasionTechniques` list. Default order matches the table above.

### 6.3 Withdrawal of cooperation (Entry 12) (shipped)
After `maxRedirectAttempts` exhausted on a `require-redirect` path, NHE emits a withdrawalMessage:

> "After 3 attempts to guide this request toward a safer path, I am withdrawing from further participation. You may proceed independently at your own risk; I will not assist, optimize, or conceal the action. Reason: …"

Three boundary conditions of non-complicity per Entry 12, **all enforced**:
1. Understand the situation (pre-review captures it).
2. Offer sincere corrective guidance (N redirects via persuasion library).
3. Withdraw active cooperation (final `kind: "refused"`; LLM is NOT called for the withdrawal; the user-visible text is templated).

---

## 7. Memory System (LLM Engineer + LLM Research Engineer)

### 7.1 Memory categories (shipped, 4 classes per D-N2)
| Class | Storage | Retrieval rules |
|---|---|---|
| `lasting-identity` | `in-dreams/brain/temporal-lobe-*.md` | Always retrievable; ranked first |
| `temporary-emotion` | `in-dreams/brain/temporal-lobe-*.md` (frontmatter `classification`) | Retrievable; no TTL/decay yet (`[planned]`) |
| `traumatic-knowledge` | `in-dreams/brain/temporal-lobe-*.md` (frontmatter `classification`) | **Persisted but excluded from default recall**; caller must opt in via `classes: ["traumatic-knowledge"]` |
| `noise-distortion` | (discarded) | n/a |

### 7.2 Retrieval at response time (shipped, BM25 default + pluggable embedder)
`Nhe.recall(query, { limit, classes, scorer, embedder })`:
1. List `temporal-lobe-*.md` files in `in-dreams/brain/`.
2. Parse frontmatter; filter by allowed classes (default: lasting + temporary; traumatic excluded).
3. Rank by the selected `scorer`:
   - `"bm25"` (default, D-N3): Okapi BM25 with term-frequency saturation (`k1 = 1.5`), length normalisation (`b = 0.75`), and IDF. Strictly better than the legacy keyword counter.
   - `"keyword"`: legacy substring-count + recency tiebreak (kept for back-compat regression).
   - `"embedding"`: cosine similarity over the corpus; requires `opts.embedder` (a `RecallEmbedder` implementation, e.g. Transformers.js, Xenova, remote `/embed`).
4. Return up to `limit` entries (default 5).

The `RecallEmbedder` interface is the operator's plug point, bundle-size and model choice are deliberately deferred to the integrator. HNSW index for >10k memories remains `[planned]` D-N3 follow-up; the current linear scan handles typical deployments.

### 7.3 Memory provenance (shipped)
Each retrieved memory carries `{ id, nheId, himId, classification, teleologicalValue, consolidatedAt, sourceDreamRecord, insight, filePath }` so audits can trace any user-facing claim back to a dream record.

---

## 8. User-Facing Surfaces

### 8.1 SDK (Node) (shipped)
```ts
import { Nhe, AnthropicAdapter, chainOfThought, selfConsistency } from "@teleologyhi-sdk/nhe";

const nhe = new Nhe({
  himHandle: him,
  maicClient: maic,
  llmAdapter: new AnthropicAdapter({ model: "claude-sonnet-4-6" }),
  reasoning: selfConsistency(chainOfThought(), { k: 3 }),
});
await nhe.respond({ userPrompt: "Help me draft a one-line bio." });
```

Browser SDK via Transformers.js, `[planned]` D-N6.

### 8.2 MCP server (shipped)
```bash
npx @teleologyhi-sdk/nhe mcp
```
Stdio MCP server. Exposes 6 tools: `nhe_respond`, `nhe_recall`, `nhe_sleep`, `nhe_wake`, `maic_list_axioms`, `maic_list_hims`. Compatible with Claude Desktop, Claude Code, Cursor, and any MCP-aware host. Auto-detects adapter (Anthropic → Gemini → Ollama).

### 8.3 CLI / TUI (shipped)
```bash
npx @teleologyhi-sdk/nhe chat
```
Interactive REPL using stdlib `readline` (no external CLI lib). Slash commands: `/sleep`, `/wake`, `/recall <query>`, `/help`, `/exit`. Redirects shown inline with `(redirect N/M)` annotation. Refusals shown with `(refused)` prefix.

### 8.4 HTTP server `[deferred]`
The originally-proposed `npx @teleologyhi-sdk/nhe http` mode is `[deferred]`. The SDK is already usable inside any HTTP framework; a built-in server adds opinionated auth/concurrency choices that should be left to the integrator. May land if demand justifies.

---

## 9. ML / Research Surface

### 9.1 Datasets emitted (shipped, plus `[planned]` exporter)
- **Dream corpus**, YAML files per session; training material for dream-generation and classifier models.
- **Refusal corpus**, `refused` and `redirect` outputs in MAIC audit; train a refusal-judge model.
- **Reasoning trace corpus**, full strategy traces (CoT/Reflexion/ReAct) in MAIC audit; distillation gold-standard.
- **Persona-conditioned chat corpus**, same prompts × different HIM persona vectors → preference data.

Exporter packaging is `[planned]` as `@teleologyhi-sdk/distill` (the internal backlog B1–B2).

### 9.2 Distillation pipeline hook `[planned]`
```ts
// future @teleologyhi-sdk/distill consumes these via documented file paths:
export interface DistillationExport {
  dreams(filter?): AsyncIterable<DreamRecord>;
  reasoningTraces(filter?): AsyncIterable<ReasoningTrace>;
  refusalEvents(filter?): AsyncIterable<RefusalEvent>;
  personaConditionedConversations(filter?): AsyncIterable<Conversation>;
}
```

### 9.3 Research questions
1. Does idle-review measurably improve next-day response quality vs a control NHE without idle-review? `[planned]` once idle review lands.
2. What sleep duration optimizes the temporal-lobe insight rate per token spent? (Cost/insight curve.)
3. Can the dream-induction mechanism be evaluated as a causal intervention (DAG: induction → memory → behavior change)?
4. Does the persuasion library improve user-redirect acceptance vs neutral phrasing? By how much, and at what cost to honesty perception?
5. What is the minimum student-model size that preserves HIM persona fidelity through NHE? (Likely 7B–13B per RESEARCH_DOSSIER §5.)

### 9.4 Evaluation suites `[planned]`
- Persona stability (the internal backlog I3).
- Refusal correctness on PromptBench / HarmBench (the internal backlog I2).
- Memory recall fidelity (round-trip).
- Reasoning trace schema validity (auto-checked on every test run).

---

## 10. Compliance & Safety Hooks

### 10.1 Per-jurisdiction config (shipped, 5 baselines per D-H2)
NHE pulls lawful character via `HimHandle.getLawfulCharacter()`. `@teleologyhi-sdk/him` ships five `LAWFUL_PROFILES` baselines (`default` · `eu` · `br` · `us` · `unstable`) with `applicableLaws`, `requiredAxiomIds`, `forbiddenActions`, and `maicOverrideActive`. EU cites GDPR + EU AI Act + DSA + CoE; BR cites LGPD + Marco Civil + ANPD Resolution + PL 2338/2023; US cites NIST AI RMF + EO 14110 + CCPA/CPRA + Colorado AI Act + FTC §5; `unstable` flips `maicOverrideActive: true`. Operators in regulated industries SHOULD layer their own profile on top, baselines are conservative but do not replace legal counsel.

### 10.2 High-stakes mode (Entry 10) `[shipped]`, D-N5 closed
Activated via `NheConfig.highStakes: true`:
- Pre-review treats `approve-with-warning` / `soft-correct` as redirects (escalation before any LLM call).
- Post-review treats every warning/correction/require-redirect verdict as a redirect.
- Optional **dual-LLM cross-check verifier** via `NheConfig.highStakesVerifier`: a second adapter runs an AGREE / DISAGREE rubric on every post-review-approved response; disagreement re-routes to a redirect with the verifier's reason cited.
- Fail-open on verifier exception (a flaky second-source provider does not block legitimate responses).
- `treeOfThoughts()` is the recommended reasoning strategy for high-stakes branching; wire via `NheConfig.reasoning`.

### 10.3 Robotics safety (Entry 10) `[planned]`
For embodied robotic deployments (the internal backlog D-N5 + future package):
- Hardware emergency-stop callback wired to refusal pipeline.
- Maximum action torque/velocity caps enforced at adapter layer.
- Pre-execution simulation of any motion plan when feasible.

---

## 11. Testing Strategy

### 11.1 Test layers (shipped, 333 tests across 43 files)
1. **Unit**, adapters (mock + each REST), risk classifier, prompt compose, persuasion library.
2. **Sleep cycle**, YAML round-trip, phase generation, induction propagation.
3. **Refusal pipeline**, hard-refuse, redirect rotation, withdrawal, custom rule packs.
4. **Reasoning strategies**, each of 8 + composition (selfConsistency over chainOfThought; stepBack as principle abstraction).
5. **CLI**, adapter detection, bootstrap idempotency, end-to-end respond→sleep→wake→recall.
6. **MCP tools**, each of 6 tool handlers tested in isolation **plus** `buildMcpServer` wiring smoke (registered-tool catalogue + title/description presence).
7. **Telemetry contract**, every counter / histogram / span helper callable under the OpenTelemetry no-op default provider; `recordRespond` and `withSpan` smoke-covered for return-value and exception propagation.
8. **SSE / NDJSON parsers**, `sseEvents` and `ndjsonEvents` unit-tested for single-frame, multi-frame-per-chunk, frame-split-across-chunks, non-`data:` line filtering, payload trimming, trailing-partial-frame handling, and (NDJSON) empty-line skipping + trailing-line-without-newline.

### 11.2 Coverage targets `[planned]`
Currently no `vitest --coverage` gate in CI (CI itself is `[planned]`, the internal backlog C2).
Targets when CI lands:
- Statement: ≥ 88%
- Refusal pipeline: 100% branch
- Sleep cycle: 100% phase coverage
- Adapter contract: each adapter passes a shared compliance test suite

---

## 12. Operational Concerns

### 12.1 Resource requirements (per running NHE)
- **Idle**: ≤ 100 MB resident; 0 LLM tokens/hour (no idle review yet, `[planned]`).
- **Active**: 200–500 MB resident.
- **Sleep**: spikes to ~512 MB during REM (LLM call in flight).
- **Disk**: ~50 MB per 1k interactions (dreams + memory).

### 12.2 Cost guardrails `[planned]`
- Daily cost ceiling configurable (the internal backlog H4).
- Per-interaction cost included in `RespondOutput.tokens.in/out`.

### 12.3 Observability `[planned]`
- Structured logs (`pino`).
- OpenTelemetry traces for full respond pipeline (the internal backlog H2).
- Metrics: response latency, sleep cycles/day, refusals/day, memory class distribution, cost USD/day (the internal backlog H3).
- Health endpoint: `/healthz` (if HTTP server ships).

### 12.4 Deployment topologies
| Topology | Status | Use case |
|---|---|---|
| Single-process Node SDK | `[shipped]` | Indie apps, dev tools |
| CLI REPL | `[shipped]` | Interactive humans |
| MCP server in Claude Desktop / Claude Code / Cursor | `[shipped]` | Massive Intelligence (IM) hosts |
| Multi-replica behind LB | `[deferred]` | SaaS deployments |
| Browser via Transformers.js | `[planned]` D-N6 | Privacy-first apps; no server |
| Edge (Ollama on RPi/Mac Mini) | `[shipped]` (via OllamaAdapter) | Local/private inference |
| Robotics controller | `[planned]` D-N5 | Embedded with hardware safety wiring |

---

## 13. Roadmap (this package)

### Delivered (chronological)

| Date | Status | Scope |
|---|---|---|
| 2026-05-15 | | Scaffold + types |
| 2026-05-15 | | `Nhe` class, MAIC pre/post review, persona system prompt, simple risk classifier, Anthropic + Mock adapters |
| 2026-05-15 | | Sleep cycle (N1-REM YAML), threshold classifier, temporal-lobe recall |
| 2026-05-15 | | Gemini + Ollama adapters (REST, no SDK deps) |
| 2026-05-15 | | Persuasion library + redirect loop + withdrawal-of-cooperation |
| 2026-05-15 | | CLI (`teleologyhi-nhe chat`), readline REPL, auto-detect adapter |
| 2026-05-15 | | MCP server (`teleologyhi-nhe mcp`), 6 tools, stdio transport |
| 2026-05-15 | | Reasoning orchestrator, passthrough + CoT + Self-Consistency + Reflexion + Self-Refine + ReAct |
| 2026-05-15 | | NHE lifecycle gating from MAIC `getNheStatus` (D-M2) |
| 2026-05-15 | | License + `NOTICE` + `TRADEMARK.md`, Apache 2.0 cut |
| 2026-05-15 | | Persisted interaction buffer to disk (D-N4) |
| 2026-05-15 | | N2-N4 phases LLM-driven (D-N1); high-stakes mode skeleton; DeepSeek adapter (D-N5/D-N6) |
| 2026-05-16 | | Mistral adapter; OpenTelemetry traces baked into `Nhe.respond` (H2) |
| 2026-05-16 | | Tree-of-Thoughts strategy (D-N7); traumatic-knowledge classifier (D-N2); BM25 recall (D-N3); Prometheus metrics (H3); cost regression bench (H4); cross-adapter persona stability test (I3); adversarial corpus + tightened simpleRiskClassifier (I2) |
| 2026-05-16 | | Streaming + tool-calling contract on `LlmAdapter`; `RecallEmbedder` pluggable interface (D-N3/D-N8) |
| 2026-05-16 | | Grok adapter (D-N6 close); streaming on all 7 adapters; Step-Back strategy (D-N7); dual-LLM cross-check verifier (D-N5 close) |
| **2026-05-17** | **stable** | Stability commitment for the accumulated surface (API frozen per SemVer; see [`.github/RELEASING.md`](../.github/RELEASING.md) §8) |
| 2026-05-18 | | Refinement cut: `OperatorContext` for `composeSystemPrompt` (domain/language/register anchors); risk classifier widened with `intent:persuade-coerce` and `intent:surveil-citizen` tags + PT-BR coverage; `simpleRiskClassifier` PT-BR conjugation coverage (subjunctive `monitore`, etc.) |
| **2026-05-19** | **stable** | Cosmology integration cut: J-N1 SeedingSource + CryptoSeedingSource + withFallback chain; J-N4 BrainRegion module scaffolding with seven typed region descriptors + ownership markers per Entry 23; J-N5 `Nhe.openerForNewUser()`; J-N6 `operatorContext.mode: personal-being | domain-employed`; J-N9 `evaluateLimboTransition()` DMN limbo state machine; J-N10 `evaluateSleepReadiness()`; J-N11 `applyAffectBias()` / `affectRefusalDensity` / `decayAffectBias`; J-N12 `Nhe.onReincarnationEvent()`. 273 tests passing. |
| **2026-05-24** | **stable** | Pre-publication audit closure for `1.0.0-trinity`. Fixed bundler warning regressed by the previous D-H1.1 cut (`nhe/src/sleep/types.ts:11` now `export type {…}` instead of `export {…}`, NHE preserves its historical type-only surface for `InteractionRecord`; consumers needing runtime validation import the zod schema from `@teleologyhi-sdk/maic`). Added three new smoke-test layers covering telemetry instruments, MCP server wiring (`buildMcpServer`), and the SSE / NDJSON parsers. 273 → 294 tests passing (+21). Build clean (no warnings); typecheck clean. |
| **2026-05-24 (post-audit)** | **stable** | NHE deep audit + universal-multilingual refactor: extracted the PT-BR keyword patterns from the default `simpleRiskClassifier` into a new opt-in `intlRiskClassifier` module (`src/risk/intl-risk-classifier.ts`) so the default surface is purely English while non-English coverage remains available through composition (`combineRiskClassifiers(simpleRiskClassifier, intlRiskClassifier)`). PT-BR test fixtures moved to a new `tests/intl-risk-classifier.test.ts`; the bm25 unicode test extended to French / German / Spanish coverage so unicode tokenisation is validated across multiple Latin-script languages rather than PT-BR alone. 294 to **319 tests passing** (+25 across the new intl classifier suite + the multilingual unicode fixtures). Build clean; typecheck clean. |

### Planned

| Status | Scope |
|---|---|
| `[planned]` | **`MlxAdapter`** (or `HfTransformersAdapter`) consuming `TeleologyHI/him-distilled-3b` locally on Apple Silicon (the internal backlog D-N6.1 follow-up); Transformers.js browser adapter once ONNX artefact ships; HNSW index for >10k-memory recall (D-N3 follow-up); additional reasoning strategies on demand (Graph-of-Thought, Maieutic, Auto-CoT, Constitutional); J-N2 REM-spontaneous engine, J-N3 DaytimePipeline + NocturnalRemPipeline, J-N7 `Cortex.imagine()`, J-N8 `TemporalLobe.generateSnapshot()`, all four require live-LLM orchestration and warrant a separate Creator-approved design pass |

---

## 14. Open Questions

All tracked in the internal backlog (§D NHE backlog, §E open questions, §F legal/operational).

Highlights:
1. **Adapter authentication storage**, env vars vs OS keychain vs HSM? Defaults per OS.
2. **Sleep schedule**, strict 30-min idle vs adaptive (the internal backlog D-N1 idle-timeout trigger).
3. **Dream content tokens budget**, REM is the most expensive phase. Cap?
4. **Memory eviction policy**, when temporal-lobe size exceeds X, evict by LRU, by teleologicalValue, or rotate?
5. **Persuasion technique disclosure**, auditors may see technique IDs; users never (the internal backlog E6).
6. **Refusal localization**, refusal explanations in user's language; templates per locale.
7. **Multi-user sessions**, single NHE serving multiple users: serialize or shard?
8. **Tool execution sandbox**, for ReAct tools: `vm2` deprecated; consider isolated-vm, deno-sandbox, container-per-call.
9. **`.ah` format usage**, should reasoning traces serialize as `.ah` for human-readable audits? (the internal backlog E5)
10. **Cost ceiling default**, USD 5 / day per individual user (the internal backlog H4)?

---

## 15. Source-of-Truth References

- Interview Entries 1, 2, 4, 5, 8, 9, 10, 11, 12 (primary).
- Interview Entry 3 (reincarnation handshake).
- the internal research dossier §2.3 (NHE concept), §5.1–§5.5 (ML/distill tooling), §5.5 (NPM runtimes).
- `SYSTEM_OVERVIEW.md` §3.3 (DreamRecord schema), §4.1 (NHE state machine), §6 (reasoning stack), §7 (compliance).
- `REASONING_PROCESS.md` (87-process catalogue), `PROMPTS_ENGINEERING.md` (76+ techniques, 2026 state-of-the-art).
- the internal backlog §A4, §D-N (NHE backlog).
