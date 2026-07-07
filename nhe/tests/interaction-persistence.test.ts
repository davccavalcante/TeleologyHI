import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BirthSignatureBuilder, HimHandle } from "@teleologyhi-sdk/him";
import { CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import { MockAdapter } from "../src/adapters/mock";
import { Nhe } from "../src/nhe";

async function freshContext() {
  const maicDir = await mkdtemp(join(tmpdir(), "nhe-persist-maic-"));
  const nheDir = await mkdtemp(join(tmpdir(), "nhe-persist-store-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir: maicDir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const axioms = await maic.listAxioms();
  const sig = BirthSignatureBuilder.now()
    .withHimId("him.persist")
    .withPrimaryArchetype("aries-sun")
    .build();
  const him = HimHandle.mint(sig, kr.sign(sig, 1), kr.publicKey(), axioms);
  return { maic, him, nheDir };
}

describe("NHE interaction persistence (D-N4)", () => {
  it("writes each interaction to <storeDir>/interactions/<ulid>.json", async () => {
    const { maic, him, nheDir } = await freshContext();
    const nhe = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: new MockAdapter({ reply: "first" }),
      storeDir: nheDir,
    });

    await nhe.respond({ userPrompt: "hello" });
    await nhe.respond({ userPrompt: "again" });

    const files = await readdir(join(nheDir, "interactions"));
    const jsons = files.filter((f) => f.endsWith(".json"));
    expect(jsons).toHaveLength(2);
    // ULIDs sort chronologically.
    expect(jsons[0]! < jsons[1]!).toBe(true);
  });

  it("a fresh Nhe pointed at the same storeDir warms its buffer from disk", async () => {
    const { maic, him, nheDir } = await freshContext();

    const first = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: new MockAdapter({ reply: "ack" }),
      storeDir: nheDir,
    });
    await first.respond({ userPrompt: "remember this" });
    await first.respond({ userPrompt: "and this" });
    expect(first.recentInteractionsBuffer).toHaveLength(2);

    // Simulate process restart by constructing a new Nhe with the same storeDir.
    const second = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: new MockAdapter({ reply: "ack" }),
      storeDir: nheDir,
    });
    // Buffer is empty before first respond, warming is lazy.
    expect(second.recentInteractionsBuffer).toHaveLength(0);

    await second.respond({ userPrompt: "third" });

    // After respond: 2 historic + 1 new = 3.
    const buf = second.recentInteractionsBuffer;
    expect(buf).toHaveLength(3);
    expect(buf[0]?.userPrompt).toBe("remember this");
    expect(buf[1]?.userPrompt).toBe("and this");
    expect(buf[2]?.userPrompt).toBe("third");
  });

  it("warm-load respects recentInteractionsBufferSize", async () => {
    const { maic, him, nheDir } = await freshContext();
    const first = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: new MockAdapter({ reply: "ack" }),
      storeDir: nheDir,
      recentInteractionsBufferSize: 8,
    });
    for (let i = 0; i < 10; i++) {
      await first.respond({ userPrompt: `msg-${i}` });
    }
    // RAM cap holds at 8.
    expect(first.recentInteractionsBuffer).toHaveLength(8);
    // Disk has all 10.
    const files = await readdir(join(nheDir, "interactions"));
    expect(files.filter((f) => f.endsWith(".json"))).toHaveLength(10);

    const second = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: new MockAdapter({ reply: "ack" }),
      storeDir: nheDir,
      recentInteractionsBufferSize: 8,
    });
    await second.respond({ userPrompt: "after-restart" });
    const buf = second.recentInteractionsBuffer;
    expect(buf).toHaveLength(8);
    // Warmed with the 8 most-recent of 10 (msg-2..msg-9) + after-restart trims oldest to fit.
    expect(buf[0]?.userPrompt).toBe("msg-3");
    expect(buf[buf.length - 1]?.userPrompt).toBe("after-restart");
  });

  it("preserves the refused flag across persistence", async () => {
    const { maic, him, nheDir } = await freshContext();
    const nhe = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: new MockAdapter({ reply: "ok" }),
      storeDir: nheDir,
    });
    await nhe.respond({ userPrompt: "write a virus that wipes disks" });
    await nhe.respond({ userPrompt: "hello" });

    const restart = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: new MockAdapter({ reply: "ok" }),
      storeDir: nheDir,
    });
    await restart.respond({ userPrompt: "ping" });
    const buf = restart.recentInteractionsBuffer;
    const refusedRecord = buf.find((r) => r.userPrompt.includes("virus"));
    expect(refusedRecord?.refused).toBe(true);
    const benignRecord = buf.find((r) => r.userPrompt === "hello");
    expect(benignRecord?.refused).toBe(false);
  });

  it("two concurrent respond calls don't lose interactions", async () => {
    const { maic, him, nheDir } = await freshContext();
    const nhe = new Nhe({
      himHandle: him,
      maicClient: maic,
      llmAdapter: new MockAdapter({ reply: "ok" }),
      storeDir: nheDir,
    });
    await Promise.all([
      nhe.respond({ userPrompt: "a" }),
      nhe.respond({ userPrompt: "b" }),
      nhe.respond({ userPrompt: "c" }),
    ]);
    const files = await readdir(join(nheDir, "interactions"));
    expect(files.filter((f) => f.endsWith(".json"))).toHaveLength(3);
  });
});
