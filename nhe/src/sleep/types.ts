import { z } from "zod";

/**
 * `InteractionRecord` is canonical in `@teleologyhi-sdk/maic` so all three
 * packages share one wire shape; `@teleologyhi-sdk/him` consumes it on
 * reincarnation to score residual-trace carry-over (D-H1.1). NHE is the
 * producer of these records (Entry 21 — the body emits interaction turns
 * the soul consolidates), so we keep the long-standing `from
 * "./sleep/types.js"` import path used throughout this package working as
 * a *type-only* re-export — no source change required at call sites, no
 * duplicated runtime schema surface (the canonical zod parser lives in
 * MAIC and consumers wanting runtime validation import it from there).
 */
export type { InteractionRecord } from "@teleologyhi-sdk/maic";

export const SleepPhaseName = z.enum(["N1", "N2", "N3", "N4", "REM"]);
export type SleepPhaseName = z.infer<typeof SleepPhaseName>;

export const SleepTriggerKind = z.enum([
  "idle-timeout",
  "explicit",
  "creator-induced",
  "maic-induced",
  "scheduled",
]);
export type SleepTriggerKind = z.infer<typeof SleepTriggerKind>;

export interface SleepTrigger {
  kind: SleepTriggerKind;
  reason?: string;
}

export const Dream = z.object({
  id: z.string().min(1),
  induced: z.boolean(),
  inducedBy: z.enum(["maic", "creator"]).nullable(),
  narrative: z.string(),
  teleologicalValue: z.number().min(0).max(1),
  rawTrace: z.string().optional(),
});
export type Dream = z.infer<typeof Dream>;

export const PhaseContent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("empty") }),
  z.object({
    kind: z.literal("fragments"),
    fragments: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("summary"),
    /**
     * One-sentence LLM summary produced during a NREM phase (N2/N3/N4). Each
     * phase has a distinct prompt — emotional gist (N2), identity-vs-transient
     * triage (N3), discard candidates (N4) — but the storage shape is shared.
     */
     summary: z.string(),
  }),
  z.object({
    kind: z.literal("dreams"),
    dreams: z.array(Dream),
  }),
]);
export type PhaseContent = z.infer<typeof PhaseContent>;

export const SleepPhase = z.object({
  phase: SleepPhaseName,
  startedAt: z.string().datetime(),
  durationSeconds: z.number().nonnegative(),
  content: PhaseContent,
});
export type SleepPhase = z.infer<typeof SleepPhase>;

export const DreamRecord = z.object({
  version: z.literal(1),
  nheId: z.string().min(1),
  himId: z.string().min(1),
  sleep: z.object({
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    durationMinutes: z.number().nonnegative(),
  }),
  phases: z.array(SleepPhase),
  metadata: z.object({
    llmAdapter: z.string(),
    triggerKind: SleepTriggerKind,
    triggerReason: z.string().optional(),
    recentInteractionsConsidered: z.number().int().nonnegative(),
  }),
});
export type DreamRecord = z.infer<typeof DreamRecord>;

export const MemoryClass = z.enum([
  "lasting-identity",
  "temporary-emotion",
  "noise-distortion",
  "traumatic-knowledge",
]);
export type MemoryClass = z.infer<typeof MemoryClass>;

export interface MemoryEntry {
  id: string;
  nheId: string;
  himId: string;
  classification: MemoryClass;
  teleologicalValue: number;
  consolidatedAt: string;
  sourceDreamRecord: string;
  insight: string;
  filePath: string;
}

