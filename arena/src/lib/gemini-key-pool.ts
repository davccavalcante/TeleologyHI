/**
 * Gemini API key rotation pool (E27-G, audit-hardened).
 *
 * Per the Creator's directive: `GEMINI_API_KEY` may carry several
 * comma-separated API keys. When one key fails (auth revoked, daily
 * quota exhausted, rate-limited beyond the back-off budget), the next
 * key in the pool takes over transparently. After the last key is
 * tried, the cursor wraps back to the first — so a key that has since
 * cooled down naturally gets another chance on the next request.
 *
 * Design contract:
 *
 *   - The pool is a process-wide singleton. The keys themselves are
 *     loaded once from the environment; the cursor records the index
 *     of the key that served the most recent successful call so the
 *     next request starts there (warm-cache bias). The pool state does
 *     not survive a process restart (no persistence to disk — the keys
 *     are env-only secrets).
 *   - The rotation is invisible to the user. The route handler never
 *     surfaces "the key failed, trying another" as a status; the only
 *     observable signal is a slightly higher latency for the affected
 *     turn.
 *   - The rotation never reorders the keys: the order in `.env.local`
 *     is the canonical pool order. Operators can curate this by
 *     placing their highest-quota keys first.
 *
 * Concurrency contract (audit fix F2):
 *
 *   The arena calls `generateWithRotation` from BOTH the raw-baseline
 *   column AND the governed-wrapper column in parallel
 *   (`Promise.allSettled([...])` inside the turn route handler). The
 *   first cut of this module exposed `currentKey()` + `rotate()` as
 *   separate mutating calls against the shared cursor — concurrent
 *   callers raced on the cursor, each `rotate()` advanced the cursor
 *   one position, and two parallel callers could double-advance past
 *   a viable key.
 *
 *   The audit-hardened API exposes `snapshot()` instead: each caller
 *   gets an isolated, immutable view `{ keys, startIndex }` at the
 *   moment of the call and iterates locally. The global cursor is
 *   updated only via `commitCursor(index)` after a key actually
 *   served a successful response, so a cooled-down key advances the
 *   "next request starts here" pointer naturally without racing
 *   between in-flight callers.
 *
 * Failure-class semantics (cf. `gemini-rotating-call.ts`):
 *
 *   - HTTP 401 / 403  → key-level failure → caller advances locally
 *   - HTTP 429        → key-level failure (quota) → caller advances locally
 *   - HTTP 5xx        → server-side failure → caller surfaces error;
 *                       a key is not at fault.
 *   - HTTP 400        → request-level failure UNLESS body says
 *                       "API key not valid", in which case the caller
 *                       treats it as a key-level failure.
 *   - Network error   → ambiguous → caller advances locally (defensive).
 *   - Empty 200       → audit fix F3: caller advances locally as if it
 *                       were a key-level failure (some keys/regions can
 *                       return blank candidates for `finishReason: SAFETY`
 *                       or `MAX_TOKENS` with no content parts; trying
 *                       another key occasionally recovers).
 */

const POOL_ENV_VAR = "GEMINI_API_KEY";

interface PoolState {
  keys: string[];
  cursor: number;
}

let cached: PoolState | undefined;

/**
 * Parse the pool from the environment. Idempotent: subsequent calls
 * return the cached state. Throws when no keys are configured — the
 * arena cannot operate without at least one Gemini key.
 */
function ensureLoaded(): PoolState {
  if (cached) return cached;
  const raw = process.env[POOL_ENV_VAR];
  if (!raw) {
    throw new Error(
      `${POOL_ENV_VAR} must be set in .env.local. Single key or several comma-separated keys are both accepted.`,
    );
  }
  const keys = raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (keys.length === 0) {
    throw new Error(
      `${POOL_ENV_VAR} is empty after trimming. Set at least one key.`,
    );
  }
  cached = { keys, cursor: 0 };
  return cached;
}

/**
 * Immutable view of the pool state at one moment in time. Returned by
 * `snapshot()` so concurrent callers can iterate locally without racing
 * on the shared cursor.
 */
export interface PoolSnapshot {
  /** Frozen copy of the configured keys, in canonical order. */
  readonly keys: readonly string[];
  /**
   * Index of the key the pool considers "warm" right now. Callers SHOULD
   * try this key first, then advance locally with `(startIndex + i) % length`
   * on each failure.
   */
  readonly startIndex: number;
}

/**
 * Snapshot the pool's current state. Each concurrent caller gets its
 * own snapshot; mutations to the global cursor between snapshot and
 * commit do not affect the iteration.
 */
export function snapshot(): PoolSnapshot {
  const pool = ensureLoaded();
  return {
    // Defensive freeze + copy: the pool is ~7 short strings, the cost
    // is negligible and it eliminates any chance of the caller mutating
    // the shared array.
    keys: Object.freeze([...pool.keys]),
    startIndex: pool.cursor,
  };
}

/**
 * Update the global cursor to point at the key that just served a
 * successful response. The next `snapshot()` call will use this index
 * as `startIndex`, so the warm key is tried first — a request whose
 * predecessor's quota was exhausted naturally migrates forward to a
 * still-good key without any cool-down logic.
 *
 * `index` is reduced modulo `poolSize()` defensively, so out-of-range
 * inputs do not desync the cursor.
 */
export function commitCursor(index: number): void {
  const pool = ensureLoaded();
  pool.cursor = ((index % pool.keys.length) + pool.keys.length) % pool.keys.length;
}

/**
 * Total number of keys in the pool. Callers can use this as a sweep
 * budget without invoking `snapshot()`.
 */
export function poolSize(): number {
  return ensureLoaded().keys.length;
}

/**
 * Test helper: reset the cached pool state. Intended for tests that
 * mutate `process.env[GEMINI_API_KEY]` between cases. NOT for
 * production code.
 */
export function _resetPoolCache(): void {
  cached = undefined;
}
