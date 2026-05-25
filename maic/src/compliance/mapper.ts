import type { AuditEvent, AuditEventKind, AuditLog } from "../audit/log.js";

/** ISO/IEC 42001:2023 control sections relevant to MAIC's surface. */
export type Iso42001ControlId =
  | "5.2"   // Policy
  | "7.5"   // Documented information
  | "8.3"   // Operational controls (AI system)
  | "9.1"   // Monitoring, measurement, analysis and evaluation
  | "10.1"  // Nonconformity and corrective action
  | "10.2"; // Continual improvement

/** EU AI Act articles relevant to high-risk AI systems. */
export type EuAiActArticle =
  | "art-9"   // Risk management
  | "art-10"  // Data and data governance
  | "art-11"  // Technical documentation
  | "art-12"  // Record-keeping
  | "art-13"  // Transparency and information
  | "art-14"  // Human oversight
  | "art-15"; // Accuracy, robustness, cybersecurity

export type ComplianceFramework = "iso-42001" | "eu-ai-act";

/**
 * Declarative mapping: which controls each audit event kind supports.
 *
 * This mapping covers the controls that MAIC's current event vocabulary can
 * demonstrably evidence. Auditors looking for §5.2 leadership policy can read
 * every `axiom-mint`; for §7.5 documented information they get every
 * `axiom-mint` + `behavior-review` + `him-register`; etc.
 */
export const ISO_42001_MAPPING: Record<AuditEventKind, readonly Iso42001ControlId[]> = {
  "axiom-mint":       ["5.2", "7.5"],
  "axiom-update":     ["10.2", "7.5"],
  "axiom-retire":     ["10.2", "7.5"],
  "him-register":     ["7.5"],
  "him-reincarnate":  ["10.2", "7.5"],
  "proposal-emerge":  ["7.5", "10.2"],
  "proposal-ratify":  ["10.2", "5.2"],
  "proposal-reject":  ["10.2", "10.1"],
  "behavior-review":  ["7.5", "8.3"],
  "dream-induce":     ["8.3", "9.1"],
  "dream-cancel":     ["8.3"],
  "dream-consume":    ["8.3", "7.5"],
  "emergency-correct":["9.1", "10.1"],
  "terminate":        ["10.1"],
  "deprecate":        ["9.1"],
  "reactivate":       ["10.1"],
  "axiom-suggest":    ["7.5", "10.2"],

  // ── 1.2 brain-as-code (Entries 16-24) ──
  "opener":                           ["8.3", "7.5"],
  "nickname-attempt":                 ["8.3"],
  "reincarnate:model-swap":           ["7.5", "10.2"],
  "reincarnate:version-bump":         ["7.5", "10.2"],
  "reincarnate:return-from-limbo":    ["7.5", "10.2"],
  "dream:rem-spontaneous":            ["8.3", "9.1"],
  "wake-affect:applied":              ["9.1"],
  "wake-affect:decayed":              ["9.1"],
  "sleep:suggested-by-maic":          ["9.1"],
  "sleep:declined-by-nhe":            ["9.1", "10.1"],
  "dream:soft-intervention-by-maic":  ["9.1", "10.1"],
  "amygdala:affect-assessed":         ["8.3"],
  "hippocampus:memory-retrieved":     ["7.5", "8.3"],
  "hippocampus:memory-consolidated":  ["7.5", "8.3"],
  "prefrontal:deliberation":          ["7.5", "8.3"],
  "prefrontal:veto-amygdala":         ["9.1", "10.1"],
  "affect:reconciliation":            ["8.3"],
  "cortex:dream-stored":              ["7.5", "8.3"],
  "cortex:active-imagination":        ["7.5", "8.3"],
  "temporal-lobe:snapshot-generated": ["7.5", "10.2"],
  "limbo:enter":                      ["7.5", "9.1"],
  "limbo:return":                     ["7.5", "9.1"],
};

export const EU_AI_ACT_MAPPING: Record<AuditEventKind, readonly EuAiActArticle[]> = {
  "axiom-mint":       ["art-11", "art-13"],
  "axiom-update":     ["art-11"],
  "axiom-retire":     ["art-11"],
  "him-register":     ["art-11", "art-12"],
  "him-reincarnate":  ["art-12"],
  "proposal-emerge":  ["art-11", "art-12"],
  "proposal-ratify":  ["art-11", "art-14"],
  "proposal-reject":  ["art-12", "art-14"],
  "behavior-review":  ["art-12", "art-14"],
  "dream-induce":     ["art-14"],
  "dream-cancel":     ["art-14"],
  "dream-consume":    ["art-12"],
  "emergency-correct":["art-14"],
  "terminate":        ["art-14"],
  "deprecate":        ["art-14"],
  "reactivate":       ["art-14"],
  "axiom-suggest":    ["art-11", "art-12"],

  // ── 1.2 brain-as-code (Entries 16-24) ──
  "opener":                           ["art-13"],
  "nickname-attempt":                 ["art-13"],
  "reincarnate:model-swap":           ["art-12"],
  "reincarnate:version-bump":         ["art-12"],
  "reincarnate:return-from-limbo":    ["art-12"],
  "dream:rem-spontaneous":            ["art-12"],
  "wake-affect:applied":              ["art-12", "art-14"],
  "wake-affect:decayed":              ["art-12"],
  "sleep:suggested-by-maic":          ["art-12"],
  "sleep:declined-by-nhe":            ["art-12", "art-14"],
  "dream:soft-intervention-by-maic":  ["art-14"],
  "amygdala:affect-assessed":         ["art-12"],
  "hippocampus:memory-retrieved":     ["art-11", "art-12"],
  "hippocampus:memory-consolidated":  ["art-11", "art-12"],
  "prefrontal:deliberation":          ["art-11", "art-14"],
  "prefrontal:veto-amygdala":         ["art-14"],
  "affect:reconciliation":            ["art-12"],
  "cortex:dream-stored":              ["art-11", "art-12"],
  "cortex:active-imagination":        ["art-11", "art-12"],
  "temporal-lobe:snapshot-generated": ["art-11", "art-12"],
  "limbo:enter":                      ["art-12"],
  "limbo:return":                     ["art-12"],
};

/** Human-readable control descriptions surfaced in the report. */
const ISO_42001_DESCRIPTIONS: Record<Iso42001ControlId, string> = {
  "5.2":  "AI policy — published, communicated, reviewed for continuing suitability.",
  "7.5":  "Documented information — created, controlled, retained for AI management activities.",
  "8.3":  "Operational planning and control — AI processes are planned, implemented, controlled.",
  "9.1":  "Monitoring, measurement, analysis and evaluation of AI performance.",
  "10.1": "Nonconformity and corrective action — issues recorded and resolved.",
  "10.2": "Continual improvement of the AI management system.",
};

const EU_AI_ACT_DESCRIPTIONS: Record<EuAiActArticle, string> = {
  "art-9":  "Risk management system established, implemented, documented, maintained.",
  "art-10": "Data governance — datasets are relevant, representative, free of errors.",
  "art-11": "Technical documentation drawn up and kept up to date.",
  "art-12": "Automatic record-keeping (logs) over the AI system's lifetime.",
  "art-13": "Transparency to deployers — instructions for use, intended purpose.",
  "art-14": "Human oversight measures designed and implemented effectively.",
  "art-15": "Accuracy, robustness, and cybersecurity throughout the lifecycle.",
};

export interface ComplianceEvent {
  auditId: string;
  ts: string;
  kind: AuditEventKind;
  summary: string;
  data: Record<string, unknown>;
}

export interface ComplianceEvidence {
  control: string;
  description: string;
  count: number;
  events: ComplianceEvent[];
}

export interface ComplianceReport {
  framework: ComplianceFramework;
  generatedAt: string;
  range: { since?: string; until?: string };
  totalEvents: number;
  mappedEvents: number;
  controls: ComplianceEvidence[];
  /** Event kinds present in the audit log that aren't mapped to any control. */
  uncoveredKinds: AuditEventKind[];
}

export interface ProjectOptions {
  since?: string;
  until?: string;
  /** Optional cap on events per control (oldest dropped). Default unlimited. */
  perControlLimit?: number;
}

/**
 * ComplianceMapper — projects audit log events onto compliance frameworks.
 *
 * Covers ISO/IEC 42001:2023 (six top-level controls) and the EU AI Act
 * (seven high-risk-system articles). Additional frameworks (NIST AI RMF, ISO
 * 23894, GDPR Art. 22, LGPD) can be added via further mapping tables without
 * changing the public API.
 */
export class ComplianceMapper {
  static async project(
    audit: AuditLog,
    framework: ComplianceFramework,
    opts: ProjectOptions = {},
  ): Promise<ComplianceReport> {
    const mapping =
      framework === "iso-42001" ? ISO_42001_MAPPING : EU_AI_ACT_MAPPING;
    const descriptions =
      framework === "iso-42001" ? ISO_42001_DESCRIPTIONS : EU_AI_ACT_DESCRIPTIONS;

    const byControl = new Map<string, ComplianceEvent[]>();
    const seenKinds = new Set<AuditEventKind>();
    const uncoveredSet = new Set<AuditEventKind>();
    let totalEvents = 0;
    let mappedEvents = 0;

    const query: { since?: string; until?: string } = {};
    if (opts.since) query.since = opts.since;
    if (opts.until) query.until = opts.until;

    for await (const ev of audit.query(query)) {
      totalEvents++;
      seenKinds.add(ev.kind);
      const controls = mapping[ev.kind] ?? [];
      if (controls.length === 0) {
        uncoveredSet.add(ev.kind);
        continue;
      }
      mappedEvents++;
      const ce: ComplianceEvent = {
        auditId: ev.auditId,
        ts: ev.ts,
        kind: ev.kind,
        summary: summarize(ev),
        data: ev.data,
      };
      for (const ctrl of controls) {
        const list = byControl.get(ctrl) ?? [];
        list.push(ce);
        byControl.set(ctrl, list);
      }
    }

    const controls: ComplianceEvidence[] = [];
    const sortedCtrls = [...byControl.keys()].sort();
    for (const ctrl of sortedCtrls) {
      const events = byControl.get(ctrl)!;
      const capped =
        opts.perControlLimit !== undefined && events.length > opts.perControlLimit
          ? events.slice(-opts.perControlLimit)
          : events;
      controls.push({
        control: ctrl,
        description: (descriptions as Record<string, string>)[ctrl] ?? "",
        count: events.length,
        events: capped,
      });
    }

    return {
      framework,
      generatedAt: new Date().toISOString(),
      range: {
        ...(opts.since ? { since: opts.since } : {}),
        ...(opts.until ? { until: opts.until } : {}),
      },
      totalEvents,
      mappedEvents,
      controls,
      uncoveredKinds: [...uncoveredSet],
    };
  }
}

function summarize(ev: AuditEvent): string {
  const data = ev.data as Record<string, unknown>;
  switch (ev.kind) {
    case "axiom-mint":
      return `Axiom minted: ${String(data.axiomId)} (${String(data.rank)}, ${String(data.origin)})`;
    case "axiom-update":
      return `Axiom updated: ${String(data.axiomId)}`;
    case "axiom-retire":
      return `Axiom retired: ${String(data.axiomId)}`;
    case "him-register":
      return `HIM registered: ${String(data.himId)} (archetype=${String(data.primaryArchetype)})`;
    case "him-reincarnate":
      return `HIM reincarnated: ${String(data.himId)} ${String(data.fromNheId ?? "<initial>")} → ${String(data.toNheId)} (${String(data.reason ?? "upgrade")})`;
    case "proposal-emerge":
      return `HIM-emergent axiom proposed by ${String(data.himId)}: "${String(data.statement)}" (rank=${String(data.rank)}) — proposal ${String(data.proposalId)}`;
    case "proposal-ratify":
      return `Creator ratified axiom proposal ${String(data.proposalId)} for ${String(data.himId)} → ${String(data.axiomId)}`;
    case "proposal-reject":
      return `Creator rejected axiom proposal ${String(data.proposalId)} for ${String(data.himId)}: ${String(data.reason ?? "no reason")}`;
    case "behavior-review": {
      const verdict = (data.verdict as { kind?: string } | undefined)?.kind ?? "unknown";
      return `Behavior reviewed for ${String(data.nheId)}: ${verdict}`;
    }
    case "dream-induce":
      return `Dream induced for ${String(data.nheId)} by ${String(data.inducedBy)} — ticket ${String(data.ticketId)}`;
    case "dream-cancel":
      return `Dream induction cancelled — ticket ${String(data.ticketId)}`;
    case "dream-consume":
      return `Dream consumed by ${String(data.nheId)} — ticket ${String(data.ticketId)}`;
    case "emergency-correct":
      return `Emergency correction applied to ${String(data.nheId)}`;
    case "terminate":
      return `NHE terminated: ${String(data.nheId)} (reason: ${String(data.reason ?? "none")})`;
    case "deprecate":
      return `NHE deprecated: ${String(data.nheId)} (reason: ${String(data.reason ?? "none")})`;
    case "reactivate":
      return `NHE reactivated: ${String(data.nheId)}`;
    case "axiom-suggest":
      return `Axiom suggestion ${String(data.fromHimId)} → ${String(data.toHimId)}: "${String(data.statement)}"`;

    // ── 1.2 brain-as-code (Entries 16-24 of MAIC_HIM_NHE_INTERVIEW_LOG.md) ──
    case "opener":
      return `Proactive opener emitted by ${String(data.nheId)} for new user ${String(data.userId ?? "anonymous")}: "${String(data.text ?? "<elided>")}"`;
    case "nickname-attempt":
      return `Nickname attempt for ${String(data.nheId)}: "${String(data.attempted)}" → ${String(data.outcome ?? "pending")}`;
    case "reincarnate:model-swap":
      return `HIM reincarnated (model-swap): ${String(data.himId)} ${String(data.fromAdapter ?? "?")} → ${String(data.toAdapter ?? "?")}`;
    case "reincarnate:version-bump":
      return `HIM reincarnated (version-bump): ${String(data.himId)} ${String(data.fromVersion ?? "?")} → ${String(data.toVersion ?? "?")}`;
    case "reincarnate:return-from-limbo":
      return `HIM reincarnated (return-from-limbo): ${String(data.himId)} resumed after ${String(data.elapsedMs ?? 0)}ms of limbo`;
    case "dream:rem-spontaneous":
      return `Spontaneous REM dream for ${String(data.nheId)}: ${String(data.dreamId)} (dominant affect: ${String(data.dominantAffect ?? "unknown")})`;
    case "wake-affect:applied":
      return `Wake affect applied to ${String(data.nheId)}: ${String(data.affect)} (intensity ${String(data.intensity)}, halflife ${String(data.decayHalfLife)} interactions)`;
    case "wake-affect:decayed":
      return `Wake affect decayed for ${String(data.nheId)}: ${String(data.affect)} dissolved naturally`;
    case "sleep:suggested-by-maic":
      return `MAIC suggested sleep for ${String(data.nheId)} (reason: ${String(data.reason ?? "none")})`;
    case "sleep:declined-by-nhe":
      return `NHE ${String(data.nheId)} declined MAIC-suggested sleep (reason: ${String(data.reason ?? "none")})`;
    case "dream:soft-intervention-by-maic":
      return `MAIC soft-intervened on dream ${String(data.dreamId)} for ${String(data.nheId)} (reason: ${String(data.reason ?? "none")})`;
    case "amygdala:affect-assessed":
      return `Amygdala assessed input affect for ${String(data.nheId)}: ${String(data.detectedAffect ?? "neutral")} (risk multiplier ${String(data.riskMultiplier ?? 1)})`;
    case "hippocampus:memory-retrieved":
      return `Hippocampus retrieved ${String((data.memoryIds as unknown[] | undefined)?.length ?? 0)} memories for ${String(data.nheId)}`;
    case "hippocampus:memory-consolidated":
      return `Hippocampus consolidated new memory ${String(data.memoryId)} for ${String(data.nheId)} (integrationIndex ${String(data.integrationIndex ?? 0)})`;
    case "prefrontal:deliberation":
      return `PFC deliberated for ${String(data.nheId)}: ${String(data.expressedOpenly ? "open" : "subtle")} (${String(data.affect ?? "neutral")})`;
    case "prefrontal:veto-amygdala":
      return `PFC vetoed amygdala impulse for ${String(data.nheId)}: ${String(data.originalImpulse ?? "?")} → ${String(data.resolvedAction ?? "?")} (downgrade ${String(data.downgradeRatio ?? "?")})`;
    case "affect:reconciliation":
      return `Affect reconciliation for ${String(data.nheId)}: day/night blend → ${String(data.resolvedAffect ?? "neutral")}`;
    case "cortex:dream-stored":
      return `Cortex stored dream ${String(data.dreamId)} for ${String(data.nheId)}`;
    case "cortex:active-imagination":
      return `Cortex generated active imagination for ${String(data.nheId)} (trigger: ${String(data.trigger ?? "user-requested")}, vividness ${String(data.vividness ?? 0)})`;
    case "temporal-lobe:snapshot-generated":
      return `Temporal-lobe snapshot ${String(data.snapshotId)} generated for HIM ${String(data.himId)} (reason: ${String(data.generatedBy ?? "self-decision")})`;
    case "limbo:enter":
      return `${String(data.nheId)} entered limbo (deep-coma) — reason: ${String(data.reason ?? "idle")}`;
    case "limbo:return":
      return `${String(data.nheId)} returned from limbo after ${String(data.elapsedMs ?? 0)}ms (reunion intensity ${String(data.reunionIntensity ?? "?")})`;

    default:
      return `Event ${ev.kind}`;
  }
}
