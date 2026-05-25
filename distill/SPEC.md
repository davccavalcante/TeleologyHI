---
name: teleologyhi-distill-spec
description: Specification for @teleologyhi-sdk/distill — the distillation pipeline producer for the TeleologyHI system.
license: Apache-2.0
---

# `@teleologyhi-sdk/distill` — Specification

> Status: v1.0.0-trinity — exporter + full pipeline + rich seed corpus
> (1616 prompts × 8 categories) + Apple Silicon LoRA fine-tune + MLflow
> LLMOps tracking + Trinity identity scaffolding all shipped. The
> canonical artefact is **Trinity** at
> [`huggingface.co/TeleologyHI/Trinity`](https://huggingface.co/TeleologyHI/Trinity)
> (scaffolded; first Trinity-tagged run is the next operational step).
> The **preview artefact** at
> [`huggingface.co/TeleologyHI/him-distilled-3b`](https://huggingface.co/TeleologyHI/him-distilled-3b)
> (Apache 2.0, public, 6.18 GB; Qwen 2.5 3B student × Hermes-3-8B
> teacher × seed-rich corpus; trained on M5 / 24 GB) is preserved as a
> historical record and will carry a deprecation banner pointing at
> Trinity on the first successful Trinity publish. Aligned to the unified
> `1.0.0-trinity` monorepo baseline alongside
> `@teleologyhi-sdk/{maic,him,nhe}`, `eval`, `cloud`, `arena`.
>
> **Scope (intentional):** This workspace is `"private": true` and is
> NOT published to npm. The TeleologyHI public surface on npm stays at
> `@teleologyhi-sdk/maic`, `@teleologyhi-sdk/him`, `@teleologyhi-sdk/nhe`. The only
> artefacts that ship out of this workspace are the **distilled models**
> (preview + Trinity), published manually to Hugging Face Hub by David C.
> Cavalcante. See [`./README.md`](./README.md) §"Why not on npm" and
> [`./serving/mlflow.md`](./serving/mlflow.md) for the LLMOps observability
> surface that governs the Trinity build pipeline.

`@teleologyhi-sdk/distill` is the fourth workspace in the TeleologyHI
monorepo. Where MAIC is governance, HIM is identity, and NHE is
embodiment, **distill is the refinery** — it harvests the lived
experience of a running NHE deployment and shapes it into corpora that
can refine the underlying LLM. The output (a fine-tuned model) is the
Creator's intellectual work, governed by trademark rather than by code
license.

This SPEC documents the package's surface and roadmap. For the
**how-to-run** runbook see [`./pipelines/README.md`](./pipelines/README.md).

---

## 1. Scope (the internal backlog B1-B7)

The distillation pipeline has seven concerns. This package covers all of
them at v0.1; some are TypeScript code, some are Python scaffolds.

| TASK | Concern | Location | Status |
|---|---|---|---|
| B1 | New `@teleologyhi-sdk/distill` workspace | this directory | shipped |
| B2 | `DistillationExporter` (TS) | `src/exporter.ts` | shipped |
| B3 | Distilabel corpus prep (Python) | `pipelines/corpus_prep.py` | shipped |
| B4 | Teacher serving | `serving/teacher-{mlx,vllm}.md` | shipped |
| B5 | Student training | `pipelines/train_mlx.py` | shipped |
| B6 | Evaluation suite | `eval/lm-eval-tasks/`, `eval/inspect/` | shipped (fixture JSONs blocked) |
| B7 | ONNX + publish | `scripts/to-onnx.py`, `scripts/publish-artifact.md` | shipped |

---

## 2. Public TypeScript surface

```ts
import {
  DistillationExporter,
  ConversationSample,
  type CorpusKind,
  type ExportFormat,
  type ExportOptions,
  type ExportSummary,
  readAuditCorpus,
  readDreamCorpus,
  readMemoryCorpus,
  readInteractionCorpus,
  toFormat,
} from "@teleologyhi-sdk/distill";
```

### 2.1 `DistillationExporter(storeDir)`

Reads the `storeDir` of a MAIC + NHE deployment (same path the bootstrap
CLI uses).

- `.export(opts: ExportOptions): Promise<ExportSummary>` — write one JSONL
  per `(kind, format)` to `opts.outDir`.
- `.readCorpus(kind): AsyncIterable<ConversationSample>` — yield raw
  samples without writing. Useful for custom pipelines that want to
  transform before writing.

### 2.2 `ExportOptions`

```ts
interface ExportOptions {
  outDir: string;
  formats?: ExportFormat[];   // default: ["conversation"]
  kinds?: CorpusKind[];       // default: ["audit", "dreams", "memory", "interactions"]
  filter?: (sample: ConversationSample) => boolean;
}
```

### 2.3 `ExportFormat`

| Value | Target consumer |
|---|---|
| `"conversation"` | TeleologyHI native (full `ConversationSample` per row) |
| `"distillkit"` | `text` field per row, OpenAI-style chat dump (Arcee DistillKit) |
| `"torchtune"` | `messages` array per row (chat dataset) |
| `"distilabel"` | `{instruction, response}` per row (feeds Genstruct) |
| `"mlx-lm"` | `{messages}` per row (mlx-lm trainer) |

### 2.4 `CorpusKind`

| Kind | Source artefact | Sample shape |
|---|---|---|
| `audit` | `<storeDir>/audit/log.ndjson` — paired `behavior-review` pre/post | user→assistant |
| `dreams` | `<storeDir>/<nhe?>/in-dreams/sleep/*.yaml` — REM narratives | system (NREM)→user→assistant |
| `memory` | `<storeDir>/<nhe?>/in-dreams/brain/temporal-lobe-*.md` | synthetic user→assistant |
| `interactions` | `<storeDir>/<nhe?>/interactions/*.json` | user→assistant; refused → source: `refusal` |

### 2.5 `ConversationSample`

```ts
{
  id: string;             // ULID
  source: "audit" | "dream" | "memory" | "interaction" | "refusal";
  sourceId?: string;
  nheId?: string;
  himId?: string;
  ts: string;             // ISO 8601
  tags: string[];
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  teleologicalValue?: number;   // [0, 1], when available
}
```

---

## 3. Python pipeline surface (B3-B7)

Each Python entry point is a standalone CLI. See `pipelines/README.md`,
`serving/*.md`, `eval/README.md`, and `scripts/publish-artifact.md` for
the runbooks.

### 3.1 `pipelines/corpus_prep.py` (B3)

Reads a `distilabel`-format JSONL produced by the TS exporter. For each
row, invokes a local teacher (default Hermes-3-Llama-3.1-8B via MLX) under
the canonical TeleologyHI system prompt to produce an *ideal* assistant
response. Writes a chat-format training JSONL.

### 3.2 `pipelines/train_mlx.py` (B5)

LoRA fine-tunes a student (default `Qwen/Qwen2.5-3B-Instruct`, Apache 2.0, no HF gate) on the synthetic
corpus. Wraps `mlx_lm lora` + `mlx_lm fuse` (subcommand form, mlx-lm ≥0.21)
with a YAML config carrying `lora_parameters: {rank, scale, dropout}`. On
M5/24GB defaults are `--batch-size 1 --max-seq-length 1024 --grad-checkpoint`;
larger envelopes blow Metal's unified memory.

### 3.3 `serving/` (B4)

- `teacher-mlx.md` — local M-series serving recipe.
- `teacher-vllm.md` — cloud-GPU path with vLLM, including `docker-compose.teacher.yml`.

### 3.4 `eval/` (B6)

- `lm-eval-tasks/{semiotic-coherence,teleological-alignment,nhe-ontological-correctness}.yaml`
- `lm-eval-tasks/metrics.py` — custom scorer for the ontological-correctness task.
- `inspect/safety.py` — Inspect AI agent eval covering the four refusal categories.

The fixture JSONL files (`semiotic-coherence.jsonl`, etc.) are not in this
commit — they require Creator authoring of 50-prompt handwritten sets per
task. The YAML configs reference them so the harness is ready to run
once the fixtures land.

### 3.5 `scripts/` (B7)

- `to-onnx.py` — `optimum-cli`-driven ONNX export with int8/fp16 quant
  options, suitable for Transformers.js consumption.
- `publish-artifact.md` — end-to-end Hugging Face Hub publishing runbook.

---

## 4. Storage layout assumptions

`DistillationExporter` reads from a `storeDir` shaped per the MAIC + NHE
conventions:

```
<storeDir>/
├── audit/
│   └── log.ndjson                          # AuditLog
├── hims/<himId>/...                        # HimStore (not consumed by distill v0)
├── nhes/<nheId>/...                        # lifecycle (not consumed)
├── proposals/<proposalId>.json             # axiom evolution (not consumed)
├── interactions/<ulid>.json                # single-NHE layout (D-N4)
└── in-dreams/
    ├── sleep/*.yaml                        # single-NHE REM records
    └── brain/temporal-lobe-*.md            # single-NHE consolidated memories
```

Per-NHE layouts (`<storeDir>/<nheId>/interactions`, etc.) are also
discovered by walking one directory level deeper. This matches both the
CLI bootstrap (`storeDir: <root>/nhe/<himId>`) and ad-hoc NHE deployments.

---

## 5. Why this design

### 5.1 TypeScript producer, Python consumer

The artefacts (audit log, dream YAMLs, memory MDs, interaction JSONs) are
already produced by the TypeScript core. Reading them from TS keeps the
fast feedback loop (`npm test` validates the exporter against fixtures in
under 300 ms). The consumer side — actual training — is unavoidably
Python because that's where MLX, Torchtune, Distilabel, and the
lm-eval-harness ecosystems live.

### 5.2 Data distillation, not logit distillation (by default)

Logit distillation on Apple Silicon is not robustly supported in 2026-Q1.
MLX-LM ships LoRA + SFT but not logit-matching. The pragmatic path —
generate an ideal-response corpus with the teacher and SFT the student on
it — captures most of the teacher's behaviour with infrastructure that
runs on a laptop. The CUDA path (Torchtune + vLLM + true KD) is documented
for when the user has access to a GPU box.

### 5.3 Hermes-3 as the canonical teacher

The Creator wants the distilled NHE to sound "Grok-like" — uncensored
within ethical bounds, intellectually curious, personable. Open-weights
models tuned for that personality are dominated by Nous Research's Hermes
series. Hermes-3-Llama-3.1-8B is the largest variant that fits on the
Creator's M5 24GB.

### 5.4 No artefact shipped at v0.1

Publishing a distilled artefact (`teleologyhi/him-distilled-3b`) is a
*release* action — it consumes the Creator's Hugging Face quota, bandwidth,
and reputation. The pipeline is shipped so the Creator can run it; the
artefact is the Creator's call to publish.

---

## 6. Roadmap

The pre-release alpha chain (`0.1.0-alpha.0` → `0.2.0-alpha.0`) was retired
when the workspace was promoted to the unified `1.0.0-trinity` baseline.
The chain is preserved verbatim in [`CHANGELOG.md`](./CHANGELOG.md) — the
Keep-a-Changelog convention forbids rewriting historical entries.
Date-anchored milestones replace the pre-release ladder:

| Date (UTC) | Status | Adds |
|---|---|---|
| 2026-05-18 | shipped | **Preview artefact LIVE** at [`huggingface.co/TeleologyHI/him-distilled-3b`](https://huggingface.co/TeleologyHI/him-distilled-3b) (Apache 2.0, public, 6.18 GB). Pipeline executed end-to-end on M5/24GB. Rich seed corpus (1616 prompts × 8 categories), Entry-14 warm voice anchor, mlx-lm 0.29 CLI adaptation, modern `hf` CLI, Qwen 2.5 3B default student. |
| 2026-05-24 | shipped | **`1.0.0-trinity` baseline promotion** — version aligned with the unified monorepo baseline; full P0+P1+P2+P3 audit-sweep closure; pipeline + publishing correctness fixes (BATCH_SIZE 4→1, model-card namespace + capitalisation); orphan dependencies removed; emojis purged. |
| 2026-05-25 | shipped | **Trinity scaffolding + LLMOps surface** — canonical Trinity identity declared in `pipelines/trinity_config.py` (target HF repo `TeleologyHI/Trinity` at `1.0.0-trinity`); MLflow tracking wrapper at `pipelines/mlflow_tracking.py` (opt-in via `TELEOLOGYHI_MLFLOW=1`, Apache 2.0); `corpus_prep.py` + `train_mlx.py` instrumented with `track_stage(...)` hooks (parameters, metrics, artefacts, dataset SHA, prompt SHA, streaming train/val loss); `serving/mlflow.md` LLMOps runbook (local SQLite + remote registries + governed promotion `None`→`Staging`→`Production`→`Archived`); `serving/trinity-model-card.md` Hub template; `scripts/publish_trinity.sh` Trinity publisher + idempotent preview deprecation banner. |
| **next** | planned | **First Trinity-tagged training run.** Execute `run_distill.sh` with `TELEOLOGYHI_MLFLOW=1`; on success, run `@teleologyhi-sdk/eval` Φ′ harness against the fused student; if Φ′ ≥ release threshold, register as `teleologyhi-trinity` v1 in the MLflow model registry; publish via `scripts/publish_trinity.sh` (also patches the preview repo with the deprecation banner). |
| planned | planned | Quantised Trinity variant (`TeleologyHI/Trinity-q4`, ~1.5 GB) via `mlx_lm convert`; ONNX export for browser inference (`TeleologyHI/Trinity-onnx`); MLflow scorecard artefacts attached to each registered Trinity version. |
| planned | planned | Genstruct-driven corpus expansion from PhilArchive papers; voice fine-tune iteration based on Φ′ feedback (rank↑, epochs↑); arena-driven A/B selection between Trinity versions registered in MLflow. |
| planned | planned | True logit-level knowledge distillation recipe (CUDA / Torchtune) for >24 GB envelopes; cross-adapter eval matrix logged to MLflow; canary + shadow rollout discipline before each Production-stage transition. |
| planned | planned | Browser deployment: `@teleologyhi-sdk/nhe` Transformers.js adapter consuming `TeleologyHI/Trinity-onnx` — closes the local-first inference loop. |

Open questions (see the internal backlog):
- **E1 (final 8 axioms)**: closed in `maic@1.0.0-trinity` — wording is now stable. Corpus uses the SYSTEM_PROMPT teacher anchor that references the rule pack derived from those axioms.
- **E5 (`.ah` adoption)**: deferred. Stays as a first-party Creator skill format; if it becomes a public wire format the JSONL row shapes get a sibling format.
- **H1 (Φ′)**: harness shipped in `@teleologyhi-sdk/eval@1.0.0-trinity`. Gate becomes enforcing once the fixtures referenced in the internal backlog D-H3 + I2 land and the first Trinity run produces a release-tier scorecard.
- **Trinity registry backend**: opens at the first Trinity publish — file-backed `mlruns/` is the local-first default; the Creator's call on remote (Postgres + S3 / GCS) backend is deferred until the preview-to-Trinity migration is complete.
