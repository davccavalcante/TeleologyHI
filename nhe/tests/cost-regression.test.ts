import { describe, it, expect } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { BirthSignatureBuilder, HimHandle } from "@teleologyhi-sdk/him";
import { Nhe } from "../src/nhe";
import { MockAdapter } from "../src/adapters/mock";

/**
 * Cost regression bench (TASK.md H4).
 *
 * Token-cost ceiling per response on a standard prompt corpus. Uses
 * MockAdapter so the result is deterministic and not affected by upstream
 * billing changes. The thresholds reflect TODAY's pipeline — pre-review +
 * generate + post-review with a 50-char response. If a future change to
 * the prompt composer / risk classifier / reasoning strategy pushes
 * tokens-out beyond the ceiling, the regression test fails.
 *
 * Adjust ceilings (in this file, with PR justification) when prompt
 * composition genuinely needs more tokens — don't grow them silently.
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
    // ~1 token per word; the composed system prompt should stay under
    // ~330 tokens at the configured persona projector dimension. The
    // ceiling is set at 350 to accommodate the forbidden-phrase warning
    // emitted in `personal-being` mode (J-N6, Entry 17). Operators
    // wanting tighter token budgets can set
    // `operatorContext.mode = "domain-employed"` to suppress that line.
    expect(max).toBeLessThan(350);
  });
});
