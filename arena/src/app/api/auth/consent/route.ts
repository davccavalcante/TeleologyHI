/**
 * `POST /api/auth/consent`
 *
 * Record the user's acceptance of the current consent policy. Bound to
 * the authenticated `userId` (from the `arena_session` cookie). Writes
 * the `ConsentRecord` onto the persisted `UserIdentity` and echoes it
 * back so the client can update its local state without re-fetching
 * `/api/auth/me`.
 *
 * Refuses (401) when the request is not authenticated. Refuses (400)
 * when the body lacks a non-empty `label` string. Per Entry 26 §9.5,
 * consent is GDPR-strict: no LLM call happens until this POST has
 * succeeded for the current `CURRENT_CONSENT_VERSION`.
 */
import { type NextRequest, NextResponse } from "next/server";
import { readSessionUserId } from "@/lib/auth/cookie";
import { loadUser, saveUser } from "@/lib/auth/store";
import { CURRENT_CONSENT_VERSION, ConsentRecord } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = readSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { label?: unknown };
  try {
    body = (await req.json()) as { label?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (label.length === 0) {
    return NextResponse.json({ error: "label_required" }, { status: 400 });
  }

  const user = await loadUser(userId);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 401 });
  }

  const consent: ConsentRecord = ConsentRecord.parse({
    version: CURRENT_CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
    label,
  });

  await saveUser({ ...user, consent });
  return NextResponse.json({ consent });
}
