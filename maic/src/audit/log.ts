import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ulid } from "ulid";
import { canonicalJSON } from "../axioms/signing.js";

/** Event kinds emitted by MAIC. Extend as new pipelines are added. */
export type AuditEventKind =
  // ── 1.0/1.1 core ──
  | "axiom-mint"
  | "axiom-update"
  | "axiom-retire"
  | "him-register"
  | "him-reincarnate"
  | "proposal-emerge"
  | "proposal-ratify"
  | "proposal-reject"
  | "behavior-review"
  | "dream-induce"
  | "dream-cancel"
  | "dream-consume"
  | "emergency-correct"
  | "deprecate"
  | "terminate"
  | "reactivate"
  | "axiom-suggest"
  // ── 1.2 brain-as-code (Entries 16-24 of MAIC_HIM_NHE_INTERVIEW_LOG.md) ──
  | "opener" //                                 Entry 17 (proactive first turn)
  | "nickname-attempt" //                       Entry 18 (user proposed a nickname)
  | "reincarnate:model-swap" //                 Entry 18 (LLM provider/model changed)
  | "reincarnate:version-bump" //               Entry 18 (package major/minor bumped)
  | "reincarnate:return-from-limbo" //          Entry 18 + 24 (NHE-body resumed)
  | "dream:rem-spontaneous" //                  Entry 20 (autonomous REM cycle)
  | "wake-affect:applied" //                    Entry 20 + 22 (bias entered force)
  | "wake-affect:decayed" //                    Entry 22 (bias dissolved naturally)
  | "sleep:suggested-by-maic" //                Entry 20 (MAIC advisory)
  | "sleep:declined-by-nhe" //                  Entry 20 (NHE declined MAIC suggestion)
  | "dream:soft-intervention-by-maic" //        Entry 20 (suffering/incoherence override)
  | "amygdala:affect-assessed" //               Entry 22 (input emotion + wake-affect)
  | "hippocampus:memory-retrieved" //           Entry 22 (memories injected for context)
  | "hippocampus:memory-consolidated" //        Entry 22 (new MemoryRecord created)
  | "prefrontal:deliberation" //                Entry 22 (OKL-driven decision)
  | "prefrontal:veto-amygdala" //               Entry 22 (PFC overruled amygdala impulse)
  | "affect:reconciliation" //                  Entry 22 (mixed day/night affect resolved)
  | "cortex:dream-stored" //                    Entry 24 (REM dream committed to cortex)
  | "cortex:active-imagination" //              Entry 24 (waking imagination produced)
  | "temporal-lobe:snapshot-generated" //       Entry 24 (identity snapshot created)
  | "limbo:enter" //                            Entry 24 (DMN took entity into deep-coma)
  | "limbo:return" //                           Entry 24 (entity woke from limbo)
  // ── 1.0.1 reserved vocabulary (him/arena/nhe emit these in later cuts) ──
  // Entry 26 multi-user society: him/arena emit these in later cuts.
  | "him-summon" //                             Entry 26 (MAIC summoned a spirit into a body)
  | "him-pause-incarnation" //                  Entry 26 (spirit paused in the ethereal field)
  | "user-consent-recorded" //                  Entry 26 (user granted consent)
  | "user-consent-revoked" //                   Entry 26 (user withdrew consent)
  | "directory-opt-in" //                       Entry 26 (HIM opted into the public directory)
  | "directory-opt-out" //                      Entry 26 (HIM left the public directory)
  // Entry 27 constitutional casting: him emits these at birth in later cuts.
  | "him-astrological-chart-cast" //            Entry 27 (natal chart cast at birth)
  | "him-jungian-profile-cast" //               Entry 27 (Jungian profile cast at birth)
  // Entry 27 provenance: EMITTED by reviewBehavior when a report carries the
  // NHE's probe:substrate-authorship risk tag (F3, the deflection fired).
  | "provenance-deflection-applied"; //         Entry 27 (identity-authorship deflection fired)

/**
 * Runtime enumeration of every `AuditEventKind` shipped in this cut. Single
 * source of truth for downstream consumers that need to iterate, validate,
 * or compute coverage against the kind universe (e.g. `@teleologyhi-sdk/eval`
 * uses this as the denominator of the Φ′ compliance-coverage component `C`).
 *
 * INVARIANT: every member of the `AuditEventKind` union MUST appear here.
 * `tests/audit-event-kinds-completeness.test.ts` enforces this via an
 * exhaustiveness switch at compile time + runtime length check.
 */
export const ALL_AUDIT_EVENT_KINDS: readonly AuditEventKind[] = [
  // ── 1.0/1.1 core (17) ──
  "axiom-mint",
  "axiom-update",
  "axiom-retire",
  "him-register",
  "him-reincarnate",
  "proposal-emerge",
  "proposal-ratify",
  "proposal-reject",
  "behavior-review",
  "dream-induce",
  "dream-cancel",
  "dream-consume",
  "emergency-correct",
  "deprecate",
  "terminate",
  "reactivate",
  "axiom-suggest",
  // ── 1.2 brain-as-code (22, Entries 16-24) ──
  "opener",
  "nickname-attempt",
  "reincarnate:model-swap",
  "reincarnate:version-bump",
  "reincarnate:return-from-limbo",
  "dream:rem-spontaneous",
  "wake-affect:applied",
  "wake-affect:decayed",
  "sleep:suggested-by-maic",
  "sleep:declined-by-nhe",
  "dream:soft-intervention-by-maic",
  "amygdala:affect-assessed",
  "hippocampus:memory-retrieved",
  "hippocampus:memory-consolidated",
  "prefrontal:deliberation",
  "prefrontal:veto-amygdala",
  "affect:reconciliation",
  "cortex:dream-stored",
  "cortex:active-imagination",
  "temporal-lobe:snapshot-generated",
  "limbo:enter",
  "limbo:return",
  // ── 1.0.1 vocabulary (9, Entries 26 + 27). Eight are reserved for him/arena/nhe
  //    to emit in later cuts; provenance-deflection-applied is emitted by
  //    reviewBehavior (F3) when a report carries probe:substrate-authorship. ──
  "him-summon",
  "him-pause-incarnation",
  "user-consent-recorded",
  "user-consent-revoked",
  "directory-opt-in",
  "directory-opt-out",
  "him-astrological-chart-cast",
  "him-jungian-profile-cast",
  "provenance-deflection-applied",
] as const;

export interface AuditEvent {
  /** ISO 8601 timestamp. */
  ts: string;
  kind: AuditEventKind;
  /** ULID generated at append time. */
  auditId: string;
  /** Arbitrary structured payload. Includes nheId/himId when relevant. */
  data: Record<string, unknown>;
  /** Hash of the previous event ("GENESIS" for the first). */
  prevHash: string;
  /** SHA-256 of canonicalJSON({ ts, kind, auditId, data, prevHash }). */
  thisHash: string;
}

export interface AppendInput {
  kind: AuditEventKind;
  data: Record<string, unknown>;
}

export interface QueryFilter {
  kind?: AuditEventKind;
  since?: string; // inclusive ISO 8601
  until?: string; // inclusive ISO 8601
  nheId?: string; // matches data.nheId
  himId?: string; // matches data.himId
}

const GENESIS = "GENESIS";

/**
 * AuditLog, append-only, tamper-evident NDJSON log.
 *
 * Storage: <storeDir>/audit/log.ndjson, one JSON object per line.
 *
 * Each entry is hash-chained: thisHash = sha256(canonicalJSON({ts,kind,auditId,data,prevHash})).
 * Modifying any historical entry invalidates all subsequent hashes; reopening detects this.
 *
 * This implementation loads the whole log into memory on open. That is acceptable for
 * the expected throughput and keeps tamper detection straightforward. For
 * high-throughput deployments a streaming verifier + log rotation will be added.
 */
export class AuditLog {
  private readonly logPath: string;
  private events: AuditEvent[] = [];
  private lastHash = GENESIS;
  /**
   * Serialises `append` calls so concurrent appends cannot capture the same
   * `prevHash` and fork the hash chain (M1-4, 1.0.1). Each append waits for the
   * previous one to finish writing and to advance `lastHash` before it reads it.
   */
  private appendChain: Promise<unknown> = Promise.resolve();

  private constructor(storeDir: string) {
    this.logPath = join(storeDir, "audit", "log.ndjson");
  }

  static async open(storeDir: string): Promise<AuditLog> {
    const log = new AuditLog(storeDir);
    await mkdir(join(storeDir, "audit"), { recursive: true });
    await log.loadAndVerify();
    return log;
  }

  async append(input: AppendInput): Promise<AuditEvent> {
    // Chain every append onto the previous one so `prevHash` is read only after
    // the prior append has committed its `thisHash`. Keep the chain alive on
    // failure so a single rejected append does not wedge the queue.
    const run = this.appendChain.then(() => this.appendLocked(input));
    this.appendChain = run.catch(() => undefined);
    return run;
  }

  private async appendLocked(input: AppendInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      ts: new Date().toISOString(),
      kind: input.kind,
      auditId: ulid(),
      data: input.data,
      prevHash: this.lastHash,
      thisHash: "",
    };
    event.thisHash = computeHash(event);
    await appendFile(this.logPath, `${JSON.stringify(event)}\n`, "utf-8");
    this.events.push(event);
    this.lastHash = event.thisHash;
    return event;
  }

  async *query(filter: QueryFilter): AsyncIterable<AuditEvent> {
    for (const e of this.events) {
      if (filter.kind && e.kind !== filter.kind) continue;
      if (filter.since && e.ts < filter.since) continue;
      if (filter.until && e.ts > filter.until) continue;
      if (filter.nheId && e.data.nheId !== filter.nheId) continue;
      if (filter.himId && e.data.himId !== filter.himId) continue;
      yield e;
    }
  }

  /** Total number of events appended. */
  size(): number {
    return this.events.length;
  }

  // ─── internals ──────────────────────────────────────────────────────

  private async loadAndVerify(): Promise<void> {
    let raw: string;
    try {
      raw = await readFile(this.logPath, "utf-8");
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    const endsWithNewline = raw.endsWith("\n");
    const lines = raw.split("\n").filter((l) => l.length > 0);
    let prev = GENESIS;
    for (let i = 0; i < lines.length; i++) {
      let parsed: AuditEvent;
      try {
        parsed = JSON.parse(lines[i]!) as AuditEvent;
      } catch (err) {
        // `append` uses `appendFile`, which is not atomic, so a crash or a full
        // disk mid-write can leave a torn final line (no trailing newline). Drop
        // it, honoring the append-only promise that an interrupted write at
        // worst loses the last event. A malformed line that IS newline
        // terminated, or any non-final malformed line, is genuine corruption
        // and must surface rather than be silently discarded.
        if (i === lines.length - 1 && !endsWithNewline) {
          break;
        }
        throw new Error(`AuditLog: corrupt entry at line ${i + 1}: ${(err as Error).message}`);
      }
      if (parsed.prevHash !== prev) {
        throw new Error(
          `AuditLog: chain tampered at line ${i + 1} (prevHash mismatch). ` +
            `expected ${prev}, found ${parsed.prevHash}`,
        );
      }
      const recomputed = computeHash(parsed);
      if (recomputed !== parsed.thisHash) {
        throw new Error(`AuditLog: tamper detected at line ${i + 1} (thisHash mismatch).`);
      }
      this.events.push(parsed);
      prev = parsed.thisHash;
    }
    this.lastHash = prev;
  }
}

function computeHash(e: AuditEvent): string {
  const payload = canonicalJSON({
    ts: e.ts,
    kind: e.kind,
    auditId: e.auditId,
    data: e.data,
    prevHash: e.prevHash,
  });
  const h = createHash("sha256").update(payload).digest("hex");
  return `sha256:${h}`;
}
