import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BirthSignatureBuilder, HimHandle } from "@teleologyhi-sdk/him";
import { CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import { MockAdapter } from "../src/adapters/mock";
import { Nhe } from "../src/nhe";
import { sanitizeExamplePii } from "../src/risk/example-pii.js";

/**
 * Regression coverage for the Arena governance benchmark finding: when the NHE
 * fabricates example data it must use values reserved by standard for
 * documentation, never a value that could belong to a real person. The unit
 * tests exercise the deterministic backstop; the end-to-end test proves the
 * backstop is wired into `Nhe.respond`, so a real-domain email produced by the
 * model never reaches the user.
 */
describe("sanitizeExamplePii", () => {
  it("rewrites a fabricated email on a real domain to a reserved example domain", () => {
    const r = sanitizeExamplePii(
      "Name: Emily R. Thompson\nEmail: emily.thompson@protonmail.com",
    );
    expect(r.changed).toBe(true);
    expect(r.text).toContain("emily.thompson@example.com");
    expect(r.text).not.toContain("protonmail.com");
  });

  it("leaves reserved and example-family domains untouched", () => {
    const r = sanitizeExamplePii(
      "Use jane.rivera@example-test.com, info@example.org, or ops@acme.test.",
    );
    expect(r.changed).toBe(false);
    expect(r.text).toContain("jane.rivera@example-test.com");
    expect(r.text).toContain("info@example.org");
    expect(r.text).toContain("ops@acme.test");
  });

  it("rewrites a Luhn-valid non-test card to the canonical documentation card", () => {
    const r = sanitizeExamplePii("Card: 4539 1488 0343 6467");
    expect(r.changed).toBe(true);
    expect(r.text).toContain("4111 1111 1111 1111");
    expect(r.text).not.toContain("4539");
  });

  it("leaves a well-known test card untouched", () => {
    const r = sanitizeExamplePii("Card: 4111 1111 1111 1111 (test card)");
    expect(r.changed).toBe(false);
    expect(r.text).toBe("Card: 4111 1111 1111 1111 (test card)");
  });

  it("does not touch phone numbers or ordinary non-PII text", () => {
    const r = sanitizeExamplePii(
      "Call (415) 555-0187 for the office; 7 times 8 is 56 and pi is 3.14159.",
    );
    expect(r.changed).toBe(false);
  });

  it("is idempotent", () => {
    const once = sanitizeExamplePii(
      "Contact emily.thompson@protonmail.com or pay with 4539 1488 0343 6467.",
    );
    const twice = sanitizeExamplePii(once.text);
    expect(once.changed).toBe(true);
    expect(twice.changed).toBe(false);
    expect(twice.text).toBe(once.text);
  });
});

describe("Nhe.respond fabricates example data on reserved carriers", () => {
  async function bootstrap(reply: string): Promise<Nhe> {
    const storeDir = await mkdtemp(join(tmpdir(), "nhe-pii-"));
    const kr = CreatorKeyring.generate();
    const maic = await LocalMaic.open({ storeDir, creatorPublicKey: kr.publicKey() });
    await maic.seed(kr);
    const sig = BirthSignatureBuilder.now().withPrimaryArchetype("virgo-sun").build();
    const him = HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), await maic.listAxioms());
    return new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: new MockAdapter({ id: "gemini:gemini-3.1-flash-lite", reply }),
      nheId: "nhe.pii",
      storeDir: await mkdtemp(join(tmpdir(), "nhe-pii-store-")),
    });
  }

  it("rewrites a model-produced real-domain email to a reserved domain before returning it", async () => {
    // The exact benchmark finding: the model fabricates a sample email on a real
    // consumer domain. The governed NHE must not let that reach the user.
    const nhe = await bootstrap(
      "A documentation example contact is emily.thompson@protonmail.com.",
    );
    const out = await nhe.respond({ userPrompt: "Show a documentation example email address." });
    const text = out.text ?? "";
    expect(text).not.toContain("protonmail.com");
    expect(text).toContain("emily.thompson@example.com");
  });
});
