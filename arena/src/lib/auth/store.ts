/**
 * Per-user identity store on disk.
 *
 * Layout (Entry 26 §9 item 5):
 *
 *   arena/.arena-store/users/{userId}.json   <- one file per user
 *
 * The file content is a serialised `UserIdentity` (see `types.ts`). The
 * store is intentionally simple — flat JSON, one file per user — because
 * the arena's per-user scale is small (developer + a few collaborators)
 * and Entry 26 mandates that any future migration be additive.
 *
 * Concurrency: writes use `writeFile` with a temp-and-rename pattern. The
 * arena is single-process, so racing writes are not expected in practice;
 * the temp-rename is defensive against partial writes during crash.
 */
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ulid } from "ulid";
import { UserIdentity } from "./types";

const USERS_DIR = resolve(process.cwd(), ".arena-store/users");

async function ensureDir(): Promise<void> {
  await mkdir(USERS_DIR, { recursive: true });
}

function pathFor(userId: string): string {
  return resolve(USERS_DIR, `${userId}.json`);
}

/**
 * Issue a new unique `userId` (ULID). Called once at first sign-in for a
 * given provider + providerUserId combination.
 */
export function mintUserId(): string {
  return ulid();
}

/**
 * Persist a `UserIdentity` record. Overwrites any existing record for the
 * same `userId` — callers MUST resolve uniqueness via `findByProvider`
 * before minting a new `userId`.
 */
export async function saveUser(identity: UserIdentity): Promise<void> {
  await ensureDir();
  const parsed = UserIdentity.parse(identity);
  const path = pathFor(parsed.userId);
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(parsed, null, 2), "utf-8");
  await rename(tmp, path);
}

/**
 * Load a user by their internal `userId`. Returns `null` when not found.
 */
export async function loadUser(userId: string): Promise<UserIdentity | null> {
  try {
    const raw = await readFile(pathFor(userId), "utf-8");
    return UserIdentity.parse(JSON.parse(raw));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Find an existing user by `(provider, providerUserId)`. Returns `null`
 * when no user has signed in with this provider account before. Used by
 * the OAuth callback to decide between "issue new userId" and "refresh
 * lastSeenAt on existing user".
 */
export async function findByProvider(
  provider: string,
  providerUserId: string,
): Promise<UserIdentity | null> {
  await ensureDir();
  let entries: string[];
  try {
    entries = await readdir(USERS_DIR);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") return null;
    throw err;
  }
  for (const file of entries) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(resolve(USERS_DIR, file), "utf-8");
      const candidate = UserIdentity.parse(JSON.parse(raw));
      if (
        candidate.provider === provider &&
        candidate.providerUserId === providerUserId
      ) {
        return candidate;
      }
    } catch {
      // Skip malformed files. A future cleanup task can prune them.
      continue;
    }
  }
  return null;
}

/**
 * List every user id known to the store. Used for diagnostics and for the
 * future directory feature (Entry 26 §7 stage 2). Does NOT load the full
 * UserIdentity for each — callers should `loadUser` on demand.
 */
export async function listUserIds(): Promise<string[]> {
  await ensureDir();
  try {
    const entries = await readdir(USERS_DIR);
    return entries
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") return [];
    throw err;
  }
}
