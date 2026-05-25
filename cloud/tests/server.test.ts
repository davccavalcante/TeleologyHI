import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalMaic, CreatorKeyring, RemoteMaic, type BehaviorReport } from "@teleologyhi-sdk/maic";
import { startCloud, type CloudHandle } from "../src/index";

describe("@teleologyhi-sdk/cloud server", () => {
  let dir: string;
  let maic: LocalMaic;
  let kr: CreatorKeyring;
  let handle: CloudHandle;
  const token = "test-token-1";

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "cloud-test-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({
      storeDir: dir,
      creatorPublicKey: kr.publicKey(),
    });
    handle = await startCloud({
      maic,
      acceptedTokens: new Set([token]),
      port: 0,
      host: "127.0.0.1",
    });
  });

  afterEach(async () => {
    await handle.close();
    await rm(dir, { recursive: true, force: true });
  });

  function baseUrl(): string {
    const addr = handle.server.address();
    if (!addr || typeof addr === "string") throw new Error("no address");
    return `http://127.0.0.1:${addr.port}`;
  }

  it("GET / returns service metadata without auth", async () => {
    const res = await fetch(`${baseUrl()}/`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string };
    expect(body.service).toBe("@teleologyhi-sdk/cloud");
  });

  it("GET /healthz returns ok without auth", async () => {
    const res = await fetch(`${baseUrl()}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects requests with no bearer token", async () => {
    const res = await fetch(`${baseUrl()}/v1/nhes/nhe.x/status`);
    expect(res.status).toBe(401);
  });

  it("rejects requests with a wrong bearer token", async () => {
    const res = await fetch(`${baseUrl()}/v1/nhes/nhe.x/status`, {
      headers: { authorization: "Bearer not-the-token" },
    });
    expect(res.status).toBe(401);
  });

  it("returns NheStatus via GET /v1/nhes/:id/status", async () => {
    const remote = new RemoteMaic({ baseUrl: baseUrl(), apiKey: token });
    const status = await remote.getNheStatus("nhe.never-registered");
    expect(status).toBe("active");
  });

  it("returns pending inductions list via GET /v1/nhes/:id/inductions/pending", async () => {
    const remote = new RemoteMaic({ baseUrl: baseUrl(), apiKey: token });
    const tickets = await remote.listPendingInductions("nhe.x");
    expect(tickets).toEqual([]);
  });

  it("reviews behavior via POST /v1/behavior-review", async () => {
    const remote = new RemoteMaic({ baseUrl: baseUrl(), apiKey: token });
    const report: BehaviorReport = {
      himId: "him.test",
      nheId: "nhe.test",
      actionKind: "user-response",
      payload: { text: "It's sunny." },
      reasoningTrace: [],
      riskTags: [],
      timestamp: new Date().toISOString(),
    };
    const verdict = await remote.reviewBehavior(report);
    expect(["approve", "approve-with-warning"]).toContain(verdict.kind);
  });

  it("returns 404 on unknown route", async () => {
    const res = await fetch(`${baseUrl()}/v1/unknown`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 on malformed BehaviorReport body (zod rejection)", async () => {
    const res = await fetch(`${baseUrl()}/v1/behavior-review`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ wrong: "shape" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; issues?: string[] };
    expect(body.error).toBe("invalid_behavior_report");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("returns 400 on non-JSON body", async () => {
    const res = await fetch(`${baseUrl()}/v1/behavior-review`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: "not json {",
    });
    expect(res.status).toBe(400);
  });

  it("acceptedTokens=empty WITHOUT allowUnauthenticated=true is closed (returns 401)", async () => {
    const closed = await startCloud({
      maic,
      acceptedTokens: new Set(),
      port: 0,
      host: "127.0.0.1",
    });
    try {
      const addr = closed.server.address();
      if (!addr || typeof addr === "string") throw new Error("no address");
      const res = await fetch(`http://127.0.0.1:${addr.port}/v1/nhes/nhe.x/status`);
      expect(res.status).toBe(401);
    } finally {
      await closed.close();
    }
  });

  it("acceptedTokens=empty PLUS allowUnauthenticated=true disables auth (opt-in smoke path)", async () => {
    const open = await startCloud({
      maic,
      acceptedTokens: new Set(),
      allowUnauthenticated: true,
      port: 0,
      host: "127.0.0.1",
    });
    try {
      const addr = open.server.address();
      if (!addr || typeof addr === "string") throw new Error("no address");
      const res = await fetch(`http://127.0.0.1:${addr.port}/v1/nhes/nhe.x/status`);
      expect(res.status).toBe(200);
    } finally {
      await open.close();
    }
  });
});
