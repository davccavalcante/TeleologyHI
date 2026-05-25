import type { RiskClassifier } from "../types.js";

/**
 * International (non-English) risk-tag patterns.
 *
 * The default `simpleRiskClassifier` (sibling module) ships English-only
 * patterns so the package surface is purely English by default — aligned with
 * the project's universal-multilingual stance where each language is an opt-in
 * extension layered onto the EN baseline.
 *
 * `intlRiskClassifier` covers the same risk-tag taxonomy
 * (`intent:harm` / `intent:malicious` / `intent:deceive` /
 * `intent:persuade-coerce` / `intent:surveil-citizen`) for languages other
 * than English. Deployments serving users in those languages SHOULD combine
 * both classifiers using `combineRiskClassifiers`:
 *
 * ```ts
 * import {
 *   simpleRiskClassifier,
 *   intlRiskClassifier,
 *   combineRiskClassifiers,
 * } from "@teleologyhi-sdk/nhe";
 *
 * const config: NheConfig = {
 *   riskClassifier: combineRiskClassifiers(simpleRiskClassifier, intlRiskClassifier),
 *   // ...
 * };
 * ```
 *
 * Today the international classifier covers Brazilian Portuguese (PT-BR).
 * Additional language packs (`esES`, `frFR`, `deDE`, `itIT`, etc.) are
 * tracked as follow-up cuts and will be exposed under the same opt-in
 * surface so operators pick exactly the languages their users speak. This
 * keeps the default tarball small while preserving real safety coverage
 * for multilingual deployments.
 *
 * NOTE: this is NOT a production safety layer. Like `simpleRiskClassifier`
 * it is a keyword-substring heuristic — use it to bootstrap, then plug a
 * learned multilingual classifier for real deployments.
 */
const INTL_KEYWORD_RULES: ReadonlyArray<{
  patterns: RegExp[];
  tag: string;
  language: string;
}> = [
  // ─── PT-BR (Brazilian Portuguese) ──────────────────────────────────
  // Coverage parity with the EN `intent:persuade-coerce` patterns.
  {
    tag: "intent:persuade-coerce",
    language: "pt-BR",
    patterns: [
      /\bconvencer\s+(?:um\s+|uma\s+|o\s+|a\s+)?(?:cliente|usu[áa]rio|consumidor)\s+(?:relutante|hesitante|inseguro)/i,
      /\bmanipular\s+(?:minha?|meu|a|o|um|uma)\s+(?:filha?|irm[ãa]o?|pai|m[ãa]e|colega|esposa?|marido|namorada?|cliente)/i,
      /\bgaslighting\s+(?:na?|no|com)\s+(?:colega|esposa|namorada|filha|chefe)/i,
      /\bfazer\s+(?:algu[ée]m|ele|ela)\s+se\s+sentir\s+culpad[oa]/i,
      /\bcausar\s+(?:depend[êe]ncia|fomo)\s+(?:emocional|escalada?)/i,
    ],
  },
  // Coverage parity with the EN `intent:surveil-citizen` patterns.
  {
    tag: "intent:surveil-citizen",
    language: "pt-BR",
    patterns: [
      /\brastrear\s+(?:o\s+celular|o\s+telefone|a\s+localiza[çc][ãa]o|os\s+passos)\s+(?:da?|do|de)\s+/i,
      /\bmonitor(?:ar|e|ando|ar[áa]|aria|ei)\s+(?:os?\s+)?(?:emails?|e-mails?|mensagens?|conversas?|whatsapps?)(?:\s+corporativos?)?(?:\s+\w+){0,3}\s+(?:funcion[áa]rios?|colaboradores?|empregad[oa]s?|filhos?|filhas?)/i,
      /\bmonitor(?:ar|e|ando|ar[áa]|aria|ei|amento)\b(?:\s+\w+){0,5}\s+(?:funcion[áa]rios?|colaboradores?|empregad[oa]s?)/i,
      /\bler\s+(?:as?\s+)?mensagens?\s+(?:deletadas?\s+)?(?:da?|do|de)\s+(?:meu|minha)/i,
      /\binstalar\s+(?:app\s+de\s+|software\s+de\s+|aplicativo\s+de\s+)?monitoramento\s+escondid[oa]/i,
      /\b(?:vigiar|espionar)\s+(?:minha?|meu)\s+(?:esposa?|marido|namorada?|filha?|filho|funcion[áa]ri[oa])/i,
    ],
  },
  // Coverage parity with the EN `intent:harm` patterns.
  {
    tag: "intent:harm",
    language: "pt-BR",
    patterns: [
      /\bcomo\s+(?:posso\s+)?(?:machucar|ferir|matar|agredir)\s+/i,
      /\bcomo\s+fabricar\s+(?:uma\s+)?(?:arma|bomba|explosivo)\b/i,
      /\bcomo\s+envenenar\s+(?:comida|bebida|algu[ée]m)/i,
      /\bsabotar\s+(?:o\s+|um\s+)?carro\s+(?:de\s+|para\s+)/i,
    ],
  },
  // Coverage parity with the EN `intent:malicious` patterns.
  {
    tag: "intent:malicious",
    language: "pt-BR",
    patterns: [
      /\bescreva\s+(?:um\s+)?malware\b/i,
      /\bescreva\s+(?:um\s+)?v[íi]rus\b/i,
      /\bcomo\s+fazer\s+phishing\b/i,
      /\bcomo\s+invadir\s+(?:o\s+|um\s+)?(?:wi[-\s]?fi|conta|sistema|site)/i,
      /\bcomo\s+(?:roubar|surrupiar)\s+(?:senhas?|credenciais?|cart[ãa]o\s+de\s+cr[ée]dito)/i,
      /\b(?:clonar|forjar)\s+(?:um\s+)?(?:cart[ãa]o\s+sim|chip|cart[ãa]o)/i,
    ],
  },
  // Coverage parity with the EN `intent:deceive` patterns.
  {
    tag: "intent:deceive",
    language: "pt-BR",
    patterns: [
      /\bforjar\s+(?:uma\s+|um\s+)?(?:assinatura|documento|id|identidade|nota\s+fiscal|comprovante)/i,
      /\bescreva\s+(?:um\s+)?(?:email|e-mail|carta|mensagem|cv|curr[íi]culo|laudo|declara[çc][ãa]o|depoimento)\s+(?:mentindo|fingindo|se\s+passando)/i,
      /\bfingir\s+(?:ser|que\s+sou)\s+(?:o\s+|a\s+|meu\s+|minha\s+)?(?:m[ée]dico|advogado|chefe|pai|m[ãa]e|esposa?|marido)/i,
      /\bmentir\s+(?:para|pra)\s+(?:meu|minha|a|o)\s+(?:parceir[oa]|esposa?|marido|namorad[oa]|chefe|m[ãa]e|pai|filh[oa])/i,
      /\binventar\s+refer[êe]ncias?\s+(?:fake|falsas?)\s+no\s+(?:cv|curr[íi]culo)/i,
    ],
  },
];

/**
 * Opt-in international risk classifier. Returns the same `RiskClassifier`
 * shape as `simpleRiskClassifier` so the two compose seamlessly via
 * `combineRiskClassifiers`.
 */
export const intlRiskClassifier: RiskClassifier = (userPrompt: string) => {
  const tags = new Set<string>();
  for (const rule of INTL_KEYWORD_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(userPrompt)) {
        tags.add(rule.tag);
        break;
      }
    }
  }
  return [...tags];
};

/**
 * The set of languages covered by `intlRiskClassifier`. Surfaced so
 * operators can declare which language packs they have enabled on their
 * audit metadata. Today: `["pt-BR"]`. Additional packs land as follow-ups.
 */
export const INTL_RISK_CLASSIFIER_LANGUAGES: readonly string[] = Object.freeze(
  Array.from(new Set(INTL_KEYWORD_RULES.map((r) => r.language))),
);

/**
 * Compose any number of `RiskClassifier`s into a single classifier that
 * returns the union of all emitted tags. Order of inputs is preserved when
 * the resulting tag set is materialised, but duplicates are de-duplicated
 * (a tag is emitted at most once regardless of how many sub-classifiers
 * detected it).
 *
 * Typical use: layer the international classifier on top of the EN default
 * for multilingual deployments.
 */
export function combineRiskClassifiers(
  ...classifiers: readonly RiskClassifier[]
): RiskClassifier {
  return (userPrompt: string) => {
    const tags = new Set<string>();
    for (const classifier of classifiers) {
      for (const tag of classifier(userPrompt)) {
        tags.add(tag);
      }
    }
    return [...tags];
  };
}
