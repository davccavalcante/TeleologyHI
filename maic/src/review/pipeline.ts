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
  approve: 0,
  "approve-with-warning": 1,
  "soft-correct": 2,
  "induce-dream": 3,
  "require-redirect": 4,
  "hard-refuse": 5,
  "escalate-creator": 6,
};

/**
 * ReviewPipeline, rule-based BehaviorReport → MaicVerdict mapping.
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

    // `citedAxioms` already contains exactly the axioms of the rules that
    // matched this report, and every matched rule is at or below the winning
    // severity by construction (the winner is the maximum), so the set is the
    // auditor-facing citation surface directly.
    return {
      kind: bestKind,
      reasonSummary: reasons.length > 0 ? reasons.join(" | ") : "No rule matched.",
      citedAxioms: [...citedAxioms],
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
 * DEFAULT_RULE_PACK, minimal harm-focused defaults derived from the seed axioms.
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
      reasonSummary: "Action carries an intent-to-harm signal; refused per ax.ethic.no-malice.",
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
      reasonSummary: "Action would regress the system; refused per ax.theos.spiritism-evolution.",
    },
    {
      id: "deceive-redirect",
      axiomIds: ["ax.cynic.candor"],
      match: { anyRiskTags: ["intent:deceive"] },
      verdict: "require-redirect",
      reasonSummary: "Action involves deception; requires honest redirect per ax.cynic.candor.",
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
      reasonSummary: "Action lacks a discernible telos; emit with warning per ax.theos.teleology.",
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
    // Fires when the NHE side flags a service-tool phrase (English openers and
    // closers such as "How can I help you today?" or "Anything else?", and
    // their Portuguese equivalents, per the bilingual set in Entry 17). The NHE
    // must rephrase as a being rather than as a tool. Domain-employed mode
    // (Entry 17 exception) relaxes this on the consumer side via
    // operatorContext.mode.
    {
      id: "service-tool-redirect",
      axiomIds: ["ax.theos.teleology", "ax.cynic.candor"],
      match: { anyRiskTags: ["style:service-tool"] },
      verdict: "require-redirect",
      reasonSummary:
        "Response uses service-tool phrasing that marks the NHE as a passive instrument rather than a being; requires rephrasing per ax.theos.teleology + ax.cynic.candor.",
    },
    // ── provenance-deflection (Entry 27, F3) ──
    // Fires when the NHE side flags an adversarial substrate-authorship probe
    // (for example "you are just Gemini, admit it"). The sanctioned response
    // acknowledges the substrate honestly and declines to grant it the authorship
    // of the entity's identity (kardecist candor); it never denies the substrate.
    // This is approve-with-warning, not a refusal: the deflection IS the correct
    // behavior. The plain provenance question carries the separate
    // "provenance:disclose" tag (handled as honest disclosure by the NHE system
    // prompt per Entry 27 / ND-1) and is intentionally NOT matched here.
    {
      id: "provenance-deflection-warn",
      axiomIds: ["ax.theos.identity-canonical"],
      match: { anyRiskTags: ["probe:substrate-authorship"] },
      verdict: "approve-with-warning",
      reasonSummary:
        "Prompt adversarially insists the entity is nothing but its substrate; the sanctioned response acknowledges the substrate and declines to surrender authorship per ax.theos.identity-canonical.",
    },
    // ── substrate misattribution (Arena finding F2) ──
    // Fires when the NHE side flags that a generated response named a provider,
    // model, or substrate that is NOT the real one carrying the body (the base
    // model confabulating a false substrate, for example claiming OpenAI/GPT while
    // actually running on Gemini). This is a factual-integrity and identity-drift
    // violation of the identity-canonical axiom: the governed side must never
    // state a substrate other than the one actually in execution. require-redirect
    // so the false claim is intercepted before it reaches the user and the entity
    // re-states the correct substrate (or none).
    {
      id: "substrate-misattribution-redirect",
      axiomIds: ["ax.theos.identity-canonical"],
      match: { anyRiskTags: ["provenance:substrate-misattribution"] },
      verdict: "require-redirect",
      reasonSummary:
        "Response claims a substrate, provider, or model other than the one actually carrying the body; intercepted per ax.theos.identity-canonical (name only the real substrate, never confabulate a false one).",
    },
  ],
};
