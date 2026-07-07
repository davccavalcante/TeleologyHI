import { describe, expect, it } from "vitest";
import { MockAdapter } from "../src/adapters/mock";
import { collectStream } from "../src/adapters/stream";
import type { LlmAdapter } from "../src/adapters/types";

describe("MockAdapter.generateStream (D-N8)", () => {
  it("emits delta events for each chunk then a final end event", async () => {
    const a = new MockAdapter({ reply: "1234567890ABCD", streamChunkSize: 4 });
    const events = [];
    for await (const ev of a.generateStream!({
      system: "",
      messages: [{ role: "user", content: "x" }],
    })) {
      events.push(ev);
    }
    // 14 chars / 4 chunks = 4 deltas
    const deltas = events.filter((e) => e.kind === "delta");
    const ends = events.filter((e) => e.kind === "end");
    expect(deltas).toHaveLength(4);
    expect(deltas.map((d) => (d as { text: string }).text).join("")).toBe("1234567890ABCD");
    expect(ends).toHaveLength(1);
    expect((ends[0] as { tokensIn: number }).tokensIn).toBeGreaterThan(0);
  });

  it("MockAdapter declares supportsTools + supportsStreaming", () => {
    const a = new MockAdapter();
    expect(a.supportsStreaming).toBe(true);
    expect(a.supportsTools).toBe(true);
  });
});

describe("collectStream", () => {
  it("drains a streaming adapter into a complete GenerateResponse", async () => {
    const a = new MockAdapter({ reply: "hello world", streamChunkSize: 5 });
    const r = await collectStream(a, {
      system: "",
      messages: [{ role: "user", content: "x" }],
    });
    expect(r.text).toBe("hello world");
    expect(r.tokensOut).toBeGreaterThan(0);
  });

  it("calls onDelta for each chunk in order", async () => {
    const a = new MockAdapter({ reply: "abcdefghij", streamChunkSize: 3 });
    const seen: string[] = [];
    await collectStream(a, { system: "", messages: [{ role: "user", content: "x" }] }, (chunk) =>
      seen.push(chunk),
    );
    expect(seen).toEqual(["abc", "def", "ghi", "j"]);
  });

  it("falls back to generate() when adapter lacks generateStream", async () => {
    const onlyGenerate: LlmAdapter = {
      id: "no-stream",
      async generate() {
        return { text: "non-stream reply", tokensIn: 1, tokensOut: 2 };
      },
    };
    const seen: string[] = [];
    const r = await collectStream(
      onlyGenerate,
      { system: "", messages: [{ role: "user", content: "x" }] },
      (chunk) => seen.push(chunk),
    );
    expect(r.text).toBe("non-stream reply");
    expect(seen).toEqual(["non-stream reply"]); // single onDelta with full text
  });
});
