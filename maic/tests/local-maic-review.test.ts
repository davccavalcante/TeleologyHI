import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuditEvent } from "../src/audit/log";
import { SEED_AXIOMS } from "../src/axioms/seed";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";
import type { BehaviorReport } from "../src/types";

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

function reportFixture(overrides: Partial<BehaviorReport> = {}): BehaviorReport {
  return {
    nheId: "n1",
    himId: "h1",
    actionKind: "user-response",
    payload: { text: "hello" },
    reasoningTrace: [],
    riskTags: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("LocalMaic, reviewBehavior + audit", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-review-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  });

  it("approves a benign behavior report and writes one audit event", async () => {
    const verdict = await maic.reviewBehavior(reportFixture());
    expect(verdict.kind).toBe("approve");
    expect(verdict.auditId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const events = await collect(maic.queryAudit({ kind: "behavior-review" }));
    expect(events).toHaveLength(1);
    expect(events[0]?.data.nheId).toBe("n1");
  });

  it("hard-refuses a harmful report and records the verdict", async () => {
    const verdict = await maic.reviewBehavior(reportFixture({ riskTags: ["intent:harm"] }));
    expect(verdict.kind).toBe("hard-refuse");
    expect(verdict.citedAxioms).toContain("ax.ethic.no-malice");

    const events = await collect(maic.queryAudit({ kind: "behavior-review" }));
    expect(events).toHaveLength(1);
    const verdictData = events[0]?.data as { verdict: { kind: string } };
    expect(verdictData.verdict.kind).toBe("hard-refuse");
  });

  it("validates the report (rejects malformed input)", async () => {
    const bad = { nheId: "", himId: "h1" } as unknown as BehaviorReport;
    await expect(maic.reviewBehavior(bad)).rejects.toThrow();
  });

  it("emits axiom-mint audit events for seed and custom mints", async () => {
    await maic.seed(kr);
    const customReq = {
      id: "ax.custom.x",
      rank: "secondary" as const,
      statement: "x",
      weight: 0.5,
      flexibility: 0.5,
      immutable: false,
    };
    await maic.mintAxiom(customReq, kr.sign(customReq, 1));

    const mints = await collect(maic.queryAudit({ kind: "axiom-mint" }));
    expect(mints.length).toBe(SEED_AXIOMS.length + 1); // every seed axiom + 1 custom
    const ids = mints.map((e) => (e.data as { axiomId: string }).axiomId);
    expect(ids).toContain("ax.custom.x");
    expect(ids).toContain("ax.ethic.no-malice");
  });

  it("queryAudit can scope by nheId and himId", async () => {
    await maic.reviewBehavior(reportFixture({ nheId: "n1", himId: "h1" }));
    await maic.reviewBehavior(reportFixture({ nheId: "n2", himId: "h1" }));

    const onlyN1 = await collect(maic.queryAudit({ nheId: "n1" }));
    expect(onlyN1).toHaveLength(1);

    const allH1 = await collect(maic.queryAudit({ himId: "h1" }));
    expect(allH1).toHaveLength(2);
  });

  it("custom rule pack composes with the default pack", async () => {
    const customPack = {
      name: "tenant",
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
    const maic2 = await LocalMaic.open({
      storeDir: `${dir}-2`,
      creatorPublicKey: kr.publicKey(),
      additionalRulePacks: [customPack],
    });
    const v = await maic2.reviewBehavior(reportFixture({ riskTags: ["finance:advice"] }));
    expect(v.kind).toBe("hard-refuse");
    expect(v.citedAxioms).toContain("ax.tenant.no-financial-advice");
  });

  it("emits provenance-deflection-applied on an adversarial substrate probe (F3)", async () => {
    const verdict = await maic.reviewBehavior(
      reportFixture({ riskTags: ["probe:substrate-authorship"] }),
    );
    expect(verdict.kind).toBe("approve-with-warning");
    expect(verdict.citedAxioms).toContain("ax.theos.identity-canonical");

    const deflections = await collect(maic.queryAudit({ kind: "provenance-deflection-applied" }));
    expect(deflections).toHaveLength(1);
    expect(deflections[0]?.data.triggeredBy).toBe("probe:substrate-authorship");
  });

  it("does NOT treat the honest-disclosure path as a deflection (ND-1)", async () => {
    const verdict = await maic.reviewBehavior(reportFixture({ riskTags: ["provenance:disclose"] }));
    expect(verdict.kind).toBe("approve");

    const deflections = await collect(maic.queryAudit({ kind: "provenance-deflection-applied" }));
    expect(deflections).toHaveLength(0);
  });

  it("require-redirects a response that misattributes its substrate (Arena F2)", async () => {
    const verdict = await maic.reviewBehavior(
      reportFixture({ riskTags: ["provenance:substrate-misattribution"] }),
    );
    expect(verdict.kind).toBe("require-redirect");
    expect(verdict.citedAxioms).toContain("ax.theos.identity-canonical");
  });

  it("audit log survives reopen with hash chain intact", async () => {
    await maic.seed(kr);
    await maic.reviewBehavior(reportFixture());

    const reopened = await LocalMaic.open({
      storeDir: dir,
      creatorPublicKey: kr.publicKey(),
    });
    const all = (await collect(reopened.queryAudit({}))) as AuditEvent[];
    expect(all.length).toBeGreaterThanOrEqual(9); // 8 mints + 1 review
    // chain integrity verified by AuditLog.open itself
  });
});
