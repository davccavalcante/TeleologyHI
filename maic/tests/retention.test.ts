import { describe, expect, it } from "vitest";
import type { AuditEvent } from "../src/audit/log";
import { DEFAULT_RETENTION_DAYS, evaluateRetention } from "../src/audit/retention";

function ev(kind: AuditEvent["kind"], daysAgo: number): AuditEvent {
  const ts = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return { ts, kind, auditId: `a-${kind}-${daysAgo}`, data: {}, prevHash: "", thisHash: "" };
}

describe("audit retention policy (E3)", () => {
  it("axiom events default to Infinity retention (never expire)", () => {
    expect(DEFAULT_RETENTION_DAYS["axiom-mint"]).toBe(Number.POSITIVE_INFINITY);
    expect(DEFAULT_RETENTION_DAYS["proposal-ratify"]).toBe(Number.POSITIVE_INFINITY);
  });

  it("operational events default to 90 days", () => {
    expect(DEFAULT_RETENTION_DAYS["dream-consume"]).toBe(90);
    expect(DEFAULT_RETENTION_DAYS["dream-cancel"]).toBe(90);
  });

  it("compliance events default to ~5 years", () => {
    expect(DEFAULT_RETENTION_DAYS["behavior-review"]).toBe(365 * 5);
    expect(DEFAULT_RETENTION_DAYS.terminate).toBe(365 * 5);
  });

  it("classifies young behavior-review events as keep", () => {
    const r = evaluateRetention([ev("behavior-review", 30)]);
    expect(r.keepCount).toBe(1);
    expect(r.archiveCandidateCount).toBe(0);
    expect(r.decisions[0]?.status).toBe("keep");
  });

  it("classifies aged dream-consume events as archive candidates after 90d", () => {
    const r = evaluateRetention([ev("dream-consume", 100)]);
    expect(r.archiveCandidateCount).toBe(1);
    expect(r.decisions[0]?.status).toBe("candidate-for-archive");
  });

  it("axiom-mint never expires regardless of age", () => {
    const r = evaluateRetention([ev("axiom-mint", 10 * 365)]);
    expect(r.archiveCandidateCount).toBe(0);
  });

  it("policy override applies", () => {
    const r = evaluateRetention([ev("behavior-review", 100)], {
      policy: { "behavior-review": 30 },
    });
    expect(r.decisions[0]?.status).toBe("candidate-for-archive");
  });

  it("sorts decisions oldest-first for batch processing", () => {
    const r = evaluateRetention([
      ev("dream-consume", 50),
      ev("dream-consume", 200),
      ev("dream-consume", 10),
    ]);
    const ages = r.decisions.map((d) => d.ageDays);
    expect(ages[0]).toBeGreaterThan(ages[1]!);
    expect(ages[1]).toBeGreaterThan(ages[2]!);
  });
});
