import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";
import type { BirthSignature } from "../src/types";

const bsig = (id: string): BirthSignature => ({
  himId: id,
  bornAt: new Date().toISOString(),
  primaryArchetype: "aries-sun",
  modifiers: [],
  primordialAxiomIds: [],
});

describe("LocalMaic.suggestAxiomToHim (E11, society of HIMs)", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-suggest-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    const a = bsig("him.alpha");
    const b = bsig("him.beta");
    await maic.registerHim(a, kr.sign(a, 1));
    await maic.registerHim(b, kr.sign(b, 2));
  });

  it("Creator-signed suggestion appends an axiom-suggest audit event", async () => {
    const req = {
      fromHimId: "him.alpha",
      toHimId: "him.beta",
      statement: "Patience teaches what speed cannot.",
      rank: "secondary" as const,
      rationale: "alpha repeatedly observed this in lived experience",
    };
    const { auditId } = await maic.suggestAxiomToHim(req, kr.sign(req, 9));
    expect(auditId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const events = [];
    for await (const e of maic.queryAudit({ kind: "axiom-suggest" })) events.push(e);
    expect(events).toHaveLength(1);
    expect(events[0]?.data.fromHimId).toBe("him.alpha");
    expect(events[0]?.data.toHimId).toBe("him.beta");
  });

  it("rejects an unsigned-by-the-pinned-key request", async () => {
    const impostor = CreatorKeyring.generate();
    const req = {
      fromHimId: "him.alpha",
      toHimId: "him.beta",
      statement: "untrusted suggestion",
      rank: "secondary" as const,
    };
    await expect(maic.suggestAxiomToHim(req, impostor.sign(req, 9))).rejects.toThrow(/signature/i);
  });

  it("rejects an unknown fromHimId", async () => {
    const req = {
      fromHimId: "him.ghost",
      toHimId: "him.beta",
      statement: "anything",
      rank: "secondary" as const,
    };
    await expect(maic.suggestAxiomToHim(req, kr.sign(req, 9))).rejects.toThrow(/not registered/i);
  });

  it("axiom-suggest is mapped under ISO 42001 §7.5+§10.2 + EU AI Act Art 11+12", async () => {
    const req = {
      fromHimId: "him.alpha",
      toHimId: "him.beta",
      statement: "x",
      rank: "secondary" as const,
    };
    await maic.suggestAxiomToHim(req, kr.sign(req, 9));
    const iso = await maic.toCompliance("iso-42001");
    expect(iso.uncoveredKinds).toEqual([]);
    const controls = iso.controls.map((c) => c.control);
    expect(controls).toContain("7.5");
    expect(controls).toContain("10.2");

    const eu = await maic.toCompliance("eu-ai-act");
    expect(eu.uncoveredKinds).toEqual([]);
  });
});
