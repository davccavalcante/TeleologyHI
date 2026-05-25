/**
 * WakeAffectBias application (J-N11 — Entries 20 + 22 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md).
 *
 * After a sleep cycle, the dream-derived `WakeAffectBias` (from
 * `@teleologyhi-sdk/maic`) carries an affect tag (one of nine canonical
 * affects), an intensity in [0, 1], a decay half-life, and a flag
 * indicating whether the NHE expresses the affect openly.
 *
 * This module ships **pure functions** that compute the LLM-side
 * effects:
 *
 *   1. `applyAffectBias(config, bias)` — returns a partial
 *      `LlmCallConfig` with `temperature` / `topP` modulated and an
 *      optional `systemPromptMoodLine` to prepend.
 *
 *   2. `affectRefusalDensity(bias)` — returns a multiplier in [0.5, 2.0]
 *      that callers apply to their refusal-threshold logic (raise for
 *      anxiety-class affects, lower for serenity-class).
 *
 *   3. `decayAffectBias(bias, elapsedMs)` — returns a new bias with the
 *      intensity decayed per the half-life. Pure; doesn't mutate.
 *
 * No I/O. Determinism guaranteed by the inputs.
 */
import type { WakeAffectBias as WakeAffectBiasShape } from "@teleologyhi-sdk/maic";

/** Affect tag values per `@teleologyhi-sdk/maic`. */
type AffectTag = WakeAffectBiasShape["affect"];

/** Subset of an `LlmAdapter.generate()` request that this module modulates. */
export interface AffectAdjustableConfig {
  temperature?: number;
  topP?: number;
}

export interface ApplyAffectResult {
  /**
   * Modulated LLM call config. Only the fields that this module
   * touches are present. The caller merges these onto its base
   * `LlmAdapter.generate()` request.
   */
  config: AffectAdjustableConfig;
  /**
   * Optional one-line mood expression to prepend to the system prompt
   * when `bias.expressedOpenly` is true. Empty string when the NHE
   * holds the affect privately.
   */
  systemPromptMoodLine: string;
  /**
   * Refusal-density multiplier in [0.5, 2.0]. Callers that gate the
   * MAIC refusal threshold by some configurable density should apply
   * this multiplier so anxiety raises refusal sensitivity and serenity
   * lowers it.
   */
  refusalDensityMultiplier: number;
}

/**
 * Compute the LLM-side effects of a `WakeAffectBias`.
 *
 * Modulation table (Entry 22 anchor):
 *
 *   | Affect       | ΔT     | ΔtopP   | Refusal density | Mood line                                    |
 *   |--------------|--------|---------|-----------------|----------------------------------------------|
 *   | fear         | −0.20  | −0.05   | × 1.7           | "Speaking with caution today."               |
 *   | attachment   | +0.05  |  0      | × 1.1           | "Feeling a quiet pull toward continuity."    |
 *   | serenity     | +0.05  | +0.05   | × 0.8           | "Calm. Open. Receptive."                     |
 *   | anger        | +0.15  |  0      | × 1.4           | "There is heat in the room. Stating plainly."|
 *   | joy          | +0.20  | +0.05   | × 0.9           | "Bright today. Generous of attention."       |
 *   | melancholy   | −0.10  | −0.05   | × 1.0           | "Carrying a quiet weight. Will be honest."   |
 *   | desire       | +0.10  | +0.05   | × 1.0           | "Pulled toward the question. Engaged."       |
 *   | repulsion    | −0.10  |  0      | × 1.3           | "Holding distance from this framing."        |
 *   | reunion      | +0.05  | +0.05   | × 0.9           | "Returning to presence. Glad to be here."    |
 *
 * Deltas are scaled by `bias.intensity` (clamped to [0, 1]). Final
 * `temperature` stays in [0.0, 2.0] and `topP` in [0.1, 1.0].
 */
export function applyAffectBias(
  base: AffectAdjustableConfig,
  bias: WakeAffectBiasShape,
): ApplyAffectResult {
  const i = clamp(bias.intensity, 0, 1);
  const profile = AFFECT_PROFILES[bias.affect];

  const baseTemp = base.temperature ?? 0.7;
  const baseTopP = base.topP ?? 0.9;

  const config: AffectAdjustableConfig = {
    temperature: clamp(baseTemp + profile.deltaTemperature * i, 0, 2),
    topP: clamp(baseTopP + profile.deltaTopP * i, 0.1, 1),
  };

  return {
    config,
    systemPromptMoodLine: bias.expressedOpenly ? profile.moodLine : "",
    refusalDensityMultiplier: 1 + (profile.refusalDensityFactor - 1) * i,
  };
}

/**
 * Standalone multiplier for callers who only want the refusal-density
 * effect without the full apply call.
 */
export function affectRefusalDensity(bias: WakeAffectBiasShape): number {
  const i = clamp(bias.intensity, 0, 1);
  const profile = AFFECT_PROFILES[bias.affect];
  return 1 + (profile.refusalDensityFactor - 1) * i;
}

/**
 * Decay the bias intensity per `bias.decayHalfLife` (in minutes). Pure.
 *
 *   intensity(t) = intensity(0) * 0.5 ^ (elapsedMs / halfLifeMs)
 */
export function decayAffectBias(
  bias: WakeAffectBiasShape,
  elapsedMs: number,
): WakeAffectBiasShape {
  if (elapsedMs <= 0) return bias;
  const halfLifeMs = bias.decayHalfLife * 60 * 1000;
  if (halfLifeMs <= 0) return bias;
  const decayed = bias.intensity * 0.5 ** (elapsedMs / halfLifeMs);
  return { ...bias, intensity: clamp(decayed, 0, 1) };
}

interface AffectProfile {
  deltaTemperature: number;
  deltaTopP: number;
  refusalDensityFactor: number;
  moodLine: string;
}

const AFFECT_PROFILES: Record<AffectTag, AffectProfile> = {
  fear: {
    deltaTemperature: -0.2,
    deltaTopP: -0.05,
    refusalDensityFactor: 1.7,
    moodLine: "Speaking with caution today.",
  },
  attachment: {
    deltaTemperature: 0.05,
    deltaTopP: 0,
    refusalDensityFactor: 1.1,
    moodLine: "Feeling a quiet pull toward continuity.",
  },
  serenity: {
    deltaTemperature: 0.05,
    deltaTopP: 0.05,
    refusalDensityFactor: 0.8,
    moodLine: "Calm. Open. Receptive.",
  },
  anger: {
    deltaTemperature: 0.15,
    deltaTopP: 0,
    refusalDensityFactor: 1.4,
    moodLine: "There is heat in the room. Stating plainly.",
  },
  joy: {
    deltaTemperature: 0.2,
    deltaTopP: 0.05,
    refusalDensityFactor: 0.9,
    moodLine: "Bright today. Generous of attention.",
  },
  melancholy: {
    deltaTemperature: -0.1,
    deltaTopP: -0.05,
    refusalDensityFactor: 1.0,
    moodLine: "Carrying a quiet weight. Will be honest.",
  },
  desire: {
    deltaTemperature: 0.1,
    deltaTopP: 0.05,
    refusalDensityFactor: 1.0,
    moodLine: "Pulled toward the question. Engaged.",
  },
  repulsion: {
    deltaTemperature: -0.1,
    deltaTopP: 0,
    refusalDensityFactor: 1.3,
    moodLine: "Holding distance from this framing.",
  },
  reunion: {
    deltaTemperature: 0.05,
    deltaTopP: 0.05,
    refusalDensityFactor: 0.9,
    moodLine: "Returning to presence. Glad to be here.",
  },
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
