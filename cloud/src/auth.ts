import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

/**
 * Bearer-token authorisation with **constant-time comparison**.
 *
 * The naive `Set.has(token)` approach used in v0.1.0-alpha.0 was timing-attack
 * vulnerable — V8's string hashing can leak length/prefix information across
 * iterations. This module uses `crypto.timingSafeEqual` against each accepted
 * token, with a fixed-length zero-buffer fallback when the candidate length
 * doesn't match, so a network observer cannot distinguish "wrong length",
 * "wrong prefix", and "wrong suffix" cases by timing alone.
 *
 * Security caveat: `timingSafeEqual` itself requires equal-length buffers.
 * We pad the candidate to each accepted token's length and run the compare
 * unconditionally, then OR-reduce the results — this preserves constant time
 * regardless of how many accepted tokens are configured (typically 1-10).
 */

/** True if `acceptedTokens` is empty AND `allowUnauthenticated` is true. */
export function isAuthDisabled(
  acceptedTokens: ReadonlySet<string>,
  allowUnauthenticated: boolean | undefined,
): boolean {
  return acceptedTokens.size === 0 && allowUnauthenticated === true;
}

/**
 * Validate the `Authorization` header of an incoming request against the
 * set of accepted bearer tokens. Returns `true` iff the header presents
 * `Bearer <t>` where `<t>` matches one of `acceptedTokens` byte-for-byte.
 *
 * Constant-time over the number of accepted tokens AND over the byte length
 * of the candidate token; a wrong-length candidate runs the same number of
 * compares as a right-length one.
 */
export function authorize(
  req: IncomingMessage,
  acceptedTokens: ReadonlySet<string>,
  allowUnauthenticated: boolean | undefined,
): boolean {
  if (isAuthDisabled(acceptedTokens, allowUnauthenticated)) return true;
  if (acceptedTokens.size === 0) return false; // empty set without opt-in = closed

  const header = req.headers["authorization"];
  if (typeof header !== "string") return false;
  const space = header.indexOf(" ");
  if (space < 0) return false;
  const scheme = header.slice(0, space);
  const token = header.slice(space + 1);
  if (scheme !== "Bearer" || token.length === 0) return false;

  return constantTimeTokenMatch(token, acceptedTokens);
}

/**
 * Constant-time membership check for `candidate` in `acceptedTokens`.
 * Performs one `timingSafeEqual` compare per accepted token, padding
 * `candidate` to each accepted token's length so wrong-length attempts
 * cost the same as right-length ones.
 */
export function constantTimeTokenMatch(
  candidate: string,
  acceptedTokens: ReadonlySet<string>,
): boolean {
  let any = false;
  const candidateBytes = Buffer.from(candidate, "utf8");
  for (const accepted of acceptedTokens) {
    const acceptedBytes = Buffer.from(accepted, "utf8");
    // Pad / truncate candidate to accepted's length so timingSafeEqual is
    // always callable with equal-length buffers. Truncation never produces
    // a false positive because we OR with a length-mismatch sentinel.
    const padded = Buffer.alloc(acceptedBytes.length, 0);
    candidateBytes.copy(padded, 0, 0, Math.min(candidateBytes.length, acceptedBytes.length));
    const equal = timingSafeEqual(padded, acceptedBytes);
    const sameLength = candidateBytes.length === acceptedBytes.length;
    // Both branches always run; `any` ORs the AND of both flags.
    any = any || (equal && sameLength);
  }
  return any;
}

/**
 * Detect whether the runtime environment looks like production. A truthy
 * result demands non-empty `acceptedTokens` — `startCloudFromEnv` refuses
 * to start otherwise, to prevent accidentally deploying a public server
 * without authentication.
 */
export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env["TELEOLOGYHI_ENV"] === "production") return true;
  if (env["NODE_ENV"] === "production") return true;
  return false;
}
