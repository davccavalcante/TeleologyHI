/**
 * Per-user conversation store on disk.
 *
 * Layout (E27-F, supersedes the per-round `.arena-store/rounds/` layout):
 *
 *   arena/.arena-store/users/{userId}/conversations/{conversationUuid}.json
 *
 * One file per conversation, holding the full `Conversation` shape including
 * all turns inline. Per-user partitioning makes the hard-privacy filter a
 * filesystem property rather than a runtime check: there is no path
 * `users/X/conversations/...` reachable when authenticated as user Y.
 *
 * Concurrency: writes use a `{path}.tmp` + `rename` pattern so the file is
 * never observed half-written from another reader. The arena is
 * single-process for now; the pattern is defensive against crash during
 * write, not against concurrent processes.
 *
 * Operations:
 *
 *   - `createConversation(input)` — mint a new UUID v7 and write the empty
 *     conversation (zero turns) so the sidebar can show "New conversation"
 *     immediately even before the first turn lands.
 *   - `loadConversation(userId, uuid)` — full read, returns `null` on miss.
 *   - `appendTurn(userId, uuid, turn)` — append + update `updatedAt`.
 *   - `listConversationSummaries(userId)` — for the sidebar.
 *   - `deleteConversation(userId, uuid)` — irreversible. Used by the
 *     forthcoming "delete chat" UI button.
 */
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Conversation, type ConversationSummary, type Turn } from "./types";

function userConversationsDir(userId: string): string {
  return resolve(process.cwd(), ".arena-store/users", userId, "conversations");
}

function conversationPath(userId: string, conversationUuid: string): string {
  return resolve(userConversationsDir(userId), `${conversationUuid}.json`);
}

async function writeAtomic(path: string, content: string): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, content, "utf-8");
  await rename(tmp, path);
}

interface CreateInput {
  conversationUuid: string;
  userId: string;
  himId: string;
  title: string;
  /** Initial timestamp (typically `new Date().toISOString()`). */
  at: string;
}

/**
 * Create and persist a new empty conversation. Caller mints the
 * `conversationUuid` (UUID v7) and the title.
 */
export async function createConversation(input: CreateInput): Promise<Conversation> {
  await mkdir(userConversationsDir(input.userId), { recursive: true });
  const conversation: Conversation = Conversation.parse({
    conversationUuid: input.conversationUuid,
    userId: input.userId,
    himId: input.himId,
    title: input.title,
    createdAt: input.at,
    updatedAt: input.at,
    turns: [],
  });
  await writeAtomic(
    conversationPath(input.userId, input.conversationUuid),
    JSON.stringify(conversation, null, 2),
  );
  return conversation;
}

/**
 * Load a conversation by `(userId, conversationUuid)`. Returns `null` on
 * miss (file absent or malformed). Malformed files are not thrown so a
 * single corrupt conversation cannot break the whole listing.
 */
export async function loadConversation(
  userId: string,
  conversationUuid: string,
): Promise<Conversation | null> {
  try {
    const raw = await readFile(conversationPath(userId, conversationUuid), "utf-8");
    return Conversation.parse(JSON.parse(raw));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") return null;
    return null;
  }
}

/**
 * Append a turn to the conversation and persist. Throws on missing
 * conversation — the caller (route handler) is expected to have already
 * verified existence via `loadConversation` or to be appending right after
 * `createConversation`.
 */
export async function appendTurn(
  userId: string,
  conversationUuid: string,
  turn: Turn,
): Promise<Conversation> {
  const current = await loadConversation(userId, conversationUuid);
  if (!current) {
    throw new Error(
      `appendTurn: conversation not found (userId=${userId}, conversationUuid=${conversationUuid})`,
    );
  }
  const next: Conversation = Conversation.parse({
    ...current,
    updatedAt: turn.at,
    turns: [...current.turns, turn],
  });
  await writeAtomic(
    conversationPath(userId, conversationUuid),
    JSON.stringify(next, null, 2),
  );
  return next;
}

/**
 * Replace the title (e.g. after a "rename conversation" UI action).
 */
export async function renameConversation(
  userId: string,
  conversationUuid: string,
  newTitle: string,
): Promise<Conversation | null> {
  const current = await loadConversation(userId, conversationUuid);
  if (!current) return null;
  const next: Conversation = Conversation.parse({
    ...current,
    title: newTitle,
  });
  await writeAtomic(
    conversationPath(userId, conversationUuid),
    JSON.stringify(next, null, 2),
  );
  return next;
}

/**
 * Delete a conversation file. Idempotent — returns `true` if removed,
 * `false` if it did not exist.
 */
export async function deleteConversation(
  userId: string,
  conversationUuid: string,
): Promise<boolean> {
  try {
    await rm(conversationPath(userId, conversationUuid), { force: false });
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") return false;
    throw err;
  }
}

/**
 * Return compact summaries (no turns) for the sidebar, newest-first.
 * Cheap enough at the scale we target (a single user has at most a few
 * hundred conversations).
 */
export async function listConversationSummaries(
  userId: string,
): Promise<ConversationSummary[]> {
  const dir = userConversationsDir(userId);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") return [];
    throw err;
  }

  const summaries: ConversationSummary[] = [];
  for (const file of entries) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(resolve(dir, file), "utf-8");
      const conv = Conversation.parse(JSON.parse(raw));
      summaries.push({
        conversationUuid: conv.conversationUuid,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        turnCount: conv.turns.length,
      });
    } catch {
      // Skip malformed files. A future cleanup task can prune them.
      continue;
    }
  }

  // Newest-first by `updatedAt`. Tie-break by `createdAt` (newer first).
  summaries.sort((a, b) => {
    const cmp = b.updatedAt.localeCompare(a.updatedAt);
    if (cmp !== 0) return cmp;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return summaries;
}
