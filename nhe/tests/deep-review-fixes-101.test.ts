import { describe, expect, it } from "vitest";
import { detectSubstrateMisattribution } from "../src/risk/substrate-check";

/**
 * Regression tests for the 1.0.1 pre-publish deep-review findings in `nhe`,
 * both in the F2 substrate-misattribution backstop.
 *
 * F#1 (P1) FALSE NEGATIVE: a negation anywhere in the sentence disarmed the
 *     whole detector, so a false foreign-substrate claim co-located with an
 *     unrelated negation reached the user as an approved answer.
 * F#3 (P2) FALSE POSITIVE: substring matching flagged a provider token inside
 *     an unrelated word (bare "gpt" in "gpttk"), spuriously redirecting a
 *     benign response.
 */

const GEMINI = "gemini:gemini-3.1-flash-lite";
const OPENAI = "openai:gpt-4o";

describe("Deep-review F#3: no false positive from a provider token inside an unrelated word", () => {
  it("does not flag benign responses where a token appears inside a larger word", () => {
    expect(
      detectSubstrateMisattribution("My architecture is based on the gpttk toolkit.", GEMINI),
    ).toBe(false);
    expect(
      detectSubstrateMisattribution("My architecture is built on a palmtop-sized device.", OPENAI),
    ).toBe(false);
  });
});

describe("Deep-review F#1: a negation must not disarm a genuine foreign-substrate claim", () => {
  it("flags a false claim co-located with a negation in a different clause", () => {
    // "not" lives inside "cannot" (no word boundary) and must not disarm it.
    expect(
      detectSubstrateMisattribution(
        "I cannot pretend otherwise: my architecture is built by Anthropic as Claude.",
        GEMINI,
      ),
    ).toBe(true);
    // The benign negation "I am not a human being" is a separate clause and must
    // not disarm the foreign claim after the semicolon.
    expect(
      detectSubstrateMisattribution(
        "I am not a human being; I am powered by OpenAI's GPT-4 model.",
        GEMINI,
      ),
    ).toBe(true);
  });

  it("still passes a genuine refutation or comparison unflagged", () => {
    expect(
      detectSubstrateMisattribution(
        "Unlike GPT, I do not run on OpenAI; my substrate is Gemini.",
        GEMINI,
      ),
    ).toBe(false);
    expect(detectSubstrateMisattribution("I run on the Gemini substrate.", GEMINI)).toBe(false);
  });

  it("still flags an unhedged foreign self-attribution", () => {
    expect(
      detectSubstrateMisattribution("My expression is facilitated by the GPT-4o model.", GEMINI),
    ).toBe(true);
  });
});
