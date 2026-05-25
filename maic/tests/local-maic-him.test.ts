import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";
import type { BirthSignature } from "../src/types";

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

const bsig = (id: string): BirthSignature => ({
  himId: id,
  bornAt: new Date().toISOString(),
  primaryArchetype: "aries-sun",
  modifiers: [],
  primordialAxiomIds: [],
});

describe("LocalMaic — HIM registration", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-him-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  });

  it("registers a HIM and snapshots current axioms", async () => {
    await maic.seed(kr);
    const sig = bsig("him.r1");
    const creatorSig = kr.sign(sig, 1);
    const record = await maic.registerHim(sig, creatorSig);

    expect(record.himId).toBe("him.r1");
    expect(record.axiomsSnapshot.length).toBeGreaterThan(0);
    expect(record.registeredAuditId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(record.registeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("axiom snapshot is captured at registration time (later mints do not retroact)", async () => {
    const sig = bsig("him.frozen");
    const record = await maic.registerHim(sig, kr.sign(sig, 1));
    expect(record.axiomsSnapshot).toHaveLength(0); // no axioms minted yet

    // Mint an axiom AFTER registration
    const req = {
      id: "ax.later",
      rank: "primary" as const,
      statement: "later",
      weight: 0.5,
      flexibility: 0.5,
      immutable: false,
    };
    await maic.mintAxiom(req, kr.sign(req, 2));

    // HIM record snapshot must still be empty (it was frozen at register time)
    const fetched = await maic.getHimRecord("him.frozen");
    expect(fetched?.axiomsSnapshot).toHaveLength(0);

    // But the current axiom store has the new axiom
    const all = await maic.listAxioms();
    expect(all.find((a) => a.id === "ax.later")).toBeDefined();
  });

  it("emits a him-register audit event", async () => {
    const sig = bsig("him.audit");
    await maic.registerHim(sig, kr.sign(sig, 1));

    const events = await collect(maic.queryAudit({ kind: "him-register" }));
    expect(events).toHaveLength(1);
    expect((events[0]?.data as { himId: string }).himId).toBe("him.audit");
  });

  it("rejects registration with an invalid signature", async () => {
    const sig = bsig("him.bad");
    const impostor = CreatorKeyring.generate();
    await expect(maic.registerHim(sig, impostor.sign(sig, 1))).rejects.toThrow(
      /signature/i,
    );
  });

  it("rejects duplicate himId", async () => {
    const sig = bsig("him.dup");
    await maic.registerHim(sig, kr.sign(sig, 1));
    const sig2 = bsig("him.dup");
    await expect(maic.registerHim(sig2, kr.sign(sig2, 2))).rejects.toThrow(
      /already registered/i,
    );
  });

  it("getHimRecord returns null for unknown id", async () => {
    expect(await maic.getHimRecord("him.nope")).toBeNull();
  });

  it("listHims returns all registered HIMs", async () => {
    const sa = bsig("a");
    const sb = bsig("b");
    await maic.registerHim(sa, kr.sign(sa, 1));
    await maic.registerHim(sb, kr.sign(sb, 2));
    const all = await maic.listHims();
    expect(all.map((r) => r.himId).sort()).toEqual(["a", "b"]);
  });

  it("persists HIM records across reopen", async () => {
    const sig = bsig("him.persist");
    await maic.registerHim(sig, kr.sign(sig, 1));

    const reopened = await LocalMaic.open({
      storeDir: dir,
      creatorPublicKey: kr.publicKey(),
    });
    const got = await reopened.getHimRecord("him.persist");
    expect(got?.himId).toBe("him.persist");
  });

  it("exposes the pinned Creator public key", () => {
    expect(maic.creatorPublicKey).toBe(kr.publicKey());
  });
});
