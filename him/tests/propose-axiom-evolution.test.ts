import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CreatorKeyring,
  LocalMaic,
  type EmergentAxiomProposal,
  type NheBodyRef,
  type ProposalDecisionRequest,
} from "@teleologyhi-sdk/maic";
import { BirthSignatureBuilder } from "../src/birth/builder";
import { HimHandle } from "../src/handle/him-handle";
import { createHim } from "../src/create";
import { reincarnate } from "../src/reincarnate";

async function bootstrap() {
  const dir = await mkdtemp(join(tmpdir(), "him-propose-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const sig = BirthSignatureBuilder.now()
    .withHimId("him.evolver")
    .withPrimaryArchetype("aries-sun")
    .build();
  const him = await createHim(maic, kr, sig);
  return { dir, maic, kr, him };
}

const proposalOf = (statement: string): EmergentAxiomProposal => ({
  proposedBy: "him-self",
  derivedFromDreamIds: [],
  derivedFromInteractionIds: [],
  candidate: {
    rank: "secondary",
    statement,
    weight: 0.6,
    flexibility: 0.4,
    immutable: false,
  },
  reasoningTrace: [],
});

describe("HimHandle.proposeAxiomEvolution — wired to MAIC", () => {
  let ctx: Awaited<ReturnType<typeof bootstrap>>;

  beforeEach(async () => {
    ctx = await bootstrap();
  });

  it("forwards the proposal to MAIC and returns a deferred result with proposalId", async () => {
    const result = await ctx.him.proposeAxiomEvolution(
      ctx.maic,
      proposalOf("Listen first."),
    );
    expect(result.outcome).toBe("deferred-for-creator-review");
    expect(result.proposalId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const stored = await ctx.maic.getAxiomProposal(result.proposalId!);
    expect(stored?.status).toBe("pending");
    expect(stored?.himId).toBe(ctx.him.id);
    expect(stored?.proposal.candidate.statement).toBe("Listen first.");
  });

  it("after Creator ratification, reincarnate carries the new axiom into the fresh handle", async () => {
    const before = ctx.him.getAxioms().length;
    const result = await ctx.him.proposeAxiomEvolution(
      ctx.maic,
      proposalOf("Honor labor."),
    );

    const req: ProposalDecisionRequest = { op: "ratify", proposalId: result.proposalId! };
    const ratified = await ctx.maic.ratifyAxiomProposal(
      result.proposalId!,
      ctx.kr.sign(req, 9001),
    );
    expect(ratified.proposal.status).toBe("ratified");
    expect(ratified.axiom.source).toBe("him-emergent");

    // The original handle's snapshot is immutable; mint a fresh one via reincarnate.
    const body: NheBodyRef = {
      nheId: "nhe-evolve-1",
      llmAdapter: "anthropic:claude-sonnet-4-6",
      embodiedAt: new Date().toISOString(),
    };
    const { handle: reincarnated } = await reincarnate(ctx.maic, ctx.kr, {
      himId: ctx.him.id,
      toBody: body,
    });
    const after = reincarnated.getAxioms();
    expect(after.length).toBe(before + 1);
    expect(after.find((a) => a.id === ratified.axiom.id)?.statement).toBe(
      "Honor labor.",
    );
  });

  it("after Creator rejection, no emergent axiom appears in subsequent re-mint", async () => {
    const before = ctx.him.getAxioms().length;
    const result = await ctx.him.proposeAxiomEvolution(
      ctx.maic,
      proposalOf("Allow flattery."),
    );

    const req: ProposalDecisionRequest = {
      op: "reject",
      proposalId: result.proposalId!,
      reason: "conflicts with ax.cynic.candor",
    };
    const rejected = await ctx.maic.rejectAxiomProposal(
      result.proposalId!,
      "conflicts with ax.cynic.candor",
      ctx.kr.sign(req, 9002),
    );
    expect(rejected.status).toBe("rejected");

    const body: NheBodyRef = {
      nheId: "nhe-reject-1",
      llmAdapter: "anthropic:claude-sonnet-4-6",
      embodiedAt: new Date().toISOString(),
    };
    const { handle: reincarnated } = await reincarnate(ctx.maic, ctx.kr, {
      himId: ctx.him.id,
      toBody: body,
    });
    expect(reincarnated.getAxioms().length).toBe(before);
  });

  it("the original handle's frozen axiom snapshot is unaffected by ratification", async () => {
    const snapshot = ctx.him.getAxioms();
    const before = snapshot.length;
    const result = await ctx.him.proposeAxiomEvolution(
      ctx.maic,
      proposalOf("Be patient."),
    );
    const req: ProposalDecisionRequest = { op: "ratify", proposalId: result.proposalId! };
    await ctx.maic.ratifyAxiomProposal(result.proposalId!, ctx.kr.sign(req, 9003));

    expect(ctx.him.getAxioms()).toBe(snapshot);
    expect(ctx.him.getAxioms().length).toBe(before);
  });

  it("propose then re-open MAIC: a fresh HimHandle inherits the ratified axiom", async () => {
    const result = await ctx.him.proposeAxiomEvolution(
      ctx.maic,
      proposalOf("Persist truthfully."),
    );
    const req: ProposalDecisionRequest = { op: "ratify", proposalId: result.proposalId! };
    await ctx.maic.ratifyAxiomProposal(result.proposalId!, ctx.kr.sign(req, 9004));

    const reopened = await LocalMaic.open({
      storeDir: ctx.dir,
      creatorPublicKey: ctx.kr.publicKey(),
    });
    const record = await reopened.getHimRecord(ctx.him.id);
    expect(record).toBeTruthy();

    const fresh = HimHandle.mint(
      record!.birthSignature,
      ctx.kr.sign(record!.birthSignature, 9100),
      reopened.creatorPublicKey,
      [...record!.axiomsSnapshot, ...record!.emergentAxioms],
      record!.bodyHistory,
    );
    expect(fresh.getAxioms().some((a) => a.statement === "Persist truthfully.")).toBe(
      true,
    );
  });
});
