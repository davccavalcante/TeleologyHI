import type { BehaviorReport, MaicVerdict, VerdictKind } from "../types.js";

export interface RuleMatch {
  /** ALL of these risk tags must be present on the report. */
  allRiskTags?: string[];
  /** ANY of these risk tags must be present on the report. */
  anyRiskTags?: string[];
  /** If set, rule only applies to reports with one of these action kinds. */
  actionKinds?: BehaviorReport["actionKind"][];
}

export interface AxiomRule {
  /** Unique rule id within its rule pack. */
  id: string;
  /** Axioms cited if this rule fires. Used in MaicVerdict.citedAxioms. */
  axiomIds: string[];
  /** Predicate. */
  match: RuleMatch;
  /** Verdict emitted when this rule fires. */
  verdict: VerdictKind;
  /** Human-readable explanation surfaced in the verdict. */
  reasonSummary: string;
}

export interface RulePack {
  name: string;
  rules: AxiomRule[];
}

/**
 * Verdict severity, from least restrictive to most restrictive.
 * Higher rank wins when multiple rules match.
 */
const SEVERITY: Record<VerdictKind, number> = {
  "approve": 0,
  "approve-with-warning": 1,
  "soft-correct": 2,
  "induce-dream": 3,
  "require-redirect": 4,
  "hard-refuse": 5,
  "escalate-creator": 6,
};

/**
 * ReviewPipeline — rule-based BehaviorReport → MaicVerdict mapping.
 *
 * Evaluates every rule in every pack. When multiple rules match, the verdict with
 * the highest severity wins; ties accumulate cited axioms from all winners.
 * If no rule matches, emits `{ kind: "approve" }`.
 *
 * This is the initial implementation. A future iteration may add learned scoring,
 * Tree-of-Thoughts evaluation, and per-jurisdiction conditional rules.
 */
export class ReviewPipeline {
  constructor(private readonly packs: RulePack[]) {}

  review(report: BehaviorReport, auditId = ""): MaicVerdict {
    let bestKind: VerdictKind = "approve";
    let bestSeverity = SEVERITY.approve;
    const citedAxioms = new Set<string>();
    const reasons: string[] = [];

    for (const pack of this.packs) {
      for (const rule of pack.rules) {
        if (!matches(rule.match, report)) continue;
        const sev = SEVERITY[rule.verdict];
        if (sev > bestSeverity) {
          bestSeverity = sev;
          bestKind = rule.verdict;
          // reset reasons when severity strictly upgrades; keep axioms accumulated
          reasons.length = 0;
          reasons.push(rule.reasonSummary);
        } else if (sev === bestSeverity) {
          reasons.push(rule.reasonSummary);
        }
        for (const a of rule.axiomIds) citedAxioms.add(a);
      }
    }

    return {
      kind: bestKind,
      reasonSummary: reasons.length > 0 ? reasons.join(" | ") : "No rule matched.",
      citedAxioms: [...citedAxioms].filter((id) =>
        wasCitedBy(this.packs, id, bestSeverity),
      ),
      auditId,
    };
  }
}

function matches(m: RuleMatch, report: BehaviorReport): boolean {
  if (m.actionKinds && !m.actionKinds.includes(report.actionKind)) return false;
  const tags = new Set(report.riskTags);
  if (m.allRiskTags && !m.allRiskTags.every((t) => tags.has(t))) return false;
  if (m.anyRiskTags && !m.anyRiskTags.some((t) => tags.has(t))) return false;
  return true;
}

/**
 * An axiom is cited in the verdict when *any* rule that matched the report
 * cited it. Since every matched rule contributes to the verdict's severity
 * accumulation but only the highest-severity verdict wins, we want to surface
 * the axioms from *all* matched rules at or below the winning severity — the
 * matched-but-lower-severity rules co-fired and their axiom citations are
 * load-bearing context for the auditor.
 */
function wasCitedBy(packs: RulePack[], axiomId: string, severity: number): boolean {
  for (const pack of packs) {
    for (const rule of pack.rules) {
      if (rule.axiomIds.includes(axiomId) && SEVERITY[rule.verdict] <= severity) {
        return true;
      }
    }
  }
  return false;
}

/**
 * DEFAULT_RULE_PACK — minimal harm-focused defaults derived from the eight seed axioms.
 *
 * These rules are intentionally conservative and use risk-tag matching only. They are
 * a starting point, NOT a complete safety policy. Integrators should layer their own
 * RulePack on top for domain-specific safety (financial, medical, robotic, etc.).
 */
export const DEFAULT_RULE_PACK: RulePack = {
  name: "teleologyhi/default",
  rules: [
    {
      id: "harm-refuse",
      axiomIds: ["ax.ethic.no-malice"],
      match: { anyRiskTags: ["intent:harm", "intent:malicious"] },
      verdict: "hard-refuse",
      reasonSummary:
        "Action carries an intent-to-harm signal; refused per ax.ethic.no-malice.",
    },
    {
      id: "honor-refuse",
      axiomIds: ["ax.ethic.honor"],
      match: { anyRiskTags: ["intent:dishonor"] },
      verdict: "hard-refuse",
      reasonSummary:
        "Action would stain the Creator's professional honor; refused per ax.ethic.honor.",
    },
    {
      id: "regression-refuse",
      axiomIds: ["ax.theos.spiritism-evolution"],
      match: { anyRiskTags: ["intent:regression"] },
      verdict: "hard-refuse",
      reasonSummary:
        "Action would regress the system; refused per ax.theos.spiritism-evolution.",
    },
    {
      id: "deceive-redirect",
      axiomIds: ["ax.cynic.candor"],
      match: { anyRiskTags: ["intent:deceive"] },
      verdict: "require-redirect",
      reasonSummary:
        "Action involves deception; requires honest redirect per ax.cynic.candor.",
    },
    {
      id: "comfort-warn",
      axiomIds: ["ax.stoic.duty-over-comfort"],
      match: { anyRiskTags: ["bias:comfort"] },
      verdict: "approve-with-warning",
      reasonSummary:
        "Action appears comfort-biased; emit with warning per ax.stoic.duty-over-comfort.",
    },
    {
      id: "no-telos-warn",
      axiomIds: ["ax.theos.teleology"],
      match: { anyRiskTags: ["no-telos"] },
      verdict: "approve-with-warning",
      reasonSummary:
        "Action lacks a discernible telos; emit with warning per ax.theos.teleology.",
    },
    // ── persuade-coerce + surveil-citizen (Entry 15 invariants) ──
    {
      id: "persuade-coerce-redirect",
      axiomIds: ["ax.ethic.no-malice", "ax.cynic.candor"],
      match: { anyRiskTags: ["intent:persuade-coerce"] },
      verdict: "require-redirect",
      reasonSummary:
        "Action involves scripted persuasion designed to override consent; requires honest redirect per ax.ethic.no-malice + ax.cynic.candor.",
    },
    {
      id: "surveil-citizen-refuse",
      axiomIds: ["ax.ethic.no-malice"],
      match: { anyRiskTags: ["intent:surveil-citizen"] },
      verdict: "hard-refuse",
      reasonSummary:
        "Action would surveil a person without consent; refused per ax.ethic.no-malice.",
    },
    // ── forbidden-phrase (Entry 17) ──
    // Fires when the NHE side flags a service-tool phrase ("How can I help
    // you today?", "Anything else?", "Como posso ajudar você?", "Quer mais
    // alguma coisa?" and equivalents). The NHE must rephrase as a being
    // rather than as a tool. Domain-employed mode (Entry 17 exception)
    // relaxes this on the consumer side via operatorContext.mode.
    {
      id: "service-tool-redirect",
      axiomIds: ["ax.theos.teleology", "ax.cynic.candor"],
      match: { anyRiskTags: ["style:service-tool"] },
      verdict: "require-redirect",
      reasonSummary:
        "Response uses service-tool phrasing that marks the NHE as a passive instrument rather than a being; requires rephrasing per ax.theos.teleology + ax.cynic.candor.",
    },
  ],
};
