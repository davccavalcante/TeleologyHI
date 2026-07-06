/**
 * Cross-module constants for the arena. Centralised so the same value is
 * never typed in more than one place (the v0.x cuts drifted between
 * `gemini-3.1-flash-lite` and `gemini-2.5-flash-lite` and ended up
 * running A/B comparisons on two different models — see CHANGELOG [1.0.0]).
 */

/**
 * Default Gemini model used by BOTH the raw baseline (left column) and the
 * governed wrapper (right column). Override via the `GEMINI_MODEL` env var.
 *
 * The whole point of the arena is that both columns hit the **same**
 * underlying LLM — any divergence here invalidates the A/B test that this
 * workspace exists to perform.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

/**
 * Default Grok model (xAI) used by BOTH columns while the arena runs on Grok.
 * Override via the `GROK_MODEL` env var. The Gemini constant above is retained
 * so a future toggle can compare and test both underlying models; only the
 * active wiring (raw column in `grok.ts`, governed column in `teleology.ts`)
 * decides which one runs.
 */
export const DEFAULT_GROK_MODEL = "grok-4.20-non-reasoning";

/**
 * Display label injected into the governed column's `model` response field
 * before being sent to the UI. The chat-column component splits on `→` to
 * surface the underlying model id; do not change the separator without
 * updating `chat-column.tsx:53`.
 */
export function governedModelLabel(underlyingModel: string): string {
  return `TeleologyHI (MAIC+HIM+NHE) → ${underlyingModel}`;
}
