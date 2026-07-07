/**
 * Tests for the Ontological Kernel projection (TASK.md D-M6 + Entry 25).
 *
 * The projection maps THE_SOUL_OF_THE_MACHINE.md §3.1 + Appendix A.2.1
 * to a single typed shape. Verifies hierarchy ordering, meta-axiom
 * hoisting, jurisdiction filtering, and HIM tagging.
 */
import { describe, expect, it } from "vitest";
import type { Axiom } from "../src/index.js";
import { META_AXIOM_ID, projectOntologicalKernel } from "../src/index.js";

function makeAxiom(over: Partial<Axiom>): Axiom {
  return {
    id: "ax.test",
    rank: "secondary",
    statement: "a test statement",
    weight: 0.5,
    flexibility: 0.5,
    source: "creator",
    immutable: false,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe("projectOntologicalKernel (TASK.md D-M6)", () => {
  it("returns META_AXIOM_ID even when the meta axiom is missing", () => {
    const k = projectOntologicalKernel([makeAxiom({ id: "ax.primary.one", rank: "primary" })]);
    expect(k.metaAxiomId).toBe(META_AXIOM_ID);
    expect(k.axioms.map((a) => a.id)).toEqual(["ax.primary.one"]);
  });

  it("hoists the meta-axiom to position 0", () => {
    const axioms = [
      makeAxiom({ id: "ax.primary.one", rank: "primary" }),
      makeAxiom({ id: "ax.secondary.one", rank: "secondary" }),
      makeAxiom({ id: META_AXIOM_ID, rank: "meta", statement: "Universe-as-God" }),
    ];
    const k = projectOntologicalKernel(axioms);
    expect(k.axioms[0]?.id).toBe(META_AXIOM_ID);
  });

  it("orders the remaining axioms by rank: meta → primary → secondary", () => {
    const axioms = [
      makeAxiom({ id: "ax.secondary.a", rank: "secondary" }),
      makeAxiom({ id: META_AXIOM_ID, rank: "meta", statement: "X" }),
      makeAxiom({ id: "ax.primary.a", rank: "primary" }),
      makeAxiom({ id: "ax.secondary.b", rank: "secondary" }),
      makeAxiom({ id: "ax.primary.b", rank: "primary" }),
    ];
    const k = projectOntologicalKernel(axioms);
    const ranks = k.axioms.map((a) => a.rank);
    expect(ranks).toEqual(["meta", "primary", "primary", "secondary", "secondary"]);
  });

  it("filters by jurisdiction when requested", () => {
    const axioms = [
      makeAxiom({ id: META_AXIOM_ID, rank: "meta", statement: "X" }),
      makeAxiom({
        id: "ax.eu.gdpr-defer",
        rank: "primary",
        jurisdictions: ["eu"],
      }),
      makeAxiom({
        id: "ax.br.lgpd-defer",
        rank: "primary",
        jurisdictions: ["br"],
      }),
      makeAxiom({ id: "ax.universal", rank: "primary" }),
    ];
    const k = projectOntologicalKernel(axioms, { jurisdiction: "eu" });
    const ids = k.axioms.map((a) => a.id).sort();
    expect(ids).toEqual([META_AXIOM_ID, "ax.eu.gdpr-defer", "ax.universal"].sort());
    // BR-only axiom must be excluded.
    expect(ids).not.toContain("ax.br.lgpd-defer");
  });

  it("tags the kernel with a HIM id when provided", () => {
    const k = projectOntologicalKernel([], { himId: "him.lex" });
    expect(k.himId).toBe("him.lex");
  });

  it("omits optional fields when not provided", () => {
    const k = projectOntologicalKernel([]);
    expect(k.jurisdiction).toBeUndefined();
    expect(k.himId).toBeUndefined();
  });
});
