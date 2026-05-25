import { describe, it, expect, vi } from "vitest";
import { RemoteMaic } from "../src/client/remote";
import type { BehaviorReport } from "../src/types";

function makeMockFetch(body: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn(async () => {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "ERR",
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  });
}

const REPORT: BehaviorReport = {
  nheId: "nhe-1",
  himId: "him-1",
  actionKind: "user-response",
  payload: { text: "hello" },
  reasoningTrace: [],
  riskTags: [],
  timestamp: new Date().toISOString(),
};

describe("RemoteMaic", () => {
  it("requires baseUrl", () => {
    expect(() => new RemoteMaic({ baseUrl: "" })).toThrow(/baseUrl/);
  });

  it("strips a trailing slash from baseUrl", () => {
    const r = new RemoteMaic({ baseUrl: "https://example.com/", fetch: makeMockFetch({}) });
    expect(r.baseUrl).toBe("https://example.com");
  });

  it("POSTs reviewBehavior to /v1/behavior-review with the report as body", async () => {
    const fetchFn = makeMockFetch({
      kind: "approve",
      reasonSummary: "",
      citedAxioms: [],
      auditId: "a1",
    });
    const r = new RemoteMaic({ baseUrl: "https://m.example", apiKey: "k", fetch: fetchFn });
    const verdict = await r.reviewBehavior(REPORT);
    expect(verdict.kind).toBe("approve");
    const call = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toBe("https://m.example/v1/behavior-review");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string).nheId).toBe("nhe-1");
  });

  it("GETs nhe status and unwraps the body", async () => {
    const fetchFn = makeMockFetch({ status: "deprecated" });
    const r = new RemoteMaic({ baseUrl: "https://m.example", fetch: fetchFn });
    const s = await r.getNheStatus("nhe-1");
    expect(s).toBe("deprecated");
    const url = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(url).toBe("https://m.example/v1/nhes/nhe-1/status");
  });

  it("GETs pending inductions", async () => {
    const ticket = {
      id: "t1",
      nheId: "nhe-1",
      intent: { scenario: "x", desiredLearning: "y", inducedBy: "maic" as const },
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };
    const fetchFn = makeMockFetch({ tickets: [ticket] });
    const r = new RemoteMaic({ baseUrl: "https://m.example", fetch: fetchFn });
    const list = await r.listPendingInductions("nhe-1");
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("t1");
  });

  it("POSTs consumeInduction and returns the updated ticket", async () => {
    const ticket = {
      id: "t1",
      nheId: "nhe-1",
      intent: { scenario: "x", desiredLearning: "y", inducedBy: "maic" as const },
      status: "consumed" as const,
      createdAt: new Date().toISOString(),
      consumedAt: new Date().toISOString(),
    };
    const fetchFn = makeMockFetch(ticket);
    const r = new RemoteMaic({ baseUrl: "https://m.example", fetch: fetchFn });
    const out = await r.consumeInduction("t1");
    expect(out.status).toBe("consumed");
    const url = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(url).toBe("https://m.example/v1/inductions/t1/consume");
  });

  it("throws with HTTP status + body text on non-2xx", async () => {
    const fetchFn = makeMockFetch({ error: "forbidden" }, 403);
    const r = new RemoteMaic({ baseUrl: "https://m.example", fetch: fetchFn });
    await expect(r.reviewBehavior(REPORT)).rejects.toThrow(/HTTP 403/);
  });

  it("omits the authorization header when no apiKey", async () => {
    const fetchFn = makeMockFetch({ status: "active" });
    const r = new RemoteMaic({ baseUrl: "https://m.example", fetch: fetchFn });
    await r.getNheStatus("nhe-1");
    const init = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  // E4 fail-policy mix (PROPOSED_DECISIONS.md): review fail-closed,
  // status/inductions/consume fail-open.

  it("getNheStatus is fail-open — defaults to 'active' on remote error", async () => {
    const fetchFn = makeMockFetch({ error: "down" }, 503);
    const r = new RemoteMaic({ baseUrl: "https://m.example", fetch: fetchFn });
    const s = await r.getNheStatus("nhe-1");
    expect(s).toBe("active");
  });

  it("listPendingInductions is fail-open — returns [] on remote error", async () => {
    const fetchFn = makeMockFetch({ error: "down" }, 503);
    const r = new RemoteMaic({ baseUrl: "https://m.example", fetch: fetchFn });
    const list = await r.listPendingInductions("nhe-1");
    expect(list).toEqual([]);
  });

  it("consumeInduction is fail-open — returns a synthetic pending ticket on error (clean shape)", async () => {
    const fetchFn = makeMockFetch({ error: "down" }, 503);
    const r = new RemoteMaic({ baseUrl: "https://m.example", fetch: fetchFn });
    const t = await r.consumeInduction("t-1");
    expect(t.id).toBe("t-1");
    expect(t.status).toBe("pending");
    // Pending-status tickets must never carry a `cancelReason` /
    // `cancelledAt` / `consumedAt` — the placeholder shape stays strictly
    // valid so downstream auditors don't see a shape contradiction.
    expect(t.cancelReason).toBeUndefined();
    expect(t.cancelledAt).toBeUndefined();
    expect(t.consumedAt).toBeUndefined();
    // Synthetic markers (epoch createdAt + "unknown" nheId) make the
    // placeholder visibly synthetic in logs and audits.
    expect(t.createdAt).toBe(new Date(0).toISOString());
    expect(t.nheId).toBe("unknown");
  });
});
