import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { CreatorKeyring } from "../src/creator/keyring";
import { ProposalStore } from "../src/proposals/store";
import type { EmergentAxiomProposal, ProposalDecisionRequest } from "../src/types";

const proposalOf = (statement = "Be patient."): EmergentAxiomProposal => ({
  proposedBy: "him-self",
  derivedFromDreamIds: ["drm-1"],
  derivedFromInteractionIds: ["int-1"],
  candidate: { rank: "secondary", statement, weight: 0.6, flexibility: 0.4, immutable: false },
  reasoningTrace: [],
});

describe("ProposalStore (standalone, M2-3)", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let store: ProposalStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-propstore-"));
    kr = CreatorKeyring.generate();
    store = await ProposalStore.open(dir, kr.publicKey());
  });

  it("propose persists a pending record retrievable by id and list", async () => {
    const rec = await store.propose("him.a", proposalOf());
    expect(rec.status).toBe("pending");
    expect(await store.get(rec.id)).toEqual(rec);
    expect(await store.list({ himId: "him.a" })).toHaveLength(1);
    expect(await store.list({ status: "ratified" })).toHaveLength(0);
  });

  it("markRatified rejects a non-pending proposal", async () => {
    const rec = await store.propose("him.a", proposalOf());
    const req: ProposalDecisionRequest = { op: "ratify", proposalId: rec.id };
    await store.markRatified(req, kr.sign(req, 1), "ax.him.a.001");
    // Second ratify with a fresh nonce hits the not-pending guard.
    await expect(store.markRatified(req, kr.sign(req, 2), "ax.him.a.002")).rejects.toThrow(
      /not pending/i,
    );
  });

  it("markRejected records a rejection with an optional reason", async () => {
    const rec = await store.propose("him.a", proposalOf());
    const req: ProposalDecisionRequest = { op: "reject", proposalId: rec.id, reason: "drift" };
    const rejected = await store.markRejected(req, kr.sign(req, 1));
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe("drift");
  });

  it("rejects a decision signed by the wrong key", async () => {
    const rec = await store.propose("him.a", proposalOf());
    const impostor = CreatorKeyring.generate();
    const req: ProposalDecisionRequest = { op: "ratify", proposalId: rec.id };
    await expect(store.markRatified(req, impostor.sign(req, 1), "ax.him.a.001")).rejects.toThrow(
      /signature/i,
    );
  });

  it("rejects a replayed decision nonce", async () => {
    const p1 = await store.propose("him.a", proposalOf("first"));
    const p2 = await store.propose("him.a", proposalOf("second"));
    const r1: ProposalDecisionRequest = { op: "ratify", proposalId: p1.id };
    await store.markRatified(r1, kr.sign(r1, 7), "ax.him.a.001");
    const r2: ProposalDecisionRequest = { op: "reject", proposalId: p2.id };
    await expect(store.markRejected(r2, kr.sign(r2, 7))).rejects.toThrow(/nonce/i);
  });
});
