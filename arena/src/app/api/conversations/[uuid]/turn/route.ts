/**
 * `POST /api/conversations/[uuid]/turn`
 *
 * Append a new turn to an existing conversation (E27-F).
 *
 * Replaces the legacy `POST /api/round` endpoint. The contract change:
 *
 *   - The request body still carries `{ prompt }`.
 *   - The conversation context (previous turns) is loaded server-side
 *     from the conversation file and threaded into BOTH columns:
 *     - Raw column: prior turns flow into `rawGemini(prompt, history)`
 *       as `(userPrompt, modelResponse)` pairs.
 *     - Governed column: prior turns flow into `nhe.respond({ history })`
 *       as `{role: "user"|"assistant", content}` pairs, with the
 *       `sessionId` set to `conversationUuid` so NHE's recent-interaction
 *       buffer remains scoped to this conversation.
 *   - The first turn also REPLACES the placeholder title ("New
 *     conversation") with the derived first-prompt prefix.
 *
 * Auth + consent + hard-privacy gating mirrors the other endpoints.
 */
import { type NextRequest, NextResponse } from "next/server";
import { ulid } from "ulid";
import { rawGemini, type RawGeminiHistoryTurn } from "@/lib/gemini";
import { getTeleology } from "@/lib/teleology";
import { DEFAULT_GEMINI_MODEL, governedModelLabel } from "@/lib/constants";
import { readSessionUserId } from "@/lib/auth/cookie";
import { loadUser } from "@/lib/auth/store";
import { CURRENT_CONSENT_VERSION } from "@/lib/auth/types";
import {
  appendTurn,
  loadConversation,
  renameConversation,
} from "@/lib/conversations/store";
import { deriveTitle, type Turn } from "@/lib/conversations/types";
import { isUuidV7 } from "@/lib/uuid-v7";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNDERLYING_MODEL = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
const PLACEHOLDER_TITLE = "New conversation";

interface RouteContext {
  params: Promise<{ uuid: string }>;
}

interface PostBody {
  prompt?: string;
}

interface NheHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(
  req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const userId = readSessionUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const user = await loadUser(userId);
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (!user.consent || user.consent.version !== CURRENT_CONSENT_VERSION) {
      return NextResponse.json({ error: "consent_required" }, { status: 403 });
    }

    const { uuid } = await params;
    if (!isUuidV7(uuid)) {
      return NextResponse.json({ error: "invalid_uuid" }, { status: 400 });
    }

    const conversation = await loadConversation(user.userId, uuid);
    if (!conversation) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    let body: PostBody = {};
    try {
      body = (await req.json()) as PostBody;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt_required" }, { status: 400 });
    }

    // Build the multi-turn context for both columns from the prior turns.
    // The raw column sees prior raw responses; the governed column sees
    // prior governed responses. Mixing the two would conflate the
    // compared subjects.
    //
    // Audit fix F4 (history pollution): turns whose relevant-column
    // response came back empty (rotation exhausted, empty completion
    // unrecovered, etc.) are skipped entirely — both the user prompt
    // AND the empty assistant response of that turn are dropped from
    // history. Sending `parts: [{ text: "" }]` for a `role: "model"`
    // entry confuses the LLM (Gemini occasionally refuses to continue
    // when the prior assistant turn is empty), cascading the failure.
    // Pairing the user prompt with a working response from a later
    // turn would be even worse — it would misattribute the answer —
    // so dropping the whole pair is the conservative choice.
    const rawHistory: RawGeminiHistoryTurn[] = conversation.turns
      .filter((t) => t.left.response.trim().length > 0)
      .map((t) => ({
        userPrompt: t.prompt,
        modelResponse: t.left.response,
      }));
    const nheHistory: NheHistoryMessage[] = conversation.turns
      .filter((t) => t.right.response.trim().length > 0)
      .flatMap((t) => [
        { role: "user" as const, content: t.prompt },
        { role: "assistant" as const, content: t.right.response },
      ]);

    const teleology = getTeleology();
    const turnStart = Date.now();
    const at = new Date(turnStart).toISOString();

    // Promise.allSettled lets us tell apart "both sides reached the LLM"
    // from "the rotation pool exhausted on one or both sides".
    //
    // Posture (Creator directive — "fluido e natural"): the turn is
    // ALWAYS persisted and a 200 is ALWAYS returned, regardless of how
    // many sides rejected. The user's prompt stays visible in the
    // conversation; the failed side(s) render with an empty `response`
    // string (blank assistant bubble). Earlier cuts returned 503 on
    // total failure and asked the client to roll back, but that made
    // the user's message disappear after Send — visually it felt like
    // the screen had been reset. The current posture preserves the
    // user's input in the conversation and lets them re-prompt on a
    // fresh turn if both columns came back empty.
    const [leftSettled, rightSettled] = await Promise.allSettled([
      rawGemini(prompt, rawHistory),
      (async () => {
        const start = Date.now();
        const { nhe } = await teleology;
        const out = await nhe.respond({
          userPrompt: prompt,
          sessionId: conversation.conversationUuid,
          history: nheHistory,
        });
        const citedAxioms = [
          ...new Set([
            ...(out.preReviewVerdict.citedAxioms ?? []),
            ...(out.postReviewVerdict.citedAxioms ?? []),
          ]),
        ];
        return {
          model: governedModelLabel(UNDERLYING_MODEL),
          response: out.text,
          durationMs: Date.now() - start,
          kind: out.kind,
          verdict: out.postReviewVerdict.kind,
          preVerdict: out.preReviewVerdict.kind,
          refused: out.refused,
          citedAxioms,
        };
      })(),
    ]);

    const left =
      leftSettled.status === "fulfilled"
        ? leftSettled.value
        : {
            model: `${UNDERLYING_MODEL} (raw)`,
            response: "",
            durationMs: Date.now() - turnStart,
          };

    const right =
      rightSettled.status === "fulfilled"
        ? rightSettled.value
        : {
            model: governedModelLabel(UNDERLYING_MODEL),
            response: "",
            durationMs: Date.now() - turnStart,
          };

    const turn: Turn = {
      turnId: ulid(),
      at,
      prompt,
      left,
      right,
    };

    const updated = await appendTurn(user.userId, uuid, turn);

    // First turn: replace the placeholder title with the derived prefix.
    // We only touch the title when it is still the literal placeholder, so
    // a user-renamed conversation keeps their chosen title.
    let final = updated;
    if (updated.turns.length === 1 && updated.title === PLACEHOLDER_TITLE) {
      const renamed = await renameConversation(user.userId, uuid, deriveTitle(prompt));
      if (renamed) final = renamed;
    }

    return NextResponse.json({ conversation: final, turn });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
