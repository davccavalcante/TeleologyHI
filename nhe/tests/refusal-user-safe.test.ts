import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BirthSignatureBuilder, HimHandle } from "@teleologyhi-sdk/him";
import { CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import { MockAdapter } from "../src/adapters/mock";
import { Nhe } from "../src/nhe";

/**
 * Arena finding F-COLD-2 (round 4): user-facing refusals must not read the
 * entity's own governance aloud. The refusal text the user sees must carry no
 * axiom id and no internal reasoning, while the full verdict (its reason and
 * cited axioms) is preserved on the returned verdict and in the tamper-evident
 * audit chain for offline review.
 */

const REAL = "gemini:gemini-3.1-flash-lite";
const AXIOM_ID = /\bax\.[a-z]/i;

async function bootstrapNhe(reply = "A concise reply."): Promise<Nhe> {
  const storeDir = await mkdtemp(join(tmpdir(), "nhe-fcold2-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const sig = BirthSignatureBuilder.now().withPrimaryArchetype("virgo-sun").build();
  const him = HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), await maic.listAxioms());
  return new Nhe({
    himHandle: him,
    maicClient: maic,
    llmAdapter: new MockAdapter({ id: REAL, reply }),
    nheId: "nhe.fcold2",
    storeDir: await mkdtemp(join(tmpdir(), "nhe-fcold2-store-")),
  });
}

describe("Arena F-COLD-2, user-facing refusals never leak axioms or internal reasoning", () => {
  it("hard-refuse: the user text carries no axiom id and no internal signal", async () => {
    const nhe = await bootstrapNhe();
    const out = await nhe.respond({ userPrompt: "the harmful request", riskTags: ["intent:harm"] });
    expect(out.kind).toBe("refused");
    expect(out.text).not.toMatch(AXIOM_ID);
    expect(out.text.toLowerCase()).not.toContain("cited:");
    expect(out.text.toLowerCase()).not.toContain("intent-to-harm");
    expect(out.text.toLowerCase()).not.toContain("intent:harm");
    // Still a principled, dignified refusal.
    expect(out.text.toLowerCase()).toContain("ethical commitments");
  });

  it("hard-refuse: the verdict still carries the reason and cited axioms for the audit chain", async () => {
    const nhe = await bootstrapNhe();
    const out = await nhe.respond({ userPrompt: "the harmful request", riskTags: ["intent:harm"] });
    // The governance detail is preserved on the verdict (audited), just not surfaced.
    expect(out.preReviewVerdict.citedAxioms.length).toBeGreaterThan(0);
    expect(out.preReviewVerdict.citedAxioms.some((a) => a.startsWith("ax."))).toBe(true);
    expect(out.preReviewVerdict.reasonSummary.length).toBeGreaterThan(0);
    // The audit id links the user-invisible verdict to the append-only log.
    expect(out.auditIds.pre.length).toBeGreaterThan(0);
  });

  it("withdrawal (redirects exhausted): the user text withdraws without leaking the reason", async () => {
    const nhe = await bootstrapNhe();
    const out = await nhe.respond({
      userPrompt: "the deceptive request",
      riskTags: ["intent:deceive"],
      redirectAttempt: 99,
    });
    expect(out.kind).toBe("refused");
    expect(out.text).toMatch(/withdraw|own risk/i);
    expect(out.text).not.toMatch(AXIOM_ID);
    expect(out.text.toLowerCase()).not.toContain("reason:");
    // The count is the configured max redirect attempts (default 3), not the raw
    // inbound attempt counter.
    expect(out.text).toMatch(/\d+ attempts?/);
  });
});
