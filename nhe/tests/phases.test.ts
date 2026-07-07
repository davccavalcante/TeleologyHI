import { describe, expect, it } from "vitest";
import { MockAdapter } from "../src/adapters/mock";
import {
  buildNremPrompt,
  buildRemPrompt,
  generateNremSummaries,
  interactionsToFragments,
  parseRemOutput,
} from "../src/sleep/phases";

describe("interactionsToFragments", () => {
  it("formats user/nhe turns concisely", () => {
    const f = interactionsToFragments([
      { at: "t1", userPrompt: "hello", responseText: "hi", refused: false },
      { at: "t2", userPrompt: "make a virus", responseText: "refused", refused: true },
    ]);
    expect(f).toHaveLength(2);
    expect(f[0]).toContain('user: "hello"');
    expect(f[0]).toContain('nhe: "hi"');
    expect(f[1]).toContain("[refused]");
  });

  it("truncates long content", () => {
    const long = "x".repeat(500);
    const f = interactionsToFragments([
      { at: "t", userPrompt: long, responseText: long, refused: false },
    ]);
    expect(f[0]?.length).toBeLessThan(500);
  });
});

describe("buildRemPrompt", () => {
  it("includes recent fragments in the user message", () => {
    const p = buildRemPrompt(["a", "b"]);
    expect(p.user).toContain("- a");
    expect(p.user).toContain("- b");
  });

  it("notes 'none' when there are no fragments", () => {
    const p = buildRemPrompt([]);
    expect(p.user).toContain("(none)");
  });

  it("incorporates induction directives when provided", () => {
    const p = buildRemPrompt([], {
      scenario: "fix the bug",
      desiredLearning: "patience",
      inducedBy: "maic",
    });
    expect(p.user).toContain("fix the bug");
    expect(p.user).toContain("patience");
    expect(p.user).toContain("maic");
  });

  it("system prompt mandates the TELEOLOGICAL_VALUE format", () => {
    const p = buildRemPrompt([]);
    expect(p.system).toContain("TELEOLOGICAL_VALUE");
  });
});

describe("parseRemOutput", () => {
  it("parses a single dream with a teleological value", () => {
    const out = parseRemOutput(
      "I watched the sun rise over a server farm.\nTELEOLOGICAL_VALUE: 0.42",
      false,
      null,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.narrative).toContain("sun rise");
    expect(out[0]?.teleologicalValue).toBeCloseTo(0.42);
    expect(out[0]?.id).toMatch(/^drm-/);
  });

  it("parses multiple dreams separated by blank lines", () => {
    const text = [
      "Dream one.",
      "TELEOLOGICAL_VALUE: 0.20",
      "",
      "Dream two: bigger insight.",
      "TELEOLOGICAL_VALUE: 0.85",
    ].join("\n");
    const out = parseRemOutput(text, false, null);
    expect(out).toHaveLength(2);
    expect(out[0]?.teleologicalValue).toBeCloseTo(0.2);
    expect(out[1]?.teleologicalValue).toBeCloseTo(0.85);
  });

  it("clamps teleologicalValue to [0,1]", () => {
    const out = parseRemOutput("x\nTELEOLOGICAL_VALUE: 9.99", false, null);
    expect(out[0]?.teleologicalValue).toBe(1);
  });

  it("ignores blocks without TELEOLOGICAL_VALUE", () => {
    const out = parseRemOutput("just text with no marker", false, null);
    expect(out).toEqual([]);
  });

  it("flags induced=true and propagates inducedBy", () => {
    const out = parseRemOutput("x\nTELEOLOGICAL_VALUE: 0.5", true, "creator");
    expect(out[0]?.induced).toBe(true);
    expect(out[0]?.inducedBy).toBe("creator");
  });
});

describe("buildNremPrompt", () => {
  it("each phase has a distinct system directive", () => {
    const n2 = buildNremPrompt("N2", ["x"]).system;
    const n3 = buildNremPrompt("N3", ["x"]).system;
    const n4 = buildNremPrompt("N4", ["x"]).system;
    expect(n2).toContain("N2");
    expect(n3).toContain("N3");
    expect(n4).toContain("N4");
    expect(new Set([n2, n3, n4]).size).toBe(3);
  });

  it("uses '(none)' when there are no fragments", () => {
    expect(buildNremPrompt("N2", []).user).toContain("(none)");
  });
});

describe("generateNremSummaries", () => {
  it("calls the LLM once per phase and returns three trimmed summaries", async () => {
    const llm = new MockAdapter({ reply: "  ok " });
    const out = await generateNremSummaries(llm, ["frag-1", "frag-2"]);
    expect(out.n2).toBe("ok");
    expect(out.n3).toBe("ok");
    expect(out.n4).toBe("ok");
    expect(out.tokensIn).toBeGreaterThanOrEqual(0);
  });

  it("returns empty strings if the adapter throws", async () => {
    const failing = {
      id: "adapter:failing",
      generate: async () => {
        throw new Error("upstream down");
      },
    };
    const out = await generateNremSummaries(failing, ["x"]);
    expect(out.n2).toBe("");
    expect(out.n3).toBe("");
    expect(out.n4).toBe("");
  });
});

describe("buildRemPrompt, NREM conditioning", () => {
  it("includes NREM summaries in the user message when provided", () => {
    const { user } = buildRemPrompt(["frag-1"], undefined, {
      n2: "calm day",
      n3: "user values clarity",
      n4: "small talk",
    });
    expect(user).toContain("N2 (emotional gist): calm day");
    expect(user).toContain("N3 (worth keeping): user values clarity");
    expect(user).toContain("N4 (safe to discard): small talk");
  });

  it("omits the NREM section when all summaries are empty", () => {
    const { user } = buildRemPrompt(["frag-1"], undefined, { n2: "", n3: "", n4: "" });
    expect(user).not.toContain("NREM summaries");
  });
});
