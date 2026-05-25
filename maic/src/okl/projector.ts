/**
 * Ontological Kernel projection (TASK.md D-M6 + Entry 25 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md, with explicit reference to
 * THE_SOUL_OF_THE_MACHINE.md §3.1 + Appendix A.2.1).
 *
 * The OKL exists *implicitly* in maic today: axioms carry `rank`,
 * `weight`, and `flexibility`; the meta-axiom `ax.theos.universe-as-god`
 * sits at the top; the rule pack consumes them. This module exposes the
 * *projection* — a single typed shape that maps 1:1 to the paper's
 * description so downstream tooling (Φ′ runner, compliance auditors, the
 * forthcoming `@teleologyhi-sdk/him` `OntologicalKernelLayer`) can read the
 * kernel without re-deriving it from the axiom store.
 *
 * Surface:
 *   - `META_AXIOM_ID` — the canonical id ("ax.theos.universe-as-god").
 *   - `projectOntologicalKernel(axioms, opts?)` — given a list of axioms
 *     (typically `AxiomStore.list()`), return the projection.
 *
 * The HIM-specific projection (per-HIM kernel narrowed to its
 * primordialAxiomIds) is the natural follow-up but lives upstream in
 * `@teleologyhi-sdk/him` because it needs the HIM context.
 */
import type { Axiom, OntologicalKernel } from "../types.js";

/** The canonical meta-axiom id (Entry 1, Entry 13). */
export const META_AXIOM_ID = "ax.theos.universe-as-god";

export interface ProjectKernelOptions {
  /** Restrict the kernel to a jurisdiction; default = all jurisdictions. */
  jurisdiction?: string;
  /** Tag the projection with a HIM id (for downstream tooling). */
  himId?: string;
}

/**
 * Project the OKL from a flat list of axioms.
 *
 * The returned `axioms` array is ordered by rank hierarchy:
 *   meta → primary → secondary
 * and within rank, in input order (preserve the AxiomStore mint order).
 *
 * The meta-axiom (`META_AXIOM_ID`) is hoisted to the top regardless of
 * its position in the input. If it is missing, `metaAxiomId` is set to
 * `META_AXIOM_ID` but `axioms[0]?.id` may differ — the consumer should
 * treat that as an OKL incompleteness warning.
 */
export function projectOntologicalKernel(
  axioms: readonly Axiom[],
  opts: ProjectKernelOptions = {},
): OntologicalKernel {
  const filtered = opts.jurisdiction
    ? axioms.filter(
        (a) =>
          !a.jurisdictions ||
          a.jurisdictions.length === 0 ||
          a.jurisdictions.includes(opts.jurisdiction!),
      )
    : [...axioms];

  // Hoist the meta-axiom to position 0 if present, then sort the rest by
  // rank hierarchy preserving relative order.
  const meta = filtered.find((a) => a.id === META_AXIOM_ID);
  const rest = filtered.filter((a) => a.id !== META_AXIOM_ID);
  const rankOrder: Record<Axiom["rank"], number> = {
    meta: 0,
    primary: 1,
    secondary: 2,
  };
  rest.sort((a, b) => rankOrder[a.rank] - rankOrder[b.rank]);

  const kernel: OntologicalKernel = {
    metaAxiomId: META_AXIOM_ID,
    axioms: meta ? [meta, ...rest] : rest,
  };
  if (opts.jurisdiction !== undefined) kernel.jurisdiction = opts.jurisdiction;
  if (opts.himId !== undefined) kernel.himId = opts.himId;
  return kernel;
}
