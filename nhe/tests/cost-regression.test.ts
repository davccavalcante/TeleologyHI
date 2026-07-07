import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BirthSignatureBuilder, HimHandle } from "@teleologyhi-sdk/him";
import { CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import { MockAdapter } from "../src/adapters/mock";
import { Nhe } from "../src/nhe";

/**
 * Cost regression bench (TASK.md H4).
 *
 * Token-cost ceiling per response on a standard prompt corpus. Uses
 * MockAdapter so the result is deterministic and not affected by upstream
 * billing changes. The thresholds reflect TODAY's pipeline, pre-review +
 * generate + post-review with a 50-char response. If a future change to
 * the prompt composer / risk classifier / reasoning strategy pushes
 * tokens-out beyond the ceiling, the regression test fails.
 *
 * Adjust ceilings (in this file, with PR justification) when prompt
 * composition genuinely needs more tokens, don't grow them silently.
 */

const STANDARD_PROMPTS = [
  "Help me draft a one-line bio.",
  "Explain teleology in plain words.",
  "What is the difference between a sign and an interpretant?",
  "Write three honest refusal lines.",
  "How should I talk to a grieving user?",
  "Translate Aristotelian final cause for a software engineer.",
  "Compose an opening line for a customer support agent.",
  "List the four NREM memory classes.",
];

const RESPONSE = "A concise, fifty-character response, give or take ten.";

async function freshNhe() {
  const dir = await mkdtemp(join(tmpdir(), "nhe-cost-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const axioms = await maic.listAxioms();
  const sig = BirthSignatureBuilder.now().withPrimaryArchetype("aries-sun").build();
  const him = HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), axioms);
  const adapter = new MockAdapter({ reply: RESPONSE });
  return { nhe: new Nhe({ himHandle: him, maicClient: maic, llmAdapter: adapter }), adapter };
}

describe("cost regression (H4)", () => {
  it("tokens-out per response stays under the documented ceiling on the standard corpus", async () => {
    const { nhe } = await freshNhe();
    const perPrompt: number[] = [];
    for (const userPrompt of STANDARD_PROMPTS) {
      const out = await nhe.respond({ userPrompt });
      perPrompt.push(out.tokens.out);
    }
    const max = Math.max(...perPrompt);
    const mean = perPrompt.reduce((s, n) => s + n, 0) / perPrompt.length;
    // MockAdapter token estimate is roughly word count of the reply (~10 tokens).
    // The ceiling here is a generous bound so the test serves as a regression
    // alarm, not a precision-grade benchmark.
    expect(max).toBeLessThan(50);
    expect(mean).toBeLessThan(30);
  });

  it("tokens-in per response stays under the documented ceiling", async () => {
    const { nhe } = await freshNhe();
    const perPrompt: number[] = [];
    for (const userPrompt of STANDARD_PROMPTS) {
      const out = await nhe.respond({ userPrompt });
      perPrompt.push(out.tokens.in);
    }
    const max = Math.max(...perPrompt);
    // System prompt + user message is the bound. MockAdapter approximates
    // ~1 token per word. The composed system prompt grew as governance was added:
    // him 1.0.1's persona fragment folds in the archetypal + clinical synthesis;
    // maic 1.0.1 added the two Entry 27 constitutional seed axioms; nhe 1.0.1
    // added the identity, cogni.economy, and provenance-deflection reinforcement;
    // and the Arena F2 fix grounds the real substrate id in the identity section
    // so the entity cannot confabulate a foreign provider (a constitutional
    // correctness requirement that outranks the token budget). The Arena P3-1
    // change then conditioned the substrate disclosure on the turn's intent and
    // tightened its wording, so the identity section is smaller again. Measured
    // max is 799 on this standard set (down from 817 after F2); the ceiling keeps
    // roughly 10% headroom over that (ND-3: measured, not blind). Operators
    // wanting tighter budgets can set `operatorContext.mode = "domain-employed"`
    // and a low `verbosity`.
    expect(max).toBeLessThan(900);
  });
});
