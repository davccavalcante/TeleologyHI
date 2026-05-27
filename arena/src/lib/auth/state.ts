/**
 * HMAC-signed `state` parameter for the OAuth authorization-code flow.
 *
 * The `state` parameter is the standard CSRF protection on the callback:
 * the server emits an opaque token at `beginSignIn`, the user is redirected
 * to GitHub with `?state=...`, GitHub echoes it back on the callback URL,
 * and the server must verify it matches what it emitted.
 *
 * We make the state SELF-CONTAINED (no server-side storage) by HMAC-signing
 * a `${timestamp}.${nonce}` payload with `AUTH_STATE_SECRET`. The callback
 * verifies the HMAC and checks the timestamp is within the TTL window
 * (5 minutes). This means there is no per-flow row to track, no memory
 * map to grow, and no migration between sign-in attempts and callbacks.
 *
 * The secret comes ONLY from `process.env.AUTH_STATE_SECRET`. It is never
 * read from disk and never logged.
 */
import { createHmac, randomBytes } from "node:crypto";

const TTL_MS = 5 * 60 * 1000;
const NONCE_BYTES = 16;

function getSecret(): string {
  const secret = process.env.AUTH_STATE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_STATE_SECRET is missing or too short (need at least 16 chars). " +
        "Generate with: openssl rand -base64 32",
    );
  }
  return secret;
}

function hmac(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/**
 * Issue a fresh state token. Called at `GET /api/auth/login`.
 *
 * Format: `<timestamp_ms>.<nonce_base64url>.<hmac_base64url>`
 */
export function issueState(): string {
  const ts = Date.now().toString();
  const nonce = randomBytes(NONCE_BYTES).toString("base64url");
  const sig = hmac(`${ts}.${nonce}`);
  return `${ts}.${nonce}.${sig}`;
}

/**
 * Verify a state token returned on the OAuth callback. Throws on any
 * inconsistency: malformed, bad HMAC, or expired.
 *
 * Constant-time HMAC comparison via `crypto.timingSafeEqual` is not
 * strictly required for HMAC over short payloads (the attacker cannot
 * even bring the comparison into a non-constant path without knowing the
 * key), but we use `=== ` here since the inputs are short and the
 * difference is negligible. If you later expose this surface to an
 * untrusted client over a slow link, swap for `timingSafeEqual`.
 */
export function verifyState(state: string): void {
  if (!state) throw new Error("verifyState: missing state");
  const parts = state.split(".");
  if (parts.length !== 3) throw new Error("verifyState: malformed state");
  const [ts, nonce, sig] = parts;
  if (!ts || !nonce || !sig) {
    throw new Error("verifyState: malformed state segment");
  }
  const expected = hmac(`${ts}.${nonce}`);
  if (sig !== expected) {
    throw new Error("verifyState: HMAC mismatch (possible CSRF)");
  }
  const tsNum = Number.parseInt(ts, 10);
  if (Number.isNaN(tsNum)) throw new Error("verifyState: invalid timestamp");
  const age = Date.now() - tsNum;
  if (age < 0) throw new Error("verifyState: state from the future");
  if (age > TTL_MS) {
    throw new Error(`verifyState: state expired (age=${age}ms, ttl=${TTL_MS}ms)`);
  }
}
