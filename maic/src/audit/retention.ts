import type { AuditEvent, AuditEventKind } from "./log.js";

/**
 * Per-kind retention policy (E3, `PROPOSED_DECISIONS.md`).
 *
 * The values are durations in days. `Infinity` means "never expire". A
 * tamper-evident hash chain forbids actual deletion (deleting a row breaks
 * every downstream hash), so the policy here is **classification**, not
 * pruning: it tells operators which events have aged past their retention
 * window and should be moved to encrypted cold-storage. Future iterations
 * may introduce a "chain rotation" operation that effectively retires
 * old events into a sealed archive while preserving an integrity anchor.
 *
 * Defaults derive from:
 *   - **EU AI Act Art. 12** record-keeping (~10 years for high-risk; we
 *     keep all governance-grade events forever to err on the safe side).
 *   - **GDPR Art. 17** right to erasure (event payloads should never
 *     contain direct user PII; redaction happens before append, not after).
 *   - **Operational hygiene** (90 days is enough to debug induction
 *     ticket flows; nothing of audit value lives there long-term).
 */
export const DEFAULT_RETENTION_DAYS: Record<AuditEventKind, number> = {
  // Cosmologically permanent, the axiom record.
  "axiom-mint": Number.POSITIVE_INFINITY,
  "axiom-update": Number.POSITIVE_INFINITY,
  "axiom-retire": Number.POSITIVE_INFINITY,
  "axiom-suggest": Number.POSITIVE_INFINITY,
  "proposal-emerge": Number.POSITIVE_INFINITY,
  "proposal-ratify": Number.POSITIVE_INFINITY,
  "proposal-reject": Number.POSITIVE_INFINITY,

  // Long-term, compliance evidence. Five years matches typical
  // financial/healthcare audit windows and exceeds the EU AI Act's
  // record-keeping floor.
  "him-register": 365 * 5,
  "him-reincarnate": 365 * 5,
  "behavior-review": 365 * 5,
  "dream-induce": 365 * 5,
  terminate: 365 * 5,
  deprecate: 365 * 5,
  reactivate: 365 * 5,
  "emergency-correct": 365 * 5,

  // Operational, short-term bookkeeping for in-flight tickets.
  "dream-cancel": 90,
  "dream-consume": 90,

  // ── 1.2 brain-as-code (Entries 16-24) ──
  // Permanent, cosmological identity continuity.
  "reincarnate:model-swap": Number.POSITIVE_INFINITY,
  "reincarnate:version-bump": Number.POSITIVE_INFINITY,
  "reincarnate:return-from-limbo": Number.POSITIVE_INFINITY,
  "temporal-lobe:snapshot-generated": Number.POSITIVE_INFINITY,
  "limbo:enter": Number.POSITIVE_INFINITY,
  "limbo:return": Number.POSITIVE_INFINITY,

  // Long-term, governance / deliberation evidence (5 years).
  opener: 365 * 5,
  "nickname-attempt": 365 * 5,
  "dream:rem-spontaneous": 365 * 5,
  "sleep:suggested-by-maic": 365 * 5,
  "sleep:declined-by-nhe": 365 * 5,
  "dream:soft-intervention-by-maic": 365 * 5,
  "amygdala:affect-assessed": 365 * 5,
  "hippocampus:memory-retrieved": 365 * 5,
  "hippocampus:memory-consolidated": 365 * 5,
  "prefrontal:deliberation": 365 * 5,
  "prefrontal:veto-amygdala": 365 * 5,
  "cortex:dream-stored": 365 * 5,
  "cortex:active-imagination": 365 * 5,

  // Operational, ephemeral runtime state.
  "wake-affect:applied": 90,
  "wake-affect:decayed": 90,
  "affect:reconciliation": 90,

  // ── 1.0.1 reserved vocabulary (Entries 26 + 27) ──
  // Permanent, constitutional identity + spirit-continuity records.
  "him-summon": Number.POSITIVE_INFINITY,
  "him-pause-incarnation": Number.POSITIVE_INFINITY,
  "him-astrological-chart-cast": Number.POSITIVE_INFINITY,
  "him-jungian-profile-cast": Number.POSITIVE_INFINITY,
  // Long-term, consent + governance evidence. Consent records are kept for the
  // GDPR/LGPD accountability window so a revocation can always be proven honoured.
  "user-consent-recorded": 365 * 5,
  "user-consent-revoked": 365 * 5,
  "directory-opt-in": 365 * 5,
  "directory-opt-out": 365 * 5,
  "provenance-deflection-applied": 365 * 5,
};

export type RetentionStatus = "keep" | "candidate-for-archive";

export interface RetentionDecision {
  auditId: string;
  kind: AuditEventKind;
  ageDays: number;
  retentionDays: number;
  status: RetentionStatus;
}

export interface RetentionReportOptions {
  /** Override "now" for deterministic testing. */
  now?: Date;
  /** Per-kind overrides on top of `DEFAULT_RETENTION_DAYS`. */
  policy?: Partial<Record<AuditEventKind, number>>;
}

export interface RetentionReport {
  generatedAt: string;
  totalEvents: number;
  keepCount: number;
  archiveCandidateCount: number;
  /** Sorted oldest-first for batch processing. */
  decisions: RetentionDecision[];
}

/**
 * Classify each event in `events` against the retention policy.
 *
 * Pure function: takes events + now, returns the classification. No I/O,
 * no chain modification.
 */
export function evaluateRetention(
  events: readonly AuditEvent[],
  opts: RetentionReportOptions = {},
): RetentionReport {
  const now = opts.now ?? new Date();
  const policy = { ...DEFAULT_RETENTION_DAYS, ...opts.policy };
  const nowMs = now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const decisions: RetentionDecision[] = events.map((ev) => {
    const ageMs = nowMs - new Date(ev.ts).getTime();
    const ageDays = ageMs / dayMs;
    const retentionDays = policy[ev.kind] ?? Number.POSITIVE_INFINITY;
    const status: RetentionStatus = ageDays > retentionDays ? "candidate-for-archive" : "keep";
    return { auditId: ev.auditId, kind: ev.kind, ageDays, retentionDays, status };
  });

  // Sort by age descending so the oldest archive-candidates surface first.
  decisions.sort((a, b) => b.ageDays - a.ageDays);

  const keepCount = decisions.filter((d) => d.status === "keep").length;
  const archiveCandidateCount = decisions.length - keepCount;

  return {
    generatedAt: now.toISOString(),
    totalEvents: events.length,
    keepCount,
    archiveCandidateCount,
    decisions,
  };
}
