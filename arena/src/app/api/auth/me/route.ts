/**
 * `GET /api/auth/me`
 *
 * Resolve the current user from the `arena_session` cookie. Returns:
 *
 *   - 200 + the `UserIdentity` JSON (minus the optional `signature` field
 *     if present — kept simple for the first cut) when signed in.
 *   - 200 + `{ user: null }` when not signed in (client treats this as a
 *     prompt to show the login button — Entry 26 §9.5 hard-privacy gate).
 *
 * This endpoint is hit on every page load by the client so it must be
 * cheap. The user store is a single small JSON read.
 */
import { type NextRequest, NextResponse } from "next/server";
import { readSessionUserId } from "@/lib/auth/cookie";
import { loadUser } from "@/lib/auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = readSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ user: null });
  }
  const user = await loadUser(userId);
  if (!user) {
    // Cookie pointed at a user that no longer exists in the store.
    // Treat as unauthenticated; the client can drop the stale cookie on
    // the next request to /api/auth/logout.
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user });
}
