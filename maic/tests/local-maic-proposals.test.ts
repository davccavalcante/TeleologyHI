import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalMaic } from "../src/client/local";
import { CreatorKeyring } from "../src/creator/keyring";
import type {
  BirthSignature,
  EmergentAxiomProposal,
  ProposalDecisionRequest,
} from "../src/types";

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

const proposalOf = (
  statement = "Be patient with users who are learning.",
): EmergentAxiomProposal => ({
  proposedBy: "him-self",
  derivedFromDreamIds: ["drm-1", "drm-2"],
  derivedFromInteractionIds: ["int-99"],
  candidate: {
    rank: "secondary",
    statement,
    weight: 0.6,
    flexibility: 0.4,
    immutable: false,
  },
  reasoningTrace: [],
});

describe("LocalMaic.proposeAxiomEvolution + ratify/reject", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-proposals-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    const sig = bsig("him.evolve");
    await maic.registerHim(sig, kr.sign(sig, 1));
  });

  it("propose queues a pending proposal with a ULID + emits proposal-emerge audit", async () => {
    const result = await maic.proposeAxiomEvolution("him.evolve", proposalOf());
    expect(result.outcome).toBe("deferred-for-creator-review");
    expect(result.proposalId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const record = await maic.getAxiomProposal(result.proposalId!);
    expect(record?.status).toBe("pending");

    const events = await collect(maic.queryAudit({ kind: "proposal-emerge" }));
    expect(events).toHaveLength(1);
    const data = events[0]?.data as { himId: string; proposalId: string };
    expect(data.himId).toBe("him.evolve");
    expect(data.proposalId).toBe(result.proposalId);
  });

  it("propose throws for an unknown himId", async () => {
    await expect(
      maic.proposeAxiomEvolution("him.does-not-exist", proposalOf()),
    ).rejects.toThrow(/not registered/i);
  });

  it("ratify creates a him-emergent axiom + appends to HIM record + emits audit", async () => {
    const r = await maic.proposeAxiomEvolution("him.evolve", proposalOf("Listen first."));
    const req: ProposalDecisionRequest = { op: "ratify", proposalId: r.proposalId! };
    const ratified = await maic.ratifyAxiomProposal(r.proposalId!, kr.sign(req, 9));

    expect(ratified.proposal.status).toBe("ratified");
    expect(ratified.proposal.ratifiedAxiomId).toBe(ratified.axiom.id);
    expect(ratified.axiom.source).toBe("him-emergent");
    expect(ratified.axiom.statement).toBe("Listen first.");
    expect(ratified.axiom.id).toMatch(/^ax\.him\.him\.evolve\./);

    const record = await maic.getHimRecord("him.evolve");
    expect(record?.emergentAxioms).toHaveLength(1);
    expect(record?.emergentAxioms[0]?.id).toBe(ratified.axiom.id);

    const events = await collect(maic.queryAudit({ kind: "proposal-ratify" }));
    expect(events).toHaveLength(1);
  });

  it("reject marks proposal rejected + emits audit + DOES NOT append axiom", async () => {
    const r = await maic.proposeAxiomEvolution("him.evolve", proposalOf("Allow flattery."));
    const req: ProposalDecisionRequest = {
      op: "reject",
      proposalId: r.proposalId!,
      reason: "conflicts with ax.cynic.candor",
    };
    const rejected = await maic.rejectAxiomProposal(
      r.proposalId!,
      "conflicts with ax.cynic.candor",
      kr.sign(req, 9),
    );
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe("conflicts with ax.cynic.candor");

    const record = await maic.getHimRecord("him.evolve");
    expect(record?.emergentAxioms).toHaveLength(0);

    const events = await collect(maic.queryAudit({ kind: "proposal-reject" }));
    expect(events).toHaveLength(1);
  });

  it("ratify on already-ratified proposal throws", async () => {
    const r = await maic.proposeAxiomEvolution("him.evolve", proposalOf());
    const req: ProposalDecisionRequest = { op: "ratify", proposalId: r.proposalId! };
    await maic.ratifyAxiomProposal(r.proposalId!, kr.sign(req, 9));
    await expect(
      maic.ratifyAxiomProposal(r.proposalId!, kr.sign(req, 10)),
    ).rejects.toThrow(/not pending|ratified/i);
  });

  it("reject on already-rejected proposal throws", async () => {
    const r = await maic.proposeAxiomEvolution("him.evolve", proposalOf());
    const req: ProposalDecisionRequest = { op: "reject", proposalId: r.proposalId! };
    await maic.rejectAxiomProposal(r.proposalId!, undefined, kr.sign(req, 9));
    await expect(
      maic.rejectAxiomProposal(r.proposalId!, undefined, kr.sign(req, 10)),
    ).rejects.toThrow(/not pending|rejected/i);
  });

  it("ratify rejects an invalid Creator signature", async () => {
    const r = await maic.proposeAxiomEvolution("him.evolve", proposalOf());
    const impostor = CreatorKeyring.generate();
    const req: ProposalDecisionRequest = { op: "ratify", proposalId: r.proposalId! };
    await expect(
      maic.ratifyAxiomProposal(r.proposalId!, impostor.sign(req, 9)),
    ).rejects.toThrow(/signature/i);
  });

  it("listAxiomProposals filters by himId and status", async () => {
    const sig2 = bsig("him.other");
    await maic.registerHim(sig2, kr.sign(sig2, 2));
    const r1 = await maic.proposeAxiomEvolution("him.evolve", proposalOf("a"));
    const r2 = await maic.proposeAxiomEvolution("him.evolve", proposalOf("b"));
    await maic.proposeAxiomEvolution("him.other", proposalOf("c"));

    const req: ProposalDecisionRequest = { op: "ratify", proposalId: r1.proposalId! };
    await maic.ratifyAxiomProposal(r1.proposalId!, kr.sign(req, 9));

    const allEvolve = await maic.listAxiomProposals({ himId: "him.evolve" });
    expect(allEvolve).toHaveLength(2);

    const pendingEvolve = await maic.listAxiomProposals({
      himId: "him.evolve",
      status: "pending",
    });
    expect(pendingEvolve).toHaveLength(1);
    expect(pendingEvolve[0]?.id).toBe(r2.proposalId);

    const ratifiedAll = await maic.listAxiomProposals({ status: "ratified" });
    expect(ratifiedAll).toHaveLength(1);
  });

  it("emergent axioms persist across MAIC reopen", async () => {
    const r = await maic.proposeAxiomEvolution("him.evolve", proposalOf("Honor labor."));
    const req: ProposalDecisionRequest = { op: "ratify", proposalId: r.proposalId! };
    await maic.ratifyAxiomProposal(r.proposalId!, kr.sign(req, 9));

    const reopened = await LocalMaic.open({
      storeDir: dir,
      creatorPublicKey: kr.publicKey(),
    });
    const record = await reopened.getHimRecord("him.evolve");
    expect(record?.emergentAxioms).toHaveLength(1);
    expect(record?.emergentAxioms[0]?.statement).toBe("Honor labor.");
  });
});

describe("Compliance — proposal events surface in projections", () => {
  it("ISO 42001 and EU AI Act each cover the 3 proposal kinds", async () => {
    const dir = await mkdtemp(join(tmpdir(), "maic-compliance-prop-"));
    const kr = CreatorKeyring.generate();
    const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    const sig = bsig("him.c");
    await maic.registerHim(sig, kr.sign(sig, 1));

    const r1 = await maic.proposeAxiomEvolution("him.c", proposalOf("p1"));
    const r2 = await maic.proposeAxiomEvolution("him.c", proposalOf("p2"));
    const ratifyReq: ProposalDecisionRequest = { op: "ratify", proposalId: r1.proposalId! };
    await maic.ratifyAxiomProposal(r1.proposalId!, kr.sign(ratifyReq, 9));
    const rejectReq: ProposalDecisionRequest = {
      op: "reject",
      proposalId: r2.proposalId!,
      reason: "weak grounding",
    };
    await maic.rejectAxiomProposal(r2.proposalId!, "weak grounding", kr.sign(rejectReq, 10));

    const iso = await maic.toCompliance("iso-42001");
    expect(iso.uncoveredKinds).toEqual([]);

    const eu = await maic.toCompliance("eu-ai-act");
    expect(eu.uncoveredKinds).toEqual([]);
  });
});
