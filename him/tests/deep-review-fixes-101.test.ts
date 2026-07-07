import { describe, expect, it } from "vitest";
import { LAWFUL_PROFILES, resolveLawfulProfile } from "../src/lawful/profiles";

/**
 * Regression test for the 1.0.1 pre-publish deep-review finding in `him`.
 *
 * F#6  resolveLawfulProfile shallow-spread the shared registry entry, so the
 *      returned profile's arrays were the SAME references as the module-level
 *      LAWFUL_PROFILES; a caller mutating a returned array corrupted the
 *      baseline for every subsequent HIM in the process. The fix deep-clones.
 */
describe("Deep-review F#6: resolveLawfulProfile returns arrays independent of the registry", () => {
  it("mutating a returned profile's arrays does not corrupt the shared baseline", () => {
    const before = LAWFUL_PROFILES.eu!.forbiddenActions.length;
    const p = resolveLawfulProfile("eu");
    p.forbiddenActions.push("intent:LEAKED");
    p.requiredAxiomIds.push("ax.LEAKED");
    p.applicableLaws.push("LEAKED-LAW");

    // The module-level registry must be untouched.
    expect(LAWFUL_PROFILES.eu!.forbiddenActions).not.toContain("intent:LEAKED");
    expect(LAWFUL_PROFILES.eu!.forbiddenActions.length).toBe(before);

    // A subsequent resolve returns the clean baseline, not the polluted arrays.
    const fresh = resolveLawfulProfile("eu");
    expect(fresh.forbiddenActions).not.toContain("intent:LEAKED");
    expect(fresh.requiredAxiomIds).not.toContain("ax.LEAKED");
    expect(fresh.applicableLaws).not.toContain("LEAKED-LAW");
  });
});
