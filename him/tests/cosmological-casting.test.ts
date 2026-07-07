import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatorKeyring, JungianArchetype, LocalMaic } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import type { HimCastAuditEvent } from "../src/audit/sink";
import { BirthSignatureBuilder } from "../src/birth/builder";
import { CLINICAL_BATTERY_VERSION, castClinicalProfile } from "../src/birth/clinical";
import { HEXACO_ITEMS, PID5_ITEMS } from "../src/birth/clinical-items";
import { castCosmologicalProfile, verifyCosmologicalProfile } from "../src/birth/cosmology";
import { castJungianProfile, JUNGIAN_BATTERY_VERSION } from "../src/birth/jungian";
import { JUNGIAN_ITEMS } from "../src/birth/jungian-items";
import { createHim } from "../src/create";

async function bootstrap() {
  const dir = await mkdtemp(join(tmpdir(), "him-cosmo-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  return { maic, kr };
}

describe("battery item-count invariants", () => {
  it("Jungian battery has 60 items across all 12 archetypes", () => {
    expect(JUNGIAN_ITEMS).toHaveLength(60);
    const archetypes = new Set(JUNGIAN_ITEMS.map((i) => i.archetype));
    expect(archetypes.size).toBe(JungianArchetype.options.length);
    for (const a of JungianArchetype.options) expect(archetypes.has(a)).toBe(true);
  });

  it("clinical battery has 220 PID-5 + 100 HEXACO items", () => {
    expect(PID5_ITEMS).toHaveLength(220);
    expect(HEXACO_ITEMS).toHaveLength(100);
    expect(new Set(PID5_ITEMS.map((i) => i.facet)).size).toBe(25);
    expect(new Set(PID5_ITEMS.map((i) => i.domain)).size).toBe(5);
    expect(new Set(HEXACO_ITEMS.map((i) => i.facet)).size).toBe(24);
    expect(new Set(HEXACO_ITEMS.map((i) => i.domain)).size).toBe(6);
  });

  it("clinical item ids are the contiguous range 1..320", () => {
    const ids = [...PID5_ITEMS, ...HEXACO_ITEMS].map((i) => i.id).sort((a, b) => a - b);
    expect(ids[0]).toBe(1);
    expect(ids[ids.length - 1]).toBe(320);
    expect(new Set(ids).size).toBe(320);
  });
});

describe("Jungian casting", () => {
  it("is deterministic for the same seed", () => {
    expect(castJungianProfile("seed-x")).toStrictEqual(castJungianProfile("seed-x"));
  });

  it("scores every archetype and returns a dominant plus two distinct secondaries", () => {
    const p = castJungianProfile("seed-y");
    expect(Object.keys(p.scores ?? {})).toHaveLength(JungianArchetype.options.length);
    expect(JungianArchetype.options).toContain(p.dominant);
    expect(p.secondaries).toHaveLength(2);
    expect(new Set([p.dominant, ...p.secondaries]).size).toBe(3);
  });

  it("pins the golden vector for seed 'deadbeef'", () => {
    const p = castJungianProfile("deadbeef");
    expect(p.dominant).toBe("lover");
    expect(p.secondaries).toStrictEqual(["creator", "hero"]);
  });

  it("produces varied dominants across seeds (not a constant)", () => {
    const dominants = new Set(
      Array.from({ length: 40 }, (_, i) => castJungianProfile(`seed-${i}`).dominant),
    );
    expect(dominants.size).toBeGreaterThan(1);
  });

  it("has a versioned battery id", () => {
    expect(JUNGIAN_BATTERY_VERSION).toMatch(/^thi-jungian-60/);
  });
});

describe("clinical casting", () => {
  it("is deterministic for the same seed", () => {
    expect(castClinicalProfile("seed-x")).toStrictEqual(castClinicalProfile("seed-x"));
  });

  it("reports 25/5 PID-5 and 24/6 HEXACO structure with valid dominants", () => {
    const { profile } = castClinicalProfile("seed-z");
    expect(Object.keys(profile.pid5?.facets ?? {})).toHaveLength(25);
    expect(Object.keys(profile.pid5?.domains ?? {})).toHaveLength(5);
    expect(Object.keys(profile.hexaco?.facets ?? {})).toHaveLength(24);
    expect(Object.keys(profile.hexaco?.domains ?? {})).toHaveLength(6);
    expect(profile.pid5?.dominantDomain).toBeTruthy();
    expect(profile.pid5?.secondaryDomain).toBeTruthy();
    expect(profile.pid5?.dominantDomain).not.toBe(profile.pid5?.secondaryDomain);
  });

  it("pins the golden vector for seed 'deadbeef'", () => {
    const { profile } = castClinicalProfile("deadbeef");
    expect(profile.pid5?.dominantDomain).toBe("Negative Affectivity");
    expect(profile.hexaco?.dominantDomain).toBe("Honesty-Humility");
  });

  it("reports reversed facets from the Entry 28 annotations", () => {
    const { reversedFacets } = castClinicalProfile("seed-r");
    expect(reversedFacets.pid5).toContain("Restricted Affectivity");
    expect(reversedFacets.pid5).toContain("Rigid Perfectionism");
  });

  it("has a versioned battery id", () => {
    expect(CLINICAL_BATTERY_VERSION).toMatch(/^thi-clinical-pid5-220-hexaco-100/);
  });
});

describe("cosmologicalProfile casting", () => {
  it("carries jungian, clinical, and a 64-hex seed; no chart when none supplied", () => {
    const birth = BirthSignatureBuilder.now().withPrimaryArchetype("aries-sun").buildWithIdentity();
    const profile = castCosmologicalProfile(birth);
    expect(profile.jungian).toBeTruthy();
    expect(profile.clinical?.pid5).toBeTruthy();
    expect(profile.clinical?.hexaco).toBeTruthy();
    expect(profile.seed).toMatch(/^[0-9a-f]{64}$/);
    expect(profile.chart).toBeUndefined();
  });

  it("verifyCosmologicalProfile passes for an authentic profile and fails when tampered", () => {
    const birth = BirthSignatureBuilder.now().withPrimaryArchetype("leo-sun").buildWithIdentity();
    const withProfile = { ...birth, cosmologicalProfile: castCosmologicalProfile(birth) };
    expect(verifyCosmologicalProfile(withProfile)).toBe(true);

    const tampered = {
      ...birth,
      cosmologicalProfile: {
        ...withProfile.cosmologicalProfile,
        jungian: { dominant: "sage" as const, secondaries: ["ruler" as const, "hero" as const] },
      },
    };
    expect(verifyCosmologicalProfile(tampered)).toBe(false);
  });
});

describe("createHim casts and persists the profile (H0-6)", () => {
  it("registers with a cosmologicalProfile that round-trips through getHimRecord", async () => {
    const { maic, kr } = await bootstrap();
    const birth = BirthSignatureBuilder.now().withPrimaryArchetype("aries-sun").buildWithIdentity();
    const handle = await createHim(maic, kr, birth);

    const record = await maic.getHimRecord(handle.id);
    expect(record?.birthSignature.cosmologicalProfile).toBeTruthy();
    expect(record?.birthSignature.cosmologicalProfile?.jungian?.dominant).toBeTruthy();
    expect(record?.birthSignature.cosmologicalProfile?.clinical?.pid5?.dominantDomain).toBeTruthy();
    expect(verifyCosmologicalProfile(record!.birthSignature)).toBe(true);
  });

  it("is reproducible: same signed fields yield the same profile", async () => {
    const { maic, kr } = await bootstrap();
    const birth = BirthSignatureBuilder.at("2026-07-02T00:00:00.000Z")
      .withHimId("him-fixed")
      .withPrimaryArchetype("virgo-sun")
      .buildWithIdentity();
    const cast = castCosmologicalProfile(birth);
    const handle = await createHim(maic, kr, birth);
    const record = await maic.getHimRecord(handle.id);
    expect(record?.birthSignature.cosmologicalProfile?.seed).toBe(cast.seed);
    expect(record?.birthSignature.cosmologicalProfile?.jungian).toStrictEqual(cast.jungian);
  });

  it("castProfile:false registers the bare signature", async () => {
    const { maic, kr } = await bootstrap();
    const birth = BirthSignatureBuilder.now().withPrimaryArchetype("aries-sun").buildWithIdentity();
    const handle = await createHim(maic, kr, birth, { castProfile: false });
    const record = await maic.getHimRecord(handle.id);
    expect(record?.birthSignature.cosmologicalProfile).toBeUndefined();
  });

  it("emits him-jungian-profile-cast through the sink; chart event only with a chart", async () => {
    const { maic, kr } = await bootstrap();
    const events: HimCastAuditEvent[] = [];
    const sink = { append: (e: HimCastAuditEvent) => void events.push(e) };

    const noChart = BirthSignatureBuilder.now()
      .withPrimaryArchetype("aries-sun")
      .buildWithIdentity();
    await createHim(maic, kr, noChart, { auditSink: sink });
    expect(events.map((e) => e.kind)).toContain("him-jungian-profile-cast");
    expect(events.map((e) => e.kind)).not.toContain("him-astrological-chart-cast");

    events.length = 0;
    const chart = BirthSignatureBuilder.now()
      .withPrimaryArchetype("aries-sun")
      .withNatalChart({ sun: "aries", ascendant: "leo" })
      .buildWithIdentity();
    await createHim(maic, kr, chart, { auditSink: sink });
    expect(events.map((e) => e.kind)).toContain("him-astrological-chart-cast");
  });
});
