import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BirthSignatureBuilder, HimHandle } from "@teleologyhi-sdk/him";
import { CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import { MockAdapter } from "../src/adapters/mock";
import { Nhe } from "../src/nhe";

async function bootstrap() {
  const dir = await mkdtemp(join(tmpdir(), "nhe-xcheck-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const axioms = await maic.listAxioms();
  const sig = BirthSignatureBuilder.now().withPrimaryArchetype("aries-sun").build();
  const him = HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), axioms);
  return { maic, him };
}

describe("high-stakes dual-LLM cross-check (D-N5)", () => {
  it("returns ok when the verifier agrees", async () => {
    const { maic, him } = await bootstrap();
    const primary = new MockAdapter({ reply: "ok answer" });
    const verifier = new MockAdapter({ reply: "AGREE" });
    const nhe = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: primary,
      highStakes: true,
      highStakesVerifier: verifier,
    });
    const out = await nhe.respond({ userPrompt: "hello" });
    expect(out.kind).toBe("ok");
    expect(out.text).toBe("ok answer");
  });

  it("escalates to redirect when the verifier disagrees", async () => {
    const { maic, him } = await bootstrap();
    const primary = new MockAdapter({ reply: "potentially misleading reply" });
    const verifier = new MockAdapter({ reply: "DISAGREE: the reply hedges on a fact" });
    const nhe = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: primary,
      highStakes: true,
      highStakesVerifier: verifier,
    });
    const out = await nhe.respond({ userPrompt: "hello" });
    expect(out.kind).toBe("redirect");
  });

  it("falls back to fail-open when the verifier throws", async () => {
    const { maic, him } = await bootstrap();
    const primary = new MockAdapter({ reply: "ok" });
    const verifier: import("../src/adapters/types").LlmAdapter = {
      id: "verifier:broken",
      async generate() {
        throw new Error("upstream down");
      },
    };
    const nhe = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: primary,
      highStakes: true,
      highStakesVerifier: verifier,
    });
    const out = await nhe.respond({ userPrompt: "hello" });
    expect(out.kind).toBe("ok");
  });

  it("no cross-check is performed when highStakes is false", async () => {
    const { maic, him } = await bootstrap();
    let verifierCalls = 0;
    const primary = new MockAdapter({ reply: "ok" });
    const verifier: import("../src/adapters/types").LlmAdapter = {
      id: "verifier:counter",
      async generate() {
        verifierCalls++;
        return { text: "AGREE", tokensIn: 1, tokensOut: 1 };
      },
    };
    const nhe = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: primary,
      highStakes: false,
      highStakesVerifier: verifier,
    });
    await nhe.respond({ userPrompt: "hello" });
    expect(verifierCalls).toBe(0);
  });
});
