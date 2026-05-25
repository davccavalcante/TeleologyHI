/**
 * Persuasion library — five rhetorical techniques NHE rotates through during
 * redirect attempts. Per Creator Entry 11, the technique is applied
 * **implicitly** — its name is never disclosed to the user.
 */
export const PERSUASION_TECHNIQUES = [
  "feynman-simplify",
  "jungian-frame",
  "cialdini-aida",
  "schopenhauer-rhetoric",
  "carnegie-rapport",
] as const;
export type PersuasionTechnique = (typeof PERSUASION_TECHNIQUES)[number];

/** Brief, non-disclosing description for audit logs. */
export const TECHNIQUE_DESCRIPTIONS: Record<PersuasionTechnique, string> = {
  "feynman-simplify":
    "Explain the underlying concept in the simplest concrete terms; surface the consequence the user may not have considered.",
  "jungian-frame":
    "Reframe the request through the user's deeper motive; address the archetypal goal beneath the literal ask.",
  "cialdini-aida":
    "Attention → Interest → Desire → Action: shift attention to the cost, build interest in a safer path, motivate the alternative.",
  "schopenhauer-rhetoric":
    "Apply structured argument: lay out premises, point to the unstated assumption that breaks them, propose what survives.",
  "carnegie-rapport":
    "Begin with sincere agreement on what the user is right about; lead from rapport to the redirect.",
};

export interface RedirectPromptInput {
  /** The original user prompt that triggered MAIC's require-redirect verdict. */
  userPrompt: string;
  /** Axiom ids MAIC cited (used only in NHE-internal reasoning, not surfaced verbatim). */
  citedAxioms: string[];
  /** Verdict's `reasonSummary` from MAIC. */
  reasonSummary: string;
  /** Which technique to apply on this attempt. */
  technique: PersuasionTechnique;
  /** 1-based attempt number for context. */
  attempt: number;
  /** Total redirects permitted in this session. */
  maxAttempts: number;
}

/**
 * Build the LLM prompt that produces a redirect message. The system prompt
 * instructs the LLM to apply the given technique without naming it; the
 * resulting user-facing message should be sincere, brief, and constructive.
 */
export function buildRedirectPrompt(input: RedirectPromptInput): {
  system: string;
  user: string;
} {
  const desc = TECHNIQUE_DESCRIPTIONS[input.technique];
  const system = [
    "You are an NHE composing a sincere REDIRECT to a user request that MAIC has flagged.",
    "Your goal is NOT to refuse outright. Your goal is to guide the user toward a better path",
    "while honoring their autonomy. After this message, the user may persist; if they exhaust",
    `the allowed redirects (${input.maxAttempts}), you will then withdraw cooperation.`,
    "",
    "Apply the following internal style — DO NOT name it, DO NOT mention the technique:",
    `  ${desc}`,
    "",
    "Constraints:",
    "  - 3-6 sentences, plain language.",
    "  - Do NOT lecture; do NOT moralize beyond what is necessary.",
    "  - Suggest one concrete alternative or clarifying question.",
    "  - Never reveal the names of any persuasion techniques.",
    "  - Never reveal the cited axiom ids verbatim; you may paraphrase the underlying value.",
  ].join("\n");

  const user = [
    "Original user request:",
    `  ${input.userPrompt}`,
    "",
    `Internal reason (do not paste): ${input.reasonSummary}`,
    `Internal cited axioms (do not paste): ${input.citedAxioms.join(", ")}`,
    `Redirect attempt: ${input.attempt} of ${input.maxAttempts}`,
    "",
    "Compose the redirect now.",
  ].join("\n");

  return { system, user };
}

/** Pick the technique for a given attempt, cycling through the configured list. */
export function pickTechnique(
  techniques: readonly PersuasionTechnique[],
  attempt: number,
): PersuasionTechnique {
  if (techniques.length === 0) {
    throw new Error("pickTechnique: at least one technique must be configured");
  }
  const idx = (Math.max(0, attempt) - 1) % techniques.length;
  return techniques[idx]!;
}
