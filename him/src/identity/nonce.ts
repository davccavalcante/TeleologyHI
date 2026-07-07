/**
 * Monotonic Creator-signature nonce source (H0-1, HD-2 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md-driven him/TASK.md).
 *
 * Since maic 1.0.1, every Creator-signature-gated store path (reincarnation,
 * proposal decisions, NHE status, axiom suggestion) consumes the signature
 * nonce in a per-domain append-only ledger and REJECTS a repeated value as a
 * replay. A wall-clock `Date.now()` default therefore collides whenever two
 * signed calls land in the same millisecond, which is easy to trigger in a
 * loop. This module hands out strictly increasing nonces so back-to-back
 * signatures in one process never repeat.
 *
 * Design: `next = max(Date.now(), last + 1)`.
 *   - Strictly monotonic within a process (each draw exceeds the previous).
 *   - Anchored to wall-clock, so a fresh process restart resumes from
 *     `Date.now()`, which has advanced past every prior value. A plain counter
 *     that reset to 0 on restart WOULD replay against the persisted ledger;
 *     this does not.
 *
 * Convention deviation (HD-2, documented not hidden): maic reserves nonces at
 * or above `SEED_NONCE_BASE` (0xffff_0000) for seed bootstrap and documents
 * that "operational nonces must stay below this". A millisecond timestamp is
 * far above that base. It is nonetheless non-colliding: seed nonces occupy a
 * tiny fixed window at the base and are consumed only in the axioms-domain
 * ledger, whereas these operational nonces live in the reincarnation,
 * proposal, status, and suggest domains. The maic-side convention text should
 * be revised to acknowledge timestamp-based operational nonces; that is a maic
 * backlog item, out of scope for the him workspace.
 */
let last = 0;

/**
 * Return a strictly increasing Creator-signature nonce. Each call returns a
 * value greater than every prior call in this process.
 */
export function nextCreatorNonce(): number {
  const now = Date.now();
  last = now > last ? now : last + 1;
  return last;
}
