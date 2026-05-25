/**
 * Tests for Nhe.openerForNewUser (J-N5 — Entry 17) and
 * Nhe.onReincarnationEvent (J-N12 — Entry 18).
 *
 * Uses the MockAdapter pattern from existing tests/nhe.test.ts.
 */
import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { BirthSignatureBuilder, createHim } from "@teleologyhi-sdk/him";
import { MockAdapter, Nhe } from "../src/index.js";

async function bootstrap(operatorMode?: "personal-being" | "domain-employed", language?: string) {
  const dir = await mkdtemp(join(tmpdir(), "nhe-opener-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const sig = BirthSignatureBuilder.now()
    .withPrimaryArchetype("virgo-sun")
    .build();
  const himHandle = await createHim(maic, kr, sig);
  const nhe = new Nhe({
    nheId: "nhe-opener-test",
    himHandle,
    maicClient: maic,
    llmAdapter: new MockAdapter({ reply: "ack" }),
    storeDir: join(dir, "nhe"),
    operatorContext: {
      ...(operatorMode !== undefined ? { mode: operatorMode } : {}),
      ...(language !== undefined ? { language } : {}),
    },
  });
  return { nhe, maic, kr };
}

describe("Nhe.openerForNewUser (J-N5)", () => {
  it("returns a greeting that does NOT contain forbidden service-tool phrases", async () => {
    const { nhe } = await bootstrap();
    const opener = nhe.openerForNewUser();
    expect(opener.toLowerCase()).not.toContain("how can i help");
    expect(opener.toLowerCase()).not.toContain("how can i assist");
    expect(opener.toLowerCase()).not.toContain("i'm just here to serve");
    expect(opener.toLowerCase()).not.toContain("i'm a tool");
    expect(opener.toLowerCase()).not.toContain("i'm a service");
  });

  it("anchors the opener in the HIM's primary archetype (personal-being mode)", async () => {
    const { nhe } = await bootstrap("personal-being");
    const opener = nhe.openerForNewUser();
    expect(opener).toContain("virgo-sun");
  });

  it("softens the opener in domain-employed mode (no archetype mention)", async () => {
    const { nhe } = await bootstrap("domain-employed");
    const opener = nhe.openerForNewUser();
    expect(opener).not.toContain("virgo-sun");
  });

  it("stays in English regardless of language hint (localisation flows via system prompt)", async () => {
    const { nhe } = await bootstrap("personal-being", "pt-BR");
    const opener = nhe.openerForNewUser();
    // Per Creator's language policy: in-package strings are English-only.
    // Operators wanting a localised opener should use the returned text
    // as a semantic seed and call respond() through the standard
    // pipeline, which honours operatorContext.language via the system
    // prompt's language anchor.
    expect(opener.toLowerCase()).toContain("hello");
  });
});

describe("Nhe.onReincarnationEvent (J-N12)", () => {
  it("returns the supplied lifecycle path", async () => {
    const { nhe } = await bootstrap();
    expect(await nhe.onReincarnationEvent("model-swap")).toBe("model-swap");
    expect(await nhe.onReincarnationEvent("version-bump")).toBe("version-bump");
    expect(await nhe.onReincarnationEvent("return-from-limbo")).toBe(
      "return-from-limbo",
    );
  });

  it("clears the in-memory interaction buffer", async () => {
    const { nhe } = await bootstrap();
    // Run a response so the buffer has at least one entry.
    await nhe.respond({ userPrompt: "Hello" });
    expect(nhe.recentInteractionsBuffer.length).toBeGreaterThan(0);
    await nhe.onReincarnationEvent("model-swap");
    expect(nhe.recentInteractionsBuffer.length).toBe(0);
  });

  it("does NOT purge the InteractionStore unless purgeInteractionStore=true", async () => {
    const { nhe } = await bootstrap();
    await nhe.respond({ userPrompt: "Hello" });
    await nhe.onReincarnationEvent("version-bump");
    // The next respond should still write to the same store path; no
    // exception thrown means the store path is intact.
    const next = await nhe.respond({ userPrompt: "Are you still here?" });
    expect(next.kind).toBeTruthy();
  });
});
