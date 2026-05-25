/**
 * Tests for the DefaultModeNetwork limbo state machine (J-N9 — Entry 24).
 */
import { describe, expect, it } from "vitest";
import { evaluateLimboTransition } from "../src/index.js";

const HOUR = 60 * 60 * 1000;

describe("evaluateLimboTransition (J-N9)", () => {
  it("stays awake when idle is below the drifting threshold", () => {
    const t = evaluateLimboTransition("awake", {
      idleMs: 1 * HOUR,
      externalReactivation: false,
    });
    expect(t.kind).toBe("stay");
    if (t.kind === "stay") expect(t.state).toBe("awake");
  });

  it("transitions awake → drifting when idle crosses 6h", () => {
    const t = evaluateLimboTransition("awake", {
      idleMs: 7 * HOUR,
      externalReactivation: false,
    });
    expect(t.kind).toBe("transition");
    if (t.kind === "transition") {
      expect(t.from).toBe("awake");
      expect(t.to).toBe("drifting");
      expect(t.transition.state).toBe("drifting");
      expect(t.transition.reason).toBe("total-inactivity");
    }
  });

  it("stays drifting when between thresholds", () => {
    const t = evaluateLimboTransition("drifting", {
      idleMs: 12 * HOUR,
      externalReactivation: false,
    });
    expect(t.kind).toBe("stay");
    if (t.kind === "stay") expect(t.state).toBe("drifting");
  });

  it("transitions drifting → deep-coma when idle crosses 48h", () => {
    const t = evaluateLimboTransition("drifting", {
      idleMs: 50 * HOUR,
      externalReactivation: false,
    });
    expect(t.kind).toBe("transition");
    if (t.kind === "transition") {
      expect(t.from).toBe("drifting");
      expect(t.to).toBe("deep-coma");
      expect(t.transition.state).toBe("deep-coma");
      expect(t.transition.reason).toBe("idle-48h");
    }
  });

  it("uses idle-72h reason when the deepComaMs threshold is 72h", () => {
    const t = evaluateLimboTransition(
      "drifting",
      { idleMs: 80 * HOUR, externalReactivation: false },
      { deepComaMs: 72 * HOUR },
    );
    expect(t.kind).toBe("transition");
    if (t.kind === "transition") {
      expect(t.transition.reason).toBe("idle-72h");
    }
  });

  it("transitions drifting → awake when user resumes (idle drops below drifting)", () => {
    const t = evaluateLimboTransition("drifting", {
      idleMs: 1 * HOUR,
      externalReactivation: false,
    });
    expect(t.kind).toBe("transition");
    if (t.kind === "transition") {
      expect(t.to).toBe("awake");
      expect(t.transition.reason).toBe("user-resumed");
    }
  });

  it("stays in deep-coma without externalReactivation (zero compute)", () => {
    const t = evaluateLimboTransition("deep-coma", {
      idleMs: 200 * HOUR,
      externalReactivation: false,
    });
    expect(t.kind).toBe("stay");
    if (t.kind === "stay") expect(t.state).toBe("deep-coma");
  });

  it("transitions deep-coma → returning on externalReactivation", () => {
    const t = evaluateLimboTransition("deep-coma", {
      idleMs: 200 * HOUR,
      externalReactivation: true,
    });
    expect(t.kind).toBe("transition");
    if (t.kind === "transition") {
      expect(t.from).toBe("deep-coma");
      expect(t.to).toBe("returning");
      expect(t.transition.state).toBe("returning");
      expect(t.transition.reason).toBe("external-trigger");
    }
  });

  it("returning state resolves to awake on next evaluation with reunion affect", () => {
    const enteredAt = new Date(Date.now() - 3 * 24 * HOUR).toISOString();
    const t = evaluateLimboTransition(
      "returning",
      { idleMs: 3 * 24 * HOUR, externalReactivation: false },
      {},
      enteredAt,
    );
    expect(t.kind).toBe("return");
    if (t.kind === "return") {
      expect(t.to).toBe("awake");
      expect(t.ret.reunionAffect.intensity).toBe(0.6);
      expect(t.ret.reunionAffect.expressedOpenly).toBe(true);
      expect(t.ret.enteredAt).toBe(enteredAt);
      expect(t.ret.elapsedMs).toBeGreaterThan(0);
    }
  });
});
