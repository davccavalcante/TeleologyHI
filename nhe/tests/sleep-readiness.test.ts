/**
 * Tests for evaluateSleepReadiness (J-N10 — Entry 20).
 */
import { describe, expect, it } from "vitest";
import { evaluateSleepReadiness } from "../src/index.js";

const T = { idleMs: 30 * 60 * 1000, interactionCount: 64 };

describe("evaluateSleepReadiness (J-N10)", () => {
  it("returns `awake` when no trigger fires", () => {
    const r = evaluateSleepReadiness(
      {
        idleMs: 1000,
        interactionCount: 1,
        maicSuggestionPresent: false,
        userActiveNow: true,
      },
      T,
    );
    expect(r.verdict).toBe("awake");
  });

  it("returns `ready-by-idle` when idle horizon is crossed", () => {
    const r = evaluateSleepReadiness(
      {
        idleMs: T.idleMs + 1,
        interactionCount: 1,
        maicSuggestionPresent: false,
        userActiveNow: false,
      },
      T,
    );
    expect(r.verdict).toBe("ready-by-idle");
  });

  it("returns `ready-by-saturation` when interaction count is crossed", () => {
    const r = evaluateSleepReadiness(
      {
        idleMs: 1000,
        interactionCount: T.interactionCount + 1,
        maicSuggestionPresent: false,
        userActiveNow: true,
      },
      T,
    );
    expect(r.verdict).toBe("ready-by-saturation");
  });

  it("returns `requested-by-maic` when MAIC suggests AND user is idle", () => {
    const r = evaluateSleepReadiness(
      {
        idleMs: 1000,
        interactionCount: 1,
        maicSuggestionPresent: true,
        userActiveNow: false,
      },
      T,
    );
    expect(r.verdict).toBe("requested-by-maic");
  });

  it("returns `declined` when MAIC suggests but user is active with low saturation", () => {
    const r = evaluateSleepReadiness(
      {
        idleMs: 1000,
        interactionCount: 5,
        maicSuggestionPresent: true,
        userActiveNow: true,
      },
      T,
    );
    expect(r.verdict).toBe("declined");
  });

  it("MAIC suggestion overrides active-user when saturation is high", () => {
    const r = evaluateSleepReadiness(
      {
        idleMs: 1000,
        interactionCount: T.interactionCount + 1,
        maicSuggestionPresent: true,
        userActiveNow: true,
      },
      T,
    );
    expect(r.verdict).toBe("requested-by-maic");
  });

  it("uses the default thresholds when none are supplied", () => {
    const r = evaluateSleepReadiness({
      idleMs: 100,
      interactionCount: 1,
      maicSuggestionPresent: false,
      userActiveNow: true,
    });
    expect(r.thresholds.idleMs).toBe(30 * 60 * 1000);
    expect(r.thresholds.interactionCount).toBe(64);
  });
});
