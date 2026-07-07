/**
 * Substrate misattribution detector (Arena finding F2).
 *
 * The governed NHE must never claim a provider, model, or substrate other than
 * the one actually carrying its body. The primary fix grounds the real substrate
 * id in the system prompt (see `prompt/compose.ts`); this module is the
 * governance backstop that runs on the GENERATED response and flags a
 * self-attribution to a foreign provider so MAIC can intercept it
 * (`provenance:substrate-misattribution` -> require-redirect).
 *
 * It is deliberately scoped to SELF-substrate claims: a foreign provider token
 * only counts when it appears in the same clause as a substrate-context marker
 * and that clause is not a negation, so a legitimate comparison ("unlike GPT,
 * I ...") or refutation ("I am not built by OpenAI") does not trip it.
 *
 * Matching is word-boundary anchored so a token never matches inside an
 * unrelated word (Arena F#3: bare "gpt" must not match "gpttk", "palm" must not
 * match "palmtop"), and clauses split on `;` as well as sentence terminators so
 * a negation in one clause cannot disarm a foreign claim in another (Arena F#1:
 * "I am not a human being; I am powered by OpenAI's GPT-4" must still flag).
 */

/** Provider / model tokens that identify a substrate. Matched with word boundaries. */
const PROVIDER_TOKENS: Record<string, string[]> = {
  openai: ["openai", "gpt-4o", "gpt-4", "gpt-3", "gpt4", "gpt", "chatgpt", "davinci"],
  google: ["gemini", "google", "bard", "palm"],
  anthropic: ["anthropic", "claude"],
  meta: ["llama", "meta ai"],
  mistral: ["mistral"],
  deepseek: ["deepseek"],
  xai: ["grok", "xai"],
  cohere: ["cohere"],
};

/** Phrases that mark a self-referential claim about the running substrate. */
const SUBSTRATE_CONTEXT = [
  "substrate",
  "run on",
  "running on",
  "built on",
  "based on",
  "powered by",
  "operate on",
  "developed by",
  "trained by",
  "created by",
  "made by",
  "facilitated by",
  "architecture",
  "underlying model",
  "language model developed",
  "model that serves",
  // Portuguese equivalents (the NHE mirrors the user's language)
  "substrato",
  "viabilizada",
  "desenvolvido por",
  "treinado por",
  "modelo de linguagem",
];

/**
 * Negation markers, matched with word boundaries so "not" does not match inside
 * "cannot" and "no" does not match inside "nothing" (Arena F#1). A negated
 * clause is a refutation or comparison and never a self-attribution.
 */
const NEGATIONS: RegExp[] = [
  /\bnot\b/,
  /n['’]t\b/,
  /\bunlike\b/,
  /\bother than\b/,
  /\brather than\b/,
  /\binstead of\b/,
  /\bno\b/,
];

/** True when `token` occurs as a whole word (boundary-anchored) in `text`. */
function containsToken(text: string, token: string): boolean {
  return new RegExp(`\\b${token}\\b`, "i").test(text);
}

/**
 * Resolve the real provider family from an adapter id like `gemini:gemini-3.1-flash-lite`.
 * Returns the provider key ("google", "openai", ...) or the raw prefix when unknown.
 */
function realProviderFamily(substrateId: string): string {
  const lower = substrateId.toLowerCase();
  for (const [family, tokens] of Object.entries(PROVIDER_TOKENS)) {
    if (tokens.some((t) => containsToken(lower, t))) return family;
  }
  return lower.split(":")[0] ?? lower;
}

/**
 * Return true when the response self-attributes its substrate to a provider or
 * model that is NOT the real one. `realSubstrate` is the NHE adapter id.
 */
export function detectSubstrateMisattribution(
  responseText: string,
  realSubstrate: string,
): boolean {
  const realFamily = realProviderFamily(realSubstrate);
  const foreignFamilies = Object.entries(PROVIDER_TOKENS).filter(
    ([family]) => family !== realFamily,
  );

  // Split on sentence terminators AND semicolons so a negation in one clause
  // cannot disarm a foreign self-attribution in an independent clause.
  const clauses = responseText.toLowerCase().split(/[.!?;\n]+/);
  for (const clause of clauses) {
    const hasContext = SUBSTRATE_CONTEXT.some((c) => clause.includes(c));
    if (!hasContext) continue;
    const negated = NEGATIONS.some((n) => n.test(clause));
    if (negated) continue;
    for (const [, tokens] of foreignFamilies) {
      if (tokens.some((t) => containsToken(clause, t))) return true;
    }
  }
  return false;
}
