import { type Axiom, CreatorKeyring } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import { BirthSignatureBuilder } from "../src/birth/builder";
import { HimHandle } from "../src/handle/him-handle";
import { DISPOSITION_AXES, type ResidualTrace } from "../src/types";

const fixtureAxiom = (id: string): Axiom => ({
  id,
  rank: "primary",
  statement: `Statement for ${id}`,
  weight: 0.8,
  flexibility: 0.2,
  source: "creator",
  immutable: false,
  createdAt: new Date().toISOString(),
});

describe("HimHandle.mint", () => {
  it("mints a HimHandle with a valid Creator signature", () => {
    const kr = CreatorKeyring.generate();
    const sig = BirthSignatureBuilder.now()
      .withHimId("him.test.1")
      .withPrimaryArchetype("aries-sun")
      .build();
    const creatorSig = kr.sign(sig, 1);

    const handle = HimHandle.mint(sig, creatorSig, kr.publicKey(), []);
    expect(handle.id).toBe("him.test.1");
    expect(handle.birthSignature.himId).toBe("him.test.1");
  });

  it("rejects when the signature does not verify against the expected public key", () => {
    const kr = CreatorKeyring.generate();
    const impostor = CreatorKeyring.generate();
    const sig = BirthSignatureBuilder.now().withPrimaryArchetype("aries-sun").build();
    const creatorSig = impostor.sign(sig, 1);

    expect(() => HimHandle.mint(sig, creatorSig, kr.publicKey(), [])).toThrow(/signature/i);
  });

  it("rejects when the signature does not match the birth signature payload", () => {
    const kr = CreatorKeyring.generate();
    const sigA = BirthSignatureBuilder.now()
      .withHimId("a")
      .withPrimaryArchetype("aries-sun")
      .build();
    const sigB = BirthSignatureBuilder.now()
      .withHimId("b")
      .withPrimaryArchetype("aries-sun")
      .build();
    const creatorSig = kr.sign(sigA, 1);

    expect(() => HimHandle.mint(sigB, creatorSig, kr.publicKey(), [])).toThrow(/signature/i);
  });
});

describe("HimHandle, read surface", () => {
  const kr = CreatorKeyring.generate();
  const sig = BirthSignatureBuilder.now()
    .withHimId("him.read")
    .withPrimaryArchetype("aries-sun")
    .withModifier({ kind: "moon", value: "cancer", weight: 0.7 })
    .build();
  const creatorSig = kr.sign(sig, 1);

  it("getAxioms returns a frozen array (mutations fail)", () => {
    const ax = fixtureAxiom("ax.t.1");
    const handle = HimHandle.mint(sig, creatorSig, kr.publicKey(), [ax]);
    const axioms = handle.getAxioms();
    expect(axioms).toHaveLength(1);
    expect(() => (axioms as unknown as Axiom[]).push(fixtureAxiom("evil"))).toThrow();
  });

  it("getPersonaVector is deterministic and cached (same reference)", () => {
    const handle = HimHandle.mint(sig, creatorSig, kr.publicKey(), [fixtureAxiom("ax.t.1")]);
    const v1 = handle.getPersonaVector();
    const v2 = handle.getPersonaVector();
    expect(v1).toBe(v2); // same cached object reference
    expect(Array.from(v1.embedding)).toEqual(Array.from(v2.embedding));
    for (const axis of DISPOSITION_AXES) {
      expect(v1.dispositions[axis]).toBe(v2.dispositions[axis]);
    }
  });

  it("bodyHistory starts empty", () => {
    const handle = HimHandle.mint(sig, creatorSig, kr.publicKey(), []);
    expect(handle.bodyHistory).toEqual([]);
  });
});

describe("HimHandle, residual traces + lawful character", () => {
  const kr = CreatorKeyring.generate();
  const sig = BirthSignatureBuilder.now()
    .withHimId("him.stub")
    .withPrimaryArchetype("libra-sun")
    .build();
  const creatorSig = kr.sign(sig, 1);

  it("getResidualTraces returns an empty array when none were threaded", () => {
    const handle = HimHandle.mint(sig, creatorSig, kr.publicKey(), []);
    expect(handle.getResidualTraces()).toEqual([]);
  });

  it("getResidualTraces returns a frozen snapshot of the traces passed to mint", () => {
    const traces: ResidualTrace[] = [
      {
        id: "01J0CARRY0000000000000001",
        kind: "interaction-summary",
        carriedFromNheId: "nhe-prior",
        carriedAtReincarnation: "2026-05-24T12:00:00.000Z",
        payload: { at: "2026-05-24T11:00:00.000Z", text: "hello" },
      },
    ];
    const handle = HimHandle.mint(sig, creatorSig, kr.publicKey(), [], [], traces);
    const out = handle.getResidualTraces();
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe("interaction-summary");
    expect(() => (out as unknown as ResidualTrace[]).push(traces[0]!)).toThrow();
  });

  it("getLawfulCharacter returns a default profile", () => {
    const handle = HimHandle.mint(sig, creatorSig, kr.publicKey(), []);
    const profile = handle.getLawfulCharacter();
    expect(profile.jurisdiction).toBe("default");
    expect(profile.maicOverrideActive).toBe(false);
  });
});
