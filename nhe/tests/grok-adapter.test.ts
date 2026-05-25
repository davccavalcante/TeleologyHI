import { describe, it, expect, vi } from "vitest";
import { GrokAdapter } from "../src/adapters/grok";

function makeMockFetch(body: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn(async () => {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "ERR",
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  });
}

describe("GrokAdapter", () => {
  it("throws when no API key is provided and env var is absent", () => {
    const prev = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    expect(() => new GrokAdapter()).toThrow(/api key/i);
    if (prev !== undefined) process.env.XAI_API_KEY = prev;
  });

  it("accepts explicit apiKey and defaults to grok-4", () => {
    const a = new GrokAdapter({ apiKey: "k", fetch: makeMockFetch({}) });
    expect(a.id).toBe("grok:grok-4");
  });

  it("hits /chat/completions with Bearer auth", async () => {
    const fetchFn = makeMockFetch({
      choices: [{ message: { content: "hi" } }],
      usage: { prompt_tokens: 3, completion_tokens: 1 },
    });
    const a = new GrokAdapter({ apiKey: "sekret", fetch: fetchFn });
    await a.generate({ system: "be brief", messages: [{ role: "user", content: "hi" }] });
    const call = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toBe("https://api.x.ai/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sekret");
  });

  it("returns text + token counts", async () => {
    const fetchFn = makeMockFetch({
      choices: [{ message: { content: "hello world" } }],
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    });
    const a = new GrokAdapter({ apiKey: "k", fetch: fetchFn });
    const r = await a.generate({ system: "", messages: [{ role: "user", content: "x" }] });
    expect(r.text).toBe("hello world");
    expect(r.tokensIn).toBe(5);
    expect(r.tokensOut).toBe(2);
  });

  it("throws on HTTP error", async () => {
    const fetchFn = makeMockFetch({ error: { message: "no" } }, 401);
    const a = new GrokAdapter({ apiKey: "k", fetch: fetchFn });
    await expect(
      a.generate({ system: "", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow(/HTTP 401/);
  });

  it("declares streaming + tool support", () => {
    const a = new GrokAdapter({ apiKey: "k", fetch: makeMockFetch({}) });
    expect(a.supportsStreaming).toBe(true);
    expect(a.supportsTools).toBe(true);
  });

  it("forwards tools field to OpenAI-shaped function specs", async () => {
    const fetchFn = makeMockFetch({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const a = new GrokAdapter({ apiKey: "k", fetch: fetchFn });
    await a.generate({
      system: "",
      messages: [{ role: "user", content: "x" }],
      tools: [
        {
          name: "lookup",
          description: "look something up",
          inputSchema: { type: "object", properties: { q: { type: "string" } } },
        },
      ],
    });
    const init = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.tools).toEqual([
      {
        type: "function",
        function: {
          name: "lookup",
          description: "look something up",
          parameters: { type: "object", properties: { q: { type: "string" } } },
        },
      },
    ]);
  });

  it("parses tool_calls from response into toolUses", async () => {
    const fetchFn = makeMockFetch({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: { name: "lookup", arguments: '{"q":"weather"}' },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 4, completion_tokens: 2 },
    });
    const a = new GrokAdapter({ apiKey: "k", fetch: fetchFn });
    const r = await a.generate({
      system: "",
      messages: [{ role: "user", content: "weather?" }],
      tools: [{ name: "lookup", description: "", inputSchema: {} }],
    });
    expect(r.toolUses).toEqual([
      { id: "call_1", name: "lookup", input: { q: "weather" } },
    ]);
  });

  it("omits tools field when none provided", async () => {
    const fetchFn = makeMockFetch({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const a = new GrokAdapter({ apiKey: "k", fetch: fetchFn });
    await a.generate({ system: "", messages: [{ role: "user", content: "x" }] });
    const init = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.tools).toBeUndefined();
  });

  it("generateStream parses SSE delta chunks", async () => {
    const sseBody = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Hel" } }] })}`,
      "",
      `data: ${JSON.stringify({ choices: [{ delta: { content: "lo " } }] })}`,
      "",
      `data: ${JSON.stringify({ choices: [{ delta: { content: "world" } }], usage: { prompt_tokens: 4, completion_tokens: 3 } })}`,
      "",
      "data: [DONE]",
      "",
      "",
    ].join("\n");
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody));
        controller.close();
      },
    });
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      body: stream,
      text: async () => "",
    } as unknown as Response));
    const a = new GrokAdapter({ apiKey: "k", fetch: fetchFn });
    const events = [];
    for await (const ev of a.generateStream!({
      system: "",
      messages: [{ role: "user", content: "x" }],
    })) {
      events.push(ev);
    }
    const deltas = events.filter((e) => e.kind === "delta");
    expect(deltas.map((d) => (d as { text: string }).text).join("")).toBe("Hello world");
    const ends = events.filter((e) => e.kind === "end");
    expect(ends).toHaveLength(1);
    expect((ends[0] as { tokensIn: number }).tokensIn).toBe(4);
  });
});
