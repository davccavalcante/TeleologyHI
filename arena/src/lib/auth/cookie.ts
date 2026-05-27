/**
 * Cookie helpers for the arena auth flow.
 *
 * The arena issues exactly one auth cookie: `arena_session`, an httpOnly
 * SameSite=Lax cookie carrying the user's `userId` (ULID). On every API
 * request the route handler reads this cookie, resolves the `UserIdentity`
 * from `arena/.arena-store/users/{userId}.json`, and uses it to enforce
 * hard-privacy filters (Entry 26 §7 stage 1).
 *
 * The cookie value is NOT a JWT and NOT a signed token: we keep server-side
 * the only source of truth (the user store) and treat the cookie as an
 * opaque session pointer. If the cookie is tampered with, the store lookup
 * fails closed and the user is treated as unauthenticated.
 */
import type { NextRequest, NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "arena_session";

/** Default cookie lifetime: 30 days. Renewed on each successful request. */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

interface CookieAttributes {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

function attributes(): CookieAttributes {
  return {
    httpOnly: true,
    sameSite: "lax",
    // `secure: true` requires HTTPS. Localhost dev uses HTTP, so we relax
    // it in development. Production deployments MUST be HTTPS.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  };
}

/**
 * Read the `userId` from the incoming request cookie. Returns `null` when
 * the cookie is absent or empty (the route handler treats this as
 * unauthenticated).
 */
export function readSessionUserId(req: NextRequest): string | null {
  const raw = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!raw || raw.length === 0) return null;
  return raw;
}

/**
 * Set the session cookie on the response. Used by the OAuth callback after
 * a successful sign-in and by any handler that wants to refresh the cookie.
 */
export function setSessionCookie(res: NextResponse, userId: string): void {
  res.cookies.set(AUTH_COOKIE_NAME, userId, attributes());
}

/**
 * Clear the session cookie. Used by the logout endpoint.
 */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(AUTH_COOKIE_NAME, "", { ...attributes(), maxAge: 0 });
}
