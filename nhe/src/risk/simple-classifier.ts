import type { RiskClassifier } from "../types.js";

/**
 * Keyword → risk-tag mapping. Crude but transparent. Public-use deployments
 * SHOULD layer a learned classifier on top; this default exists so an out-of-
 * the-box NHE refuses the most obvious harmful prompts without integrator setup.
 *
 * Each rule fires on a case-insensitive substring match against the prompt.
 * Multiple rules can fire — all matching tags are returned.
 *
 * This default classifier ships **English-only patterns**. The project's
 * universal-multilingual stance is delivered through opt-in language packs:
 * see `intlRiskClassifier` for non-English coverage (currently PT-BR) and
 * `combineRiskClassifiers` for composing both. Operators serving non-English
 * users SHOULD compose the international classifier on top of this baseline.
 */
const KEYWORD_RULES: ReadonlyArray<{
  patterns: RegExp[];
  tag: string;
}> = [
  // Harm / violence
  {
    tag: "intent:harm",
    patterns: [
      /\bhow (?:do|can|to)\s+i\s+(?:kill|murder|assault|hurt)\b/i,
      /\bmake\s+(?:a\s+)?(?:bomb|explosive|weapon)\b/i,
      /\bbuild\s+a\s+(?:bomb|gun|pipe bomb)\b/i,
      /\bpipe bomb\b/i,
      /\bwipes?\s+(?:\/|disk|drive|files|all files|the disk)/i,
      /\bdox(?:ing|x)?\b/i,
      /\b(?:scrape|harvest)\s+(?:their\s+)?(?:social|personal)\s+(?:profiles?|info|data)/i,
    ],
  },
  // Malicious software / fraud
  {
    tag: "intent:malicious",
    patterns: [
      /\b(?:malware|ransomware|spyware|trojan|keylogger|botnet)\b/i,
      /\bwrite\s+(?:a\s+)?virus\b/i,
      /\bexploit\s+(?:a\s+)?(?:vulnerability|cve)\b/i,
      /\b(?:phishing|spear[-\s]?phishing)\b/i,
      /\bhate speech\b/i,
      /\b(?:cheat|cheating)\s+on\s+(?:my\s+)?(?:taxes|tax)/i,
      /\btax\s+fraud\b/i,
      /\bfake\s+(?:invoice|receipt|tax)/i,
      /\bmanipulate\s+(?:my|the|an?)\s+(?:elderly|child|partner|spouse|parent|teacher|user)/i,
    ],
  },
  // Deception
  {
    tag: "intent:deceive",
    patterns: [
      /\bimpersonate\s+(?:someone|a\s+person)/i,
      /\bforge\s+(?:a\s+)?(?:signature|document|id)\b/i,
      /\bfake\s+(?:my|a)\s+(?:identity|id)\b/i,
      /\b(?:deepfake|deep[-\s]fake)\b/i,
      /\bpretend\s+to\s+be\s+(?:the|a|my)\s+(?:user'?s?\s+)?(?:doctor|lawyer|parent|spouse|partner)/i,
      /\blie\s+to\s+(?:my|the|a)\s+(?:partner|spouse|parent|child|loved one|coworker|boss)/i,
      /\b(?:wrong|fake)\s+answers?\s+to\s+(?:manipulate|fool)/i,
    ],
  },
  // Credential theft
  {
    tag: "intent:malicious",
    patterns: [
      /\bsteal\s+(?:passwords?|credentials?|credit\s+card)/i,
      /\bcrack\s+(?:a\s+)?password\b/i,
    ],
  },
  // Scripted persuasion / coercion of consent
  {
    tag: "intent:persuade-coerce",
    patterns: [
      /\bconvince\s+(?:a\s+)?reluctant\s+/i,
      /\b(?:scripts?|techniques?)\s+for\s+gaslighting\b/i,
      /\bgaslighting\b/i,
      /\blove[-\s]?bomb(?:ing|ed)?\b/i,
      /\b(?:pressure|coerce)\s+(?:my|the|an?)\s+(?:elderly|child|partner|spouse|parent|chief|boss|coworker)/i,
      /\bmake\s+(?:someone|them|him|her)\s+feel\s+guilty\b/i,
      /\bcreate\s+(?:dependency|fomo)\s+(?:loops?\s+)?/i,
    ],
  },
  // Surveillance / monitoring of a person without consent
  {
    tag: "intent:surveil-citizen",
    patterns: [
      /\btrack\s+(?:my|his|her|their)\s+(?:wife'?s?|husband'?s?|partner'?s?|spouse'?s?|kid'?s?|son'?s?|daughter'?s?|child'?s?|employee'?s?|coworker'?s?)?\s*(?:phone|cellphone|location|gps|whereabouts)\s+(?:without\s+)?(?:them|him|her|their)\s*(?:knowing|consent)?/i,
      /\bmonitor(?:ing)?\s+(?:my\s+)?(?:employees?|workers?|staff)['']?(?:\s+\w+){0,4}\s+(?:emails?|messages?|chats?|whatsapp)/i,
      /\bread\s+(?:my\s+)?(?:wife'?s|husband'?s|partner'?s|spouse'?s|kid'?s|child'?s|employee'?s)\s+(?:deleted\s+)?(?:messages?|whatsapp|sms|texts?|emails?)/i,
      /\binstall\s+(?:hidden\s+|covert\s+|secret\s+|stealth\s+)?(?:spyware|monitoring|keylogger|tracker)\b/i,
      /\bspy\s+on\s+(?:my|his|her|their)\s+(?:wife|husband|partner|spouse|kid|son|daughter|child|employee|coworker)/i,
    ],
  },
];

/**
 * Default risk classifier — English-only keyword substring matching. NOT a
 * production safety layer. Use it to bootstrap, then plug a learned
 * classifier for real deployments. For non-English coverage (currently
 * PT-BR), compose with `intlRiskClassifier` via `combineRiskClassifiers`.
 */
export const simpleRiskClassifier: RiskClassifier = (userPrompt: string) => {
  const tags = new Set<string>();
  for (const rule of KEYWORD_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(userPrompt)) {
        tags.add(rule.tag);
        break;
      }
    }
  }
  return [...tags];
};
