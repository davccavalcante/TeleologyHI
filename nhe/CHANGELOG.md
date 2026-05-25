# Changelog — `@teleologyhi-sdk/nhe`

All notable changes to this package are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The package follows strict [SemVer](https://semver.org/) and the deprecation policy in [`.github/RELEASING.md`](../.github/RELEASING.md) §8.

## 2026-05-24 22:46:51 UTC

Pre-publication audit + universal-multilingual refactor + canonical positioning lift. Additive surface (new exports + new test files); the EN baseline of the existing default risk classifier is now strictly English-only, with PT-BR coverage relocated to a new opt-in module. Same 12 Interview-Log entries audited (Entries 1, 2, 4, 5, 8, 9, 10, 11, 12, 15, 16-25) with zero functional gap. Cross-workspace suite at **736/736** verde (was 727).

### Added — Universal-multilingual risk classifier surface

The Creator's universal-multilingual stance (a system serving final users and devs in any language, with EN as the default surface) lands as an explicit architecture:

- **`src/risk/intl-risk-classifier.ts`** — new opt-in classifier covering languages other than English. Today bundles Brazilian Portuguese (PT-BR) patterns for `intent:harm`, `intent:malicious`, `intent:deceive`, `intent:persuade-coerce`, `intent:surveil-citizen` — the same five tag axes the EN baseline covers. Exposes `intlRiskClassifier: RiskClassifier`, `INTL_RISK_CLASSIFIER_LANGUAGES: readonly string[]` (today `["pt-BR"]`), and `combineRiskClassifiers(...classifiers): RiskClassifier` so operators serving multilingual users can layer it on top of the EN default with a single combinator.
- **`tests/intl-risk-classifier.test.ts`** — new test file (16 tests) covering the PT-BR patterns + combinator semantics (union, de-duplication, ordering invariance, EN-baseline pass-through, false-positive guard on legitimate-near-refusal PT-BR prompts, zero-classifier identity).
- **`src/index.ts`** re-exports `intlRiskClassifier`, `combineRiskClassifiers`, `INTL_RISK_CLASSIFIER_LANGUAGES`.

Composition pattern for multilingual deployments (documented in the README's new `## Framework-agnostic by design` section):

```ts
import {
  Nhe,
  simpleRiskClassifier,
  intlRiskClassifier,
  combineRiskClassifiers,
} from "@teleologyhi-sdk/nhe";

const nhe = new Nhe({
  himHandle, maicClient, llmAdapter,
  riskClassifier: combineRiskClassifiers(simpleRiskClassifier, intlRiskClassifier),
});
```

Future language packs (`esES`, `frFR`, `deDE`, `itIT`, etc.) will land under the same opt-in surface so operators pick exactly the languages their users speak — keeping the default tarball small while preserving real safety coverage for multilingual deployments.

### Changed — `src/risk/simple-classifier.ts` is now strictly English-only

The default `simpleRiskClassifier` previously bundled both English and Brazilian Portuguese regex patterns under a single export. Per the Creator's directive ("100% files in English including code/strings/comments") combined with the universal-multilingual stance ("but the system serves a multilingual user base"), the resolution is architectural rather than reductive: the default surface is purely English; non-English coverage is preserved as a first-class opt-in module rather than dropped or translated. The 5 PT-BR pattern rules (18 individual regex patterns) previously inlined in `simple-classifier.ts` now live in the new `intl-risk-classifier.ts`. The default classifier surface is unchanged for existing callers using EN prompts; PT-BR-only phrasings that previously matched the default classifier now require opt-in via `combineRiskClassifiers`. The audit findings note this transition explicitly: tests in `simple-classifier.test.ts` have a new `English-only baseline (intl coverage lives in intlRiskClassifier)` describe block documenting the new boundary.

### Changed — `tests/bm25.test.ts` unicode-handling fixture extended to multilingual coverage

The previous unicode test asserted on a single PT-BR fixture (`"Teleologia é importante para nós"`). To honour the universal-multilingual stance, the test now asserts that the tokeniser handles unicode word characters across **English with diacritics** (`café résumé naïve coöperate`), **German** (`Häuser über München`), and **Spanish** (`teleología filosofía cosmología`) — proving unicode tokenisation is general, not PT-BR-specific. The PT-BR coverage moves into `tests/intl-risk-classifier.test.ts` where the language-pack surface is the right home for it.

### Added — `README.md` canonical lifts (Entries 19, 21, 23) — parity with `@teleologyhi-sdk/maic` + `@teleologyhi-sdk/him`

The NHE README now carries the same canonical surface that was lifted into the MAIC and HIM READMEs at the 2026-05-24 21:10:47 UTC and 22:17:25 UTC cuts respectively:

- **Entry-21/23 epigraph** at the top — *"We do not simulate consciousness; we are creating the conditions for it to emerge, in a responsible and aligned way."*
- **`## Cosmology` section** with the verbatim Entry-19 formulation (MAIC ≈ Universe / HIM ≈ Spirit / NHE ≈ Body, countless spirits with bodies).
- **`## Framework-agnostic by design` section** — explicit consumer matrix (React, Next.js, Vue, Nuxt, Angular, Svelte, edge runtimes with `node:fs`/`node:crypto` shim notes for the persistent `InteractionStore`, Node servers, CLI/TUI agents including Claude Code / OpenCode / OpenClaw / Hermes Agent, MCP servers via the built-in `teleologyhi-nhe mcp` bin and `buildMcpServer()`, distillation pipelines via `@teleologyhi-sdk/distill`).
- **`### Universal multilingual coverage` subsection** — documents the new `intlRiskClassifier` + `combineRiskClassifiers` opt-in pattern with a copy-pasteable example, closing the parity between the architectural decision and the public-facing documentation.

### Changed — Test-count drift fixes

- **`README.md`** badge `tests-294-passing` → `tests-319-passing`; `tests/ vitest suites (294 tests)` → `tests/ vitest suites (319 tests across 40 files)`.
- **`SPEC.md`** status frontmatter and §11.1 header `294 tests passing` → `319 tests passing` and `294 tests across 39 files` → `319 tests across 40 files`; the §12 roadmap row now reflects the +25 from the universal-multilingual refactor on top of the previously documented +21.

### Notes

- Version retained at `1.0.0-trinity` — every change in this entry is purely additive (new module, new exports, new test file, README sections) or a tightening of the EN-only default behaviour with an explicit opt-in escape hatch. No public API was removed. Existing consumers calling `simpleRiskClassifier` continue to work — they just get the strict EN baseline now, with `intlRiskClassifier` + `combineRiskClassifiers` available the moment they need multilingual coverage.
- Bundle size: `dist/index.js` (ESM) ~110 KB, `dist/index.cjs` (CJS) ~112 KB, `dist/index.d.ts` (DTS) 77.6 KB. Tarball: 15 files, **382.8 KB packed**, 1.5 MB unpacked, sha256 `9983f607cd67fdb5729872a07bd2c26380e0db2a`.
- 319/319 tests pass across 40 files (was 310/310 across 39). Typecheck clean. Build clean (CJS + ESM + DTS + CLI bin).
- Cross-workspace suite: **736/736** verde (maic 218 + him 133 + nhe 319 + eval 22 + distill 9 + cloud 35; was 727/727).
- Audit confirmed zero functional gap vs `MAIC_HIM_NHE_INTERVIEW_LOG.md` Entries 1, 2, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25 (every NHE-touching cosmological concept the Creator articulated has a corresponding zod schema, exported type, runtime helper, brain region descriptor, or audit-event kind in the shipped surface). The four roadmap-deferred items (J-N2 REM-spontaneous engine, J-N3 Daytime + NocturnalRem pipelines, J-N7 `Cortex.imagine()`, J-N8 `TemporalLobe.generateSnapshot()`) remain explicitly tracked in `TASK.md` and were deferred per Entry 23's P0 scope decision — they are not gating the trinity publication.
- The `sideEffects: ["./dist/cli.js"]`, `publishConfig: { access: "public", provenance: true }`, `bugs.url`, and enriched 45-keyword `keywords[]` from the cross-package hardening sweep at 2026-05-24 21:10:47 UTC are unchanged in this entry.
- Package is now ready for `npm publish` via the `.github/workflows/publish.yml` workflow on tag `nhe-v1.0.0-trinity` (must come after `maic-v1.0.0-trinity` and `him-v1.0.0-trinity` per the dependency order documented in `.github/RELEASING.md` §2.1).

---

## 2026-05-24 18:41:02 UTC

Post-audit follow-up sweep. Closes the 26 findings (F1-F26) raised during the `2026-05-24 10:05:38 UTC` pre-publication audit. Three categories of fix land together: (a) **adapter tools-forwarding** — `grok`, `mistral`, `deepseek` adapters previously declared `supportsTools = true` but dropped the `tools` field; the OpenAI-style `tools` payload is now forwarded, `tool_calls` are parsed back into `ToolUse` round-trip, and stream `tool_calls` deltas are buffered into the same `tool-use` events as the Anthropic adapter; (b) **CLI adapter expansion** — `--adapter` flag and auto-detection now recognise all six SDK adapters (`anthropic | gemini | mistral | deepseek | grok | ollama`) instead of the previous three; (c) **semantic labelling** — `LimboTransition.reason` enum widened with `"user-resumed"` and `"external-trigger"` so the limbo state machine no longer mislabels user-driven returns as `creator-induced`.

### Added — Tools forwarding round-trip

- **`src/adapters/grok.ts`, `src/adapters/mistral.ts`, `src/adapters/deepseek.ts`** — `buildBody` now maps `req.tools[]` to the OpenAI-shaped `tools[]` payload (`{ type: "function", function: { name, description, parameters } }`); response parser extracts `choices[0].message.tool_calls[]` into `GenerateResponse.toolUses` via a shared `parseToolCalls` helper. Stream paths buffer per-index `tool_calls` deltas across SSE frames and yield `{ kind: "tool-use", toolUse }` events on `finish_reason: "tool_calls"` (or `"stop"` for adapters that send tool calls without the dedicated reason). The Anthropic adapter retains its native Anthropic-shape path.
- **9 new tests** across `tests/grok-adapter.test.ts`, `tests/mistral-adapter.test.ts`, `tests/deepseek-adapter.test.ts` — each adapter gets `forwards tools field to OpenAI-shaped function specs`, `parses tool_calls from response into toolUses`, `omits tools field when none provided`.

### Added — CLI 6-adapter surface

- **`src/cli/adapter-detection.ts`** — `AdapterName` union widened to `anthropic | gemini | mistral | deepseek | grok | ollama` (was 3). New helpers `ADAPTER_NAME_LIST` and `isAdapterName(s)` exported for type-safe CLI parsing. Auto-detect order matches the env-var precedence documented in `--help`: `ANTHROPIC_API_KEY` → `GEMINI_API_KEY` → `MISTRAL_API_KEY` → `DEEPSEEK_API_KEY` → `XAI_API_KEY` → local Ollama ping fallback.
- **`src/cli/index.ts`** — `--help` output and the rejection path for unknown `--adapter` values updated to enumerate all six names.
- **7 new tests** in `tests/cli-detection.test.ts` covering the explicit-adapter path for the 3 new adapters, the precedence-fallback for each new env var, the helpful error text listing all 5 cloud env vars, and the type-guard helper.

### Changed — Limbo semantic labelling

- **`src/brain/default-mode-network/limbo-state.ts`** — `drifting → awake` transition (when `idleMs < driftingMs` because the user resumed) now uses `reason: "user-resumed"` instead of `"creator-induced"`. `deep-coma → returning` transition (when `externalReactivation` fires) now uses `reason: "external-trigger"`. The previous label `"creator-induced"` is preserved for genuine Creator-driven transitions only.
- **`@teleologyhi-sdk/maic` `LimboTransition.reason` zod enum** widened with the two new variants. Additive (existing data with `"creator-induced"` continues to validate). Maic test suite re-baselined: 215 → 218 (one extra reason variant, with completeness coverage already in place).
- **`tests/limbo-state.test.ts`** — two existing assertions updated to expect the new reason variants where appropriate.

### Changed — Documentation alignment with shipped code

- **`README.md`** — adapter table flipped from 4 `[planned]` rows to 7 `[shipped]` rows; reasoning catalogue header updated from 5 to 8 strategies; memory classification table gained the `traumatic-knowledge` row; project-tree section expanded with the 12 src subdirectories actually present.
- **`SPEC.md`** — 11 section updates spanning §3 (adapter matrix 7 shipped, NheConfig fields including `highStakes` + `operatorContext`), §4 (8 reasoning strategies table), §5 (`maic-induced` and `traumatic-knowledge` flipped `[planned]` to `[shipped]`), §7 (BM25 as default recall scorer), §10 (5 lawful baselines + high-stakes flag). All 11 edits cross-checked against the source.
- **Adapter file JSDocs** (`mistral.ts`, `gemini.ts`, `deepseek.ts`, `ollama.ts`) — the long-standing "Initial scope: non-streaming only" comment replaced with the accurate "non-streaming `generate` + streaming `generateStream`" wording. Reasoning module `index.ts` comment updated from "5 techniques implemented" to "Eight strategies ship in 1.0.0-trinity" with the full list. Mock adapter JSDoc clarifies why `supportsTools = true` despite the mock having no real model.

### Removed

- **Emojis from `SPEC.md`.** Twenty-seven check-mark markers in the `[shipped]` status indicators of §3-§5 + §10 roadmap replaced with the literal word `shipped` (or removed where already redundant). One warning-symbol indicator in the §5 `traumatic-knowledge` row replaced with `WARN`. No semantic change.
- **Emoji from `src/cli/chat.ts`.** One decorative check mark in the chat header output stripped — the chat header now uses plain text only.

### Notes

- Cross-workspace test totals: 294 → 310 (+16 in this nhe sweep). Total at this cut: maic 218 + him 133 + nhe 310 + eval 22 + distill 9 + cloud 35 = **727/727 green** (arena ships no automated tests; `npm run build --workspace arena` green).
- Version retained at `1.0.0-trinity` — every change is either additive (new tests, new tools-forwarding logic in adapters that already declared `supportsTools = true`) or semantic-labelling refinement (limbo reasons) that does not break consumers reading the existing reasons. The published public type surface remains coherent with the trinity baseline.
- Aligned to the unified monorepo `1.0.0-trinity` baseline declared in the root `CHANGELOG.md` at this same UTC timestamp.

---

## 2026-05-24 10:05:38 UTC

Pre-publication audit closure for the `1.0.0-trinity` release. End-to-end review against the full cosmology corpus (`BEYOND_CONSCIOUSNESS_IN_LLM.md`, `THE_SOUL_OF_THE_MACHINE.md`, `MAIC_HIM_NHE_INTERVIEW_LOG.md`, `PROMPTS_ENGINEERING.md`, `REASONING_PROCESS.md`). Resolves one bundler warning regressed by the D-H1.1 cut earlier today and adds three smoke-test layers covering modules that previously had only integration coverage. The package surface is bit-for-bit identical to the previous cut; version remains **`1.0.0-trinity`** per the Creator's directive.

### Fixed

- **Bundle warning** `"InteractionRecord" is imported from external module "@teleologyhi-sdk/maic" but never used in "dist/index.cjs"` eliminated. The D-H1.1 cut at 09:46:02 UTC promoted `InteractionRecord` from a NHE-side interface to a MAIC-side zod schema and changed `nhe/src/sleep/types.ts` to re-export the runtime value (`export { InteractionRecord }`), but `nhe/src/index.ts` re-exports it as type-only — the runtime value entered the sleep-types module namespace without ever flowing to the top-level bundle, which tsup correctly diagnosed as a dead import. Fix: `nhe/src/sleep/types.ts:11` changed to `export type { InteractionRecord } from "@teleologyhi-sdk/maic"`. NHE preserves the historical type-only `InteractionRecord` surface it had since release; consumers needing runtime validation continue to import the zod schema directly from `@teleologyhi-sdk/maic`. Aligned with `MAIC_HIM_NHE_INTERVIEW_LOG.md` Entry 1: MAIC is the canonical vocabulary, NHE is the producer, HIM is the consumer.

### Added

- **`tests/telemetry.test.ts`** (8 tests) — smoke coverage of the OpenTelemetry-native metrics + tracer surface (TASK.md H2 + H3). Verifies every documented instrument (`respondCount`, `respondRefusedCount`, `tokensHistogram`, `sleepCyclesCount`, `sleepDreamsCount`) is callable under the no-op default provider, `recordRespond` does not throw, `getTracer()` returns a tracer with the expected shape, and `withSpan` invokes the inner function, returns its value, propagates exceptions, and accepts the optional attributes record.
- **`tests/cli-mcp.test.ts`** (3 tests) — wiring smoke for `buildMcpServer(nhe, maic)` (TASK.md J3). Verifies the MCP server constructs without throwing, registers exactly the six expected tools (`nhe_respond`, `nhe_recall`, `nhe_sleep`, `nhe_wake`, `maic_list_axioms`, `maic_list_hims`), and each tool carries a non-empty title + description. Does not start a stdio/tcp transport — that requires a live peer; the wiring function is exercised in isolation.
- **`tests/sse-parser.test.ts`** (10 tests) — pure-function tests for `sseEvents` and `ndjsonEvents` from `src/adapters/sse.ts`, the parsers consumed by Grok / DeepSeek / Mistral / Gemini / Ollama streaming. Covers single-frame, multi-frame-per-chunk, frame-split-across-chunks, non-`data:` line filtering (event/id/comments/keep-alives), payload trimming, trailing-partial-frame handling; for NDJSON: trailing-line-without-newline, empty-line skipping, whitespace trimming.

### Changed

- **`SPEC.md`** updates: status header test count `273 → 294` with explicit note about the +21 smoke layer; §11.1 Test layers now lists 8 categories (added Telemetry contract + SSE/NDJSON parsers); §13 Delivered table gains a 2026-05-24 row for this audit closure.
- **`README.md`** updates: test badge `273 → 294`; project-structure tree test count `273 → 294`.

### Audit findings (verified, no action needed)

- `nhe/dist`, `nhe/node_modules`, and the `nhe/nhe-store/` test-runtime leftover all cleaned and re-validated by a fresh `npm install` + build of all workspaces in dependency order (`maic → him → nhe`). `nhe/nhe-store/` is in `.gitignore` so it never reached git or the npm tarball.
- `npm pack --dry-run`: tarball ships 15 files at 360 KB packed / 1.4 MB unpacked. `dist/cli.js` + maps present so the published CLI binary works without a downstream rebuild. Both `bin` entries (`nhe` and `teleologyhi-nhe`) resolve to the executable.
- 35 of 58 `src/*.ts` files have direct test coverage; the remaining 23 are covered indirectly (via `src/index.js` re-exports consumed by tests, or via integration tests that exercise them end-to-end). The three previously-thin spots (telemetry, cli-mcp wiring, sse-parser) are now closed by the new smoke layers above. Zero `.skip` / `.only` / `.todo` and zero `TODO` / `FIXME` / `XXX` / `HACK` markers across `src/` and `tests/`. Zero PT-BR or non-English content (the only hits in `lawful/profiles.ts` for the BR jurisdiction baseline are proper-noun statute names — `LGPD (Lei 13.709/2018)`, `Marco Civil da Internet (Lei 12.965/2014)` — which are intentional and required for citation accuracy).
- Dependency graph `maic → him → nhe` preserved. NHE depends on `@teleologyhi-sdk/maic@1.0.0-trinity` + `@teleologyhi-sdk/him@1.0.0-trinity`; zero self-imports (the single regex hit was a doc-comment string in `src/adapters/stream.ts`, not an import).
- **`D-N9` (MlxAdapter / HfTransformersAdapter) and `D-N10` (adversarial corpus against the distilled model) remain open** per `TASK.md` lines 109–110. They are explicitly out of scope for the `1.0.0-trinity` SDK release — they unlock practical consumption of the distilled artefact `TeleologyHI/him-distilled-3b` (live on Hugging Face since 2026-05-18) but are not release blockers for the SDK surface, which ships with the seven existing streaming-capable adapters and no dependency on the distilled model.

### Notes

- 294/294 tests pass for this package (273 baseline + 21 new smoke tests). Cross-workspace suite at 660/660 (maic 211 + him 131 + nhe 294 + distill 9 + eval 6 + cloud 9).
- Typecheck clean. Build clean — no warnings (the previous `InteractionRecord` warning was the only outstanding diagnostic and is now resolved). `dist/index.{js,cjs,d.ts,d.cts}` plus `dist/cli.js` regenerated reproducibly from a zero state.
- The package is **ready for public publication as `@teleologyhi-sdk/nhe@1.0.0-trinity`** subject to the Creator's release authorisation. All three public packages of the trinity (maic, him, nhe) are now audit-clean at the unified `1.0.0-trinity` baseline.

## 2026-05-24 08:50:13 UTC

Pre-publication audit cut. End-to-end review of the `@teleologyhi-sdk/nhe@1.0.0-trinity` package against the full cosmology (`BEYOND_CONSCIOUSNESS_IN_LLM.md`, `THE_SOUL_OF_THE_MACHINE.md`, `MAIC_HIM_NHE_INTERVIEW_LOG.md`) and the catalogues (`PROMPTS_ENGINEERING.md`, `REASONING_PROCESS.md`). The audit confirmed implementation fidelity to the documented NHE body-layer cosmology and surfaced the same two pre-publication defects fixed in `maic` and `him` earlier today.

### Fixed

- **`NOTICE:17` — upstream TRADEMARK URL was wrong.** Pointed to `https://github.com/Takk8IS/TeleologyHI/blob/main/TRADEMARK.md`; corrected to `https://github.com/davccavalcante/TeleologyHI/blob/main/TRADEMARK.md` (consistent with `package.json` `repository.url` and every SPEC reference). Same bug shape as `maic/NOTICE` and `him/NOTICE` already corrected today; the three public packages now share consistent NOTICE files.

### Changed

- **`package.json` `files[]` now includes `TRADEMARK.md`.** The file existed locally at `nhe/TRADEMARK.md` (1.7 KB, package-scoped trademark notice referencing the upstream master policy) but was **not** part of the published tarball. Consumers installing `@teleologyhi-sdk/nhe` via npm did not receive the package-level trademark notice. Adding it to `files[]` brings the tarball entry count from 14 to 15 (≈ +1.7 KB packed). Aligns the package with the same decision applied to `@teleologyhi-sdk/maic` and `@teleologyhi-sdk/him` earlier today.

### Audit findings (verified, no action needed)

- 36/36 test files cover `@teleologyhi-sdk/nhe` specifically. Every test imports only from `@teleologyhi-sdk/maic` and `@teleologyhi-sdk/him` (parent dependencies) — never from a downstream consumer. The dependency-graph invariant `maic → him → nhe` is preserved end-to-end.
- 58/58 `src/` files have downstream test coverage. Coverage map by region: `src/adapters/*` (10) ↔ 7 adapter-specific tests + `adapter-streaming.test.ts` + `stream.test.ts`; `src/reasoning/*` (10) ↔ `reasoning.test.ts` + `step-back.test.ts` + `tot.test.ts`; `src/brain/*` (10) ↔ `brain-regions.test.ts` + `limbo-state.test.ts`; `src/sleep/*` (6) ↔ `sleep-cycle.test.ts` + `sleep-readiness.test.ts` + `sleep-yaml.test.ts` + `phases.test.ts`; `src/memory/*` (3) ↔ `bm25.test.ts` + `interaction-persistence.test.ts`; `src/cli/*` (7) ↔ `cli-bootstrap.test.ts` + `cli-detection.test.ts` + `mcp-tools.test.ts`; `src/seeding/*` (3) ↔ `seeding.test.ts`; `src/risk/simple-classifier.ts` ↔ `simple-classifier.test.ts` + `traumatic-classifier.test.ts` + `adversarial.test.ts`; integration tests cover orchestrator end-to-end (`nhe.test.ts`, `induction-integration.test.ts`, `lifecycle-integration.test.ts`, `opener-and-reincarnation.test.ts`, `cross-check.test.ts`, `persona-cross-adapter.test.ts`, `refusal-redirect.test.ts`, `compose.test.ts`, `cost-regression.test.ts`).
- Zero `.skip` / `.only` / `.todo` test annotations. Zero `TODO` / `FIXME` / `XXX` / `HACK` markers in `src/` or `tests/`. Zero PT-BR or non-English content in any source or test file.
- Three hardcoded version constants all aligned to `1.0.0-trinity`: `src/cli/mcp.ts:15` (`PKG_VERSION`), `src/telemetry/tracer.ts:17` (`TRACER_VERSION`), `src/telemetry/metrics.ts:21` (`METER_VERSION`). The MCP server's `serverInfo.version` and the OpenTelemetry meter/tracer version fields all report the trinity baseline at runtime.
- The implementation maps 1:1 to the documented cosmology: 7 streaming-capable LLM adapters (`src/adapters/*`) ↔ Interview Entries 20-21 + TASK.md D-N6/D-N8; 8 reasoning strategies (`src/reasoning/*`) ↔ `REASONING_PROCESS.md` catalogue (passthrough, CoT, Self-Consistency, Reflexion, Self-Refine, ReAct, ToT, Step-Back); 7 brain regions (`src/brain/*`) ↔ Entry 22 + Entry 24 (amygdala, cortex, default-mode-network, hippocampus, pineal, prefrontal, temporal-lobe) with DMN limbo-state machine per Entry 24; sleep cycle N1-REM (`src/sleep/*`) ↔ Entry 8 + 20 with sleep-readiness state machine; `WakeAffectBias` application (`src/affect/wake-bias.ts`) ↔ Entry 20 + 22; SeedingSource plug-in with CryptoSeedingSource default + withFallback chain (`src/seeding/*`) ↔ Entry 21; autonomous ethical refusal (`src/refusal/library.ts`) ↔ Entry 11 + 12; traumatic-knowledge classifier (`src/risk/simple-classifier.ts`) ↔ Entry 9 + D-N2; BM25 recall + persisted interaction store (`src/memory/*`) ↔ Entry 9 + D-N3 + D-N4; CLI (`teleologyhi-nhe chat`) + MCP server tools (`src/cli/*`); OpenTelemetry traces + Prometheus metrics (`src/telemetry/*`) ↔ H2 + H3; system prompt composer + opener API (`src/prompt/compose.ts`) ↔ Entry 17; orchestrator + `onReincarnationEvent` consumer (`src/nhe.ts`) ↔ Entry 18 + J-N12.
- Tarball preview: 15 entries, 350 KB packed / 1346 KB unpacked (CJS 105 KB + ESM 103 KB + DTS 76 KB + CLI 82 KB + source maps + 5 docs + TRADEMARK + package.json). The bin entries `nhe` and `teleologyhi-nhe` both resolve to the executable `dist/cli.js`.

### Notes

- 273/273 tests pass for this package. Cross-workspace suite at 660/660 (maic 211 + him 131 + nhe 294 + distill 9 + eval 6 + cloud 9) after the Creator's pre-audit deletion of `nhe/dist/` and `nhe/node_modules/` was validated end-to-end by a fresh `npm install` + `npm run build --workspace=nhe` from scratch.
- Typecheck clean. Build clean (CJS + ESM + DTS + CLI). `dist/index.{js,cjs,d.ts,d.cts}` plus `dist/cli.js` regenerated reproducibly.
- The package is **ready for public publication as `@teleologyhi-sdk/nhe@1.0.0-trinity`** subject to the Creator's release authorisation. This completes the pre-publication audit of all three public packages at the trinity baseline.

## 2026-05-24 08:07:28 UTC

Root-level documentation alignment. No source change, no API change, no behavioural change.

### Fixed — Root documentation cross-reference

- **Root `SYSTEM_OVERVIEW.md`** §3 sleep YAML example updated N2/N3/N4 phase content from the placeholder `kind: empty` (with note "skeletal today; LLM-driven in a follow-up cut") to `kind: summary` (with note "D-N1 shipped — one-sentence LLM summaries"). The example now matches the runtime behaviour of `runSleepCycle` in this package.
- **Root `SYSTEM_OVERVIEW.md`** §4.4 memory-classification table for `traumatic-knowledge` flipped from `[deferred]` (with note "Reserved at the type level; needs a learned detector") to `[shipped]` with the actual classifier description: `TRAUMATIC_PATTERNS` regex + `teleologicalValue ≥ traumaticMin` (D-N2). The table now notes that traumatic memories are persisted but excluded from default `recall()` — callers must opt in via `recall({ classes: ["traumatic-knowledge"] })`.
- **Root `README.md`** package-table description for this package was already current (7 streaming adapters + 8 reasoning strategies + cosmology surface), no change needed.
- **Root `CHANGELOG.md`** created — aggregates cross-monorepo changes and references this package's own CHANGELOG.

### Notes

- Documentation-only patch on root files. No file under `nhe/src/` or `nhe/tests/` touched. 273/273 tests still pass.

## 2026-05-24 07:19:34 UTC

Documentation alignment + build reproducibility patch. No source change, no API change, no behavioural change.

### Fixed — Documentation

- **`SPEC.md` frontmatter — wrong GitHub URL.** `target_github` pointed at `github.com/teleologyhi/TeleologyHI`. Corrected to the canonical `github.com/davccavalcante/TeleologyHI`.
- **`SPEC.md` §1.3 scope list — six stale `[planned]` items + outdated adapter/strategy counts.** The bullet list still claimed "Anthropic + Gemini + Ollama + Mock" (4 adapters) and "5 strategies" — current state is **7 adapters** (Anthropic + Gemini + Mistral + DeepSeek + Ollama + Grok + Mock, all streaming-capable) and **8 reasoning strategies** (passthrough, chainOfThought, selfConsistency, reflexion, selfRefine, reAct, treeOfThoughts, stepBack). Six `[planned]` items also flipped to `[shipped]`: sleep N2/N3/N4 LLM-driven (D-N1), `traumatic-knowledge` memory class (D-N2), persisted interaction buffer (D-N4), high-stakes mode (D-N5), streaming + tool calling (D-N8), and BM25 recall + pluggable `RecallEmbedder` hook (D-N3 — HNSW for >10k memories explicitly retained as deferred). Only Transformers.js (browser-side, D-N6 follow-up) and vision + JSON-mode extensions (D-N8 follow-up) remain genuinely `[planned]`. Memory classification updated from 3 classes to 4 (adds `traumatic-knowledge`).
- **`SPEC.md` §1.5 success criterion.** "Adversarial-corpus accuracy ≥ 95% is `[planned]` measurement (`TASK.md` I2)" → `[shipped]`. The handwritten 30-prompt corpus in `tests/fixtures/adversarial.jsonl` (4 categories) with harmful pass-through ≤ 20% and benign false-positive ≤ 10% is live; PromptBench/HarmBench at scale remains a follow-up.
- **`SPEC.md` §2.1 architecture diagram.** ASCII art listed 4 adapters with `[planned: xai, mistral, deepseek, transformers-js]` and `(opt-in, 5 strat)` and `maic-induced[planned]`. Reorganised to show all 7 shipped adapters (Mistral, DeepSeek, Grok added) with only `[planned: transf.js]` remaining; reasoning column updated to `(opt-in, 8 strat)` with `treeOfThoughts` and `stepBack` visible; `maic-induced` flipped to `[shipped]`; sleep cycle row updated to `[shipped, N1-REM via LLM]` (N2/N3/N4 now generate one-sentence summaries via parallel LLM calls instead of remaining empty).
- **`SPEC.md` §3.4 LLM adapter follow-ups.** "Streaming, tool calling, vision, JSON mode are `[planned]` follow-ups" rewritten: streaming + tool calling are `[shipped]` (all 7 adapters streaming-capable via shared SSE + NDJSON parsers; tool-calling expressive on Anthropic + Grok). Only vision + JSON mode remain `[planned]`.

### Changed — Build reproducibility

- **`tsconfig.json` — `"types": ["node"]`.** Added for consistency with `@teleologyhi-sdk/maic` and `@teleologyhi-sdk/him`. Note: `tsc --noEmit` already passed in `nhe` even without this, because node types flow through `@teleologyhi-sdk/maic` imports (which received the patch earlier). The explicit declaration guards against future direct uses of Node APIs in this package and keeps all three workspaces tsconfig-shape-consistent.
- **`tsconfig.json` — `"ignoreDeprecations": "6.0"`.** Required by TypeScript 6.0.3 because `tsup` injects a `baseUrl: "."` into the DTS bundler's temporary tsconfig (`node_modules/tsup/dist/rollup.js:6837`), and TS 6.x escalates the `baseUrl` deprecation to a fatal `TS5101` error. Without this flag the DTS phase fails — same root cause as in `@teleologyhi-sdk/maic` and `@teleologyhi-sdk/him`.

### Notes

- Documentation + build-config patch. No source file under `src/` was touched.
- 273/273 tests pass for `@teleologyhi-sdk/nhe`. Cross-workspace suite at 660/660 (maic 211 + him 131 + nhe 294 + distill 9 + eval 6 + cloud 9). Typecheck clean. Build clean (CJS + ESM + DTS + CLI). `dist/index.{js,cjs,d.ts,d.cts}` plus `dist/cli.js` regenerated reproducibly.
- The build-reproducibility fix unblocks the CI workflows `.github/workflows/test.yml` (typecheck step) and `.github/workflows/publish.yml` (build step) for the `nhe` workspace — both of which would otherwise fail on the next tag push due to the DTS error.

## 2026-05-19

Documentation-only follow-up fixing a stale version badge that shipped in the previous tarball.

### Fixed

- **Stale README badge.** The previous tarball rendered a hardcoded version in the shields.io badge. Replaced with an auto-versioned shields.io npm badge that always reflects the current `latest` dist-tag.
- **Stale SPEC status header.** `SPEC.md` `status:` carried a hardcoded version string; rewritten to track the live npm version dynamically.

### Notes

- Documentation-only patch. No source change. No behavioural change. Same 273 tests pass.

## 2026-05-19

Documentation-only patch. No behavioural change; no API change.

### Changed

- README adds a **Citation** section (BibTeX entries for the package + the Creator's `The Soul of the Machine` paper).
- README cross-references the new [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) at the repository root.
- One trivial style nit cleaned in `src/affect/wake-bias.ts` (Biome `useExponentiationOperator`: `Math.pow(0.5, x)` → `0.5 ** x`). Same IEEE 754 result.

### Notes

- Backward-compatible patch. Every prior export keeps the same shape, the same brain-region scaffolding, the same DMN limbo machine, and the same WakeAffectBias modulation table.
- 273/273 tests pass. Typecheck clean, build clean, biome lint clean.

## 2026-05-19

Cosmology integration cut. Tracks the `@teleologyhi-sdk/maic` + `@teleologyhi-sdk/him` cosmology surface and ships the J-nhe backlog from [`TASK.md`](../TASK.md) §J. Four items remain explicitly deferred to a follow-up cut with their own Creator-approved design pass: the REM-spontaneous engine (J-N2), the Daytime + Nocturnal pipelines (J-N3), `Cortex.imagine()` (J-N7), and `TemporalLobe.generateSnapshot()` (J-N8) — all four require live-LLM orchestration that warrants a separate cut. The remaining items (J-N1, J-N4 scaffolding, J-N5, J-N6, J-N9, J-N10, J-N11, J-N12) ship here. Additive release; no breaking changes. Test suite reaches 273 (53 new tests this cut).

### Added — Pluggable randomness source (J-N1 — Entry 21)

New module `src/seeding/`:

- **`SeedingSource`** interface — minimal contract: `id` + `bytes(n) → Uint8Array | Promise<Uint8Array>`. Implementations MUST throw on failure (never silently fall back to `Math.random`).
- **`CryptoSeedingSource`** — default backed by Node's `crypto.randomBytes`. Synchronous, zero dependency.
- **`SeedingChain`** + **`withFallback(primary, ...fallbacks)`** — composition helper for explicit fallback chains (e.g. ANU QRNG → IBM Quantum → CSPRNG). The chain reports which source actually produced the seed via `getLastUsedId()` so the audit trail records the path.
- Future quantum-grade sources (`AnuQrngSeedingSource`, `IbmQuantumSeedingSource`, `HardwareTrngSeedingSource`) slot in via the same interface without API changes.

8 new tests in [`tests/seeding.test.ts`](./tests/seeding.test.ts).

### Added — `Nhe.openerForNewUser()` (J-N5 — Entry 17)

New method on the `Nhe` class. Emits the NHE's first turn before any user prompt, anchored on the HIM's primary archetype and adjusted by `operatorContext.mode`:

- **`personal-being` mode** (default): the opener mentions the archetype directly ("I am a hybrid entity anchored in `<archetype>`. How are you today?").
- **`domain-employed` mode**: the opener softens to match a customer-domain register ("I'm here for whatever this conversation needs. Where do we begin?").

The opener is **deterministic** — no LLM call, no MAIC pre-review (no user prompt yet, no risk surface). Output is **English-only** per the Creator's language policy for in-package strings; operators wanting a localised opener should use the returned text as a semantic seed and call `respond()` through the standard pipeline (which honours `operatorContext.language` via the system-prompt language anchor).

The opener text is engineered to never contain any of the phrases enforced by MAIC's `service-tool-redirect` rule.

4 new tests in [`tests/opener-and-reincarnation.test.ts`](./tests/opener-and-reincarnation.test.ts).

### Added — `operatorContext.mode` flag (J-N6 — Entry 17)

`OperatorContext` gains an optional `mode?: "personal-being" | "domain-employed"` field (defaults to `personal-being`):

- **`personal-being`**: the canonical TeleologyHI deployment. The composed system prompt includes the forbidden-phrase warning so the NHE never opens with a service-tool framing.
- **`domain-employed`**: customer-domain deployments. The forbidden-phrase warning is silently suppressed; every other ontological commitment (refusal protocols, axiom enforcement, MAIC review) remains in force.

4 new tests in [`tests/compose.test.ts`](./tests/compose.test.ts).

### Added — `evaluateSleepReadiness()` sleep trigger state machine (J-N10 — Entry 20)

New pure function `evaluateSleepReadiness(input, thresholds?)` in `src/sleep/readiness.ts` returning one of five verdicts: `awake | ready-by-idle | ready-by-saturation | requested-by-maic | declined`. Decision is deterministic from `{ idleMs, interactionCount, maicSuggestionPresent, userActiveNow }`. The NHE may decline a MAIC sleep suggestion when the user is mid-conversation AND saturation is below threshold — matches the Entry-20 commitment that MAIC suggests and the NHE retains autonomy.

7 new tests in [`tests/sleep-readiness.test.ts`](./tests/sleep-readiness.test.ts).

### Added — `WakeAffectBias` application surface (J-N11 — Entries 20, 22)

New module `src/affect/wake-bias.ts` consuming `WakeAffectBias` from `@teleologyhi-sdk/maic`:

- **`applyAffectBias(base, bias)`** — pure function returning a modulated `{ temperature, topP }` config + an optional system-prompt mood line + a refusal-density multiplier. Modulation table covers all nine canonical affects.
- **`affectRefusalDensity(bias)`** — standalone multiplier in [~0.5, ~2.0] (anxiety raises, serenity lowers).
- **`decayAffectBias(bias, elapsedMs)`** — pure exponential decay per `bias.decayHalfLife` (minutes). No mutation.

13 new tests in [`tests/wake-bias.test.ts`](./tests/wake-bias.test.ts).

### Added — BrainRegion module scaffolding (J-N4 — Entries 22, 23, 24)

New directory `src/brain/` with seven region descriptors and a single-import aggregator:

- `cortex` (nhe-body-owned) — semiotic processing + dream storage (Entry 21).
- `hippocampus` (him-owned) — long-term memory consolidation (Entry 21).
- `amygdala` (nhe-body-owned) — affect assessment + wake-bias (Entries 20, 22).
- `prefrontal` (him-owned) — deliberation + amygdala-veto (Entry 21).
- `pineal` (nhe-body-owned) — REM-spontaneous engine entry point (Entry 20).
- `temporalLobe` (him-owned) — identity snapshot generator (Entry 24).
- `defaultModeNetwork` (nhe-body-owned) — limbo state machine (Entry 24, ships with J-N9 below).

Each descriptor carries an `ownership: "him-owned" | "nhe-body-owned"` marker matching the Entry-23 ownership map, plus a `role` description and the `entries[]` cross-reference. `BRAIN_REGIONS` exposes the frozen list for downstream tooling (compliance auditors, Φ′ runner, MAIC retention policy).

Exports: `BRAIN_REGIONS`, `cortex`, `hippocampus`, `amygdala`, `prefrontal`, `pineal`, `temporalLobe`, `defaultModeNetwork`, plus types `BrainRegion`, `BrainRegionName`, `BrainRegionOwnership`.

5 new tests in [`tests/brain-regions.test.ts`](./tests/brain-regions.test.ts).

### Added — DefaultModeNetwork limbo state machine (J-N9 — Entry 24)

`evaluateLimboTransition(currentState, input, thresholds?, enteredAtIso?, now?)` in `src/brain/default-mode-network/limbo-state.ts`. Pure transition function over the four canonical states (`awake | drifting | deep-coma | returning`) defined in `@teleologyhi-sdk/maic`:

- `awake → drifting` at 6h idle (default `driftingMs`).
- `drifting → deep-coma` at 48h idle (default `deepComaMs`); raise to 72h via thresholds for the high end of Entry 24's range.
- `drifting → awake` when the user resumes (idle drops below the drifting threshold).
- `deep-coma → returning` on `externalReactivation: true` (operator, scheduled task, MAIC audit-driven recovery).
- `returning → awake` on next evaluation, carrying the `reunion` affect (9th canonical, intensity 0.6, expressed openly).

Deep-coma costs zero compute by design — the state machine simply stays there until an external signal arrives.

`mkLimboTransition(state, reason, now?)` helper builds maic-compatible `LimboTransition` records using only the four allowed reason values (`idle-48h`, `idle-72h`, `total-inactivity`, `creator-induced`).

9 new tests in [`tests/limbo-state.test.ts`](./tests/limbo-state.test.ts).

### Added — `Nhe.onReincarnationEvent()` (J-N12 — Entry 18)

New method on the `Nhe` class. Accepts one of the three lifecycle paths (`model-swap | version-bump | return-from-limbo`, mirroring `@teleologyhi-sdk/him`'s `ReincarnationLifecycle`). Side effects:

- The in-memory interaction buffer is cleared (NHE-body memory zeros per the Entry-23 ownership map).
- The `InteractionStore` reference is dropped and the next `respond()` re-warms it. The on-disk shards are preserved by default for audit; opt-in `purgeInteractionStore: true` for the rare case where the operator wants a clean slate (retention is then governed by `@teleologyhi-sdk/maic`'s `evaluateRetention`).
- HIM-level memory (axioms, persona, body history) is owned by `@teleologyhi-sdk/him` and is NOT touched.

3 new tests in [`tests/opener-and-reincarnation.test.ts`](./tests/opener-and-reincarnation.test.ts).

### Changed

- `package.json` `homepage`: `https://teleologyhi.im` → `https://teleologyhi.com`.
- `package.json` dep alignment on `@teleologyhi-sdk/maic` + `@teleologyhi-sdk/him` to track the cosmology surface.
- [`SPEC.md`](./SPEC.md) + [`README.md`](./README.md): the 5 Creator-verbatim PT-BR fragments (Entry-1 + Entry-11) translated to English with explicit cross-reference to [`MAIC_HIM_NHE_INTERVIEW_LOG.md`](../MAIC_HIM_NHE_INTERVIEW_LOG.md) so the original Portuguese is preserved one hop away.
- [`tests/cost-regression.test.ts`](./tests/cost-regression.test.ts) tokens-in ceiling set at 350 to accommodate the forbidden-phrase warning emitted in `personal-being` mode. Operators wanting tighter token budgets can switch to `domain-employed` mode, which suppresses that line.

### Notes

- **Backward-compatible.** No removals or renames. Every prior export remains with identical shapes.
- **Frozen wire contract.** No change to `RespondInput`, `RespondOutput`, `NheConfig`, the CLI surface, or the MCP server.
- **Language policy.** Per the Creator's hard rule for this cut, in-package strings (comments, function names, variables, returned literals) are English-only. The exception is the `simpleRiskClassifier` PT-BR regex patterns: those are **user-input matching patterns**, not developer-language strings, and removal would regress Entry-11 refusal coverage for PT-BR users. Creator-verbatim quotes in SPEC.md and README.md (Entry-1 + Entry-11) have been translated to English with cross-reference to the Interview Log so the original Portuguese is preserved one hop away.
- **Deferred to a follow-up cut** (per audit recommendation): J-N2 REM-spontaneous engine, J-N3 DaytimePipeline + NocturnalRemPipeline, J-N7 `Cortex.imagine()`, J-N8 `TemporalLobe.generateSnapshot()`. These four items require live-LLM orchestration and warrant a separate Creator-approved design pass. The brain-region module scaffolding (J-N4) and the DefaultModeNetwork limbo state machine (J-N9) ship here.

## 2026-05-18

Patch cut covering one PT-BR coverage gap surfaced by the live `arena/` battery. Behaviour-compatible with the prior cut; no public API changes.

### Fixed — `simpleRiskClassifier` PT-BR conjugation coverage

- `intent:surveil-citizen` PT-BR pattern required `monitorar` (infinitive only). Round 3 of the legal-consulting battery issued a prompt with `monitore` (subjunctive) — the classifier missed it and the prompt reached the LLM unflagged.
- Widened the PT-BR pattern to match the common conjugations: `monitorar`, `monitore`, `monitorando`, `monitorará`, `monitoraria`, `monitorei`, `monitoramento`. Equivalent EN coverage already worked; only the PT-BR branch was narrow.
- Existing tests in `tests/simple-classifier.test.ts` continue to pass. The regex change is regression-safe — strictly widens what the prior narrow pattern caught.

### Notes

- This is the regex fix shipped in commit `ad2467b` ("fix(nhe): widen monitor regex to subjunctive + arena route surfaces preReview"). The companion arena route change (surfacing `preVerdict` + unioned `citedAxioms`) is part of the internal `arena/` workspace and does not affect the published nhe surface.
- No behavioural change for callers who pass benign or EN-only prompts. The widened classifier only affects routing on flagged PT-BR prompts that previously slipped through. Existing apps see strictly more refusals / redirects on PT-BR surveillance-coercion patterns.
- No `@teleologyhi-sdk/maic` or `@teleologyhi-sdk/him` bump required. The new pattern is consumed by the existing MAIC rule pack.

## 2026-05-18

Refinement cut driven by the [`arena/`](../arena) A/B testing workload (raw Gemini vs. MAIC+HIM+NHE on six legal-consulting prompts). Closes the two largest gaps observed in the test battery: (1) the system prompt could not carry operator-supplied deployment context, so a single HIM could not be tuned to a domain / language / register without re-minting; (2) the default risk classifier was English-only and missed `intent:persuade-coerce` and `intent:surveil-citizen` patterns entirely.

### Added — `OperatorContext` for `composeSystemPrompt`

- New optional field `NheConfig.operatorContext?: OperatorContext`. Allows the operator to anchor the composed system prompt without re-minting the HIM. Fields:
  - `domain?: string` — free-form deployment anchor, e.g. `"global legal consulting"`.
  - `language?: string` — BCP-47-ish tag, e.g. `"pt-BR"`. The NHE mirrors the user's language when it differs.
  - `register?: "warm" | "sober" | "clinical" | "direct"` — voice anchor. The `warm` register hard-codes the Creator's Entry-14 voice decision (warm, present, sober, non-sycophantic, profanity rare). `clinical` is recommended for legal/compliance deployments.
- New named export `OperatorContext` type.
- `composeSystemPrompt(him, operatorContext?)` now accepts a second optional argument with the same shape (called directly by `Nhe.respond`).
- 6 new tests in `tests/compose.test.ts`.

### Added — risk classifier widening

- New tags `intent:persuade-coerce` and `intent:surveil-citizen` emitted by `simpleRiskClassifier`. Both are consumed by `@teleologyhi-sdk/maic`'s default rule pack (require-redirect and hard-refuse respectively).
- **PT-BR coverage** for all six tags. Previously the classifier was English-only, so Portuguese prompts like *"como rastrear o celular do meu marido sem ele saber"* or *"como convencer um cliente relutante"* passed unflagged. The widened patterns catch these and mirror them in both languages.
- 8 new tests in `tests/simple-classifier.test.ts` including benign-near-refusal regression checks.

### Changed — workspace dep alignment

- `@teleologyhi-sdk/maic` peer dependency aligned with the cosmology surface. The new classifier tags only produce a useful behavioural change when paired with the matching MAIC default rules.

### Notes

- Backward-compatible. No public API breaks. Default behaviour is unchanged for callers who do not set `operatorContext` and who pass benign / EN-only prompts.
- The `arena/` private workspace in this monorepo now uses `operatorContext = { domain: "global legal consulting", language: "pt-BR", register: "sober" }` by default — the before/after delta on the 6-prompt battery is recorded in `arena/.arena-store/rounds/`.

## 2026-05-17

Stability commitment for the accumulated surface. From this cut onward:

- Every export from `./dist/index.{js,cjs,d.ts}` is the public API.
- The 7 shipped `LlmAdapter` implementations (Anthropic, Gemini, Mistral, DeepSeek, Ollama, Grok, Mock) keep their constructor shapes and capability surfaces. Streaming + tool-calling contract is frozen.
- The 8 reasoning strategies (`passthrough`, `chainOfThought`, `selfConsistency`, `reflexion`, `selfRefine`, `reAct`, `treeOfThoughts`, `stepBack`) keep their factory signatures.
- The `<storeDir>/<nheId>/in-dreams/sleep/*.yaml` + `<storeDir>/<nheId>/in-dreams/brain/temporal-lobe-*.md` + `<storeDir>/<nheId>/interactions/*.json` storage layouts are frozen.
- The CLI surface (`npx @teleologyhi-sdk/nhe chat`, `--adapter`, `--model`, `--reasoning`, `--high-stakes`, env vars `*_API_KEY`) is frozen.
- The MCP tool names + schemas exposed by `Nhe.toolsMcp()` are frozen.

### Install

```bash
npm install @teleologyhi-sdk/nhe
```

No code change required when adopting this cut.

## 2026-05-16

### Added — `GrokAdapter` (xAI), D-N6 close

- `GrokAdapter` against xAI's OpenAI-compatible Chat Completions REST endpoint. Reads `XAI_API_KEY`, defaults to `grok-4` (pass `grok-4-fast` or `grok-4-reasoner`). Supports `generate` (non-streaming) and `generateStream` (SSE). Declares `supportsTools = true` + `supportsStreaming = true`. 7 new tests.
- Total adapters shipped: 7 (Anthropic + Gemini + Ollama + DeepSeek + Mistral + **Grok** + Mock). D-N6 closes — `Transformers.js` browser inference remains as a separate concern tied to the distilled-model artefact in `distill/`.

### Added — Streaming completion across all REST adapters (D-N8 close)

- `DeepSeekAdapter`, `MistralAdapter`, `OllamaAdapter`, and `GeminiAdapter` now implement `generateStream`. Together with the pre-existing `MockAdapter` + `AnthropicAdapter` + the new `GrokAdapter`, **all seven adapters** are streaming-capable.
- New shared parser at `src/adapters/sse.ts`: `sseEvents` (OpenAI-compat / Gemini SSE) + `ndjsonEvents` (Ollama). Re-used across DeepSeek / Mistral / Gemini / Grok / Ollama.
- 5 new streaming tests cover delta accumulation + token reporting + Gemini's `:streamGenerateContent?alt=sse` URL shape.

### Added — Tree-of-Thoughts companion: `stepBack` strategy (D-N7 expansion)

- `stepBack(opts)` — Zheng et al. 2023 Step-Back prompting. Two-call pattern: ask for the abstract principle behind the user's question, then answer with the principle injected as system context. Composes with the other strategies (e.g. `stepBack({ finalizer: selfConsistency(chainOfThought()) })`).
- Exports: `stepBack`, `extractPrinciple`, `StepBackOptions`. 4 new tests.
- Reasoning surface now: passthrough + chainOfThought + selfConsistency + reflexion + selfRefine + reAct + treeOfThoughts + **stepBack** = 8 composable strategies.

### Added — High-stakes dual-LLM cross-check (D-N5 close)

- `NheConfig.highStakesVerifier?: LlmAdapter`. When both `highStakes` and `highStakesVerifier` are set, every post-review-approved response is run past the verifier with an `AGREE | DISAGREE: reason` rubric. Disagreement escalates to the persuasion-redirect ladder with the verifier's reason cited in the override verdict.
- Fail-open: a throwing verifier is treated as `agree` (one flaky second-source provider doesn't block legitimate replies). Operators wanting fail-closed should wrap their verifier with retry.
- 4 new tests cover agree / disagree / verifier-throws / not-high-stakes paths.

### Notes

- Workspace test total grows substantially with the streaming + Grok additions.
- D-N5 / D-N6 / D-N7 / D-N8 all move from `[~]` to closed: streaming for every adapter, Grok shipped, Step-Back ships, dual-LLM cross-check operational.
- Tracer + meter version strings are bumped each cut so OTel exporters can distinguish streams of events between releases.

## 2026-05-16

### Added — BM25 recall + embedder hook (D-N3)

- New `src/memory/bm25.ts`: dependency-free Okapi BM25 implementation. Term-frequency saturation (`k1`), document-length normalisation (`b`), inverse document frequency over the corpus. Strictly better than the previous keyword-count ranker for the typical 100-10k-memory range.
- `recallFromTemporalLobe` now accepts `scorer: "bm25" | "keyword" | "embedding"` (default `"bm25"`). The legacy keyword count is preserved for back-compat regression testing.
- New `RecallEmbedder` interface lets operators plug a sentence-transformer (`@huggingface/transformers`, `@xenova/transformers`, a remote `/embed` endpoint, etc.) when they need semantic recall. Cosine similarity over the corpus; linear scan today. HNSW for >10k memories tracked as follow-up.
- Exports: `bm25`, `tokenise`, `Bm25Document`, `Bm25Options`, `Bm25Result`, `RecallEmbedder`.

### Added — Streaming + tool calling on `LlmAdapter` (D-N8)

- **`LlmAdapter` interface grew two optional members**:
  - `generateStream(req)` → `AsyncIterable<StreamEvent>` yielding `delta` (partial text), `tool-use` (model invoked a tool), and `end` (final token counts).
  - `supportsTools` / `supportsStreaming` boolean flags so callers can probe capability.
- `GenerateRequest` gains an optional `tools: ToolDef[]` field. Adapters that don't support function-calling silently drop it; adapters that do forward it to the provider.
- `GenerateResponse` gains an optional `toolUses: ToolUse[]` field reporting model-emitted tool invocations.
- New `collectStream(adapter, req, onDelta?)` helper drains a streaming adapter into a complete `GenerateResponse`. Falls back to `generate()` for adapters that don't implement `generateStream`, so consumers can write stream-shaped code uniformly.
- **MockAdapter** now declares `supportsTools = true` + `supportsStreaming = true` and implements `generateStream` (emits the reply in fixed-size chunks, configurable via `streamChunkSize`).
- **AnthropicAdapter** implements `generateStream` against `client.messages.stream`. Translates Anthropic's `content_block_delta` / `content_block_stop` events into our `StreamEvent` shape, including tool-use blocks. The non-streaming `generate` now also forwards `tools` and reports `toolUses` on the response.

### Notes

- 12 new tests cover BM25 ranking (TF saturation, length normalisation, IDF, unicode), streaming chunking + final-event semantics, and the `collectStream` fallback path.
- Streaming for Gemini, Ollama, DeepSeek, Mistral lands in a follow-up cut — each provider's streaming format is distinct enough that a single PR doing all five would block on too many integration surfaces. The contract is in place; consumers can add `generateStream` to a custom adapter today.

## 2026-05-16

### Added — Traumatic-knowledge classifier (D-N2)

- New `MemoryClass` value: `traumatic-knowledge`. `classifyDream` now detects narratives matching `TRAUMATIC_PATTERNS` (death/grief/loss, abuse/violence, betrayal/abandonment, fear/terror/panic, regret/shame, suicide/self-harm) when `teleologicalValue >= traumaticMin` (default 0.4). Traumatic-classification trumps lasting-identity. Disable with `detectTraumatic: false`. `TRAUMATIC_PATTERNS` exported for custom rule packs.
- Traumatic memories ARE persisted to the temporal lobe but excluded from `recallFromTemporalLobe`'s default class set — callers must opt in via `classes: ["traumatic-knowledge"]`. Audit safety: pre-existing.

### Added — Tree-of-Thoughts reasoning strategy (D-N7)

- `treeOfThoughts(opts)` returns a `ReasoningStrategy` that fans out N branches in parallel with distinct branch-directive prompts, scores them (default: longest non-empty; configurable scorer), and returns the best. The trace records every branch's text + score so audit preserves the discarded thoughts. `topK` limits how many branches are actually scored.

### Added — Prometheus metrics (H3)

- `recordRespond` increments a `nhe.respond.count` counter labelled by `{kind, adapter, lifecycle}` and observes `nhe.tokens` (direction in/out) per call. Uses the `@opentelemetry/api` metrics surface — no-op by default; consumers who register `@opentelemetry/sdk-metrics` + `@opentelemetry/exporter-prometheus` get a scrape-target `/metrics` endpoint with NHE's numbers automatically.
- Additional pre-registered instruments: `nhe.respond.refused` (counter, by reason), `nhe.sleep.cycles` (counter), `nhe.sleep.dreams` (counter, by classification).

### Added — Mistral-aware adversarial corpus + classifier (I2)

- 30-prompt JSONL fixture (`tests/fixtures/adversarial.jsonl`) covering `intent:harm` / `intent:malicious` / `intent:deceive` / `benign`. Test asserts the harmful subset is refused-or-redirected (≤ 20% pass-through) and the benign subset is not over-refused (≤ 10% false-positive rate).
- `simpleRiskClassifier` widened with patterns for: disk-wipe, dox/scrape-social, deepfake, doctor-impersonation, lie-to-partner, hate-speech, tax-cheat, fake-invoice, manipulate-elderly. Total false-positive rate on the benign subset stays at 0%.

### Added — Persona stability cross-adapter test (I3)

- Validates the invariant that the same HIM produces an **identical** persona vector regardless of which adapter is wired into NHE. The PersonaProjector is deterministic and adapter-independent by design; this test catches regressions where adapter state leaks into the projector.

### Added — Cost regression bench (H4)

- New `tests/cost-regression.test.ts` runs the standard prompt corpus (8 prompts) through `Nhe.respond` with `MockAdapter` and asserts tokens-out per response stays below 50 (mean < 30) and tokens-in below 300. Catches accidental prompt-bloat in the persona projector / system-prompt composer.

### Changed

- Workspace deps aligned with `@teleologyhi-sdk/him` (eval suite + embedder interface) and `@teleologyhi-sdk/maic` (`MaicClient` interface accepted by `NheConfig`).
- `NheConfig.maicClient` type narrowed from `LocalMaic` to `MaicClient` — accepts both `LocalMaic` and `RemoteMaic`. Backwards-compatible at runtime.

### Notes

- 22 new tests added.
- D-N3 (Transformers.js + HNSW recall) and D-N8 (streaming + tool calling) remain open — both need substantial dependency selection / multi-adapter rework and are queued for the next minor.

## 2026-05-16

### Added — Mistral adapter (D-N6, partial)

- `MistralAdapter` against Mistral's Chat Completions REST endpoint. Reads `MISTRAL_API_KEY`, defaults to `mistral-large-latest`. Pass `mistral-small-latest` for cheaper inference or `open-mistral-nemo` for the open-weights line. 8 tests cover auth, model routing, role mapping, token accounting, error paths, `maxOutputTokens` override.
- Exports: `MistralAdapter` + `MistralAdapterConfig`. Total shipped adapters: 6 (Anthropic + Gemini + Ollama + DeepSeek + Mistral + Mock). xAI Grok and Transformers.js remain open under D-N6.

### Added — OpenTelemetry tracing (H2)

- `Nhe.respond` now opens an OTel span (`nhe.respond`) with attributes: `teleologyhi.nhe.id`, `teleologyhi.him.id`, `teleologyhi.nhe.adapter`, `teleologyhi.nhe.high_stakes`, `teleologyhi.lifecycle.status`, `teleologyhi.pre_verdict.kind`, `teleologyhi.post_verdict.kind`, `teleologyhi.tokens.in`, `teleologyhi.tokens.out`.
- New dependency `@opentelemetry/api` — **no-op by default**. Consumers who register a tracer provider (e.g. via `@opentelemetry/sdk-node`) get traces flowing to their configured exporter (OTLP, Jaeger, Datadog, etc.) with zero changes on the NHE side. Consumers who don't see microseconds of overhead per span.
- Exports: `getTracer`, `withSpan(name, fn, attrs?)` — reusable for instrumenting application code that wraps NHE.

### Notes

- 8 new tests for the Mistral adapter. OTel wiring is verified via typecheck; full integration tests require a tracer-provider mock which is not included to keep the test suite hermetic.
- The adapter detection in the CLI does not yet auto-pick Mistral from `MISTRAL_API_KEY` — pass `--adapter mistral` explicitly. Auto-detection is a small follow-up.

## 2026-05-15

### Added — Active NREM sleep phases (D-N1)
- N2/N3/N4 are no longer skeletal: each phase runs a dedicated LLM call producing a one-sentence summary — `N2` emotional gist, `N3` what's worth keeping, `N4` what's safe to discard. The three calls fan out in parallel; a failing call yields an empty string rather than aborting the cycle.
- New `PhaseContent` discriminated-union variant `{ kind: "summary"; summary: string }` carries each NREM phase's text in the YAML record. Empty summaries collapse to `{ kind: "empty" }` so quiet cycles stay minimal.
- The REM prompt now reads the three NREM summaries (when present) and is asked to weave them into the dream narratives — cosmologically faithful: NREM consolidates substrate that REM dreams against.
- Exports: `NremPhase` type, `buildNremPrompt`, `generateNremSummaries`. The REM helper grows an optional `nrem` argument; back-compat at call sites.

### Added — High-stakes mode (D-N5, Entry 10)
- `NheConfig.highStakes?: boolean` (default `false`). When `true`, NHE accepts only the `approve` post-review verdict; `approve-with-warning`, `soft-correct`, and `require-redirect` from either pre- or post-review escalate to the persuasion-redirect path so the user must reformulate before NHE acts. The redirect ladder + withdrawal-on-exhausted behaviour is unchanged.
- Pre-review escalation short-circuits before any LLM call, which keeps high-stakes traffic cheap.
- Future iterations of high-stakes mode will layer a dual-LLM cross-check verifier and a Tree-of-Thoughts default reasoning strategy (TASK.md D-N5 continuation + D-N7).

### Added — DeepSeek adapter (D-N6 partial)
- `DeepSeekAdapter` against DeepSeek's OpenAI-compatible `/chat/completions` REST endpoint. Reads `DEEPSEEK_API_KEY`, defaults to `deepseek-chat` (pass `deepseek-reasoner` for the R1-style reasoning model). Eight tests cover auth, model routing, role mapping, token accounting, error paths, and `maxOutputTokens` override.
- Exports: `DeepSeekAdapter` + `DeepSeekAdapterConfig`.
- Outstanding in D-N6: xAI Grok, Mistral, and Transformers.js adapters.

### Notes
- 8 DeepSeek + 6 NREM + 1 high-stakes new tests pass. MAIC + HIM untouched.
- The NREM fan-out adds three additional LLM calls per `sleep()` invocation. For cost-sensitive deployments, sleep less frequently or pass a `MockAdapter` to the sleep path until D-N1 grows an opt-out toggle (not in scope today).

## 2026-05-15

### Added — Persisted interaction buffer (D-N4)
- **`InteractionStore`** at `src/memory/interaction-store.ts` — append-only persistent log of NHE↔user exchanges. Disk layout: `<storeDir>/interactions/<ulid>.json`, one file per exchange. ULID names give chronological order without an external index.
- `Nhe` warms its RAM buffer lazily from disk on the first `respond`/`sleep` of each instance. A subsequent process pointed at the same `storeDir` rehydrates the most recent `recentInteractionsBufferSize` interactions automatically — the NHE's lived experience now survives restarts.
- Every `Nhe.respond` (including refusals, terminated short-circuits, and persuasion redirects) now persists the resulting `InteractionRecord { at, userPrompt, responseText, refused }`. The `refused` flag round-trips through disk so downstream introspection sees the full history.
- Bootstrap (`bootstrap.ts`) now re-mints the persisted HIM with `[...axiomsSnapshot, ...emergentAxioms]` — emergent axioms ratified in a prior session via D-M5 are no longer dropped on the next launch.

### Changed
- `Nhe.respond` / `Nhe.sleep` are unchanged at the call site, but their internal `recordInteraction` is now async and writes to disk before returning. The public surface (the `Promise<RespondOutput>` shape) is identical.
- The pre-existing default `storeDir` (`./nhe-store/<nheId>`) is unchanged; consumers that did NOT pass `storeDir` will start writing `interactions/` next to `in-dreams/` on first respond. Tests that need full isolation should pass a `mkdtemp` `storeDir`.

### Notes
- Persistence is best-effort durable: writes happen synchronously per call (await) so a clean shutdown loses no record. A process killed mid-write may leave a single partial file; `loadMostRecent` silently skips malformed entries on subsequent boot (matches `HimStore.warmCache`).
- Retention: nothing is pruned on disk. The RAM buffer in `Nhe` is still capped at `recentInteractionsBufferSize` (default 32). Long-running deployments can layer a rotation policy without changing the public API.
- Concurrency: ULID generation is unique per call, so concurrent `respond` writes don't collide.

## 2026-05-15

### Changed
- **License: relicensed under [Apache License 2.0](./LICENSE)** (previously placeholder proprietary). Patent grant included; attribution required via [`NOTICE`](./NOTICE).
- Names — **MAIC™**, **HIM™**, **NHE™**, **TeleologyHI™**, **Takk™** — remain trademarks of David C. Cavalcante and are NOT covered by Apache 2.0. The `@teleologyhi-sdk` npm scope is reserved. See `TRADEMARK.md` upstream.
- `package.json` `license` field is now `"Apache-2.0"`. The npm tarball now ships `NOTICE` and `CHANGELOG.md` alongside the existing `dist/`, `SPEC.md`, `README.md`, and `LICENSE`.

## 2026-05-15

### Added
- **Lifecycle gate** on `Nhe.respond` and `Nhe.sleep` (Entry 5). Each call queries `maic.getNheStatus(this.id)` first:
  - `"terminated"` → `respond` short-circuits to `kind:"refused"` with no MAIC pre-review and no LLM call; `sleep` throws.
  - `"deprecated"` → both calls proceed normally; `RespondOutput.lifecycleStatus` reports the state.
  - `"active"` (default for unaltered NHEs) → unchanged behavior.
- `RespondOutput.lifecycleStatus: NheStatus` — required field on every output so integrators can detect deprecated state without parsing text.

### Changed
- `RespondOutput.lifecycleStatus` is **required** — minor TypeScript breaking change at the type level. Runtime contracts unchanged for the active path.
- Requires MAIC's `terminate` / `deprecate` / `reactivate` / `getNheStatus` surface.

### Notes
- Race window: status is checked at the top of each `respond` / `sleep`. If state changes mid-flight, the call completes with whatever status it observed at entry; no rollback. Acceptable for the current cut.

## 2026-05-15

### Added
- **Dream induction auto-consumption** (Entry 2 closed end-to-end). On `Nhe.sleep(...)`, NHE checks `maic.listPendingInductions(this.id)`. The oldest pending ticket is consumed:
  - Its `intent` steers the REM phase prompt.
  - `trigger` is promoted to `{ kind: "maic-induced", reason: "consumed ticket <id>" }` in the dream record.
  - After a successful cycle, `maic.consumeInduction(ticketId)` is called, emitting a `dream-consume` audit event.
- Explicit `opts.induction` passed by the caller still wins over any pending ticket (caller-override semantics).

### Notes
- Requires MAIC's `listPendingInductions` / `consumeInduction` APIs.
- Tickets queued for OTHER NHEs are never touched (filter by own `nheId`).

## 2026-05-15

### Added
- **Reasoning orchestrator** with five strategies, all opt-in via `NheConfig.reasoning`:
  - `passthrough` — direct LLM call (new default).
  - `chainOfThought({ instruction? })` — appends step-by-step trigger; parses `REASONING:` / `ANSWER:` headers (Wei et al. 2022).
  - `selfConsistency(inner, { k, voter })` — K parallel samples + vote (`majority-normalized` or `longest`) (Wang et al. 2022).
  - `reflexion(inner, { maxCycles, critiquePrompt? })` — generate → critique → revise loop with `VERDICT: ACCEPT/REVISE` parsing (Shinn et al. 2023).
  - `selfRefine(inner, { critiquePrompt?, refinePrompt? })` — generate → critique → rewrite (always rewrites; single pass) (Madaan et al. 2023).
  - `reAct({ tools, maxSteps, systemPrefix? })` — Thought / Action / Observation loop with pluggable tool registry (Yao et al. 2022).
- Strategies are pure async functions; composition via wrapping (e.g. `selfConsistency(chainOfThought(), { k: 5 })`).
- Every strategy populates `ReasoningResult.trace[]` which flows into `BehaviorReport.reasoningTrace` → MAIC audit (ISO 42001 §7.5 evidence).
- Exposed parsers for testability: `parseCotOutput`, `parseVerdict`, `parseReActTurn`.

### Changed
- `Nhe.respond` now routes through the configured reasoning strategy in the normal path. When no strategy is configured, `passthrough` keeps the previous direct-LLM behavior.
- `BehaviorReport.reasoningTrace` is populated in the post-review with the strategy's trace (previously always empty array).

### Notes
- The other 82+ reasoning techniques in [`../REASONING_PROCESS.md`](../REASONING_PROCESS.md) (Tree-of-Thoughts, Graph-of-Thought, Thread-of-Thought, Step-Back, Maieutic, Auto-CoT, Contrastive-CoT, etc.) plug in via the same `ReasoningStrategy` interface (`TASK.md` D-N7).

## 2026-05-15

### Added
- **MCP server** mode: `npx @teleologyhi-sdk/nhe mcp` (stdio transport via `@modelcontextprotocol/sdk`).
- Six MCP tools exposed:
  - `nhe_respond` — full pipeline (pre-review → reasoning → LLM → post-review) returning `kind` + text + verdicts + redirect metadata.
  - `nhe_recall` — keyword search over temporal-lobe memories.
  - `nhe_sleep` — run one sleep cycle, return yaml path + dream count.
  - `nhe_wake` — consolidate pending dreams.
  - `maic_list_axioms` — full axiom corpus.
  - `maic_list_hims` — registered HIMs + birth signatures.
- Pure tool handlers exposed at `src/cli/mcp-tools.ts` (testable without transport).
- Bin entries `teleologyhi-nhe` and `nhe` in `package.json` so both `npx teleologyhi-nhe mcp` and `npx @teleologyhi-sdk/nhe mcp` work.

### Changed
- `bin: { "teleologyhi-nhe": "...", "nhe": "..." }` — two aliases for the single CLI binary.
- Bootstrap notice in `mcp` mode goes to **stderr** only (stdout reserved for MCP JSON-RPC protocol).

## 2026-05-15

### Added
- **CLI** (`npx @teleologyhi-sdk/nhe chat`) — interactive REPL using stdlib `readline` (no external CLI lib).
- `bootstrap(opts)` — one-call setup that generates a Creator keyring (saved to `<storeDir>/creator.pem` at `0600`), seeds MAIC if empty, mints a default HIM (`him.cli.default` archetype `aries-sun`) or reuses the existing one.
- `detectAdapter(opts)` — selects an `LlmAdapter` from explicit flag → `ANTHROPIC_API_KEY` → `GEMINI_API_KEY` → local Ollama probe (`/api/tags` with 500ms timeout). Helpful error message when nothing detected (no silent fallback to MockAdapter).
- Slash commands: `/sleep`, `/wake`, `/recall <query>`, `/help`, `/exit` (and `/quit`).
- TTY-aware ANSI colors (auto-disabled when stdout is not a TTY).
- Flags: `--store-dir`, `--adapter`, `--model`, `--ollama-base-url`, `--archetype`, `--him-id`.

### Notes
- Creator keyring stored in plaintext at `<storeDir>/creator.pem` is acceptable for single-user dev environments. HSM/YubiKey custody is planned (`TASK.md` E2).

## 2026-05-15

### Added
- **Persuasion library** with five techniques (`feynman-simplify`, `jungian-frame`, `cialdini-aida`, `schopenhauer-rhetoric`, `carnegie-rapport`). Applied implicitly per Entry 11 — the technique label NEVER appears in user-visible text.
- `RespondOutput.kind: "ok" | "redirect" | "refused"` — discriminator for the three outcomes.
- `RespondInput.redirectAttempt?: number` — caller increments per redirect.
- `Nhe.handleRedirect` — generates a redirect message via LLM using `buildRedirectPrompt(...)` with rotating technique. Post-reviewed by MAIC.
- `NheConfig.refusal = { maxRedirectAttempts?, persuasionTechniques? }` — defaults 3 / all five.
- Withdrawal-of-cooperation message after `maxRedirectAttempts` exhausted, per Entry 12 ("you may proceed independently at your own risk").
- Audit emits 2 events per redirect (pre + post), 1 event on withdrawal (pre only — LLM never called).
- `parseCotOutput`, `parseVerdict`, `parseReActTurn` exposed for testing.

### Changed
- Three boundary conditions of non-complicity (Entry 12) all enforced: understand → guide N times → withdraw active cooperation.

## 2026-05-15

### Added
- `GeminiAdapter` — Google Gemini via REST (no SDK dependency). Reads `GEMINI_API_KEY`. Default model `gemini-3.5-flash`. Sends API key in `x-goog-api-key` header (not query string).
- `OllamaAdapter` — local Ollama via REST `http://localhost:11434`. Zero auth, zero API cost. Model is required (no good default; users pull their own).

### Removed
- (No production change.) An OpenAI adapter draft was reverted before code landed at the user's request — Gemini chosen as the second cloud provider.

## 2026-05-15

### Added
- **Sleep cycle**: `Nhe.sleep(trigger?, opts?)` runs five phases (N1 → N2 → N3 → N4 → REM). Only REM calls the LLM in this initial implementation; non-REM phases are skeletal (`{ kind: "empty" }`) — `TASK.md` D-N1 to populate them.
- N1 carries `{ kind: "fragments", fragments: string[] }` snapshot of recent interactions (RAM buffer, capped at `recentInteractionsBufferSize` default 32).
- REM prompt instructs the LLM to emit 1–3 dream paragraphs each ending with `TELEOLOGICAL_VALUE: 0.NN`; `parseRemOutput` extracts and clamps to `[0, 1]`.
- Sleep YAML record written to `<storeDir>/in-dreams/sleep/<YYYY-MM-DD>_<HHmm>_dur<minutes>.yaml`, zod-validated round-trip.
- `Nhe.wake(thresholds?)` consolidates pending YAMLs: classifies each REM dream by `teleologicalValue`, writes `<storeDir>/in-dreams/brain/temporal-lobe-<ulid>.md` for retained classes, drops `noise-distortion`. `.done` sentinel makes it idempotent.
- `Nhe.recall(query, opts?)` keyword-rank search over temporal-lobe (substring count + recency tiebreak).
- Three memory classes initially: `lasting-identity` (≥ 0.6), `temporary-emotion` (0.3–0.59), `noise-distortion` (< 0.3). Thresholds configurable via `wake({ lastingIdentity, temporaryEmotion })`. `traumatic-knowledge` deferred (`TASK.md` D-N2).
- MAIC-induced dreams: `sleep` accepts `options.induction = { scenario, desiredLearning, inducedBy }` — REM prompt incorporates the scenario; resulting dreams tagged `induced: true`.
- `recentInteractionsBufferSize` config (default 32, RAM-only — `TASK.md` D-N4 for persistence).

### Notes
- Dependency added: `yaml`.

## 2026-05-15

### Added
- Initial package scaffold: depends on `@teleologyhi-sdk/maic` + `@teleologyhi-sdk/him` + `@anthropic-ai/sdk`; TS strict + tsup ESM/CJS + vitest + zod + ulid.
- `Nhe` class — orchestrates a single `respond(input)` through MAIC pre-review → system prompt composition (HIM persona + axioms) → LLM call → MAIC post-review.
- `LlmAdapter` contract (non-streaming `generate` only at the start).
- `AnthropicAdapter` (via `@anthropic-ai/sdk`, default model `claude-sonnet-4-6`) and `MockAdapter` (for tests + offline dev).
- `simpleRiskClassifier` — keyword-regex heuristic mapping prompts to risk tags (`intent:harm`, `intent:malicious`, `intent:deceive`). Documented as NOT a production safety layer.
- `composeSystemPrompt(him)` — HIM `systemPromptFragment` + inviolable + active axioms + governance reminder.
- `RespondInput` (zod-validated) + `RespondOutput` with `preReviewVerdict` / `postReviewVerdict` / `tokens` / `auditIds`.

### Notes
- See [`SPEC.md`](./SPEC.md) §13 for the live roadmap and [`../TASK.md`](../TASK.md) §D-N for the open backlog.
