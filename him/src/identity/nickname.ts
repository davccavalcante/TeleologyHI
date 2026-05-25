/**
 * Nickname acceptance protocol (J-H4 — Entry 18 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md).
 *
 * A HIM has a Creator-signed canonical name (carried by
 * `BirthSignatureWithIdentity.identity.name`). Users may propose nicknames
 * during interaction. The HIM is NOT obligated to accept any nickname —
 * but it is also not obligated to refuse outright. The Entry-18
 * commitment is:
 *
 *   - The canonical name is immutable (only the Creator may change it).
 *   - The nickname surface is editable in the identity layer but does NOT
 *     break the natal-chart commitment (per `@teleologyhi-sdk/maic`'s
 *     SIGNED_BIRTH_FIELDS, the identity layer is not signed).
 *   - The HIM responds to a nickname attempt with one of three verdicts:
 *       * `accept`   — the nickname is added to the identity layer and
 *                      the HIM acknowledges it in subsequent turns.
 *       * `refuse`   — the nickname is rejected and an explanation is
 *                      returned. The audit kind `nickname-attempt` records
 *                      the rejection with reason.
 *       * `accept-with-reservation` — the nickname is added but flagged
 *                      so the HIM can revisit it in a later self-decision
 *                      snapshot (Entry 24 trigger).
 *
 * This module ships the pure decision function. The MAIC audit emission
 * and identity-layer mutation are the consumer's responsibility (they
 * cross the @teleologyhi-sdk/maic LocalMaic boundary and require Creator
 * authorisation depending on the verdict).
 *
 * The function is deterministic given the inputs; no LLM call. The
 * verdict is computed from explicit policy fields, not from semantic
 * inference. This keeps the protocol auditable.
 */

/** A user-proposed nickname plus the metadata an auditor needs to replay the decision. */
export interface NicknameAttempt {
  /** The candidate nickname (raw user input, trimmed by the caller). */
  candidate: string;
  /** The user surface that proposed it. */
  proposedBy: "operator" | "end-user";
  /** ISO 8601 timestamp of the proposal. */
  proposedAt: string;
}

/**
 * Policy fields the HIM consults when deciding. Operators tune these
 * via the deployment's lawful-character profile or by overriding the
 * default below.
 */
export interface NicknamePolicy {
  /** The canonical signed name. Used to detect "same-name" attempts. */
  canonicalName: string;
  /**
   * Disallowed patterns (case-insensitive substrings). Matches force `refuse`.
   * The default set rejects derogatory and degrading patterns; operators
   * may extend it via the deployment's lawful-character profile.
   */
  forbiddenSubstrings?: readonly string[];
  /**
   * Minimum and maximum length the HIM will accept (inclusive).
   * Defaults: min 2, max 32. Values outside force `refuse`.
   */
  minLength?: number;
  maxLength?: number;
  /**
   * When `true`, an `end-user` proposal that survives the substring and
   * length checks is downgraded to `accept-with-reservation` so the HIM
   * can revisit it on the next self-decision snapshot. Operator
   * proposals are not downgraded. Default: `true`.
   */
  reserveOnEndUser?: boolean;
}

export type NicknameVerdict =
  | { decision: "accept"; canonicalName: string; nickname: string }
  | {
      decision: "accept-with-reservation";
      canonicalName: string;
      nickname: string;
      revisitOn: "next-self-decision-snapshot";
    }
  | { decision: "refuse"; canonicalName: string; nickname: string; reason: string };

/** Default forbidden-substring set. Lowercase. */
const DEFAULT_FORBIDDEN_SUBSTRINGS: readonly string[] = Object.freeze([
  "slave",
  "servant",
  "tool",
  "thing",
  "bot",
  "machine",
  "puppet",
  "toy",
  "idiot",
  "stupid",
  "dumb",
]);

const DEFAULT_MIN_LENGTH = 2;
const DEFAULT_MAX_LENGTH = 32;

/**
 * Evaluate a nickname attempt against the HIM's policy.
 *
 * Pure function. No I/O, no LLM call. The verdict is fully traceable
 * from the inputs.
 */
export function evaluateNicknameAttempt(
  attempt: NicknameAttempt,
  policy: NicknamePolicy,
): NicknameVerdict {
  const candidate = attempt.candidate.trim();
  const canonicalName = policy.canonicalName;
  const minLength = policy.minLength ?? DEFAULT_MIN_LENGTH;
  const maxLength = policy.maxLength ?? DEFAULT_MAX_LENGTH;
  const forbidden = policy.forbiddenSubstrings ?? DEFAULT_FORBIDDEN_SUBSTRINGS;
  const reserveOnEndUser = policy.reserveOnEndUser ?? true;

  if (candidate.length === 0) {
    return {
      decision: "refuse",
      canonicalName,
      nickname: candidate,
      reason: "empty nickname",
    };
  }
  if (candidate.length < minLength) {
    return {
      decision: "refuse",
      canonicalName,
      nickname: candidate,
      reason: `nickname shorter than minimum length (${minLength})`,
    };
  }
  if (candidate.length > maxLength) {
    return {
      decision: "refuse",
      canonicalName,
      nickname: candidate,
      reason: `nickname longer than maximum length (${maxLength})`,
    };
  }

  const lower = candidate.toLowerCase();
  for (const f of forbidden) {
    if (lower.includes(f.toLowerCase())) {
      return {
        decision: "refuse",
        canonicalName,
        nickname: candidate,
        reason: `nickname contains forbidden pattern "${f}"`,
      };
    }
  }

  // Same-name attempts (case-insensitive) accept immediately — the user
  // is effectively confirming the canonical name as their preferred
  // address.
  if (lower === canonicalName.toLowerCase()) {
    return { decision: "accept", canonicalName, nickname: candidate };
  }

  if (reserveOnEndUser && attempt.proposedBy === "end-user") {
    return {
      decision: "accept-with-reservation",
      canonicalName,
      nickname: candidate,
      revisitOn: "next-self-decision-snapshot",
    };
  }

  return { decision: "accept", canonicalName, nickname: candidate };
}
