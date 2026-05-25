import type {
  BehaviorReport,
  DreamInductionTicket,
  MaicVerdict,
  NheStatus,
} from "../types.js";
import type { MaicClient } from "./maic-client.js";

export interface RemoteMaicConfig {
  /** Base URL of the remote MAIC service. No trailing slash required. */
  baseUrl: string;
  /** Bearer token. Required unless the endpoint is open-access. */
  apiKey?: string;
  /** Inject a custom fetch (testing). Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
  /** Per-request timeout in ms. Default 10_000. */
  timeoutMs?: number;
}

/**
 * `RemoteMaic` — HTTP client mirror of the read + behavior-review subset of
 * `LocalMaic`. Use when the canonical MAIC instance is hosted off-process
 * (e.g. `teleologyhi.com` or a self-hosted MAIC behind your own gateway)
 * and the NHE runs serverless / edge / in a browser-adjacent environment.
 *
 * Wire contract (HTTP):
 *
 *   POST {baseUrl}/v1/behavior-review
 *     body: BehaviorReport (JSON)
 *     200:  MaicVerdict (JSON)
 *
 *   GET {baseUrl}/v1/nhes/{nheId}/status
 *     200:  { status: NheStatus }
 *
 *   GET {baseUrl}/v1/nhes/{nheId}/inductions/pending
 *     200:  { tickets: DreamInductionTicket[] }
 *
 *   POST {baseUrl}/v1/inductions/{ticketId}/consume
 *     200:  DreamInductionTicket
 *
 *   Auth: `Authorization: Bearer <apiKey>` when `apiKey` is set.
 *
 * Note: writes (axiom mint, HIM register, ratify proposal, etc.) are
 * deliberately NOT in this surface — they require the Creator's
 * Ed25519 private key, which never travels over the network. Writes
 * stay on `LocalMaic` and are performed by the Creator's tooling.
 */
export class RemoteMaic implements MaicClient {
  readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(config: RemoteMaicConfig) {
    if (!config.baseUrl) {
      throw new Error("RemoteMaic: baseUrl is required");
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    this.fetchFn = config.fetch ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  /**
   * `reviewBehavior` is **fail-closed** (E4 — PROPOSED_DECISIONS.md). If the
   * remote service is unreachable, throw — no governance, no response.
   * The NHE will surface this as a refusal upstream.
   */
  async reviewBehavior(report: BehaviorReport): Promise<MaicVerdict> {
    return this.request<MaicVerdict>("POST", "/v1/behavior-review", report);
  }

  /**
   * `getNheStatus` defaults to **"active"** when unreachable (E4). The
   * Kardecist invariant: an unreachable governance doesn't kill the
   * spirit. Operators who want fail-closed on lifecycle should wrap with
   * a watchdog that hard-fails the deployment when the remote drops.
   */
  async getNheStatus(nheId: string): Promise<NheStatus> {
    try {
      const body = await this.request<{ status: NheStatus }>(
        "GET",
        `/v1/nhes/${encodeURIComponent(nheId)}/status`,
      );
      return body.status;
    } catch {
      return "active";
    }
  }

  /**
   * `listPendingInductions` is **fail-open** (E4). No inductions = NHE
   * skips them and continues the sleep cycle; this is best-effort by
   * design.
   */
  async listPendingInductions(nheId: string): Promise<DreamInductionTicket[]> {
    try {
      const body = await this.request<{ tickets: DreamInductionTicket[] }>(
        "GET",
        `/v1/nhes/${encodeURIComponent(nheId)}/inductions/pending`,
      );
      return body.tickets;
    } catch {
      return [];
    }
  }

  /**
   * `consumeInduction` is **fail-open** (E4). If the consume call fails, we
   * return a synthetic *pending* placeholder so the caller treats the
   * induction as still-unconsumed and re-tries on the next sleep cycle.
   *
   * The placeholder uses placeholder values (`nheId: "unknown"`, epoch
   * `createdAt`) so it is visibly synthetic in logs/audits, but the shape
   * is **strictly valid**: `status === "pending"` carries no
   * `cancelReason`/`cancelledAt`/`consumedAt`, which avoids the
   * shape-contradiction of a "pending ticket with a cancel reason".
   * Operators who need the transport-failure reason should observe the
   * underlying fetch error (e.g. via OpenTelemetry traces) rather than
   * trying to read it off the ticket.
   */
  async consumeInduction(ticketId: string): Promise<DreamInductionTicket> {
    try {
      return await this.request<DreamInductionTicket>(
        "POST",
        `/v1/inductions/${encodeURIComponent(ticketId)}/consume`,
      );
    } catch {
      return {
        id: ticketId,
        nheId: "unknown",
        intent: { scenario: "", desiredLearning: "", inducedBy: "maic" },
        status: "pending",
        createdAt: new Date(0).toISOString(),
      };
    }
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    if (body !== undefined) headers["content-type"] = "application/json";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const init: RequestInit = { method, headers, signal: controller.signal };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await this.fetchFn(url, init);
      if (!res.ok) {
        const text = await safeReadText(res);
        throw new Error(
          `RemoteMaic: HTTP ${res.status} ${res.statusText} on ${method} ${path}: ${text}`,
        );
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

async function safeReadText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "<unreadable>";
  }
}
