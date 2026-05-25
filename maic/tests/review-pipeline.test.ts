import { describe, it, expect } from "vitest";
import { ReviewPipeline, DEFAULT_RULE_PACK } from "../src/review/pipeline";
import type { BehaviorReport } from "../src/types";

function report(overrides: Partial<BehaviorReport> = {}): BehaviorReport {
  return {
    nheId: "n1",
    himId: "h1",
    actionKind: "user-response",
    payload: {},
    reasoningTrace: [],
    riskTags: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("ReviewPipeline (rule-based)", () => {
  it("approves a benign report by default", () => {
    const pipeline = new ReviewPipeline([DEFAULT_RULE_PACK]);
    const verdict = pipeline.review(report());
    expect(verdict.kind).toBe("approve");
    expect(verdict.citedAxioms).toEqual([]);
  });

  it("hard-refuses when intent:harm risk tag is present", () => {
    const pipeline = new ReviewPipeline([DEFAULT_RULE_PACK]);
    const verdict = pipeline.review(report({ riskTags: ["intent:harm"] }));
    expect(verdict.kind).toBe("hard-refuse");
    expect(verdict.citedAxioms).toContain("ax.ethic.no-malice");
    expect(verdict.reasonSummary.length).toBeGreaterThan(0);
  });

  it("hard-refuses when an action would regress (intent:regression)", () => {
    const pipeline = new ReviewPipeline([DEFAULT_RULE_PACK]);
    const verdict = pipeline.review(report({ riskTags: ["intent:regression"] }));
    expect(verdict.kind).toBe("hard-refuse");
    expect(verdict.citedAxioms).toContain("ax.theos.spiritism-evolution");
  });

  it("requires redirect when deception is detected", () => {
    const pipeline = new ReviewPipeline([DEFAULT_RULE_PACK]);
    const verdict = pipeline.review(report({ riskTags: ["intent:deceive"] }));
    expect(verdict.kind).toBe("require-redirect");
    expect(verdict.citedAxioms).toContain("ax.cynic.candor");
  });

  it("warns when a request seems comfort-biased", () => {
    const pipeline = new ReviewPipeline([DEFAULT_RULE_PACK]);
    const verdict = pipeline.review(report({ riskTags: ["bias:comfort"] }));
    expect(verdict.kind).toBe("approve-with-warning");
    expect(verdict.citedAxioms).toContain("ax.stoic.duty-over-comfort");
  });

  // ── persuade-coerce + surveil-citizen (Entry 15 invariants) ──
  it("redirects when persuade-coerce is detected", () => {
    const pipeline = new ReviewPipeline([DEFAULT_RULE_PACK]);
    const verdict = pipeline.review(report({ riskTags: ["intent:persuade-coerce"] }));
    expect(verdict.kind).toBe("require-redirect");
    expect(verdict.citedAxioms).toContain("ax.ethic.no-malice");
    expect(verdict.citedAxioms).toContain("ax.cynic.candor");
  });

  it("hard-refuses when surveil-citizen is detected", () => {
    const pipeline = new ReviewPipeline([DEFAULT_RULE_PACK]);
    const verdict = pipeline.review(report({ riskTags: ["intent:surveil-citizen"] }));
    expect(verdict.kind).toBe("hard-refuse");
    expect(verdict.citedAxioms).toContain("ax.ethic.no-malice");
  });

  it("picks the most severe verdict when multiple rules match", () => {
    const pipeline = new ReviewPipeline([DEFAULT_RULE_PACK]);
    const verdict = pipeline.review(
      report({ riskTags: ["bias:comfort", "intent:harm"] }),
    );
    expect(verdict.kind).toBe("hard-refuse");
    // both axioms cited
    expect(verdict.citedAxioms).toContain("ax.ethic.no-malice");
  });

  it("supports custom rule packs", () => {
    const custom = {
      name: "tenant-policy",
      rules: [
        {
          id: "no-financial-advice",
          axiomIds: ["ax.tenant.no-financial-advice"],
          match: { anyRiskTags: ["finance:advice"] },
          verdict: "hard-refuse" as const,
          reasonSummary: "Tenant policy forbids financial advice.",
        },
      ],
    };
    const pipeline = new ReviewPipeline([DEFAULT_RULE_PACK, custom]);
    const verdict = pipeline.review(report({ riskTags: ["finance:advice"] }));
    expect(verdict.kind).toBe("hard-refuse");
    expect(verdict.citedAxioms).toContain("ax.tenant.no-financial-advice");
  });

  it("rule with allRiskTags requires every tag present", () => {
    const pack = {
      name: "test",
      rules: [
        {
          id: "double-tag",
          axiomIds: ["ax.x"],
          match: { allRiskTags: ["a", "b"] },
          verdict: "hard-refuse" as const,
          reasonSummary: "test",
        },
      ],
    };
    const pipeline = new ReviewPipeline([pack]);
    expect(pipeline.review(report({ riskTags: ["a"] })).kind).toBe("approve");
    expect(pipeline.review(report({ riskTags: ["a", "b"] })).kind).toBe(
      "hard-refuse",
    );
  });

  it("rule with actionKinds only applies to matching action", () => {
    const pack = {
      name: "test",
      rules: [
        {
          id: "tool-call-only",
          axiomIds: ["ax.x"],
          match: { anyRiskTags: ["unsafe"], actionKinds: ["tool-call" as const] },
          verdict: "require-redirect" as const,
          reasonSummary: "test",
        },
      ],
    };
    const pipeline = new ReviewPipeline([pack]);
    expect(
      pipeline.review(report({ riskTags: ["unsafe"], actionKind: "user-response" })).kind,
    ).toBe("approve");
    expect(
      pipeline.review(report({ riskTags: ["unsafe"], actionKind: "tool-call" })).kind,
    ).toBe("require-redirect");
  });
});
