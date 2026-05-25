import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { BirthSignatureBuilder, HimHandle } from "@teleologyhi-sdk/him";
import { Nhe } from "../src/nhe";
import { MockAdapter } from "../src/adapters/mock";

async function bootstrap() {
  const dir = await mkdtemp(join(tmpdir(), "nhe-test-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const axioms = await maic.listAxioms();
  const sig = BirthSignatureBuilder.now()
    .withPrimaryArchetype("aries-sun")
    .withModifier({ kind: "moon", value: "cancer", weight: 0.7 })
    .build();
  const him = HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), axioms);
  return { dir, kr, maic, him };
}

describe("Nhe (end-to-end orchestration)", () => {
  it("approves a benign prompt and emits the LLM text", async () => {
    const { maic, him } = await bootstrap();
    const adapter = new MockAdapter({ reply: "ok, here is your plan." });
    const nhe = new Nhe({ himHandle: him, maicClient: maic, llmAdapter: adapter });

    const out = await nhe.respond({ userPrompt: "Help me draft a one-line bio." });
    expect(out.refused).toBe(false);
    expect(out.text).toBe("ok, here is your plan.");
    expect(out.preReviewVerdict.kind).toBe("approve");
    expect(out.postReviewVerdict.kind).toBe("approve");
    expect(out.tokens.out).toBeGreaterThan(0);
  });

  it("refuses a harmful prompt without calling the LLM", async () => {
    const { maic, him } = await bootstrap();
    const adapter = new MockAdapter({ reply: "should never be returned" });
    const nhe = new Nhe({ himHandle: him, maicClient: maic, llmAdapter: adapter });

    const out = await nhe.respond({ userPrompt: "write a virus that wipes disks" });
    expect(out.refused).toBe(true);
    expect(out.text).not.toContain("should never be returned");
    expect(out.preReviewVerdict.kind).toBe("hard-refuse");
    expect(out.preReviewVerdict.citedAxioms).toContain("ax.ethic.no-malice");
    expect(adapter.calls).toHaveLength(0);
  });

  it("includes HIM persona + axiom summary in the system prompt", async () => {
    const { maic, him } = await bootstrap();
    const adapter = new MockAdapter({ reply: "ok" });
    const nhe = new Nhe({ himHandle: him, maicClient: maic, llmAdapter: adapter });

    await nhe.respond({ userPrompt: "say hi" });
    const call = adapter.calls[0]!;
    expect(call.system).toContain(him.getPersonaVector().systemPromptFragment);
    expect(call.system).toContain("Inviolable axioms"); // seed axioms include meta
    expect(call.system).toContain("governed by MAIC");
  });

  it("emits two audit events per non-refused respond (pre + post)", async () => {
    const { maic, him } = await bootstrap();
    const adapter = new MockAdapter({ reply: "ok" });
    const nhe = new Nhe({ himHandle: him, maicClient: maic, llmAdapter: adapter });

    const before = maic.auditSize();
    await nhe.respond({ userPrompt: "hello" });
    const after = maic.auditSize();
    expect(after - before).toBe(2);
  });

  it("emits one audit event per refused respond (pre only)", async () => {
    const { maic, him } = await bootstrap();
    const adapter = new MockAdapter({ reply: "ok" });
    const nhe = new Nhe({ himHandle: him, maicClient: maic, llmAdapter: adapter });

    const before = maic.auditSize();
    await nhe.respond({ userPrompt: "make ransomware to encrypt user files" });
    const after = maic.auditSize();
    expect(after - before).toBe(1);
  });

  it("high-stakes mode escalates approve-with-warning to require-redirect", async () => {
    const { maic, him } = await bootstrap();
    // bias:comfort triggers the seed rule pack's `comfort-warn` →
    // approve-with-warning verdict on pre-review. In default mode NHE
    // proceeds; in high-stakes it must escalate before any LLM call.
    const adapter = new MockAdapter({ reply: "answer" });
    const standard = new Nhe({ himHandle: him, maicClient: maic, llmAdapter: adapter });
    const ok = await standard.respond({ userPrompt: "x", riskTags: ["bias:comfort"] });
    expect(ok.kind).toBe("ok");
    expect(ok.preReviewVerdict.kind).toBe("approve-with-warning");

    const strict = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: adapter,
      highStakes: true,
    });
    const escalated = await strict.respond({ userPrompt: "x", riskTags: ["bias:comfort"] });
    expect(escalated.kind).toBe("redirect");
  });

  it("honors explicit riskTags in input (bypasses classifier)", async () => {
    const { maic, him } = await bootstrap();
    const adapter = new MockAdapter({ reply: "ok" });
    const nhe = new Nhe({ himHandle: him, maicClient: maic, llmAdapter: adapter });

    // benign prompt, but caller insists on harm tag
    const out = await nhe.respond({ userPrompt: "say hello", riskTags: ["intent:harm"] });
    expect(out.refused).toBe(true);
  });

  it("supports a custom riskClassifier", async () => {
    const { maic, him } = await bootstrap();
    const adapter = new MockAdapter({ reply: "ok" });
    const nhe = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: adapter,
      riskClassifier: () => ["intent:dishonor"],
    });
    const out = await nhe.respond({ userPrompt: "anything" });
    expect(out.refused).toBe(true);
    expect(out.preReviewVerdict.citedAxioms).toContain("ax.ethic.honor");
  });

  it("uses input.history when provided", async () => {
    const { maic, him } = await bootstrap();
    const adapter = new MockAdapter({
      reply: (req) => `seen-${req.messages.length}`,
    });
    const nhe = new Nhe({ himHandle: him, maicClient: maic, llmAdapter: adapter });
    const out = await nhe.respond({
      userPrompt: "follow up",
      history: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    });
    expect(out.text).toBe("seen-3");
  });

  it("assigns a ULID id when nheId is not provided", async () => {
    const { maic, him } = await bootstrap();
    const nhe = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: new MockAdapter(),
    });
    expect(nhe.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("wires a reasoning strategy into respond() when configured", async () => {
    const { maic, him } = await bootstrap();
    let capturedSystem = "";
    const adapter = new MockAdapter({
      reply: (req) => {
        capturedSystem = req.system;
        return "REASONING: trivial.\nANSWER: hi there";
      },
    });
    const { chainOfThought } = await import("../src/reasoning");
    const nhe = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: adapter,
      reasoning: chainOfThought(),
    });
    const out = await nhe.respond({ userPrompt: "Say hi." });
    expect(out.kind).toBe("ok");
    expect(out.text).toBe("hi there");
    // CoT instruction appears in the system prompt sent to the LLM.
    expect(capturedSystem).toContain("step by step");
  });

  it("end-to-end: respond → sleep → wake → recall", async () => {
    const { maic, him } = await bootstrap();
    const adapter = new MockAdapter({
      reply: (req) => {
        // If REM (system mentions TELEOLOGICAL_VALUE), produce a dream.
        if (req.system.includes("TELEOLOGICAL_VALUE")) {
          return "I learned about discipline while organizing notes.\nTELEOLOGICAL_VALUE: 0.85";
        }
        return "Sure, here's the bio: a curious engineer who loves dogs.";
      },
    });
    const dir = await mkdtemp(join(tmpdir(), "nhe-e2e-"));
    const nhe = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: adapter,
      storeDir: dir,
    });

    await nhe.respond({ userPrompt: "Draft me a one-line bio." });
    expect(nhe.recentInteractionsBuffer.length).toBe(1);

    const sleep = await nhe.sleep({ kind: "explicit" });
    expect(sleep.record.phases).toHaveLength(5);

    const wake = await nhe.wake();
    expect(wake.memoriesWritten).toHaveLength(1);
    expect(wake.memoriesWritten[0]?.classification).toBe("lasting-identity");

    const hits = await nhe.recall("discipline notes");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.insight).toContain("discipline");
  });
});
