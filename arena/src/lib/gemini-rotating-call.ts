/**
 * Gemini REST call with automatic key rotation (E27-G, audit-hardened).
 *
 * This module replaces direct `@google/genai` SDK usage for ANY Gemini
 * call the arena makes, so both the raw-baseline column and the
 * governed-wrapper column share the same key-rotation pool. The
 * underlying transport is `fetch` against the Generative Language REST
 * API (`v1beta`), the same endpoint family the `GeminiAdapter`
 * publishes inside `@teleologyhi-sdk/nhe`.
 *
 * The single entry point `generateWithRotation` takes a request payload
 * and tries each pool key once before giving up. Key-level failures
 * (401, 403, 429, ambiguous network errors, malformed-key 400) trigger
 * a local advance to the next key; request-level failures (400 that
 * are not key-related, 5xx) and unrecoverable errors surface
 * immediately.
 *
 * Audit fix F2 (pool race): the previous cut shared the cursor across
 * concurrent callers via `currentKey()` + `rotate()`. With the arena's
 * parallel raw + governed columns calling this in parallel, the two
 * threads ping-ponged the cursor and skipped viable keys. The current
 * cut snapshots `{ keys, startIndex }` at call entry via the pool's
 * `snapshot()` API and iterates locally; the global cursor is only
 * advanced via `commitCursor(index)` after a key serves a successful
 * response.
 *
 * Audit fix F3 (empty completion): when the Generative Language API
 * returns 200 OK but the candidates' content has no text parts (e.g.
 * `finishReason: "SAFETY"` or `MAX_TOKENS` cut before any token was
 * emitted), the first cut returned `text: ""` to the caller without
 * any error. The route handler then persisted an empty assistant
 * bubble — visually equivalent to the rotation-exhausted case but
 * caused by model behavior, not key state. The current cut throws
 * `EmptyCompletionError` from `callOnce`, the loop treats it as
 * key-equivalent and advances locally to give a different key a shot
 * before surfacing the empty result.
 */
import { commitCursor, poolSize, snapshot } from "./gemini-key-pool";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Single-turn or multi-turn content payload accepted by the REST API.
 * Mirrors the canonical `contents` shape Gemini expects.
 */
export interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

export interface GeminiRotatingRequest {
  /** Model id (e.g. `gemini-3.1-flash-lite`). */
  model: string;
  /** Conversation contents (multi-turn). */
  contents: GeminiContent[];
  /** Optional system instruction. Mapped to `systemInstruction.parts[0].text`. */
  system?: string;
  /** Optional generation config. */
  maxOutputTokens?: number;
}

export interface GeminiRotatingResponse {
  /** Concatenated text from all candidate parts. Never empty (audit fix F3). */
  text: string;
  /** Token counts as reported by the API, or 0 when missing. */
  tokensIn: number;
  tokensOut: number;
  /** Index of the pool key that successfully served this call (0-based). */
  keyIndex: number;
}

/**
 * HTTP status codes that always indicate a key-level problem rather
 * than a request-level or server-level problem. Rotation is always
 * appropriate for these codes.
 */
const KEY_FAILURE_STATUSES = new Set([401, 403, 429]);

/**
 * Heuristic for HTTP `400` responses. Google's Generative Language API
 * returns `400 Bad Request` with the message `"API key not valid"`
 * (and `error.status: "INVALID_ARGUMENT"`) when the api key itself is
 * malformed, expired, revoked, or simply wrong. We MUST rotate on
 * those, even though the canonical semantic of 400 is "request-level
 * failure". Other 400s (prompt too long, content blocked by safety,
 * malformed JSON) still surface immediately.
 */
function looksLikeInvalidKeyAt400(detail: string): boolean {
  const lower = detail.toLowerCase();
  return (
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key expired") ||
    lower.includes("api key is invalid")
  );
}

class KeyFailureError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "KeyFailureError";
  }
}

/**
 * Audit fix F3: thrown when a 200 OK response carries no text in any
 * candidate part. Treated by the loop as a key-equivalent failure so
 * another key gets a shot before the caller is forced to deal with
 * `text: ""`.
 *
 * Causes observed in practice:
 *   - `finishReason: "SAFETY"` with `content.parts` absent.
 *   - `finishReason: "MAX_TOKENS"` reached before any token was emitted
 *     (extremely small `maxOutputTokens` or a model that started with
 *     a long internal reasoning trace).
 *   - `finishReason: "OTHER"` (model-level refusal of unknown class).
 */
class EmptyCompletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyCompletionError";
  }
}

interface GeminiApiErrorShape {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface GeminiApiResponseShape {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

async function callOnce(
  apiKey: string,
  req: GeminiRotatingRequest,
): Promise<GeminiRotatingResponse> {
  const url = `${BASE_URL}/models/${encodeURIComponent(req.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body: Record<string, unknown> = {
    contents: req.contents,
  };
  if (req.system) {
    body.systemInstruction = { parts: [{ text: req.system }] };
  }
  if (req.maxOutputTokens) {
    body.generationConfig = { maxOutputTokens: req.maxOutputTokens };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const status = res.status;
    let detail = "";
    try {
      const errBody = (await res.json()) as GeminiApiErrorShape;
      detail = errBody.error?.message ?? "";
    } catch {
      // ignore — error body not JSON
    }
    const message = `Gemini API ${status}${detail ? `: ${detail}` : ""}`;
    if (KEY_FAILURE_STATUSES.has(status)) {
      throw new KeyFailureError(status, message);
    }
    // Google returns 400 INVALID_ARGUMENT for invalid keys — treat
    // those specifically as key-level failures so the pool rotates.
    if (status === 400 && looksLikeInvalidKeyAt400(detail)) {
      throw new KeyFailureError(status, message);
    }
    throw new Error(message);
  }

  const json = (await res.json()) as GeminiApiResponseShape;
  const candidate = json.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("");
  const tokensIn = json.usageMetadata?.promptTokenCount ?? 0;
  const tokensOut = json.usageMetadata?.candidatesTokenCount ?? 0;

  // Audit fix F3: detect a 200-with-no-text case and surface it so the
  // rotating loop can advance to the next key. The model occasionally
  // returns blank candidates for `finishReason: "SAFETY" | "MAX_TOKENS"
  // | "OTHER"`. Returning silently here was the smoking gun behind the
  // empty-bubble UI bug; the route handler had no signal to distinguish
  // "model gave nothing" from "all keys exhausted".
  if (text.trim().length === 0) {
    const reason = candidate?.finishReason ?? "no_content";
    throw new EmptyCompletionError(
      `Gemini returned no text (finishReason=${reason})`,
    );
  }

  return { text, tokensIn, tokensOut, keyIndex: 0 /* set by caller */ };
}

/**
 * Execute the request, advancing through the key pool on key-level
 * failures (`400` with `"API key not valid"`, `401`, `403`, `429`),
 * ambiguous network errors, and empty completions.
 *
 * Per the Creator's directive ("se a última chave falhar, volta a
 * tentar a primeira"), the loop performs **two full sweeps** of the
 * pool before surfacing the last failure: the first sweep tries every
 * key once starting from `startIndex`; the second sweep returns to
 * `startIndex` and gives any cooled-down key a second chance.
 *
 * The cap at 2 sweeps is a safety net against infinite loops — if a
 * key was rate-limited in the first sweep, it is statistically very
 * unlikely to be available again within the same request's lifetime.
 * Subsequent user requests benefit from the cursor's natural advance
 * (`commitCursor` on success), so a key that has since recovered will
 * serve them.
 *
 * The user-facing latency penalty per advance is one extra HTTP round
 * trip. The route handler does NOT surface "advanced key" as a status —
 * the only observable signal is the slightly higher `durationMs` field
 * on the affected turn.
 */
export async function generateWithRotation(
  req: GeminiRotatingRequest,
): Promise<GeminiRotatingResponse> {
  // Audit fix F2 (pool race): snapshot the pool state ONCE at call
  // entry. Concurrent callers each get their own immutable view, so
  // there is no race on the shared cursor while iterating.
  const { keys, startIndex } = snapshot();
  const n = keys.length;
  if (n === 0) {
    throw new Error("gemini-rotating-call: pool is empty");
  }
  const maxAttempts = n * 2;
  let lastErr: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const idx = (startIndex + attempt) % n;
    const key = keys[idx];
    if (!key) {
      // Defensive: snapshot guarantees non-empty entries, but TS sees
      // the array index as `string | undefined`.
      continue;
    }
    try {
      const result = await callOnce(key, req);
      // Success — commit the cursor so the next request starts here.
      // Other in-flight callers are unaffected; their snapshots are
      // independent of the global cursor.
      commitCursor(idx);
      return { ...result, keyIndex: idx };
    } catch (err) {
      lastErr = err as Error;
      if (err instanceof KeyFailureError) {
        // Key-level failure: continue to the next key in our local sweep.
        continue;
      }
      if (err instanceof EmptyCompletionError) {
        // Audit fix F3: blank 200 OK. Treat as key-equivalent. Some
        // keys / regions return SAFETY/MAX_TOKENS empties at higher
        // rates; rotating once before giving up costs at most one
        // extra HTTP round-trip.
        continue;
      }
      // Network errors with no HTTP status are ambiguous. We advance
      // defensively but do not loop forever — `maxAttempts` enforces
      // the budget.
      const looksNetwork =
        err instanceof TypeError ||
        (err as { code?: string }).code === "ECONNRESET" ||
        (err as { code?: string }).code === "ENOTFOUND";
      if (looksNetwork) {
        continue;
      }
      // Non-key, non-network, non-empty: surface immediately.
      throw err;
    }
  }

  throw lastErr ?? new Error("generateWithRotation: exhausted pool with no recorded error");
}

// Re-export `poolSize` for callers that want to size their own budgets
// (e.g. tests verifying the sweep count).
export { poolSize };
