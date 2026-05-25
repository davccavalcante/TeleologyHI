/**
 * @teleologyhi-sdk/distill — Distillation pipeline for the TeleologyHI system.
 *
 * Reads MAIC + NHE artefacts (audit log, sleep YAMLs, temporal-lobe memories,
 * interaction records) and emits JSONL corpora in formats consumable by the
 * mainstream distillation toolkits: DistillKit, Torchtune, Distilabel, mlx-lm.
 *
 * The TypeScript surface is the **producer** side — what to feed the trainer.
 * The trainer itself lives under `./pipelines` (Python, MLX-native for Apple
 * Silicon; vLLM-compatible for cloud GPU). See SPEC.md for the full flow.
 */

// ─── types ──────────────────────────────────────────────────────────
export { ConversationSample } from "./types.js";
export type {
  DistilabelRow,
  DistillKitRow,
  ExportFormat,
  MlxLmRow,
  TorchtuneRow,
} from "./types.js";

// ─── exporter ───────────────────────────────────────────────────────
export { DistillationExporter } from "./exporter.js";
export type {
  CorpusKind,
  ExportOptions,
  ExportSummary,
} from "./exporter.js";

// ─── readers (granular access for custom pipelines) ──────────────────
export { readAuditCorpus } from "./readers/audit.js";
export { readDreamCorpus } from "./readers/dreams.js";
export { readMemoryCorpus } from "./readers/memory.js";
export { readInteractionCorpus } from "./readers/interactions.js";

// ─── formats (round-trip helpers) ────────────────────────────────────
export { toFormat } from "./formats.js";
