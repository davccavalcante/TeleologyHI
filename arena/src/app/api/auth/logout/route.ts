/**
 * `POST /api/auth/logout`
 *
 * Clear the `arena_session` cookie. Does not delete the user record from
 * the store — sign-in again on the same provider account resumes the same
 * `userId` (Entry 26 §6: HIM is immortal; the user-side analogue is that
 * the `UserIdentity` persists across logouts).
 *
 * Method is POST (not GET) to prevent logout-by-prefetch and to make the
 * action explicit. The route handler echoes `{ ok: true }` so the client
 * can decide what to do next (typically: clear local state and redirect
 * to `/`).
 */
import { type NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
