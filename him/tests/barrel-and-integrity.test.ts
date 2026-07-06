import {
  BirthSignatureWithIdentity,
  ClinicalInstrument,
  ClinicalProfile,
  CosmologicalProfile,
  JungianArchetype,
  JungianProfile,
  SEED_AXIOMS,
} from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import * as him from "../src/index";
import { LAWFUL_PROFILES } from "../src/lawful/profiles";

describe("barrel re-exports (H1-7)", () => {
  it("exposes the new maic constitutional schemas as runtime parsers through the single surface", () => {
    // Reached via the him barrel (identity check against the maic originals).
    expect(him.BirthSignatureWithIdentity).toBe(BirthSignatureWithIdentity);
    expect(him.JungianArchetype).toBe(JungianArchetype);
    expect(him.JungianProfile).toBe(JungianProfile);
    expect(him.ClinicalInstrument).toBe(ClinicalInstrument);
    expect(him.ClinicalProfile).toBe(ClinicalProfile);
    expect(him.CosmologicalProfile).toBe(CosmologicalProfile);
    // All are zod schemas with a runtime parser.
    expect(typeof him.BirthSignatureWithIdentity.parse).toBe("function");
    expect(typeof him.CosmologicalProfile.parse).toBe("function");
  });

  it("exposes the him casting engines and audit sink", () => {
    expect(typeof him.castJungianProfile).toBe("function");
    expect(typeof him.castClinicalProfile).toBe("function");
    expect(typeof him.castCosmologicalProfile).toBe("function");
    expect(typeof him.verifyCosmologicalProfile).toBe("function");
    expect(typeof him.deriveBirthSeed).toBe("function");
    expect(him.JUNGIAN_ITEMS).toHaveLength(60);
    expect(him.PID5_ITEMS).toHaveLength(220);
    expect(him.HEXACO_ITEMS).toHaveLength(100);
    expect(typeof him.NOOP_AUDIT_SINK.append).toBe("function");
    expect(him.PROJECTOR_VERSION).toBeTruthy();
  });
});

describe("lawful-profile axiom-id integrity (H2-1)", () => {
  it("every requiredAxiomId resolves to a maic seed axiom (no silent drift)", () => {
    const seedIds = new Set(SEED_AXIOMS.map((a) => a.id));
    for (const [jurisdiction, profile] of Object.entries(LAWFUL_PROFILES)) {
      for (const id of profile.requiredAxiomIds) {
        expect(seedIds.has(id), `${jurisdiction} requires unknown axiom ${id}`).toBe(true);
      }
    }
  });
});
