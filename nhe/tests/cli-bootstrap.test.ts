import { describe, it, expect } from "vitest";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrap } from "../src/cli/bootstrap";
import { MockAdapter } from "../src/adapters/mock";

describe("CLI bootstrap", () => {
  it("creates Creator keyring + MAIC seed + HIM on fresh install", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nhe-cli-boot-"));
    const result = await bootstrap({
      storeDir: dir,
      llmAdapter: new MockAdapter({ reply: "ok" }),
    });
    expect(result.freshInstall).toBe(true);
    expect(result.him.id).toBe("him.cli.default");

    // creator.pem exists
    const krStat = await stat(join(dir, "creator.pem"));
    expect(krStat.isFile()).toBe(true);

    // 8 seed axioms minted
    const axioms = await result.maic.listAxioms();
    expect(axioms.length).toBe(8);
  });

  it("reuses existing keyring + HIM on a second invocation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nhe-cli-boot2-"));
    const first = await bootstrap({
      storeDir: dir,
      llmAdapter: new MockAdapter({ reply: "ok" }),
    });
    const second = await bootstrap({
      storeDir: dir,
      llmAdapter: new MockAdapter({ reply: "ok" }),
    });
    expect(second.freshInstall).toBe(false);
    expect(second.keyring.publicKey()).toBe(first.keyring.publicKey());
    expect(second.him.id).toBe(first.him.id);
    // No duplicate axioms — seed was idempotent.
    expect((await second.maic.listAxioms()).length).toBe(8);
  });

  it("supports a custom himId and archetype on fresh install", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nhe-cli-boot3-"));
    const result = await bootstrap({
      storeDir: dir,
      llmAdapter: new MockAdapter({ reply: "ok" }),
      himId: "him.test.custom",
      archetype: "virgo-sun",
    });
    expect(result.him.id).toBe("him.test.custom");
    expect(result.him.birthSignature.primaryArchetype).toBe("virgo-sun");
  });

  it("end-to-end: bootstrap → respond → sleep → recall", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nhe-cli-e2e-"));
    const adapter = new MockAdapter({
      reply: (req) =>
        req.system.includes("TELEOLOGICAL_VALUE")
          ? "Reflected insight about pacing.\nTELEOLOGICAL_VALUE: 0.82"
          : "Sure — here is a short reply.",
    });
    const result = await bootstrap({ storeDir: dir, llmAdapter: adapter });
    const out = await result.nhe.respond({ userPrompt: "Say hi briefly." });
    expect(out.kind).toBe("ok");
    await result.nhe.sleep({ kind: "explicit" });
    const wake = await result.nhe.wake();
    expect(wake.memoriesWritten.length).toBe(1);
    const hits = await result.nhe.recall("pacing");
    expect(hits.length).toBeGreaterThan(0);
  });
});
