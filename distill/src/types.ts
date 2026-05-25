import { z } from "zod";

/**
 * Record shapes that DistillationExporter emits to JSONL. Each shape is
 * tailored to a downstream toolkit's expected input.
 */

/**
 * Generic conversation sample — the lingua franca that Distilabel,
 * lm-evaluation-harness, and most KD pipelines accept. One row per turn pair.
 */
export const ConversationSample = z.object({
  /** Stable id (ULID) so downstream dedup is easy. */
  id: z.string().min(1),
  /** Provenance hint — which TeleologyHI artefact produced this row. */
  source: z.enum([
    "audit",
    "dream",
    "memory",
    "interaction",
    "refusal",
  ]),
  /** Optional reference back to the originating artefact (auditId/dreamId/etc). */
  sourceId: z.string().optional(),
  /** Optional NHE/HIM owners — useful for partitioning by persona at training time. */
  nheId: z.string().optional(),
  himId: z.string().optional(),
  /** ISO 8601 timestamp of the source artefact. */
  ts: z.string(),
  /** Free-form labels (e.g. ["refused", "axiom:no-malice"]). */
  tags: z.array(z.string()).default([]),
  /** Role-tagged turns, oldest first. */
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
  /** Optional teleological score in [0, 1] when available (dreams, memories). */
  teleologicalValue: z.number().min(0).max(1).optional(),
});
export type ConversationSample = z.infer<typeof ConversationSample>;

/** Shape DistillKit's logit-distillation trainer expects per-row. */
export interface DistillKitRow {
  text: string;
  metadata?: Record<string, unknown>;
}

/** Shape Torchtune's chat-dataset reader expects per-row. */
export interface TorchtuneRow {
  messages: { role: string; content: string }[];
  metadata?: Record<string, unknown>;
}

/**
 * Shape Distilabel's "instruction" task expects. Suitable input for the
 * Genstruct task that generates (prompt, ideal-response) pairs.
 */
export interface DistilabelRow {
  instruction: string;
  response?: string;
  metadata?: Record<string, unknown>;
}

/** Shape mlx-lm's training jsonl reader expects (chat or text). */
export interface MlxLmRow {
  messages?: { role: string; content: string }[];
  text?: string;
}

export type ExportFormat = "conversation" | "distillkit" | "torchtune" | "distilabel" | "mlx-lm";
