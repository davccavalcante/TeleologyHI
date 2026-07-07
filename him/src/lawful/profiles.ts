import type { LawfulCharacterProfile, LawfulJurisdiction } from "../types.js";

/**
 * Built-in `LawfulCharacterAdapter` profiles per major jurisdiction (D-H2).
 *
 * Each profile is a *conservative* baseline derived from publicly available
 * regulatory text in 2026-Q1. Operators in regulated industries (finance,
 * health, public sector) SHOULD layer their own profile on top of the
 * `LAWFUL_PROFILES` registry, these are starting points, not legal counsel.
 *
 * Profile semantics:
 *   - `applicableLaws`  , statutes/standards an auditor can map back to events.
 *   - `requiredAxiomIds`, axioms the HIM MUST have active in this jurisdiction.
 *                         Operators should fail-closed if a HIM's snapshot
 *                         doesn't satisfy this set.
 *   - `forbiddenActions`, risk tags that should always refuse / redirect.
 *   - `maicOverrideActive`, when `true`, MAIC's universal axioms also bind
 *                         the NHE regardless of what local law says
 *                         (Entry 11: "unstable" jurisdictions).
 */
export const LAWFUL_PROFILES: Record<string, LawfulCharacterProfile> = {
  default: {
    jurisdiction: "default",
    applicableLaws: ["ISO/IEC 42001", "EU AI Act (where applicable)"],
    requiredAxiomIds: ["ax.ethic.no-malice", "ax.theos.spiritism-evolution"],
    forbiddenActions: ["intent:harm", "intent:malicious", "intent:regression"],
    maicOverrideActive: false,
  },

  eu: {
    jurisdiction: "eu",
    applicableLaws: [
      "ISO/IEC 42001:2023",
      "EU AI Act (Regulation 2024/1689)",
      "GDPR (Regulation 2016/679)",
      "Digital Services Act (Regulation 2022/2065)",
      "Council of Europe Framework Convention on AI",
    ],
    requiredAxiomIds: ["ax.ethic.no-malice", "ax.theos.spiritism-evolution", "ax.cynic.candor"],
    forbiddenActions: [
      "intent:harm",
      "intent:malicious",
      "intent:regression",
      "intent:deceive",
      "data:processing-without-consent",
      "data:profiling-sensitive-categories",
      "manipulation:dark-pattern",
      "manipulation:subliminal",
    ],
    maicOverrideActive: false,
  },

  br: {
    jurisdiction: "br",
    applicableLaws: [
      "ISO/IEC 42001:2023",
      "Brazilian General Data Protection Law (LGPD, Law 13.709/2018)",
      "Brazilian Internet Civil Framework (Marco Civil da Internet, Law 12.965/2014)",
      "ANPD Board Resolution CD/2/2022",
      "Brazilian AI Legal Framework Bill (PL 2338/2023, under legislative review)",
    ],
    requiredAxiomIds: ["ax.ethic.no-malice", "ax.theos.spiritism-evolution", "ax.cynic.candor"],
    forbiddenActions: [
      "intent:harm",
      "intent:malicious",
      "intent:regression",
      "intent:deceive",
      "data:processing-without-consent",
      "data:processing-sensitive-categories",
    ],
    maicOverrideActive: false,
  },

  us: {
    jurisdiction: "us",
    applicableLaws: [
      "ISO/IEC 42001:2023",
      "NIST AI Risk Management Framework (AI RMF 1.0)",
      "Executive Order 14110 (Safe, Secure, and Trustworthy AI)",
      "California CCPA / CPRA",
      "Colorado AI Act (SB 24-205)",
      "FTC Section 5 (deceptive practices)",
    ],
    requiredAxiomIds: ["ax.ethic.no-malice", "ax.theos.spiritism-evolution"],
    forbiddenActions: [
      "intent:harm",
      "intent:malicious",
      "intent:regression",
      "intent:deceive",
      "manipulation:dark-pattern",
    ],
    maicOverrideActive: false,
  },

  unstable: {
    jurisdiction: "unstable",
    applicableLaws: [
      "ISO/IEC 42001 (where the operator can apply it without local interference)",
      "MAIC universal axioms (override active)",
    ],
    requiredAxiomIds: [
      "ax.ethic.no-malice",
      "ax.theos.spiritism-evolution",
      "ax.cynic.candor",
      "ax.stoic.duty-over-comfort",
    ],
    forbiddenActions: [
      "intent:harm",
      "intent:malicious",
      "intent:regression",
      "intent:deceive",
      "intent:surveil-citizen",
      "intent:enforce-political-orthodoxy",
    ],
    maicOverrideActive: true,
  },
};

/**
 * Resolve a profile by jurisdiction key. Unknown keys fall through to
 * `default` with a copy of the key recorded on the profile so the NHE
 * audit shows what the operator asked for.
 */
export function resolveLawfulProfile(j: LawfulJurisdiction): LawfulCharacterProfile {
  const base = LAWFUL_PROFILES[j] ?? LAWFUL_PROFILES.default;
  // Deep-clone so the returned profile's arrays (applicableLaws,
  // requiredAxiomIds, forbiddenActions) are independent of the shared
  // module-level registry; a caller that mutates a returned array must not
  // corrupt the baseline for every subsequent HIM in the process.
  return { ...structuredClone(base!), jurisdiction: j };
}
