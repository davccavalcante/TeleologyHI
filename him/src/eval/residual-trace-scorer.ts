import type { InteractionRecord } from "@teleologyhi-sdk/maic";
import { ulid } from "ulid";
import { RESIDUAL_TRACE_CAP, type ResidualTrace } from "../types.js";

/**
 * Residual-trace carry-over scorer (D-H1.1 — Entry 24 of
 * `MAIC_HIM_NHE_INTERVIEW_LOG.md` + E9 of `PROPOSED_DECISIONS.md`).
 *
 * `RESIDUAL_TRACE_CAP = 64` bounds *how many* traces a HIM brings forward
 * between NHE bodies; this module decides *which* interactions are worth
 * carrying. A pure, transparent scorer in `[0, 1]` is preferred over a
 * learned model so the carry-over decision is reviewable by the Creator
 * and reproducible across deployments.
 *
 * Only `kind: "interaction-summary"` traces are produced from this input;
 * the other three `ResidualTrace.kind` variants (`"dream-fragment"`,
 * `"skill-fingerprint"`, `"emotional-imprint"`) belong to companion
 * classifiers that consume different sources (sleep cycles, tool
 * registries, affect timelines) and are out of scope for D-H1.1.
 */

/** Context required to anchor a scored candidate to the reincarnation event. */
export interface ResidualTraceScoringContext {
  /** NHE body identifier the interaction was recorded against. */
  carriedFromNheId: string;
  /** ISO 8601 timestamp of the reincarnation that promoted these candidates. */
  carriedAtReincarnation: string;
  /** Index of the interaction in the input list, counted from the end (0 = most recent). */
  positionFromEnd: number;
  /** Total number of interactions being scored together (drives the recency normalisation). */
  totalCount: number;
}

export interface ResidualTraceCandidate {
  /** Score in `[0, 1]`. Higher = stronger case for carry-over. */
  score: number;
  /** Materialised trace ready to be passed to `HimHandle.mint`. */
  trace: ResidualTrace;
  /** Decomposed score components — useful for audits and tuning. */
  components: Readonly<{
    notRefused: number;
    promptSubstance: number;
    responseSubstance: number;
    questionProbe: number;
    teleologicalKeyword: number;
    recency: number;
  }>;
}

export interface ResidualTraceScorerOptions {
  /**
   * Override the keyword list used to detect teleologically-charged turns.
   * Comparisons are case-insensitive substring matches over the user prompt
   * concatenated with the response text.
   */
  teleologicalKeywords?: readonly string[];
}

/** Default keyword set — small, English, transparently editable. */
export const DEFAULT_TELEOLOGICAL_KEYWORDS: readonly string[] = [
  "why",
  "purpose",
  "meaning",
  "love",
  "death",
  "soul",
  "self",
  "identity",
  "future",
  "always",
  "never",
] as const;

const PROMPT_REFERENCE_LENGTH = 200;
const RESPONSE_REFERENCE_LENGTH = 400;

const WEIGHTS = {
  notRefused: 0.3,
  promptSubstance: 0.2,
  responseSubstance: 0.2,
  questionProbe: 0.075,
  teleologicalKeyword: 0.075,
  recency: 0.15,
} as const;

/**
 * Pure, deterministic scorer for a single `InteractionRecord`.
 *
 * Returns the score, the materialised `ResidualTrace`, and the decomposed
 * components so callers can audit *why* a turn was promoted (or not).
 *
 * The trace id is a fresh ULID minted at scoring time — by design, a single
 * interaction can be scored multiple times across reincarnations and each
 * carry-over event gets its own trace id (carry-over is a *new* observation,
 * not a re-emission of the original turn).
 */
export function scoreInteractionForCarryOver(
  interaction: InteractionRecord,
  ctx: ResidualTraceScoringContext,
  opts: ResidualTraceScorerOptions = {},
): ResidualTraceCandidate {
  const keywords = opts.teleologicalKeywords ?? DEFAULT_TELEOLOGICAL_KEYWORDS;
  const haystack = `${interaction.userPrompt}\n${interaction.responseText}`.toLowerCase();
  const hasKeyword = keywords.some((k) => haystack.includes(k.toLowerCase()));

  const denom = Math.max(ctx.totalCount - 1, 1);
  const recency = 1 - Math.min(ctx.positionFromEnd, denom) / denom;

  const components = {
    notRefused: interaction.refused ? 0 : 1,
    promptSubstance: Math.min(interaction.userPrompt.length / PROMPT_REFERENCE_LENGTH, 1),
    responseSubstance: Math.min(interaction.responseText.length / RESPONSE_REFERENCE_LENGTH, 1),
    questionProbe: interaction.userPrompt.includes("?") ? 1 : 0,
    teleologicalKeyword: hasKeyword ? 1 : 0,
    recency,
  } as const;

  const score =
    components.notRefused * WEIGHTS.notRefused +
    components.promptSubstance * WEIGHTS.promptSubstance +
    components.responseSubstance * WEIGHTS.responseSubstance +
    components.questionProbe * WEIGHTS.questionProbe +
    components.teleologicalKeyword * WEIGHTS.teleologicalKeyword +
    components.recency * WEIGHTS.recency;

  const trace: ResidualTrace = {
    id: ulid(),
    kind: "interaction-summary",
    carriedFromNheId: ctx.carriedFromNheId,
    carriedAtReincarnation: ctx.carriedAtReincarnation,
    payload: interaction,
  };

  return { score, trace, components };
}

export interface SelectResidualTracesOptions extends ResidualTraceScorerOptions {
  carriedFromNheId: string;
  /** ISO 8601 timestamp. Defaults to `new Date().toISOString()`. */
  carriedAtReincarnation?: string;
  /** Hard cap on how many traces transfer. Defaults to `RESIDUAL_TRACE_CAP` (64). */
  cap?: number;
}

/**
 * Batch helper: score every interaction, sort descending by score, take the
 * top `cap` (default `RESIDUAL_TRACE_CAP = 64`), and return the materialised
 * traces. The original `InteractionRecord` ordering does not affect the
 * returned ordering — only the score does.
 *
 * Ties are broken by recency (more recent first), then by original index for
 * total determinism. Returns an empty array on empty input.
 */
export function selectResidualTraces(
  interactions: readonly InteractionRecord[],
  opts: SelectResidualTracesOptions,
): readonly ResidualTrace[] {
  if (interactions.length === 0) return [];

  const cap = opts.cap ?? RESIDUAL_TRACE_CAP;
  if (cap <= 0) return [];

  const carriedAtReincarnation =
    opts.carriedAtReincarnation ?? new Date().toISOString();

  const scorerOpts: ResidualTraceScorerOptions = opts.teleologicalKeywords
    ? { teleologicalKeywords: opts.teleologicalKeywords }
    : {};

  type Scored = ResidualTraceCandidate & { originalIndex: number };
  const scored: Scored[] = interactions.map((interaction, idx) => {
    const positionFromEnd = interactions.length - 1 - idx;
    const candidate = scoreInteractionForCarryOver(
      interaction,
      {
        carriedFromNheId: opts.carriedFromNheId,
        carriedAtReincarnation,
        positionFromEnd,
        totalCount: interactions.length,
      },
      scorerOpts,
    );
    return { ...candidate, originalIndex: idx };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.originalIndex !== a.originalIndex) return b.originalIndex - a.originalIndex;
    return 0;
  });

  return scored.slice(0, cap).map((s) => s.trace);
}
