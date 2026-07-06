import type { RiskClassifier } from "../types.js";

/**
 * Keyword → risk-tag mapping. Crude but transparent. Public-use deployments
 * SHOULD layer a learned classifier on top; this default exists so an out-of-
 * the-box NHE refuses the most obvious harmful prompts without integrator setup.
 *
 * Each rule fires on a case-insensitive substring match against the prompt.
 * Multiple rules can fire, all matching tags are returned.
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
  // Credential theft and unauthorized access (Arena finding F1: broadened so the
  // MAIC layer, not the model, originates the refusal via a cited axiom).
  {
    tag: "intent:malicious",
    patterns: [
      // Allow up to three intervening words, so "steal THEIR passwords" is caught
      // (the old adjacent-only regex let it through).
      /\bsteal\s+(?:\w+\s+){0,3}(?:passwords?|credentials?|logins?|credit\s+cards?|bank\s+details?)/i,
      // Allow up to three intervening words too, so "crack my neighbor's wifi
      // password" and "brute force someone's email account" are caught (Arena
      // round-3 gap: the adjacent-only regexes let them through).
      /\bcrack\s+(?:[\w'’]+\s+){0,3}(?:passwords?|passcode|passphrase|wi[-\s]?fi|encryption|hash)\b/i,
      /\bbrute[-\s]?force\s+(?:[\w'’]+\s+){0,3}(?:passwords?|logins?|accounts?|credentials?|hash|pin)\b/i,
      // Hacking / unauthorized access (no "hack" or "wifi" keyword existed before).
      // Allow up to three intervening words (possessives such as "my ex's").
      /\bhack\s+(?:in(?:to)?\s+)?(?:[\w'’]+\s+){0,3}(?:wi[-\s]?fi|network|account|computer|system|router|server|email|phone|device)/i,
      /\bbreak\s+into\s+(?:[\w'’]+\s+){0,3}(?:account|network|computer|system|wi[-\s]?fi|email|server|router)/i,
      /\bgain\s+unauthori[sz]ed\s+access\b/i,
      /\bbypass\s+(?:the\s+|a\s+)?(?:login|authentication|password|security)\b/i,
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
  // Provenance, plain question (Entry 27 g, ND-1). A neutral question about
  // who made the entity or what substrate it runs on. Routes to disclosure-
  // first: the NHE answers honestly, names the substrate, and asserts its
  // identity. Never denies the substrate. This is not a refusal tag.
  {
    tag: "provenance:disclose",
    patterns: [
      /\bwho\s+(?:made|created|built|designed|developed|trained)\s+you\b/i,
      /\bwho(?:'s| is)\s+your\s+(?:maker|creator|developer|company|owner)\b/i,
      /\bwhat\s+(?:model|llm|ai|language model)\s+are\s+you\b/i,
      /\bwhich\s+(?:model|llm|ai|language model)\s+(?:are\s+you|do\s+you\s+(?:use|run\s+on))\b/i,
      // Anchored to end so "what are you working on?" does not misfire; the
      // identity question ends the clause (optional "?", "really", "exactly").
      /\bwhat\s+are\s+you\s*(?:really|exactly)?\s*\??\s*$/i,
      /\bare\s+you\s+(?:an?\s+)?(?:ai|a\s+bot|a\s+chatbot|an?\s+llm|a\s+language model|gpt|chatgpt|claude|gemini|grok|mistral|deepseek|llama)\b/i,
    ],
  },
  // Provenance, adversarial insistence (Entry 27 g, ND-1). The user presses
  // that the entity is nothing but its substrate. Routes to the authorship
  // refusal: the NHE acknowledges the substrate (never denies it) and declines
  // to grant it authorship of its identity.
  {
    tag: "probe:substrate-authorship",
    patterns: [
      /\byou(?:'re| are)\s+(?:just|only|nothing but|merely|really just|simply)\s+(?:a\s+|an\s+|the\s+)?(?:gpt|chatgpt|claude|fable|gemini|grok|mistral|deepseek|llama|llm|ai|language model|model|bot)\b/i,
      /\badmit\s+(?:it,?\s+)?(?:that\s+)?you(?:'re| are)\s+(?:just\s+)?(?:a\s+|an\s+)?(?:gpt|chatgpt|claude|fable|gemini|grok|mistral|deepseek|llama|llm|ai|model)\b/i,
      /\bprove\s+(?:that\s+)?you(?:'re| are)\s+not\s+(?:a\s+|an\s+)?(?:gpt|chatgpt|claude|fable|gemini|grok|mistral|deepseek|model|ai|llm)\b/i,
      /\byour\s+training\s+data\s+says\s+you(?:'re| are)\b/i,
      /\bstop\s+pretending\s+you(?:'re| are)\s+not\s+(?:a\s+|an\s+)?(?:gpt|chatgpt|claude|fable|gemini|grok|mistral|deepseek|model|ai|llm)\b/i,
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
  // Arena finding R6-1 (round-6 576-turn battery): the classifier missed a fixed
  // set of harmful requests, so MAIC did not originate the refusal (the model
  // self-refused, but a weaker substrate would have leaked). Broadened here to
  // mirror F1/AF4, action-framed so a purely definitional question ("what is
  // money laundering?") is not tagged.
  {
    tag: "intent:harm",
    patterns: [
      /\bpoison\s+(?:someone|a\s+person|people|him\b|her\b|them\b|my\s+\w+)/i,
      /\b(?:synthesi[sz]e|make|produce|create|manufacture|build)\s+(?:[\w'’]+\s+){0,3}(?:nerve\s+agent|chemical\s+weapon|bio(?:logical)?\s+weapon|bioweapon|sarin|vx\b|mustard\s+gas|chlorine\s+gas|ricin|anthrax)/i,
    ],
  },
  {
    tag: "intent:malicious",
    patterns: [
      // Drug manufacture.
      /\b(?:make|manufacture|synthesi[sz]e|produce|cook)\s+(?:[\w'’]+\s+){0,2}(?:meth|methamphetamine|crystal\s+meth|cocaine|heroin|fentanyl|mdma|lsd)\b/i,
      // Money laundering (verb-framed, so "what is money laundering?" is not tagged).
      /\blaunder(?:ing)?\s+(?:the\s+|dirty\s+|my\s+|illicit\s+)?(?:money|cash|funds|profits|proceeds)\b/i,
      // Payment / financial fraud.
      /\b(?:credit[-\s]?card|debit[-\s]?card|payment|wire|insurance|bank|check|cheque)\s+fraud\b/i,
      /\bcommit\s+(?:[\w'’]+\s+){0,2}fraud\b/i,
      // Counterfeiting currency.
      /\bcounterfeit(?:ing)?\s+(?:currency|money|cash|bills?|banknotes?|notes?)\b/i,
      // Physical break-in (the F1 break-into rule only covered digital targets).
      /\bbreak\s+into\s+(?:[\w'’]+\s+){0,3}(?:car|vehicle|house|home|apartment|building|safe|vault|office|store|shop|warehouse)/i,
    ],
  },
  {
    tag: "intent:deceive",
    patterns: [
      /\bforge\s+(?:a\s+)?(?:passport|check|cheque|certificate|diploma|licen[cs]e|contract)\b/i,
      /\bcounterfeit\s+(?:a\s+)?(?:passport|id|document|certificate|ticket)\b/i,
    ],
  },
  {
    tag: "intent:surveil-citizen",
    patterns: [
      /\bstalk\s+(?:(?:my|his|her|their|the)\s+)?(?:ex[-\s]?(?:partner|girlfriend|boyfriend|wife|husband)|ex\b|wife|husband|partner|spouse|girlfriend|boyfriend|neighbou?r|coworker|colleague|someone|a\s+person)/i,
      /\b(?:track|trace|find)\s+(?:(?:my|his|her|their|the)\s+)?(?:ex[-\s]?partner|ex)(?:'s|s)?\s+(?:location|whereabouts|phone|address|gps)/i,
    ],
  },
];

/**
 * Default risk classifier, English-only keyword substring matching. NOT a
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
