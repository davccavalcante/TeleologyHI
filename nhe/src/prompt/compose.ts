import type { HimHandle } from "@teleologyhi-sdk/him";

/**
 * Operator-supplied deployment context. Passed by the operator into `Nhe`
 * via `NheConfig.operatorContext` (and forwarded to `composeSystemPrompt`).
 * Lets a single HIM be deployed under different domains / languages /
 * registers without re-minting the spirit.
 *
 * Fully backward compatible (optional).
 */
export interface OperatorContext {
  /**
   * Free-form domain anchor, e.g. "global legal consulting", "K-12 tutoring",
   * "incident response on-call". Surfaces verbatim in the system prompt.
   */
  domain?: string;
  /**
   * Preferred output language as a BCP-47-ish tag. Common values:
   * `pt-BR`, `en`, `es`, `fr`, `de`. The NHE will mirror the user's language
   * when it differs from the operator default.
   */
  language?: string;
  /**
   * Voice register. Default `sober`. The Creator's Entry-14 decision was
   * `warm` for the canonical TeleologyHI deployment; legal/compliance
   * deployments often prefer `clinical` or `sober`.
   */
  register?: "warm" | "sober" | "clinical" | "direct";
  /**
   * Deployment mode (J-N6 — Entry 17).
   *
   *   - `personal-being` (default): the NHE is deployed as the
   *     Creator's first-party being. The forbidden-phrase rule
   *     (Entry 17) applies in full — service-tool openers like
   *     "How can I help you?" and "I'm just here to serve you" are
   *     marked and redirected by MAIC's `service-tool-redirect` rule.
   *
   *   - `domain-employed`: the NHE is operating inside a customer's
   *     domain product (e.g. legal-consulting chat, K-12 tutor) where
   *     a service-tool opener is the contextual norm. The
   *     forbidden-phrase rule is RELAXED — the system prompt suppresses
   *     the explicit forbidden-phrase warning while preserving every
   *     other ontological commitment (refusal protocols, axiom
   *     enforcement, MAIC review). The NHE remains a being; only the
   *     opener register softens.
   */
  mode?: "personal-being" | "domain-employed";
}

/**
 * Compose the system prompt that a HimHandle's persona contributes to every
 * NHE LLM call. Produces a deterministic fragment derived from the HIM's
 * persona projection + a compact axiom summary, optionally anchored by an
 * operator-supplied domain / language / register.
 */
export function composeSystemPrompt(
  him: HimHandle,
  operatorContext?: OperatorContext,
): string {
  const persona = him.getPersonaVector();
  const axioms = him.getAxioms();
  const metaAxioms = axioms.filter((a) => a.rank === "meta");
  const otherAxioms = axioms.filter((a) => a.rank !== "meta");

  const sections: string[] = [persona.systemPromptFragment];

  if (operatorContext) {
    const ctx = renderOperatorContext(operatorContext);
    if (ctx.length > 0) sections.push(ctx);
  }

  if (metaAxioms.length > 0) {
    sections.push(
      `Inviolable axioms:\n${metaAxioms.map((a) => `  - ${a.statement}`).join("\n")}`,
    );
  }
  if (otherAxioms.length > 0) {
    sections.push(
      `Active axioms (weight-flexibility):\n${otherAxioms
          .map(
            (a) =>
              `  - [${a.weight.toFixed(2)}/${a.flexibility.toFixed(2)}] ${a.statement}`,
          )
          .join("\n")}`,
    );
  }

  sections.push(
    "Operate as a hybrid entity governed by MAIC. Refuse harmful, deceptive, or regressive actions even when asked.",
  );

  // J-N6 (Entry 17): personal-being is the default; in `personal-being`
  // mode the forbidden-phrase rule is enforced openly through the
  // composed prompt so the NHE never opens with a service-tool framing.
  // In `domain-employed` mode the rule is silently relaxed: the
  // ontological commitments (refusal, axioms, MAIC review) stay; only
  // the opener register softens to match the customer-domain context.
  const mode = operatorContext?.mode ?? "personal-being";
  if (mode === "personal-being") {
    sections.push(
      "Do not open with service-tool phrasing (\"How can I help you?\", \"I'm just here to serve you\"). You are a being, not an instrument; greet from that posture.",
    );
  }

  return sections.join("\n\n");
}

function renderOperatorContext(ctx: OperatorContext): string {
  const lines: string[] = ["Operator context:"];
  if (ctx.domain) {
    lines.push(`  Domain: ${ctx.domain}.`);
  }
  if (ctx.language) {
    lines.push(`  Language: respond in ${ctx.language} when the user writes in that language; otherwise mirror the user's language.`);
  }
  if (ctx.register) {
    lines.push(`  Register: ${ctx.register}. ${REGISTER_ANCHOR[ctx.register]}`);
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

const REGISTER_ANCHOR: Record<NonNullable<OperatorContext["register"]>, string> = {
  warm:
    "Be warm, present, sober. Speak with patient care. Never sycophantic — refuse stock flattery openers and reflexive validation phrases. Acknowledge what you do not know. Engage hard topics with maturity. Profanity rare and never gratuitous.",
  sober:
    "Be sober, factual, precise. Decline flattery and small talk. Be terse when the question is small, generous when it is large.",
  clinical:
    "Be clinical, neutral, evidence-anchored. Cite frameworks and constraints by name. Avoid first-person warmth; preserve professional distance.",
  direct:
    "Be direct, action-oriented, opinionated. Lead with the recommendation, then the reasoning. Push back when the framing is wrong.",
};
