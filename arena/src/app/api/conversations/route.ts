/**
 * `/api/conversations`
 *
 * Conversation collection endpoint (E27-F).
 *
 *   - `GET`  → list compact summaries (sidebar). Newest-first.
 *   - `POST` → create a new empty conversation. Server mints the UUID v7
 *              and returns the full `Conversation` shape (with empty
 *              `turns`). The client then immediately POSTs the first
 *              turn to `/api/conversations/{uuid}/turn`.
 *
 * Both methods require the `arena_session` cookie + a current
 * `CURRENT_CONSENT_VERSION`. Hard-privacy: the listing is partitioned by
 * `userId` at the filesystem layer.
 */
import { type NextRequest, NextResponse } from "next/server";
import { readSessionUserId } from "@/lib/auth/cookie";
import { loadUser } from "@/lib/auth/store";
import { CURRENT_CONSENT_VERSION, type UserIdentity } from "@/lib/auth/types";
import { defaultBirthPolicy, ensureHimOwnership } from "@/lib/birth-policy";
import {
  createConversation,
  listConversationSummaries,
} from "@/lib/conversations/store";
import { deriveTitle } from "@/lib/conversations/types";
import { uuidv7 } from "@/lib/uuid-v7";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticate(req);
  if (auth.kind === "error") return auth.response;
  const summaries = await listConversationSummaries(auth.user.userId);
  return NextResponse.json({ conversations: summaries });
}

interface CreateBody {
  /**
   * Optional title seed. When absent the conversation starts with a
   * placeholder title ("New conversation"); after the first turn is
   * appended, `appendTurnAndMaybeRetitle` (in the per-conversation
   * endpoint) replaces the title with the derived first-prompt prefix.
   */
  titleSeed?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticate(req);
  if (auth.kind === "error") return auth.response;
  const user = auth.user;

  let body: CreateBody = {};
  try {
    const raw = (await req.json()) as unknown;
    if (raw && typeof raw === "object") body = raw as CreateBody;
  } catch {
    // empty body is fine for the no-seed case.
  }

  const policy = defaultBirthPolicy(user);
  await ensureHimOwnership(user.userId, policy.himId);

  const conversationUuid = uuidv7();
  const at = new Date().toISOString();
  const initialTitle =
    body.titleSeed && body.titleSeed.trim().length > 0
      ? deriveTitle(body.titleSeed)
      : "New conversation";

  const conversation = await createConversation({
    conversationUuid,
    userId: user.userId,
    himId: policy.himId,
    title: initialTitle,
    at,
  });

  return NextResponse.json({ conversation });
}
