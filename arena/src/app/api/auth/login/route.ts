/**
 * `GET /api/auth/login`
 *
 * Initiates the OAuth flow. Issues a fresh HMAC-signed `state` token,
 * stores it in a short-lived httpOnly cookie (`arena_oauth_state`), and
 * redirects the user to the provider's authorize URL.
 *
 * The cookie is consumed exactly once by `/api/auth/callback/<provider>`
 * and cleared there.
 */
import { type NextRequest, NextResponse } from "next/server";
import { currentAuthProvider } from "@/lib/auth/provider";
import { issueState } from "@/lib/auth/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "arena_oauth_state";
const STATE_COOKIE_MAX_AGE_SECONDS = 5 * 60;

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const state = issueState();
  const provider = currentAuthProvider();
  const redirectTarget = await provider.beginSignIn(state);

  const res = NextResponse.redirect(redirectTarget);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}
