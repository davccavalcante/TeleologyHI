import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { LocalMaic } from "@teleologyhi-sdk/maic";
import { authorize, isAuthDisabled, isProductionEnv } from "./auth.js";
import {
  BehaviorReviewRequestSchema,
  type CloudConfig,
  type CloudHandle,
} from "./types.js";

/**
 * Start the HTTP server. The endpoints satisfy the `RemoteMaic` wire
 * contract in `@teleologyhi-sdk/maic`:
 *
 *   POST /v1/behavior-review
 *   GET  /v1/nhes/{nheId}/status
 *   GET  /v1/nhes/{nheId}/inductions/pending
 *   POST /v1/inductions/{ticketId}/consume
 *
 * Plus a couple of operational endpoints:
 *
 *   GET  /healthz         — liveness probe (no auth)
 *   GET  /                — minimal landing JSON (no auth)
 *
 * Every authenticated payload is validated against the canonical zod
 * schemas re-exported from `@teleologyhi-sdk/maic` via `./types.js` — a
 * malformed body NEVER reaches the backing `MaicClient`.
 *
 * Bearer-token comparison goes through `crypto.timingSafeEqual` via
 * `./auth.js` — `Set.has(token)` (the v0.1 pattern) leaked timing.
 */
export async function startCloud(config: CloudConfig): Promise<CloudHandle> {
  const port = config.port ?? 8787;
  const host = config.host ?? "0.0.0.0";

  if (isAuthDisabled(config.acceptedTokens, config.allowUnauthenticated)) {
    process.stderr.write(
      "[@teleologyhi-sdk/cloud] WARN: authentication DISABLED " +
        "(acceptedTokens is empty AND allowUnauthenticated=true). " +
        "Only use this for local smoke tests; NEVER deploy a public " +
        "server this way.\n",
    );
  }

  const server = createServer((req, res) => {
    handle(req, res, config).catch((err) => {
      sendJson(res, 500, {
        error: "internal",
        detail: (err as Error).message,
      });
    });
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;

  return {
    server,
    url,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  config: CloudConfig,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = req.method ?? "GET";

  if (method === "GET" && path === "/healthz") {
    return sendJson(res, 200, { ok: true });
  }
  if (method === "GET" && path === "/") {
    return sendJson(res, 200, {
      service: "@teleologyhi-sdk/cloud",
      docs: "https://teleologyhi.com",
      endpoints: [
        "POST /v1/behavior-review",
        "GET  /v1/nhes/:nheId/status",
        "GET  /v1/nhes/:nheId/inductions/pending",
        "POST /v1/inductions/:ticketId/consume",
      ],
    });
  }

  if (!authorize(req, config.acceptedTokens, config.allowUnauthenticated)) {
    return sendJson(res, 401, { error: "unauthorized" });
  }

  if (method === "POST" && path === "/v1/behavior-review") {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      return sendJson(res, 400, {
        error: "bad_request",
        detail: (err as Error).message,
      });
    }
    const parsed = BehaviorReviewRequestSchema.safeParse(body);
    if (!parsed.success) {
      return sendJson(res, 400, {
        error: "invalid_behavior_report",
        issues: parsed.error.issues.map(
          (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
        ),
      });
    }
    const verdict = await config.maic.reviewBehavior(parsed.data);
    return sendJson(res, 200, verdict);
  }

  const statusMatch = path.match(/^\/v1\/nhes\/([^/]+)\/status$/);
  if (method === "GET" && statusMatch) {
    const nheId = decodeURIComponent(statusMatch[1] ?? "");
    const status = await config.maic.getNheStatus(nheId);
    return sendJson(res, 200, { status });
  }

  const inductionsMatch = path.match(
    /^\/v1\/nhes\/([^/]+)\/inductions\/pending$/,
  );
  if (method === "GET" && inductionsMatch) {
    const nheId = decodeURIComponent(inductionsMatch[1] ?? "");
    const tickets = await config.maic.listPendingInductions(nheId);
    return sendJson(res, 200, { tickets });
  }

  const consumeMatch = path.match(/^\/v1\/inductions\/([^/]+)\/consume$/);
  if (method === "POST" && consumeMatch) {
    const ticketId = decodeURIComponent(consumeMatch[1] ?? "");
    const ticket = await config.maic.consumeInduction(ticketId);
    return sendJson(res, 200, ticket);
  }

  return sendJson(res, 404, { error: "not_found", path, method });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
    if (totalBytes(chunks) > 1024 * 1024) {
      throw new Error("payload too large (>1MB)");
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  return JSON.parse(text);
}

function totalBytes(chunks: Buffer[]): number {
  let n = 0;
  for (const c of chunks) n += c.length;
  return n;
}

function sendJson(res: ServerResponse, code: number, body: unknown): void {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

/**
 * Convenience helper for the canonical Creator deployment: open a
 * `LocalMaic` against the configured storeDir + creator public key,
 * derive accepted tokens from the env, and start the server.
 *
 * Production safety: when `TELEOLOGYHI_ENV=production` (or `NODE_ENV=production`)
 * the helper refuses to start if `TELEOLOGYHI_TOKENS` is empty —
 * accidental anonymous-access deploys are rejected at boot.
 */
export async function startCloudFromEnv(): Promise<CloudHandle> {
  const storeDir = process.env["TELEOLOGYHI_STORE_DIR"];
  const creatorPublicKey = process.env["TELEOLOGYHI_CREATOR_PUBLIC_KEY"];
  const tokens = (process.env["TELEOLOGYHI_TOKENS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const port = process.env["PORT"] ? Number(process.env["PORT"]) : undefined;
  const host = process.env["HOST"];
  const allowUnauthenticated =
    process.env["TELEOLOGYHI_ALLOW_UNAUTHENTICATED"] === "true";

  if (!storeDir) {
    throw new Error("TELEOLOGYHI_STORE_DIR must be set");
  }
  if (!creatorPublicKey) {
    throw new Error(
      "TELEOLOGYHI_CREATOR_PUBLIC_KEY must be set (base64url string from CreatorKeyring.publicKey())",
    );
  }
  if (tokens.length === 0 && !allowUnauthenticated) {
    throw new Error(
      "TELEOLOGYHI_TOKENS must be set to a non-empty comma-separated list. " +
        "To run without authentication (smoke tests only), set " +
        "TELEOLOGYHI_ALLOW_UNAUTHENTICATED=true explicitly.",
    );
  }
  if (tokens.length === 0 && allowUnauthenticated && isProductionEnv()) {
    throw new Error(
      "Refusing to start without authentication: " +
        "TELEOLOGYHI_ALLOW_UNAUTHENTICATED=true is forbidden when " +
        "TELEOLOGYHI_ENV=production or NODE_ENV=production. " +
        "Set TELEOLOGYHI_TOKENS to a non-empty value before deploying.",
    );
  }

  const maic = await LocalMaic.open({
    storeDir,
    creatorPublicKey,
  });

  const cfg: CloudConfig = {
    maic,
    acceptedTokens: new Set(tokens),
    ...(allowUnauthenticated ? { allowUnauthenticated: true } : {}),
    ...(port !== undefined ? { port } : {}),
    ...(host !== undefined ? { host } : {}),
  };
  return startCloud(cfg);
}
