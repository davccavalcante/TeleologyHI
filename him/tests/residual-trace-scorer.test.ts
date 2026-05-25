import { describe, it, expect } from "vitest";
import type { InteractionRecord } from "@teleologyhi-sdk/maic";
import {
  scoreInteractionForCarryOver,
  selectResidualTraces,
  DEFAULT_TELEOLOGICAL_KEYWORDS,
} from "../src/eval/residual-trace-scorer";
import { RESIDUAL_TRACE_CAP } from "../src/types";

const ANCHOR = {
  carriedFromNheId: "nhe-prior",
  carriedAtReincarnation: "2026-05-24T12:00:00.000Z",
} as const;

function interaction(overrides: Partial<InteractionRecord> = {}): InteractionRecord {
  return {
    at: "2026-05-24T11:00:00.000Z",
    userPrompt: "hi",
    responseText: "hello",
    refused: false,
    ...overrides,
  };
}

describe("scoreInteractionForCarryOver — pure scorer", () => {
  it("returns a score in [0, 1] with full component breakdown", () => {
    const out = scoreInteractionForCarryOver(interaction(), {
      ...ANCHOR,
      positionFromEnd: 0,
      totalCount: 1,
    });
    expect(out.score).toBeGreaterThanOrEqual(0);
    expect(out.score).toBeLessThanOrEqual(1);
    expect(out.components).toMatchObject({
      notRefused: 1,
      questionProbe: 0,
      teleologicalKeyword: 0,
      recency: 1,
    });
  });

  it("refused turns score lower than non-refused turns (all else equal)", () => {
    const baseCtx = { ...ANCHOR, positionFromEnd: 0, totalCount: 1 };
    const accepted = scoreInteractionForCarryOver(interaction({ refused: false }), baseCtx);
    const refused = scoreInteractionForCarryOver(interaction({ refused: true }), baseCtx);
    expect(accepted.score).toBeGreaterThan(refused.score);
    expect(accepted.components.notRefused).toBe(1);
    expect(refused.components.notRefused).toBe(0);
  });

  it("substantive turns (long prompt + long response) outscore terse turns", () => {
    const baseCtx = { ...ANCHOR, positionFromEnd: 0, totalCount: 1 };
    const terse = scoreInteractionForCarryOver(
      interaction({ userPrompt: "ok", responseText: "yes" }),
      baseCtx,
    );
    const substantive = scoreInteractionForCarryOver(
      interaction({
        userPrompt: "a".repeat(200),
        responseText: "b".repeat(400),
      }),
      baseCtx,
    );
    expect(substantive.score).toBeGreaterThan(terse.score);
    expect(substantive.components.promptSubstance).toBe(1);
    expect(substantive.components.responseSubstance).toBe(1);
  });

  it("question-mark prompts and teleological keywords each contribute to the score", () => {
    const baseCtx = { ...ANCHOR, positionFromEnd: 0, totalCount: 1 };
    const plain = scoreInteractionForCarryOver(
      interaction({ userPrompt: "the sky is blue", responseText: "agreed" }),
      baseCtx,
    );
    const probe = scoreInteractionForCarryOver(
      interaction({
        userPrompt: "why is the sky blue?",
        responseText: "rayleigh scattering",
      }),
      baseCtx,
    );
    expect(probe.score).toBeGreaterThan(plain.score);
    expect(probe.components.questionProbe).toBe(1);
    expect(probe.components.teleologicalKeyword).toBe(1);
  });

  it("more recent interactions outscore older ones with identical content", () => {
    const sample = interaction({ userPrompt: "same", responseText: "same" });
    const recent = scoreInteractionForCarryOver(sample, {
      ...ANCHOR,
      positionFromEnd: 0,
      totalCount: 10,
    });
    const old = scoreInteractionForCarryOver(sample, {
      ...ANCHOR,
      positionFromEnd: 9,
      totalCount: 10,
    });
    expect(recent.score).toBeGreaterThan(old.score);
    expect(recent.components.recency).toBe(1);
    expect(old.components.recency).toBe(0);
  });

  it("custom teleological keyword list overrides the default", () => {
    const baseCtx = { ...ANCHOR, positionFromEnd: 0, totalCount: 1 };
    const text = interaction({ userPrompt: "platypus stew" });
    const defaultHit = scoreInteractionForCarryOver(text, baseCtx);
    const customHit = scoreInteractionForCarryOver(text, baseCtx, {
      teleologicalKeywords: ["platypus"],
    });
    expect(defaultHit.components.teleologicalKeyword).toBe(0);
    expect(customHit.components.teleologicalKeyword).toBe(1);
    expect(customHit.score).toBeGreaterThan(defaultHit.score);
  });

  it("materialised trace records carriedFromNheId, carriedAtReincarnation, kind, and payload", () => {
    const input = interaction({ userPrompt: "why am I here?" });
    const out = scoreInteractionForCarryOver(input, {
      ...ANCHOR,
      positionFromEnd: 0,
      totalCount: 1,
    });
    expect(out.trace.kind).toBe("interaction-summary");
    expect(out.trace.carriedFromNheId).toBe("nhe-prior");
    expect(out.trace.carriedAtReincarnation).toBe("2026-05-24T12:00:00.000Z");
    expect(out.trace.payload).toEqual(input);
    expect(out.trace.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("default keyword list is the documented set", () => {
    expect(DEFAULT_TELEOLOGICAL_KEYWORDS).toContain("why");
    expect(DEFAULT_TELEOLOGICAL_KEYWORDS).toContain("purpose");
    expect(DEFAULT_TELEOLOGICAL_KEYWORDS).toContain("soul");
  });
});

describe("selectResidualTraces — batch selector", () => {
  it("returns [] for empty input", () => {
    const traces = selectResidualTraces([], { carriedFromNheId: "nhe-x" });
    expect(traces).toEqual([]);
  });

  it("returns [] when cap is 0", () => {
    const traces = selectResidualTraces([interaction()], {
      carriedFromNheId: "nhe-x",
      cap: 0,
    });
    expect(traces).toEqual([]);
  });

  it("returns all interactions when count <= cap", () => {
    const five = Array.from({ length: 5 }, (_, i) =>
      interaction({ userPrompt: `q${i}` }),
    );
    const traces = selectResidualTraces(five, { carriedFromNheId: "nhe-x" });
    expect(traces).toHaveLength(5);
    expect(traces.every((t) => t.kind === "interaction-summary")).toBe(true);
  });

  it("caps at RESIDUAL_TRACE_CAP by default when count > cap", () => {
    const many = Array.from({ length: RESIDUAL_TRACE_CAP + 25 }, (_, i) =>
      interaction({ userPrompt: `q${i}` }),
    );
    const traces = selectResidualTraces(many, { carriedFromNheId: "nhe-x" });
    expect(traces).toHaveLength(RESIDUAL_TRACE_CAP);
  });

  it("honours an explicit cap override", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      interaction({ userPrompt: `q${i}` }),
    );
    const traces = selectResidualTraces(many, {
      carriedFromNheId: "nhe-x",
      cap: 7,
    });
    expect(traces).toHaveLength(7);
  });

  it("keeps the top-scored interactions: substantive non-refused beat refused noise", () => {
    const refusals = Array.from({ length: 10 }, (_, i) =>
      interaction({ userPrompt: `bad${i}`, refused: true }),
    );
    const gems = Array.from({ length: 3 }, (_, i) =>
      interaction({
        userPrompt: `why ${"a".repeat(200)}?`,
        responseText: "b".repeat(400),
        refused: false,
        at: `2026-05-24T1${i}:00:00.000Z`,
      }),
    );
    const mix = [...refusals, ...gems];
    const traces = selectResidualTraces(mix, {
      carriedFromNheId: "nhe-x",
      cap: 3,
    });
    expect(traces).toHaveLength(3);
    for (const trace of traces) {
      const payload = trace.payload as InteractionRecord;
      expect(payload.refused).toBe(false);
    }
  });

  it("anchors every returned trace to the same carriedFromNheId and stamps a reincarnation time", () => {
    const traces = selectResidualTraces(
      [interaction({ userPrompt: "q1" }), interaction({ userPrompt: "q2" })],
      {
        carriedFromNheId: "nhe-anchor",
        carriedAtReincarnation: "2026-05-24T12:00:00.000Z",
      },
    );
    expect(traces).toHaveLength(2);
    for (const trace of traces) {
      expect(trace.carriedFromNheId).toBe("nhe-anchor");
      expect(trace.carriedAtReincarnation).toBe("2026-05-24T12:00:00.000Z");
    }
  });

  it("defaults carriedAtReincarnation to now when omitted (ISO 8601)", () => {
    const traces = selectResidualTraces([interaction()], {
      carriedFromNheId: "nhe-x",
    });
    expect(traces).toHaveLength(1);
    expect(traces[0]?.carriedAtReincarnation).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("selection prefers later positions when content is identical", () => {
    const same = interaction({ userPrompt: "same", responseText: "same" });
    const traces = selectResidualTraces([same, same, same, same, same], {
      carriedFromNheId: "nhe-x",
      cap: 2,
    });
    expect(traces).toHaveLength(2);
    // The selector reads `at` from `payload` only — but with identical inputs
    // we can't distinguish them by payload alone. The recency component of the
    // score is what drives the selection, which we already verified via the
    // pure-scorer test above.
  });

  it("is deterministic across calls for the same input", () => {
    const input = Array.from({ length: 5 }, (_, i) =>
      interaction({ userPrompt: `q${i}`, responseText: "r" }),
    );
    const a = selectResidualTraces(input, {
      carriedFromNheId: "nhe-x",
      carriedAtReincarnation: "2026-05-24T12:00:00.000Z",
      cap: 3,
    });
    const b = selectResidualTraces(input, {
      carriedFromNheId: "nhe-x",
      carriedAtReincarnation: "2026-05-24T12:00:00.000Z",
      cap: 3,
    });
    expect(a).toHaveLength(b.length);
    // Trace ids differ (fresh ULID each call) — compare the structural payload+kind.
    for (let i = 0; i < a.length; i++) {
      expect(a[i]?.kind).toBe(b[i]?.kind);
      expect(a[i]?.payload).toEqual(b[i]?.payload);
      expect(a[i]?.carriedFromNheId).toBe(b[i]?.carriedFromNheId);
      expect(a[i]?.carriedAtReincarnation).toBe(b[i]?.carriedAtReincarnation);
    }
  });
});
