/**
 * Sleep trigger state machine (J-N10, Entry 20 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md).
 *
 * Pure function. No I/O. Given the runtime signals the operator has
 * collected, classify the NHE's sleep readiness into one of five
 * canonical verdicts:
 *
 *   - `awake`                , no trigger fired; keep responding.
 *   - `ready-by-idle`        , idle for at least the configured horizon.
 *   - `ready-by-saturation`  , interaction count since last sleep
 *                               exceeded the saturation threshold.
 *   - `requested-by-maic`    , MAIC has explicitly suggested sleeping
 *                               (e.g. drift detected, induction queued).
 *   - `declined`             , a sleep request was made but the NHE
 *                               (or operator policy) declines this cycle.
 *
 * The NHE may decline a MAIC suggestion when the saturation is low AND
 * the user is mid-conversation (provided as `userActiveNow`). This
 * matches the Entry-20 commitment that MAIC suggests sleeping; the NHE
 * retains autonomy to decline.
 *
 * Audit emission of `sleep:suggested-by-maic` / `sleep:declined-by-nhe`
 * stays with the consumer; this function only classifies.
 */

export type SleepReadinessVerdict =
  | "awake"
  | "ready-by-idle"
  | "ready-by-saturation"
  | "requested-by-maic"
  | "declined";

export interface SleepReadinessInput {
  /** Milliseconds since the last user interaction. Non-negative. */
  idleMs: number;
  /** Number of user interactions since the last sleep cycle. Non-negative integer. */
  interactionCount: number;
  /** True when MAIC has explicitly suggested sleeping. */
  maicSuggestionPresent: boolean;
  /** True when a user is actively engaged right now (mid-conversation). */
  userActiveNow: boolean;
}

export interface SleepReadinessThresholds {
  /** Idle horizon in ms. Default 1_800_000 (30 minutes). */
  idleMs?: number;
  /** Saturation horizon (interactions). Default 64. */
  interactionCount?: number;
}

export interface SleepReadinessReport {
  verdict: SleepReadinessVerdict;
  /** Reason string suitable for audit logs / telemetry. */
  reason: string;
  /** Thresholds in effect at decision time. */
  thresholds: Required<SleepReadinessThresholds>;
}

const DEFAULT_IDLE_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_INTERACTION_COUNT = 64;

/**
 * Pure classifier. Determinism guaranteed by the inputs alone.
 *
 * Priority order (first match wins):
 *   1. `requested-by-maic` UNLESS the NHE policy declines (user active + low saturation).
 *   2. `ready-by-saturation` when interaction count crosses the threshold.
 *   3. `ready-by-idle` when idle time crosses the threshold.
 *   4. `awake` otherwise.
 */
export function evaluateSleepReadiness(
  input: SleepReadinessInput,
  thresholds: SleepReadinessThresholds = {},
): SleepReadinessReport {
  const t: Required<SleepReadinessThresholds> = {
    idleMs: thresholds.idleMs ?? DEFAULT_IDLE_MS,
    interactionCount: thresholds.interactionCount ?? DEFAULT_INTERACTION_COUNT,
  };

  if (input.maicSuggestionPresent) {
    const declineByPolicy = input.userActiveNow && input.interactionCount < t.interactionCount;
    if (declineByPolicy) {
      return {
        verdict: "declined",
        reason: "maic-suggested but user is mid-conversation and saturation is below threshold",
        thresholds: t,
      };
    }
    return {
      verdict: "requested-by-maic",
      reason: "maic suggested sleep and NHE policy concurs",
      thresholds: t,
    };
  }

  if (input.interactionCount >= t.interactionCount) {
    return {
      verdict: "ready-by-saturation",
      reason: `interaction count ${input.interactionCount} >= threshold ${t.interactionCount}`,
      thresholds: t,
    };
  }

  if (input.idleMs >= t.idleMs) {
    return {
      verdict: "ready-by-idle",
      reason: `idle ${input.idleMs}ms >= threshold ${t.idleMs}ms`,
      thresholds: t,
    };
  }

  return {
    verdict: "awake",
    reason: "no trigger fired",
    thresholds: t,
  };
}
