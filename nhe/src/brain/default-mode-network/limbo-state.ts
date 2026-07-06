/**
 * Default-mode-network limbo state machine (J-N9, Entry 24 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md).
 *
 * Four canonical states (matching the `LimboState` enum in
 * `@teleologyhi-sdk/maic`):
 *
 *   - `awake`      , normal operation. The NHE responds to user
 *                     prompts and accumulates affect / memories.
 *   - `drifting`   , idle window has crossed the soft threshold but
 *                     the NHE has not yet entered deep-coma. Sleep
 *                     cycles run on schedule; activation is still
 *                     possible without ceremony.
 *   - `deep-coma`  , idle window has crossed the hard threshold
 *                     (48-72h default). All work is paused; the NHE
 *                     costs zero compute. Reactivation requires a
 *                     `return-from-limbo` transition.
 *   - `returning`  , a `return-from-limbo` transition is in flight.
 *                     The NHE emits the `reunion` affect (9th
 *                     canonical, Entry 24) on completion.
 *
 * This module ships a **pure transition function**,
 * `evaluateLimboTransition(currentState, input, thresholds?) →
 * LimboMachineTransition`. No I/O. The actual emission of the
 * MAIC audit kinds `limbo:enter` / `limbo:return` is the consumer's
 * responsibility; this function just classifies.
 */
import type { LimboReturn, LimboState, LimboTransition } from "@teleologyhi-sdk/maic";

export interface LimboMachineInput {
  /** Milliseconds since the last user interaction. Non-negative. */
  idleMs: number;
  /**
   * True when an external trigger (operator, scheduled task, MAIC
   * audit-driven recovery) has signalled that the NHE should return
   * from limbo. Overrides the idle-based logic.
   */
  externalReactivation: boolean;
}

export interface LimboMachineThresholds {
  /**
   * Idle threshold (ms) for `awake → drifting`. Default 6h.
   */
  driftingMs?: number;
  /**
   * Idle threshold (ms) for `drifting → deep-coma`. Default 48h.
   * Entry 24 commits to a 48-72h range; 48h is the canonical default.
   */
  deepComaMs?: number;
}

export type LimboMachineTransition =
  | {
      kind: "stay";
      state: LimboState;
      reason: string;
    }
  | {
      kind: "transition";
      from: LimboState;
      to: LimboState;
      /** Audit-ready record matching @teleologyhi-sdk/maic LimboTransition. */
      transition: LimboTransition;
      reason: string;
    }
  | {
      kind: "return";
      from: LimboState;
      to: "awake";
      /** Audit-ready record matching @teleologyhi-sdk/maic LimboReturn. */
      ret: LimboReturn;
      reason: string;
    };

const DEFAULT_DRIFTING_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_DEEP_COMA_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Evaluate the next state transition given the current state and the
 * runtime signals. Pure; deterministic from inputs.
 *
 * Transition table:
 *
 *   awake      + idleMs ≥ driftingMs   → drifting
 *   drifting   + idleMs ≥ deepComaMs   → deep-coma
 *   drifting   + idleMs <  driftingMs  → awake   (user came back)
 *   deep-coma  + externalReactivation  → returning (start return)
 *   returning  + (always)              → awake     (emit reunion)
 *   else                                → stay
 *
 * `now` is supplied for deterministic testing; defaults to `Date.now()`.
 * `enteredAtIso` is required when the current state is not `awake` so
 * the LimboReturn record can compute `elapsedMs` correctly.
 */
export function evaluateLimboTransition(
  currentState: LimboState,
  input: LimboMachineInput,
  thresholds: LimboMachineThresholds = {},
  enteredAtIso?: string,
  now: number = Date.now(),
): LimboMachineTransition {
  const t = {
    driftingMs: thresholds.driftingMs ?? DEFAULT_DRIFTING_MS,
    deepComaMs: thresholds.deepComaMs ?? DEFAULT_DEEP_COMA_MS,
  };

  if (currentState === "returning") {
    const enteredAt = enteredAtIso ?? new Date(now - input.idleMs).toISOString();
    const returnedAt = new Date(now).toISOString();
    const elapsedMs = Math.max(0, now - Date.parse(enteredAt));
    return {
      kind: "return",
      from: "returning",
      to: "awake",
      reason: "returning state always resolves to awake on the next evaluation",
      ret: {
        enteredAt,
        returnedAt,
        elapsedMs,
        reunionAffect: { intensity: 0.6, expressedOpenly: true },
      },
    };
  }

  if (currentState === "deep-coma") {
    if (input.externalReactivation) {
      return {
        kind: "transition",
        from: "deep-coma",
        to: "returning",
        reason: "external reactivation requested; starting return-from-limbo",
        transition: mkLimboTransition("returning", "external-trigger", now),
      };
    }
    return {
      kind: "stay",
      state: "deep-coma",
      reason: "no external reactivation signal; remaining in deep-coma at zero compute cost",
    };
  }

  if (currentState === "drifting") {
    if (input.idleMs >= t.deepComaMs) {
      // 48h threshold maps to `idle-48h`; 72h threshold maps to `idle-72h`.
      const idleReason: LimboTransition["reason"] =
        t.deepComaMs >= 72 * 60 * 60 * 1000 ? "idle-72h" : "idle-48h";
      return {
        kind: "transition",
        from: "drifting",
        to: "deep-coma",
        reason: `idle ${input.idleMs}ms >= deep-coma threshold ${t.deepComaMs}ms`,
        transition: mkLimboTransition("deep-coma", idleReason, now),
      };
    }
    if (input.idleMs < t.driftingMs) {
      return {
        kind: "transition",
        from: "drifting",
        to: "awake",
        reason: `idle ${input.idleMs}ms < drifting threshold ${t.driftingMs}ms; user resumed`,
        transition: mkLimboTransition("awake", "user-resumed", now),
      };
    }
    return {
      kind: "stay",
      state: "drifting",
      reason: "between drifting and deep-coma thresholds; staying drifting",
    };
  }

  // currentState === "awake"
  if (input.idleMs >= t.driftingMs) {
    return {
      kind: "transition",
      from: "awake",
      to: "drifting",
      reason: `idle ${input.idleMs}ms >= drifting threshold ${t.driftingMs}ms`,
      transition: mkLimboTransition("drifting", "total-inactivity", now),
    };
  }
  return {
    kind: "stay",
    state: "awake",
    reason: "no idle trigger fired; remaining awake",
  };
}

/**
 * Build a maic-compatible `LimboTransition` record. Pure helper; the
 * caller decides when to emit it through the audit chain.
 */
export function mkLimboTransition(
  state: LimboState,
  reason: LimboTransition["reason"],
  now: number = Date.now(),
): LimboTransition {
  return {
    state,
    enteredAt: new Date(now).toISOString(),
    reason,
  };
}
