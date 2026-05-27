/**
 * `BirthPolicy` — the developer-defined surface that controls which HIMs may
 * be summoned for a given user (Entry 26 §2: birth is a hybrid decision
 * between developer policy and MAIC routing).
 *
 * This is the minimal skeleton for E27-C-essential. The full per-user
 * multi-HIM directory (where each user owns several specialised HIMs across
 * contexts) is deferred to a follow-up cut explicitly named in Entry 27.
 * For now, every authenticated user is routed to the single canonical HIM
 * `him.legal-consulting.lex`, the same singleton the v1.0.0-trinity arena
 * already exposes. The policy interface, however, is in place so the
 * follow-up can plug richer rules without touching the API routes.
 *
 * Operationally:
 *
 *   - `defaultBirthPolicy(user)` returns the canonical HIM and the
 *     operatorContext the arena binds it to. This is the only policy in
 *     this cut.
 *   - The per-user HIM directory is persisted at
 *     `.arena-store/users/{userId}/hims-owned.json` (a simple list of HIM
 *     ids the user counterpart-owns). For now every user's list resolves
 *     to `[him.legal-consulting.lex]` after the first round.
 *   - The MAIC routing decision (summon-new vs reincarnate-existing) is
 *     surfaced as a noop here because we only have one HIM globally. The
 *     follow-up cut will turn `routeOrSummon` into a real router.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { UserIdentity } from "./auth/types";

/**
 * Canonical HIM the arena binds to in the v1.0.0-trinity cut. See
 * `src/lib/teleology.ts` for the BirthSignature this id resolves to.
 */
export const CANONICAL_HIM_ID = "him.legal-consulting.lex" as const;

/**
 * The operator context the arena binds the canonical HIM to. Hardcoded in
 * the v1.0.0-trinity cut (Entry 26 §9 follow-up: parameterise per request
 * once the multi-HIM directory lands).
 */
export const DEFAULT_OPERATOR_CONTEXT = Object.freeze({
  domain: "global legal consulting",
  language: "en-US" as const,
  register: "warm" as const,
});

export interface BirthPolicyResult {
  himId: string;
  operatorContext: typeof DEFAULT_OPERATOR_CONTEXT;
}

/**
 * Compute the BirthPolicy result for a given authenticated user. In this cut,
 * the result is constant (canonical HIM + default operator context). The
 * `user` argument is taken so the follow-up cut can branch on user identity,
 * declared jurisdiction, or per-user HIM index without changing the call
 * sites in the API routes.
 */
export function defaultBirthPolicy(_user: UserIdentity): BirthPolicyResult {
  return {
    himId: CANONICAL_HIM_ID,
    operatorContext: DEFAULT_OPERATOR_CONTEXT,
  };
}

/**
 * Filesystem layout for the per-user HIM directory. Each authenticated user
 * has a folder at `.arena-store/users/{userId}/` that holds:
 *
 *   - `hims-owned.json` — the list of HIM ids this user counterpart-owns.
 *     In this cut it always resolves to `[CANONICAL_HIM_ID]`.
 */
function userHimsOwnedPath(userId: string): string {
  return resolve(process.cwd(), ".arena-store/users", userId, "hims-owned.json");
}

/**
 * Ensure the per-user HIM directory exists and that the canonical HIM id is
 * in the user's owned list. Idempotent — safe to call on every request.
 *
 * Returns the (possibly extended) list.
 */
export async function ensureHimOwnership(
  userId: string,
  himId: string,
): Promise<string[]> {
  const path = userHimsOwnedPath(userId);
  const dir = resolve(path, "..");
  await mkdir(dir, { recursive: true });

  let owned: string[] = [];
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      owned = parsed.filter((v): v is string => typeof v === "string");
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "ENOENT") throw err;
  }

  if (!owned.includes(himId)) {
    owned.push(himId);
    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(owned, null, 2), "utf-8");
    const { rename } = await import("node:fs/promises");
    await rename(tmp, path);
  }
  return owned;
}

/**
 * Read the per-user HIM owned list. Returns an empty array when the user has
 * not yet exercised any round (no file on disk yet).
 */
export async function listHimsOwnedByUser(userId: string): Promise<string[]> {
  try {
    const raw = await readFile(userHimsOwnedPath(userId), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
    return [];
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") return [];
    throw err;
  }
}
