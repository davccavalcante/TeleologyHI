import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AuditLog } from "../src/audit/log";
import { canonicalJSON } from "../src/axioms/signing";
import { RemoteMaic } from "../src/client/remote";
import { ComplianceMapper } from "../src/compliance/mapper";
import { signedBirthPayload } from "../src/creator/sign-birth";
import type { BehaviorReport, BirthSignatureWithIdentity } from "../src/types";

// A fetch that always rejects, simulating a network-level failure (not an HTTP
// error status). RemoteMaic must treat this as unreachable.
const rejectingFetch = (): typeof globalThis.fetch =>
  (() => Promise.reject(new Error("network down"))) as unknown as typeof globalThis.fetch;

describe("canonicalJSON (M2-3 direct coverage)", () => {
  it("sorts object keys deterministically", () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe(canonicalJSON({ a: 2, b: 1 }));
    expect(canonicalJSON({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("drops undefined members", () => {
    expect(canonicalJSON({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("throws on a non-finite number", () => {
    expect(() => canonicalJSON({ x: Number.POSITIVE_INFINITY })).toThrow(/non-finite/i);
    expect(() => canonicalJSON({ x: Number.NaN })).toThrow(/non-finite/i);
  });
});

describe("signedBirthPayload (M2-3 direct coverage)", () => {
  it("projects exactly the signed fields, dropping the dev-configurable surface", () => {
    const birth: BirthSignatureWithIdentity = {
      himId: "him.x",
      bornAt: new Date().toISOString(),
      primaryArchetype: "aries-sun",
      modifiers: [],
      primordialAxiomIds: ["ax.ethic.no-malice"],
      identity: { name: "Lex" },
      natalChart: { sun: "aries", ascendant: "leo" },
      notes: "should not be signed",
    };
    const payload = signedBirthPayload(birth);
    expect(Object.keys(payload).sort()).toEqual(
      [
        "bornAt",
        "himId",
        "modifiers",
        "natalChart",
        "primaryArchetype",
        "primordialAxiomIds",
      ].sort(),
    );
    // The identity surface and notes are NOT part of the signed payload.
    expect((payload as Record<string, unknown>).identity).toBeUndefined();
    expect((payload as Record<string, unknown>).notes).toBeUndefined();
  });
});

describe("ComplianceMapper.project (M2-3 direct coverage)", () => {
  it("projects audit events directly onto ISO 42001 controls", async () => {
    const dir = await mkdtemp(join(tmpdir(), "maic-cov-cmp-"));
    const log = await AuditLog.open(dir);
    await log.append({
      kind: "behavior-review",
      data: { nheId: "nhe-1", verdict: { kind: "approve" } },
    });
    const report = await ComplianceMapper.project(log, "iso-42001");
    expect(report.framework).toBe("iso-42001");
    expect(report.totalEvents).toBe(1);
    expect(report.controls.some((c) => c.control === "7.5")).toBe(true);
    expect(report.uncoveredKinds).toEqual([]);
  });
});

describe("RemoteMaic fetch rejection (M2-3 direct coverage)", () => {
  it("getNheStatus fails open to active when fetch rejects", async () => {
    const r = new RemoteMaic({ baseUrl: "https://m.example", fetch: rejectingFetch() });
    expect(await r.getNheStatus("nhe-1")).toBe("active");
  });

  it("listPendingInductions fails open to [] when fetch rejects", async () => {
    const r = new RemoteMaic({ baseUrl: "https://m.example", fetch: rejectingFetch() });
    expect(await r.listPendingInductions("nhe-1")).toEqual([]);
  });

  it("consumeInduction fails open to a synthetic pending ticket when fetch rejects", async () => {
    const r = new RemoteMaic({ baseUrl: "https://m.example", fetch: rejectingFetch() });
    const t = await r.consumeInduction("t-1");
    expect(t.id).toBe("t-1");
    expect(t.status).toBe("pending");
  });

  it("reviewBehavior fails closed (throws) when fetch rejects", async () => {
    const r = new RemoteMaic({ baseUrl: "https://m.example", fetch: rejectingFetch() });
    const report: BehaviorReport = {
      nheId: "nhe-1",
      himId: "him-1",
      actionKind: "user-response",
      payload: {},
      reasoningTrace: [],
      riskTags: [],
      timestamp: new Date().toISOString(),
    };
    await expect(r.reviewBehavior(report)).rejects.toThrow();
  });
});
