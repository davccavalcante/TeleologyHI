import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";
import { type BirthSignatureWithIdentity, SIGNED_BIRTH_FIELDS } from "../src/types";

const bsig = (id: string): BirthSignatureWithIdentity => ({
  himId: id,
  bornAt: new Date().toISOString(),
  primaryArchetype: "aries-sun",
  modifiers: [],
  primordialAxiomIds: [],
});

// F5 (Entries 27 + 28): the three-axis cosmologicalProfile schema.
describe("F5: cosmologicalProfile round-trips through registration", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-f5-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  });

  it("registers a profile-bearing signature and returns all three axes", async () => {
    const birth: BirthSignatureWithIdentity = {
      ...bsig("him.profile"),
      cosmologicalProfile: {
        chart: { sun: "aries", ascendant: "leo", moon: "cancer" },
        jungian: { dominant: "sage", secondaries: ["magician", "creator"] },
        clinical: {
          pid5: { dominantDomain: "detachment", domains: { detachment: 62 } },
          hexaco: { dominantDomain: "honesty-humility", domains: { "honesty-humility": 70 } },
        },
        seed: "seed-abc",
      },
    };
    await maic.registerHim(birth, kr.sign(birth, 1));
    const rec = await maic.getHimRecord("him.profile");
    const profile = rec?.birthSignature.cosmologicalProfile;
    expect(profile?.chart?.sun).toBe("aries");
    expect(profile?.jungian?.dominant).toBe("sage");
    expect(profile?.jungian?.secondaries).toEqual(["magician", "creator"]);
    expect(profile?.clinical?.pid5?.dominantDomain).toBe("detachment");
    expect(profile?.clinical?.hexaco?.dominantDomain).toBe("honesty-humility");
    expect(profile?.seed).toBe("seed-abc");
  });

  it("registers a profile-null signature (additive invariant)", async () => {
    const birth = bsig("him.noprofile");
    await maic.registerHim(birth, kr.sign(birth, 1));
    const rec = await maic.getHimRecord("him.noprofile");
    expect(rec?.birthSignature.cosmologicalProfile).toBeUndefined();
  });

  it("persists the profile across a store reopen", async () => {
    const birth: BirthSignatureWithIdentity = {
      ...bsig("him.persist"),
      cosmologicalProfile: { jungian: { dominant: "hero", secondaries: ["ruler", "explorer"] } },
    };
    await maic.registerHim(birth, kr.sign(birth, 1));
    const reopened = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    const rec = await reopened.getHimRecord("him.persist");
    expect(rec?.birthSignature.cosmologicalProfile?.jungian?.dominant).toBe("hero");
  });

  it("keeps cosmologicalProfile out of SIGNED_BIRTH_FIELDS in 1.0.1 (D-F5b)", () => {
    expect(SIGNED_BIRTH_FIELDS).not.toContain("cosmologicalProfile");
  });
});
