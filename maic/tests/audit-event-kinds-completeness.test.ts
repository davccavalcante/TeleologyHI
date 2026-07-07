import { describe, expect, it } from "vitest";
import { ALL_AUDIT_EVENT_KINDS, type AuditEventKind } from "../src/index";

/**
 * Compile-time + runtime guarantee that `ALL_AUDIT_EVENT_KINDS` is exhaustive
 * over the `AuditEventKind` union. If a new kind is added to the union and
 * forgotten in the array, the exhaustiveness switch below fails to compile.
 *
 * Why this matters: `@teleologyhi-sdk/eval` uses `ALL_AUDIT_EVENT_KINDS.length`
 * as the denominator for the Φ′ compliance-coverage component `C`. A drift here
 * silently inflates `C` (smaller denominator → higher coverage) and falsifies
 * the release gate.
 */
describe("ALL_AUDIT_EVENT_KINDS completeness", () => {
  it("contains 48 kinds (17 core + 22 brain-as-code + 9 reserved as of 1.0.1)", () => {
    expect(ALL_AUDIT_EVENT_KINDS).toHaveLength(48);
  });

  it("contains no duplicates", () => {
    const set = new Set(ALL_AUDIT_EVENT_KINDS);
    expect(set.size).toBe(ALL_AUDIT_EVENT_KINDS.length);
  });

  it("is exhaustive over AuditEventKind (compile-time check)", () => {
    // If a new kind is added to the union without being added to the array,
    // the default branch below becomes reachable and `assertNever` fails to
    // typecheck. This forces the maintainer to update the runtime array.
    function assertNever(x: never): never {
      throw new Error(`Non-exhaustive AuditEventKind: ${String(x)}`);
    }
    const sample: AuditEventKind = ALL_AUDIT_EVENT_KINDS[0]!;
    switch (sample) {
      case "axiom-mint":
      case "axiom-update":
      case "axiom-retire":
      case "him-register":
      case "him-reincarnate":
      case "proposal-emerge":
      case "proposal-ratify":
      case "proposal-reject":
      case "behavior-review":
      case "dream-induce":
      case "dream-cancel":
      case "dream-consume":
      case "emergency-correct":
      case "deprecate":
      case "terminate":
      case "reactivate":
      case "axiom-suggest":
      case "opener":
      case "nickname-attempt":
      case "reincarnate:model-swap":
      case "reincarnate:version-bump":
      case "reincarnate:return-from-limbo":
      case "dream:rem-spontaneous":
      case "wake-affect:applied":
      case "wake-affect:decayed":
      case "sleep:suggested-by-maic":
      case "sleep:declined-by-nhe":
      case "dream:soft-intervention-by-maic":
      case "amygdala:affect-assessed":
      case "hippocampus:memory-retrieved":
      case "hippocampus:memory-consolidated":
      case "prefrontal:deliberation":
      case "prefrontal:veto-amygdala":
      case "affect:reconciliation":
      case "cortex:dream-stored":
      case "cortex:active-imagination":
      case "temporal-lobe:snapshot-generated":
      case "limbo:enter":
      case "limbo:return":
      case "him-summon":
      case "him-pause-incarnation":
      case "user-consent-recorded":
      case "user-consent-revoked":
      case "directory-opt-in":
      case "directory-opt-out":
      case "him-astrological-chart-cast":
      case "him-jungian-profile-cast":
      case "provenance-deflection-applied":
        expect(typeof sample).toBe("string");
        return;
      default:
        assertNever(sample);
    }
  });
});
