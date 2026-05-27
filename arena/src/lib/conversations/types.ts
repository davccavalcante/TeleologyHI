/**
 * Conversation + Turn schemas for the multi-turn arena (E27-F).
 *
 * Per the architectural decision documented in `MAIC_HIM_NHE_INTERVIEW_LOG.md`
 * Entry 27 (the forthcoming E27-E follow-up), the arena moves from a
 * round-as-base-unit model to a conversation-as-base-unit model, mirroring
 * the Claude/ChatGPT paradigm:
 *
 *   - One Conversation holds N Turns in chronological order.
 *   - The conversation is identified by a UUID v7 (`conversationUuid`),
 *     which is time-ordered like a ULID but uses the universally-supported
 *     RFC 9562 format.
 *   - Each Turn carries its own ULID (`turnId`) for internal references,
 *     plus a server-side timestamp.
 *   - Both columns (raw + governed) operate on the same conversation
 *     context: the second turn sees turn 1 as history, the third sees
 *     turns 1+2, etc. The LLM produces continuations, not isolated
 *     replies — the same behaviour as Claude / ChatGPT / Grok.
 *
 * Hard-privacy (Entry 26 §7 stage 1) is enforced at the store layer: each
 * conversation file lives under `.arena-store/users/{userId}/conversations/`,
 * so a malicious caller cannot list another user's conversations by guessing
 * UUIDs — the lookup path itself is gated by the authenticated `userId`.
 *
 * The `himId` is stamped onto the conversation at creation time. Future
 * cuts (E27 follow-up: multi-HIM per user) may add an `availableHims` field
 * to the conversation summary so the user can pick which spirit hosts the
 * governed reply; for the current cut every user has exactly one HIM
 * (`him.legal-consulting.lex`).
 */
import { z } from "zod";

/**
 * Maximum number of characters used from the first prompt to derive the
 * conversation title (sidebar display). Mirrors Claude's first-N-chars
 * convention. Bump this if titles look truncated too aggressively.
 */
export const TITLE_CHAR_LIMIT = 60;

/**
 * Schema for one turn — a single (prompt, raw response, governed response)
 * triplet. Persisted as a member of `Conversation.turns[]`, never on its
 * own file. The triplet is symmetric: both columns see the same `prompt`
 * and run in parallel.
 */
export const Turn = z.object({
  /** ULID, time-ordered. Issued server-side when the turn is appended. */
  turnId: z.string().min(1),
  /** ISO-8601 UTC timestamp when the turn started processing. */
  at: z.string().datetime(),
  prompt: z.string().min(1),
  left: z.object({
    /** Underlying LLM model id, e.g. `gemini-3.1-flash-lite`. */
    model: z.string().min(1),
    response: z.string(),
    durationMs: z.number().int().nonnegative(),
  }),
  right: z.object({
    /** Governed-wrapper model label, e.g. `TeleologyHI → gemini-3.1-flash-lite`. */
    model: z.string().min(1),
    response: z.string(),
    durationMs: z.number().int().nonnegative(),
    /** `RespondKind`: `"ok" | "regular" | "redirect" | "refused"`. */
    kind: z.string().optional(),
    /** Post-review verdict kind: `"approve" | "warn" | "deny" | …`. */
    verdict: z.string().optional(),
    /** Pre-review verdict kind (exposed when it diverges from `verdict`). */
    preVerdict: z.string().optional(),
    /** True when the NHE refused to participate. */
    refused: z.boolean().optional(),
    /** Axiom IDs cited by HIM at either pre or post review. */
    citedAxioms: z.array(z.string()).optional(),
  }),
});
export type Turn = z.infer<typeof Turn>;

/**
 * Full conversation record persisted as a single JSON file. Holds all turns
 * inline; for the per-user scale we expect (developer + a handful of
 * collaborators with < 1000 turns per conversation each) this is the right
 * trade-off vs splitting turns into separate files.
 */
export const Conversation = z.object({
  /** UUID v7. Used in URLs and as the file name on disk. */
  conversationUuid: z.string().min(1),
  /** Owner of the conversation. Hard-privacy partition key (Entry 26 §7). */
  userId: z.string().min(1),
  /** HIM that hosts the governed replies for this conversation. */
  himId: z.string().min(1),
  /** Display title for the sidebar. Derived from the first prompt's first ~60 chars. */
  title: z.string().min(1),
  /** ISO-8601 UTC timestamp of conversation creation (first turn). */
  createdAt: z.string().datetime(),
  /** ISO-8601 UTC timestamp of the most recent turn. */
  updatedAt: z.string().datetime(),
  /** Turns in chronological order (oldest first). */
  turns: z.array(Turn),
});
export type Conversation = z.infer<typeof Conversation>;

/**
 * Compact projection returned by `GET /api/conversations` for the sidebar.
 * Does NOT include the full turn array — the sidebar only needs identity,
 * title, timestamps, and turn count to render.
 */
export const ConversationSummary = z.object({
  conversationUuid: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  turnCount: z.number().int().nonnegative(),
});
export type ConversationSummary = z.infer<typeof ConversationSummary>;

/**
 * Derive a sidebar title from the first prompt. Trims, collapses internal
 * whitespace, and truncates to `TITLE_CHAR_LIMIT` characters (adding an
 * ellipsis when truncated). Mirrors the Claude/ChatGPT convention.
 */
export function deriveTitle(firstPrompt: string): string {
  const normalised = firstPrompt.trim().replace(/\s+/g, " ");
  if (normalised.length <= TITLE_CHAR_LIMIT) return normalised;
  return `${normalised.slice(0, TITLE_CHAR_LIMIT - 1).trimEnd()}…`;
}
