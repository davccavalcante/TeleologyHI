import { describe, expect, it, vi } from "vitest";
import { DeepSeekAdapter } from "../src/adapters/deepseek";
import { GeminiAdapter } from "../src/adapters/gemini";
import { MistralAdapter } from "../src/adapters/mistral";
import { OllamaAdapter } from "../src/adapters/ollama";

function makeSseStream(frames: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const body = `${frames.map((f) => `data: ${f}`).join("\n\n")}\n\n`;
  return new ReadableStream({
    start(c) {
      c.enqueue(enc.encode(body));
      c.close();
    },
  });
}

function makeNdjsonStream(lines: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      c.enqueue(enc.encode(`${lines.join("\n")}\n`));
      c.close();
    },
  });
}

function mockFetch(stream: ReadableStream<Uint8Array>): typeof globalThis.fetch {
  return vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        body: stream,
        text: async () => "",
      }) as unknown as Response,
  );
}

async function collectDeltas(
  iter: AsyncIterable<{ kind: string; text?: string }>,
): Promise<string> {
  const parts: string[] = [];
  for await (const ev of iter) {
    if (ev.kind === "delta" && ev.text) parts.push(ev.text);
  }
  return parts.join("");
}

describe("DeepSeekAdapter.generateStream", () => {
  it("decodes SSE chunks into deltas", async () => {
    const fetchFn = mockFetch(
      makeSseStream([
        JSON.stringify({ choices: [{ delta: { content: "Hello" } }] }),
        JSON.stringify({ choices: [{ delta: { content: " world" } }] }),
        JSON.stringify({
          choices: [{ delta: {} }],
          usage: { prompt_tokens: 2, completion_tokens: 2 },
        }),
        "[DONE]",
      ]),
    );
    const a = new DeepSeekAdapter({ apiKey: "k", fetch: fetchFn });
    expect(a.supportsStreaming).toBe(true);
    const text = await collectDeltas(
      a.generateStream!({ system: "", messages: [{ role: "user", content: "x" }] }),
    );
    expect(text).toBe("Hello world");
  });
});

describe("MistralAdapter.generateStream", () => {
  it("decodes SSE chunks into deltas", async () => {
    const fetchFn = mockFetch(
      makeSseStream([
        JSON.stringify({ choices: [{ delta: { content: "bon" } }] }),
        JSON.stringify({ choices: [{ delta: { content: "jour" } }] }),
        "[DONE]",
      ]),
    );
    const a = new MistralAdapter({ apiKey: "k", fetch: fetchFn });
    const text = await collectDeltas(
      a.generateStream!({ system: "", messages: [{ role: "user", content: "x" }] }),
    );
    expect(text).toBe("bonjour");
  });
});

describe("OllamaAdapter.generateStream", () => {
  it("decodes NDJSON chunks into deltas", async () => {
    const fetchFn = mockFetch(
      makeNdjsonStream([
        JSON.stringify({ message: { content: "ola" } }),
        JSON.stringify({ message: { content: " mundo" } }),
        JSON.stringify({
          message: { content: "" },
          done: true,
          prompt_eval_count: 3,
          eval_count: 4,
        }),
      ]),
    );
    const a = new OllamaAdapter({ model: "qwen2.5:7b", fetch: fetchFn });
    expect(a.supportsStreaming).toBe(true);
    const events = [];
    for await (const ev of a.generateStream!({
      system: "",
      messages: [{ role: "user", content: "x" }],
    })) {
      events.push(ev);
    }
    const text = events
      .filter((e) => e.kind === "delta")
      .map((e) => (e as { text: string }).text)
      .join("");
    expect(text).toBe("ola mundo");
    const end = events.find((e) => e.kind === "end");
    expect((end as { tokensIn: number }).tokensIn).toBe(3);
  });
});

describe("GeminiAdapter.generateStream", () => {
  it("decodes SSE chunks into deltas", async () => {
    const fetchFn = mockFetch(
      makeSseStream([
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "hola" }] } }] }),
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: " mundo" }] } }],
          usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 2 },
        }),
      ]),
    );
    const a = new GeminiAdapter({ apiKey: "k", fetch: fetchFn });
    expect(a.supportsStreaming).toBe(true);
    const text = await collectDeltas(
      a.generateStream!({ system: "", messages: [{ role: "user", content: "x" }] }),
    );
    expect(text).toBe("hola mundo");
  });

  it("uses :streamGenerateContent?alt=sse in the URL", async () => {
    const stream = makeSseStream(["[DONE]"]);
    const fetchFn = mockFetch(stream);
    const a = new GeminiAdapter({ apiKey: "k", fetch: fetchFn });
    const it = a.generateStream!({ system: "", messages: [{ role: "user", content: "x" }] });
    // Drain to trigger the fetch
    for await (const _ of it) {
      /* no-op */
    }
    const url = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(url).toContain(":streamGenerateContent");
    expect(url).toContain("alt=sse");
  });
});

describe("OpenAI-compatible streaming token usage (ND-5)", () => {
  async function endEvent(
    iter: AsyncIterable<{ kind: string; tokensIn?: number; tokensOut?: number }>,
  ): Promise<{ tokensIn?: number; tokensOut?: number } | undefined> {
    let end: { tokensIn?: number; tokensOut?: number } | undefined;
    for await (const ev of iter) if (ev.kind === "end") end = ev;
    return end;
  }

  for (const [name, Adapter] of [
    ["deepseek", DeepSeekAdapter],
    ["mistral", MistralAdapter],
  ] as const) {
    it(`${name} requests stream_options.include_usage and parses the usage frame`, async () => {
      const fetchFn = mockFetch(
        makeSseStream([
          JSON.stringify({ choices: [{ delta: { content: "hi" } }] }),
          JSON.stringify({
            choices: [{ delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 42, completion_tokens: 7 },
          }),
          "[DONE]",
        ]),
      );
      const a = new Adapter({ apiKey: "k", fetch: fetchFn });
      const end = await endEvent(
        a.generateStream({ system: "s", messages: [{ role: "user", content: "q" }] }),
      );
      // The request asked the API to include usage on the stream.
      const init = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0]![1] as RequestInit;
      const body = JSON.parse(init.body as string);
      expect(body.stream).toBe(true);
      expect(body.stream_options).toEqual({ include_usage: true });
      // And the terminal usage frame is parsed into non-zero end tokens.
      expect(end?.tokensIn).toBe(42);
      expect(end?.tokensOut).toBe(7);
    });
  }
});
