import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { BirthSignatureBuilder } from "../src/birth/builder";
import { createHim } from "../src/create";

describe("createHim — one-call helper", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "him-create-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    await maic.seed(kr);
  });

  it("creates a HimHandle and registers it with MAIC", async () => {
    const sig = BirthSignatureBuilder.now()
      .withPrimaryArchetype("aries-sun")
      .build();
    const handle = await createHim(maic, kr, sig);

    expect(handle.id).toBe(sig.himId);
    const record = await maic.getHimRecord(sig.himId);
    expect(record).not.toBeNull();
    expect(record?.himId).toBe(sig.himId);
  });

  it("includes the seed axioms in the handle's corpus", async () => {
    const sig = BirthSignatureBuilder.now()
      .withPrimaryArchetype("virgo-sun")
      .build();
    const handle = await createHim(maic, kr, sig);
    const axioms = handle.getAxioms();
    expect(axioms.length).toBeGreaterThan(0);
    expect(axioms.some((a) => a.id === "ax.ethic.no-malice")).toBe(true);
  });

  it("rejects when keyring does not match MAIC's pinned public key", async () => {
    const impostor = CreatorKeyring.generate();
    const sig = BirthSignatureBuilder.now().withPrimaryArchetype("x").build();
    await expect(createHim(maic, impostor, sig)).rejects.toThrow(/signature|public key/i);
  });

  it("honors an explicit nonce when provided", async () => {
    const sig = BirthSignatureBuilder.now()
      .withPrimaryArchetype("aquarius-sun")
      .build();
    const handle = await createHim(maic, kr, sig, { nonce: 12345 });
    expect(handle.id).toBe(sig.himId);
  });
});
