/**
 * Audit sink for HIM casting events (H1-2 of him/TASK.md, Entry 27 reserved
 * audit kinds `him-jungian-profile-cast` and `him-astrological-chart-cast`).
 *
 * maic 1.0.1 reserves these two audit kinds and maps them in the compliance and
 * retention tables, but it exposes no public method for an external package to
 * append into a live `LocalMaic` audit chain, and opening a second `AuditLog`
 * on the same store directory would fork the tamper-evident hash chain. So this
 * cut emits casting events through a caller-supplied structural sink rather than
 * the canonical chain. The default is a no-op.
 *
 * Canonical-chain emission (a maic method that lets him append these kinds into
 * the signed chain) is a named follow-up for the next maic touch; until it
 * exists, the compliance-mapper rows for the cast kinds describe events that
 * only a supplied sink observes. See him/SPEC.md.
 */

/** The two Entry 27 casting audit kinds a HIM emits at birth. */
export type HimCastAuditKind = "him-jungian-profile-cast" | "him-astrological-chart-cast";

/** A single casting audit event. */
export interface HimCastAuditEvent {
  readonly kind: HimCastAuditKind;
  readonly data: Readonly<Record<string, unknown>>;
}

/** A structural audit destination. Implementations may be sync or async. */
export interface AuditSink {
  append(event: HimCastAuditEvent): void | Promise<void>;
}

/** The default sink: discards events. */
export const NOOP_AUDIT_SINK: AuditSink = {
  append(): void {
    // Intentionally empty: canonical-chain emission awaits a maic append surface.
  },
};
