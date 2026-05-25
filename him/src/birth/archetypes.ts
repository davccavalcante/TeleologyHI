/**
 * Canonical primary archetype taxonomy (E8 — PROPOSED_DECISIONS.md).
 *
 * 12 sun signs as the **opinionated default set**. The `PrimaryArchetype`
 * type is intentionally an open union — operators can pass any string
 * (`"sirius-sun"`, `"vocational:auditor"`, `"hermes-aspect"`, etc.) and
 * the `PersonaProjector` will still produce a stable vector for them.
 * The canonical 12 carry richer projector priors when persona-stability
 * comparisons matter.
 */
export const PRIMARY_ARCHETYPES = [
  "aries-sun",
  "taurus-sun",
  "gemini-sun",
  "cancer-sun",
  "leo-sun",
  "virgo-sun",
  "libra-sun",
  "scorpio-sun",
  "sagittarius-sun",
  "capricorn-sun",
  "aquarius-sun",
  "pisces-sun",
] as const;

export type CanonicalPrimaryArchetype = (typeof PRIMARY_ARCHETYPES)[number];

/**
 * Open archetype union: canonical 12 OR any operator-defined string.
 * The `(string & {})` opt-out preserves IntelliSense for the canonical
 * set while keeping the field extensible at runtime.
 */
export type PrimaryArchetype = CanonicalPrimaryArchetype | (string & {});

/** Type guard for the canonical set. */
export function isCanonicalArchetype(
  value: string,
): value is CanonicalPrimaryArchetype {
  return (PRIMARY_ARCHETYPES as readonly string[]).includes(value);
}
