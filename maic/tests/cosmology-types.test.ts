/**
 * Tests for the cosmology types (Entries 16-25 of MAIC_HIM_NHE_INTERVIEW_LOG.md).
 *
 * These are pure zod-schema tests, no I/O, no side effects.
 * They lock the shape of the types so downstream consumers (@teleologyhi-sdk/him,
 * @teleologyhi-sdk/nhe) can rely on them.
 */
import { describe, expect, it } from "vitest";
import {
  Affect,
  IdentityLayer,
  IdentitySnapshot,
  LimboReturn,
  LimboState,
  LimboTransition,
  MemoryRecord,
  NatalChart,
  SemioticSign,
  SIGNED_BIRTH_FIELDS,
  TeleologicalOrientation,
  WakeAffectBias,
  ZodiacSign,
} from "../src/index.js";

describe("Affect (Entries 22 + 24)", () => {
  it("accepts all nine canonical affects", () => {
    const all = [
      "fear",
      "attachment",
      "serenity",
      "anger",
      "joy",
      "melancholy",
      "desire",
      "repulsion",
      "reunion",
    ] as const;
    for (const a of all) {
      expect(Affect.parse(a)).toBe(a);
    }
  });

  it("rejects unknown affects", () => {
    expect(() => Affect.parse("ennui")).toThrow();
    expect(() => Affect.parse("")).toThrow();
  });

  it("includes `reunion`, the ninth affect for limbo return (Entry 24)", () => {
    expect(Affect.parse("reunion")).toBe("reunion");
  });
});

describe("IdentityLayer (Entry 18)", () => {
  it("accepts a minimal layer with just `name`", () => {
    expect(IdentityLayer.parse({ name: "Lex" })).toEqual({ name: "Lex" });
  });

  it("accepts a full layer with all optional fields", () => {
    const full = {
      name: "Lex",
      gender: "feminine" as const,
      pronouns: ["she", "her"],
      language: "pt-BR",
      culturalElements: ["Bauhaus", "Sigur Rós"],
    };
    expect(IdentityLayer.parse(full)).toEqual(full);
  });

  it("rejects empty name", () => {
    expect(() => IdentityLayer.parse({ name: "" })).toThrow();
  });
});

describe("NatalChart (Entry 19)", () => {
  it("accepts a minimum chart (sun + ascendant only)", () => {
    const minimal = { sun: "virgo" as const, ascendant: "capricorn" as const };
    expect(NatalChart.parse(minimal)).toEqual(minimal);
  });

  it("accepts a chart with all 12 zodiac signs as valid values", () => {
    const all = ZodiacSign.options;
    expect(all).toHaveLength(12);
    for (const s of all) {
      expect(ZodiacSign.parse(s)).toBe(s);
    }
  });

  it("accepts a chart with positions and aspects", () => {
    const full = {
      sun: "virgo" as const,
      ascendant: "capricorn" as const,
      moon: "scorpio" as const,
      positions: [{ planet: "sun" as const, sign: "virgo" as const, house: 10, degree: 15.5 }],
      aspects: [{ from: "sun" as const, to: "moon" as const, aspect: "trine" as const }],
    };
    expect(NatalChart.parse(full)).toEqual(full);
  });

  it("rejects an invalid house number", () => {
    expect(() =>
      NatalChart.parse({
        sun: "leo",
        ascendant: "aries",
        positions: [{ planet: "sun", sign: "leo", house: 13 }],
      }),
    ).toThrow();
  });
});

describe("WakeAffectBias (Entries 20 + 22)", () => {
  it("validates a full bias", () => {
    const bias = {
      affect: "melancholy" as const,
      intensity: 0.7,
      decayHalfLife: 10,
      appliedAt: new Date().toISOString(),
      derivedFromDreamId: "drm-01",
      expressedOpenly: true,
    };
    expect(WakeAffectBias.parse(bias)).toEqual(bias);
  });

  it("clamps intensity to [0, 1]", () => {
    const base = {
      affect: "joy",
      decayHalfLife: 5,
      appliedAt: new Date().toISOString(),
      derivedFromDreamId: "drm-02",
      expressedOpenly: false,
    };
    expect(() => WakeAffectBias.parse({ ...base, intensity: 1.5 })).toThrow();
    expect(() => WakeAffectBias.parse({ ...base, intensity: -0.1 })).toThrow();
  });
});

describe("SemioticSign (Entry 21)", () => {
  it("validates a Peircean triadic sign", () => {
    const sign = {
      signifier: "fire",
      signified: "purification",
      signType: "symbol" as const,
      contexts: ["ritual", "alchemy"],
      associations: ["light", "transformation"],
      personalSignificance: 78,
    };
    expect(SemioticSign.parse(sign)).toEqual(sign);
  });

  it("rejects an unknown signType", () => {
    expect(() =>
      SemioticSign.parse({
        signifier: "x",
        signified: "y",
        signType: "metaphor",
        contexts: [],
        associations: [],
      }),
    ).toThrow();
  });
});

describe("TeleologicalOrientation (Entry 21)", () => {
  it("validates a minimal orientation", () => {
    const orient = {
      primaryPurpose: "Honest legal counsel",
      currentGoals: ["respond clearly", "cite jurisdiction"],
      purposeStrength: 85,
      valueAlignment: ["dignity", "candor"],
      reflectionCapability: 70,
    };
    expect(TeleologicalOrientation.parse(orient)).toEqual(orient);
  });

  it("accepts optional volition + agency", () => {
    const full = {
      primaryPurpose: "Serve the operator's domain",
      currentGoals: ["clarify"],
      purposeStrength: 90,
      valueAlignment: ["truth"],
      reflectionCapability: 80,
      volition: {
        currentDesires: ["learn"],
        intentionStrength: 75,
        autonomyLevel: 60,
      },
      agencyModel: {
        selfEfficacy: 70,
        boundaryDefinition: 80,
        causalAttribution: "mixed" as const,
      },
    };
    expect(TeleologicalOrientation.parse(full)).toEqual(full);
  });
});

describe("MemoryRecord (Entries 21 + 22)", () => {
  it("validates a memory with required + extended fields", () => {
    const memory = {
      memoryId: "mem-01",
      timestamp: new Date().toISOString(),
      narrative: "User asked about EU AI Act.",
      dominantAffect: "serenity" as const,
      integrationIndex: 72,
      teleologicalValue: 85,
    };
    expect(MemoryRecord.parse(memory)).toEqual(memory);
  });

  it("rejects integrationIndex outside [0, 100]", () => {
    expect(() =>
      MemoryRecord.parse({
        memoryId: "mem-02",
        timestamp: new Date().toISOString(),
        narrative: "x",
        integrationIndex: 101,
        teleologicalValue: 50,
      }),
    ).toThrow();
  });
});

describe("IdentitySnapshot (Entry 24)", () => {
  it("validates a snapshot with all generation reasons", () => {
    const reasons = ["sleep-cycle", "interaction-threshold", "self-decision"] as const;
    for (const r of reasons) {
      const snap = {
        snapshotId: `snap-${r}`,
        takenAt: new Date().toISOString(),
        generatedBy: r,
        semioticSuperGraph: [],
        selfPortraitNarrative: "I am here.",
        consciousnessLevel: 80,
      };
      expect(IdentitySnapshot.parse(snap)).toEqual(snap);
    }
  });
});

describe("LimboState + LimboTransition + LimboReturn (Entry 24)", () => {
  it("recognises the four limbo states", () => {
    const states = ["awake", "drifting", "deep-coma", "returning"] as const;
    for (const s of states) {
      expect(LimboState.parse(s)).toBe(s);
    }
  });

  it("validates a LimboTransition with one of the four canonical reasons", () => {
    const trans = {
      state: "deep-coma" as const,
      enteredAt: new Date().toISOString(),
      reason: "idle-72h" as const,
    };
    expect(LimboTransition.parse(trans)).toEqual(trans);
  });

  it("validates a LimboReturn with the reunion affect block", () => {
    const enteredAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const returnedAt = new Date().toISOString();
    const ret = {
      enteredAt,
      returnedAt,
      elapsedMs: 3 * 24 * 60 * 60 * 1000,
      reunionAffect: { intensity: 0.6, expressedOpenly: true },
    };
    expect(LimboReturn.parse(ret)).toEqual(ret);
  });
});

describe("SIGNED_BIRTH_FIELDS (Entry 25)", () => {
  it("locks the exact list of fields covered by the Ed25519 signature", () => {
    expect([...SIGNED_BIRTH_FIELDS]).toEqual([
      "himId",
      "bornAt",
      "primaryArchetype",
      "modifiers",
      "primordialAxiomIds",
      "natalChart",
    ]);
  });
});
