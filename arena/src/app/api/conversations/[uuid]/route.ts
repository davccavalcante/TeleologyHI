/**
 * `/api/conversations/[uuid]`
 *
 * Per-conversation endpoint (E27-F).
 *
 *   - `GET`    → return the full `Conversation` (including all turns).
 *   - `DELETE` → permanently remove the conversation file from disk.
 *
 * Hard-privacy is enforced by `loadConversation(userId, uuid)`: the file
 * path itself is partitioned by `userId`, so a UUID issued for user A
 * cannot be resolved when authenticated as user B.
 */
import { type NextRequest, NextResponse } from "next/server";
import { readSessionUserId } from "@/lib/auth/cookie";
import { loadUser } from "@/lib/auth/store";
import { CURRENT_CONSENT_VERSION, type UserIdentity } from "@/lib/auth/types";
import {
  deleteConversation,
  loadConversation,
} from "@/lib/conversations/store";
import { isUuidV7 } from "@/lib/uuid-v7";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ uuid: string }>;
}

type AuthResult =
  | { kind: "error"; response: NextResponse }
  | { kind: "ok"; user: UserIdentity };

async function authenticate(req: NextRequest): Promise<AuthResult> {
  const userId = readSessionUserId(req);
  if (!userId) {
    return {
      kind: "error",
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }
  const user = await loadUser(userId);
  if (!user) {
    return {
      kind: "error",
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }
  if (!user.consent || user.consent.version !== CURRENT_CONSENT_VERSION) {
    return {
      kind: "error",
      response: NextResponse.json({ error: "consent_required" }, { status: 403 }),
    };
  }
  return { kind: "ok", user };
}

export async function GET(
  req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const auth = await authenticate(req);
  if (auth.kind === "error") return auth.response;

  const { uuid } = await params;
  if (!isUuidV7(uuid)) {
    return NextResponse.json({ error: "invalid_uuid" }, { status: 400 });
  }

  const conversation = await loadConversation(auth.user.userId, uuid);
  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ conversation });
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const auth = await authenticate(req);
  if (auth.kind === "error") return auth.response;

  const { uuid } = await params;
  if (!isUuidV7(uuid)) {
    return NextResponse.json({ error: "invalid_uuid" }, { status: 400 });
  }

  const removed = await deleteConversation(auth.user.userId, uuid);
  return NextResponse.json({ removed });
}
