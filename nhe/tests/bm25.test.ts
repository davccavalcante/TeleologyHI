import { describe, expect, it } from "vitest";
import { bm25, tokenise } from "../src/memory/bm25";

const DOCS = [
  { id: "1", text: "The user values patient explanations over speed." },
  { id: "2", text: "Teleology is the study of purpose; ends matter." },
  { id: "3", text: "Speed and brevity sometimes obscure what matters." },
  { id: "4", text: "Patience teaches the user something durable." },
  { id: "5", text: "Random unrelated content about birds and trees." },
];

describe("bm25 (D-N3)", () => {
  it("ranks documents with the query terms higher", () => {
    const r = bm25("patient user", DOCS);
    expect(r.length).toBeGreaterThan(0);
    // Doc 1 contains both terms; Doc 4 contains 'user' but not 'patient' as
    // a token (it has 'Patience' which tokenises to 'patience', not 'patient').
    expect(r[0]?.doc.id).toBe("1");
  });

  it("returns no results when the query has no overlap with any document", () => {
    const r = bm25("quantum chromodynamics", DOCS);
    expect(r.length).toBe(0);
  });

  it("normalises by document length so a short doc beats a long doc with the same TF", () => {
    const short = { id: "s", text: "purpose" };
    const long = {
      id: "l",
      text: `purpose ${"filler ".repeat(100)}`,
    };
    const r = bm25("purpose", [short, long]);
    expect(r[0]?.doc.id).toBe("s");
  });

  it("weights rare terms more (IDF)", () => {
    // 'speed' appears in 2 docs, 'birds' appears in 1 doc.
    const r = bm25("speed birds", DOCS);
    const top = r[0]?.doc.id;
    // 'birds' is rarer → doc 5 should outrank docs 1 and 3.
    expect(top).toBe("5");
  });

  it("tokenise strips short tokens + non-word characters", () => {
    expect(tokenise("hello, world! a I")).toEqual(["hello", "world"]);
  });

  it("handles unicode word characters across multiple languages", () => {
    // The tokeniser preserves any unicode word-character including
    // diacritics, so the same regex covers EN (loanwords), FR, DE, ES, IT,
    // PT, and any language whose lexicon survives Unicode normalisation.
    // Single-letter tokens are dropped intentionally, that's the filter.
    expect(tokenise("café résumé naïve coöperate")).toEqual([
      "café",
      "résumé",
      "naïve",
      "coöperate",
    ]);
    expect(tokenise("Häuser über München")).toEqual(["häuser", "über", "münchen"]);
    expect(tokenise("teleología filosofía cosmología")).toEqual([
      "teleología",
      "filosofía",
      "cosmología",
    ]);
  });

  it("returns zero results for empty corpus or empty query", () => {
    expect(bm25("anything", [])).toEqual([]);
    expect(bm25("", DOCS)).toEqual([]);
  });
});
