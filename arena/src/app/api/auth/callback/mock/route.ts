/**
 * `GET /api/auth/callback/mock`
 *
 * OAuth callback for the `MockAuthProvider` (dev-only stub). Mirrors the
 * GitHub callback shape but accepts the locally-generated `mock-{state}`
 * code. Used by automated smoke tests and by the developer for quick
 * local iterations when GitHub OAuth is not yet wired.
 *
 * Refuses to run when the selected provider is anything other than `mock`.
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
  if (provider.kind !== "mock") {
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
    // query string on the redirect.
    return errorRedirect(req, "exchange_failed");
  }
}
