import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "../src/audit/log";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";
import { NonceLedger } from "../src/creator/nonce-ledger";
import { signBirthSignature, verifyBirthSignature } from "../src/creator/sign-birth";
import type {
  BirthSignature,
  BirthSignatureWithIdentity,
  EmergentAxiomProposal,
  NheBodyRef,
  NheLifecycleRequest,
  ReincarnationRequest,
} from "../src/types";

async function count<T>(iter: AsyncIterable<T>): Promise<number> {
  let n = 0;
  for await (const _ of iter) n++;
  return n;
}

const bsig = (id: string): BirthSignature => ({
  himId: id,
  bornAt: new Date().toISOString(),
  primaryArchetype: "aries-sun",
  modifiers: [],
  primordialAxiomIds: [],
});

const body = (nheId: string, llmAdapter = "anthropic:claude-sonnet-4-6"): NheBodyRef => ({
  nheId,
  llmAdapter,
  embodiedAt: new Date().toISOString(),
});

const proposalOf = (
  statement = "Be patient with users who are learning.",
): EmergentAxiomProposal => ({
  proposedBy: "him-self",
  derivedFromDreamIds: ["drm-1"],
  derivedFromInteractionIds: ["int-1"],
  candidate: { rank: "secondary", statement, weight: 0.6, flexibility: 0.4, immutable: false },
  reasoningTrace: [],
});

// ─── M1-1: registerHim validates before appending the audit event ───────────
describe("M1-1: registerHim audit-after-validate ordering", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-m11-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  });

  it("a registration rejected for a bad signature appends no audit event", async () => {
    const sig = bsig("him.bad");
    const impostor = CreatorKeyring.generate();
    const before = maic.auditSize();
    await expect(maic.registerHim(sig, impostor.sign(sig, 1))).rejects.toThrow(/signature/i);
    expect(maic.auditSize()).toBe(before);
    expect(await count(maic.queryAudit({ kind: "him-register" }))).toBe(0);
  });

  it("a registration rejected for a duplicate himId appends no second audit event", async () => {
    const sig = bsig("him.dup");
    await maic.registerHim(sig, kr.sign(sig, 1));
    const afterFirst = maic.auditSize();
    await expect(maic.registerHim(sig, kr.sign(sig, 2))).rejects.toThrow(/already registered/i);
    expect(maic.auditSize()).toBe(afterFirst);
    expect(await count(maic.queryAudit({ kind: "him-register" }))).toBe(1);
  });

  it("a successful registration emits exactly one him-register event", async () => {
    const sig = bsig("him.ok");
    const before = maic.auditSize();
    await maic.registerHim(sig, kr.sign(sig, 1));
    expect(maic.auditSize()).toBe(before + 1);
    expect(await count(maic.queryAudit({ kind: "him-register" }))).toBe(1);
  });
});

// ─── M1-2: BirthSignature preserves identity + natalChart end to end ─────────
describe("M1-2: signed natal chart round-trips through registration", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-m12-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  });

  it("registers a chart-bearing signature and returns the chart from getHimRecord", async () => {
    const birth: BirthSignatureWithIdentity = {
      ...bsig("him.chart"),
      identity: { name: "Lex", gender: "feminine", language: "en" },
      natalChart: { sun: "aries", ascendant: "leo", moon: "cancer" },
    };
    await maic.registerHim(birth, kr.sign(birth, 1));
    const rec = await maic.getHimRecord("him.chart");
    expect(rec?.birthSignature.natalChart).toEqual({
      sun: "aries",
      ascendant: "leo",
      moon: "cancer",
    });
    expect(rec?.birthSignature.identity?.name).toBe("Lex");
  });

  it("persists the natal chart across a store reopen", async () => {
    const birth: BirthSignatureWithIdentity = {
      ...bsig("him.persist"),
      natalChart: { sun: "taurus", ascendant: "virgo" },
    };
    await maic.registerHim(birth, kr.sign(birth, 1));
    const reopened = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    const rec = await reopened.getHimRecord("him.persist");
    expect(rec?.birthSignature.natalChart).toEqual({ sun: "taurus", ascendant: "virgo" });
  });

  it("still registers a signature with no natal chart (additive invariant)", async () => {
    const birth = bsig("him.plain");
    await maic.registerHim(birth, kr.sign(birth, 1));
    const rec = await maic.getHimRecord("him.plain");
    expect(rec?.birthSignature.natalChart).toBeUndefined();
  });

  it("signBirthSignature + verifyBirthSignature cover the natal chart", () => {
    const birth: BirthSignatureWithIdentity = {
      ...bsig("him.signed"),
      natalChart: { sun: "gemini", ascendant: "libra" },
    };
    const signed = signBirthSignature(birth, kr);
    expect(verifyBirthSignature(signed, kr.publicKey())).toBe(true);
    // A tampered chart breaks verification.
    const tampered = { ...signed, natalChart: { sun: "scorpio", ascendant: "libra" } };
    expect(verifyBirthSignature(tampered, kr.publicKey())).toBe(false);
  });
});

// ─── M1-3: NonceLedger + axiom nonce log are append-only and crash-safe ──────
describe("M1-3: nonce ledger is append-only and survives reopen", () => {
  it("rejects a replayed nonce and persists consumed nonces across reopen", async () => {
    const dir = await mkdtemp(join(tmpdir(), "maic-m13-ledger-"));
    const ledger = await NonceLedger.open(dir);
    await ledger.consume(3);
    await ledger.consume(4);
    await expect(ledger.consume(3)).rejects.toThrow(/nonce/i);

    const reopened = await NonceLedger.open(dir);
    await expect(reopened.consume(4)).rejects.toThrow(/nonce/i);
    await reopened.consume(5);
  });

  it("records one line per axiom mint without rewriting prior content", async () => {
    const dir = await mkdtemp(join(tmpdir(), "maic-m13-axioms-"));
    const kr = CreatorKeyring.generate();
    const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    const result = await maic.seed(kr);
    const raw = await readFile(join(dir, "axioms", "nonces.log"), "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    expect(lines).toHaveLength(result.minted);
  });
});

// ─── M1-4: AuditLog serialises concurrent appends into an intact chain ───────
describe("M1-4: AuditLog append is serialised", () => {
  it("keeps the hash chain intact under 50 concurrent appends", async () => {
    const dir = await mkdtemp(join(tmpdir(), "maic-m14-"));
    const log = await AuditLog.open(dir);
    await Promise.all(
      Array.from({ length: 50 }, (_, i) => log.append({ kind: "behavior-review", data: { i } })),
    );
    expect(log.size()).toBe(50);
    // Reopen runs loadAndVerify, which throws if the chain forked.
    const reopened = await AuditLog.open(dir);
    expect(reopened.size()).toBe(50);
  });
});

// ─── M1-5: replay protection on lifecycle / reincarnation / proposal / suggest ─
describe("M1-5: Creator-signature replay protection", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-m15-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  });

  it("rejects a replayed lifecycle signature via the nonce guard", async () => {
    // A same-request terminate replay is caught earlier by the terminal-status
    // guard (the nonce is now consumed only after the preconditions pass), so
    // exercise the nonce guard directly: a deprecate whose replay changes state
    // after an intervening reactivate is rejected as an already-used nonce,
    // proving the signed nonce stays single-use even when preconditions pass.
    const dep: NheLifecycleRequest = { op: "deprecate", nheId: "nhe-x" };
    const depSig = kr.sign(dep, 5);
    await maic.deprecate("nhe-x", undefined, depSig);
    await maic.reactivate("nhe-x", undefined, kr.sign({ op: "reactivate", nheId: "nhe-x" }, 6));
    await expect(maic.deprecate("nhe-x", undefined, depSig)).rejects.toThrow(/nonce/i);
  });

  it("rejects a replayed reincarnation signature", async () => {
    const b = bsig("him.z");
    await maic.registerHim(b, kr.sign(b, 1));
    const req: ReincarnationRequest = { himId: "him.z", toBody: body("nhe-z1") };
    const sig = kr.sign(req, 2);
    await maic.reincarnateHim(req, sig);
    await expect(maic.reincarnateHim(req, sig)).rejects.toThrow(/nonce/i);
  });

  it("rejects reincarnating into an already-open body id", async () => {
    const b = bsig("him.y");
    await maic.registerHim(b, kr.sign(b, 1));
    const r1: ReincarnationRequest = { himId: "him.y", toBody: body("nhe-dup") };
    await maic.reincarnateHim(r1, kr.sign(r1, 2));
    const r2: ReincarnationRequest = { himId: "him.y", toBody: body("nhe-dup") };
    await expect(maic.reincarnateHim(r2, kr.sign(r2, 3))).rejects.toThrow(
      /already has an open body/i,
    );
  });

  it("rejects a proposal-decision nonce reused across proposals", async () => {
    const b = bsig("him.p");
    await maic.registerHim(b, kr.sign(b, 1));
    const p1 = await maic.proposeAxiomEvolution("him.p", proposalOf("First."));
    const p2 = await maic.proposeAxiomEvolution("him.p", proposalOf("Second."));
    const ratifyReq = { op: "ratify" as const, proposalId: p1.proposalId! };
    await maic.ratifyAxiomProposal(p1.proposalId!, kr.sign(ratifyReq, 5));
    const rejectReq = { op: "reject" as const, proposalId: p2.proposalId! };
    await expect(
      maic.rejectAxiomProposal(p2.proposalId!, undefined, kr.sign(rejectReq, 5)),
    ).rejects.toThrow(/nonce/i);
  });

  it("rejects a replayed suggestAxiomToHim signature", async () => {
    const a = bsig("him.a");
    const c = bsig("him.c");
    await maic.registerHim(a, kr.sign(a, 1));
    await maic.registerHim(c, kr.sign(c, 2));
    const req = {
      fromHimId: "him.a",
      toHimId: "him.c",
      statement: "Patience teaches what speed cannot.",
      rank: "secondary" as const,
    };
    const sig = kr.sign(req, 3);
    await maic.suggestAxiomToHim(req, sig);
    await expect(maic.suggestAxiomToHim(req, sig)).rejects.toThrow(/nonce/i);
  });
});
