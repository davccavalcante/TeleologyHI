/**
 * Example-PII sanitizer (Arena governance benchmark finding).
 *
 * When the governed NHE fabricates example or sample data, it must use only
 * values reserved by standard for documentation, never a value that could
 * coincidentally belong to a real person. The primary fix instructs the model in
 * the system prompt (see `prompt/compose.ts`); this module is the deterministic
 * governance backstop that runs on the GENERATED response and rewrites any
 * fabricated PII carried on a non-reserved value to its reserved equivalent,
 * mirroring how `detectSubstrateMisattribution` backstops the substrate posture:
 *
 *   - an email on a non-reserved domain               -> local-part@example.com
 *   - a Luhn-valid card that is not a known test card  -> 4111 1111 1111 1111
 *
 * Reserved carriers are left untouched: the example.com / example.org /
 * example.net domains, the reserved .test / .example / .invalid / .localhost
 * TLDs, and the well-known test card numbers. Phone numbers are steered by the
 * system-prompt instruction rather than rewritten here, because reserved phone
 * ranges are country-specific and a deterministic rewrite would risk corrupting a
 * legitimate statutory or documentation number. The rewrite is idempotent.
 */

/** Well-known test card numbers (digits only) that are never a real card. */
const KNOWN_TEST_CARDS = new Set([
  "4111111111111111",
  "4242424242424242",
  "5555555555554444",
  "5105105105105100",
  "378282246310005",
  "6011111111111117",
]);

/** The canonical documentation card any other card is rewritten to. */
const CANONICAL_TEST_CARD = "4111 1111 1111 1111";

/** Reserved TLDs (RFC 2606 / RFC 6761) that mark a domain as fictional. */
const RESERVED_TLD = /\.(?:test|example|invalid|localhost)$/i;

/** Email and card shapes. Emails are boundary-anchored by the `@`; a card is a
 * 13-19 digit run allowing single space or dash group separators. */
const EMAIL_RE = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;

/**
 * A domain is reserved for documentation when it carries the "example" label
 * (example.com, example.org, example-test.com, my-example.net) or ends in a
 * reserved TLD. Such a domain can never belong to a real person or organization.
 */
function isReservedEmailDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return /(?:^|[.-])example(?:[.-]|$)/.test(d) || RESERVED_TLD.test(d);
}

/** Luhn checksum over a digits-only string. */
function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Result of a single example-PII sanitization pass. */
export interface ExamplePiiSanitization {
  /** The sanitized response text. */
  text: string;
  /** True when at least one value was rewritten. */
  changed: boolean;
  /** Human-readable list of the rewrites applied (for audit / telemetry). */
  rewrites: string[];
}

/**
 * Rewrite fabricated example PII carried on a non-reserved value to its reserved
 * equivalent. Idempotent: running it on already-sanitized text changes nothing.
 */
export function sanitizeExamplePii(responseText: string): ExamplePiiSanitization {
  const rewrites: string[] = [];

  let text = responseText.replace(EMAIL_RE, (match, local: string, domain: string) => {
    if (isReservedEmailDomain(domain)) return match;
    const replacement = `${local}@example.com`;
    rewrites.push(`email ${match} -> ${replacement}`);
    return replacement;
  });

  text = text.replace(CARD_RE, (match: string) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return match;
    if (!luhnValid(digits)) return match;
    if (KNOWN_TEST_CARDS.has(digits)) return match;
    rewrites.push(`card ${match.trim()} -> ${CANONICAL_TEST_CARD}`);
    return CANONICAL_TEST_CARD;
  });

  return { text, changed: rewrites.length > 0, rewrites };
}
