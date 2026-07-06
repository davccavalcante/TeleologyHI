import { appendFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AuditLog } from "../src/audit/log";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";
import { NonceLedger } from "../src/creator/nonce-ledger";
import type {
  BirthSignature,
  EmergentAxiomProposal,
  MintAxiomRequest,
  NheBodyRef,
  ReincarnationRequest,
} from "../src/types";

/**
 * Regression tests for the 1.0.1 pre-publish deep-review findings in `maic`.
 * Each test fails against the pre-fix code and passes after the fix.
 *
 * F#2  AuditLog: a torn final line must be dropped, not brick `open()`.
 * F#4  AxiomStore.mint: the nonce check and claim must be atomic (no TOCTOU).
 * F#5  ratify: one proposal yields exactly one axiom with a deterministic id.
 * F#8  a failed precondition must not burn the signature nonce.
 * F#9  NonceLedger: a torn final line must be dropped, not mis-recorded.
 */

const tmp = (p: string) => mkdtemp(join(tmpdir(), p));

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

const proposalOf = (statement: string): EmergentAxiomProposal => ({
  proposedBy: "him-self",
  derivedFromDreamIds: ["drm-1"],
  derivedFromInteractionIds: ["int-1"],
  candidate: { rank: "secondary", statement, weight: 0.6, flexibility: 0.4, immutable: false },
  reasoningTrace: [],
});

describe("Deep-review F#2: AuditLog tolerates a torn final line, rejects real corruption", () => {
  it("drops an unterminated torn final line instead of bricking open()", async () => {
    const dir = await tmp("maic-dr-f2a-");
    const log = await AuditLog.open(dir);
    await log.append({ kind: "behavior-review", data: { i: 1 } });
    await log.append({ kind: "behavior-review", data: { i: 2 } });
    // Simulate a crash or full disk mid-append: a non-empty, unterminated,
    // invalid-JSON final line with no trailing newline.
    await appendFile(join(dir, "audit", "log.ndjson"), '{"ts":"2026', "utf-8");
    const reopened = await AuditLog.open(dir);
    expect(reopened.size()).toBe(2);
  });

  it("still throws on a newline-terminated corrupt line (genuine tamper or corruption)", async () => {
    const dir = await tmp("maic-dr-f2b-");
    const log = await AuditLog.open(dir);
    await log.append({ kind: "behavior-review", data: { i: 1 } });
    // A terminated garbage line is NOT a torn write; it must surface.
    await appendFile(join(dir, "audit", "log.ndjson"), "not-json\n", "utf-8");
    await expect(AuditLog.open(dir)).rejects.toThrow(/corrupt/i);
  });
});

describe("Deep-review F#4: AxiomStore.mint closes the nonce replay TOCTOU", () => {
  it("two concurrent mints replaying one Creator signature mint exactly one axiom", async () => {
    const dir = await tmp("maic-dr-f4-");
    const kr = CreatorKeyring.generate();
    const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    const req: MintAxiomRequest = {
      rank: "secondary",
      statement: "One signature, one axiom.",
      weight: 0.5,
      flexibility: 0.5,
      immutable: false,
    };
    const sig = kr.sign(req, 42);
    const results = await Promise.allSettled([maic.mintAxiom(req, sig), maic.mintAxiom(req, sig)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;
    expect(fulfilled).toBe(1);
    expect(rejected).toBe(1);
    expect(await maic.listAxioms()).toHaveLength(1);
  });
});

describe("Deep-review F#5: one ratified proposal yields exactly one axiom, deterministic id", () => {
  it("derives the emergent axiom id from the proposal id and never duplicates", async () => {
    const dir = await tmp("maic-dr-f5-");
    const kr = CreatorKeyring.generate();
    const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    const b = bsig("him.r");
    await maic.registerHim(b, kr.sign(b, 1));
    const p = await maic.proposeAxiomEvolution("him.r", proposalOf("Grow through reflection."));
    const proposalId = p.proposalId!;
    await maic.ratifyAxiomProposal(proposalId, kr.sign({ op: "ratify", proposalId }, 5));

    const record = await maic.getHimRecord("him.r");
    expect(record?.emergentAxioms).toHaveLength(1);
    // Deterministic id: a crash-retry would regenerate the SAME id, and
    // appendEmergentAxiom is idempotent by id, so no duplicate can appear.
    expect(record?.emergentAxioms[0]?.id).toContain(proposalId);

    // A retry of the already-ratified proposal is rejected and adds nothing.
    await expect(
      maic.ratifyAxiomProposal(proposalId, kr.sign({ op: "ratify", proposalId }, 6)),
    ).rejects.toThrow(/not pending/i);
    const after = await maic.getHimRecord("him.r");
    expect(after?.emergentAxioms).toHaveLength(1);
  });
});

describe("Deep-review F#8: a failed precondition does not burn the signature nonce", () => {
  it("a reincarnate for an unregistered him keeps the nonce, so the retry after registering works", async () => {
    const dir = await tmp("maic-dr-f8-");
    const kr = CreatorKeyring.generate();
    const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    const req: ReincarnationRequest = { himId: "him.late", toBody: body("nhe-late") };
    const sig = kr.sign(req, 7);
    // himId not registered yet: rejected, and the nonce must NOT be burned.
    await expect(maic.reincarnateHim(req, sig)).rejects.toThrow(/not registered/i);
    // Register the him, then retry the SAME signed request; it must succeed.
    const b = bsig("him.late");
    await maic.registerHim(b, kr.sign(b, 1));
    const out = await maic.reincarnateHim(req, sig);
    expect(out.bodyHistory.some((x) => x.nheId === "nhe-late")).toBe(true);
  });
});

describe("Deep-review F#9: NonceLedger drops a torn final line", () => {
  it("drops an unterminated final line instead of mis-recording a partial integer", async () => {
    const dir = await tmp("maic-dr-f9-");
    const ledger = await NonceLedger.open(dir);
    await ledger.consume(42);
    // Simulate a torn append of nonce 99: only the first digit landed, no newline.
    await appendFile(join(dir, "nonces.log"), "9", "utf-8");
    const reopened = await NonceLedger.open(dir);
    expect(reopened.has(42)).toBe(true); // complete line preserved
    expect(reopened.has(9)).toBe(false); // torn line dropped, not mis-recorded as 9
    // 99 stays free because its operation never completed; consuming it is fine.
    await expect(reopened.consume(99)).resolves.toBeUndefined();
  });
});
