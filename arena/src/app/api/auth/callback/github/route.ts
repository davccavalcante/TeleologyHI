/**
 * `GET /api/auth/callback/github`
 *
 * OAuth callback for the GitHub provider. The standard contract: GitHub
 * redirects the user here with `?code=...&state=...`. We:
 *
 *   1. Read the `arena_oauth_state` cookie that `/api/auth/login` set.
 *   2. Verify the HMAC signature and TTL of the state token.
 *   3. Compare the state from the URL against the cookie state (CSRF).
 *   4. Complete the sign-in via `GitHubAuthProvider.completeSignIn`.
 *   5. Set the `arena_session` cookie with the issued `userId`.
 *   6. Clear the `arena_oauth_state` cookie.
 *   7. Redirect the user back to `/`.
 *
 * If anything fails, redirect to `/?auth_error=<reason>` so the UI can
 * surface a banner. The reason is a short stable string — never the raw
 * exception message (which could leak internals).
 */
import { type NextRequest, NextResponse } from "next/server";
import { currentAuthProvider } from "@/lib/auth/provider";
import { verifyState } from "@/lib/auth/state";
import { setSessionCookie } from "@/lib/auth/cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "arena_oauth_state";

function errorRedirect(req: NextRequest, reason: string): NextResponse {
  const url = new URL("/", req.url);
  url.searchParams.set("auth_error", reason);
  const res = NextResponse.redirect(url);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state) return errorRedirect(req, "missing_code_or_state");
  if (!cookieState) return errorRedirect(req, "missing_state_cookie");

  try {
    verifyState(state);
  } catch {
    return errorRedirect(req, "invalid_state");
  }

  const provider = currentAuthProvider();
  if (provider.kind !== "github") {
    return errorRedirect(req, "provider_mismatch");
  }

  try {
    const result = await provider.completeSignIn({
      code,
      state,
      expectedState: cookieState,
    });
    const dest = new URL("/", req.url);
    const res = NextResponse.redirect(dest);
    setSessionCookie(res, result.cookieValue);
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch {
    // Silenced by E27-G directive: no error output anywhere on the request
    // lifecycle. The user-visible signal is the `?auth_error=exchange_failed`
    // query string on the redirect, which the ConsentBanner surfaces as a
    // generic retry hint without exposing internals.
    return errorRedirect(req, "exchange_failed");
  }
}
