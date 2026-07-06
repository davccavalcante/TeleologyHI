import { describe, expect, it, vi } from "vitest";
import { MistralAdapter } from "../src/adapters/mistral";

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

describe("MistralAdapter", () => {
  it("throws when no API key is provided and env var is absent", () => {
    const prev = process.env.MISTRAL_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    expect(() => new MistralAdapter()).toThrow(/api key/i);
    if (prev !== undefined) process.env.MISTRAL_API_KEY = prev;
  });

  it("accepts an explicit apiKey and uses mistral-large-latest by default", () => {
    const a = new MistralAdapter({ apiKey: "k", fetch: makeMockFetch({}) });
    expect(a.id).toBe("mistral:mistral-large-latest");
  });

  it("hits /chat/completions with Bearer auth and the configured model", async () => {
    const fetchFn = makeMockFetch({
      choices: [{ message: { role: "assistant", content: "hi" } }],
      usage: { prompt_tokens: 4, completion_tokens: 1 },
    });
    const a = new MistralAdapter({
      apiKey: "sekret",
      model: "mistral-small-latest",
      fetch: fetchFn,
    });
    await a.generate({ system: "be brief", messages: [{ role: "user", content: "hi" }] });
    const call = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toContain("/chat/completions");
    expect(url).not.toContain("sekret");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sekret");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("mistral-small-latest");
  });

  it("prepends system message and forwards user/assistant roles unchanged", async () => {
    const fetchFn = makeMockFetch({
      choices: [{ message: { content: "" } }],
    });
    const a = new MistralAdapter({ apiKey: "k", fetch: fetchFn });
    await a.generate({
      system: "be honest",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "a" },
        { role: "user", content: "q2" },
      ],
    });
    const init = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.messages).toHaveLength(4);
    expect(body.messages[0]).toEqual({ role: "system", content: "be honest" });
    expect(body.messages[3].role).toBe("user");
  });

  it("returns choices[0].message.content plus usage tokens", async () => {
    const fetchFn = makeMockFetch({
      choices: [{ message: { content: "hello world" } }],
      usage: { prompt_tokens: 7, completion_tokens: 2 },
    });
    const a = new MistralAdapter({ apiKey: "k", fetch: fetchFn });
    const r = await a.generate({ system: "", messages: [{ role: "user", content: "x" }] });
    expect(r.text).toBe("hello world");
    expect(r.tokensIn).toBe(7);
    expect(r.tokensOut).toBe(2);
  });

  it("throws with a useful message on HTTP error", async () => {
    const fetchFn = makeMockFetch({ error: { message: "invalid key" } }, 401);
    const a = new MistralAdapter({ apiKey: "k", fetch: fetchFn });
    await expect(
      a.generate({ system: "", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow(/HTTP 401/);
  });

  it("throws when the API returns a body-level error", async () => {
    const fetchFn = makeMockFetch({ error: { message: "rate limited" } });
    const a = new MistralAdapter({ apiKey: "k", fetch: fetchFn });
    await expect(
      a.generate({ system: "", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow(/rate limited/);
  });

  it("honors maxOutputTokens override per request", async () => {
    const fetchFn = makeMockFetch({ choices: [{ message: { content: "" } }] });
    const a = new MistralAdapter({
      apiKey: "k",
      defaultMaxOutputTokens: 100,
      fetch: fetchFn,
    });
    await a.generate({
      system: "",
      messages: [{ role: "user", content: "x" }],
      maxOutputTokens: 50,
    });
    const init = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.max_tokens).toBe(50);
  });

  it("forwards tools field to OpenAI-shaped function specs", async () => {
    const fetchFn = makeMockFetch({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const a = new MistralAdapter({ apiKey: "k", fetch: fetchFn });
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
    const a = new MistralAdapter({ apiKey: "k", fetch: fetchFn });
    const r = await a.generate({
      system: "",
      messages: [{ role: "user", content: "weather?" }],
      tools: [{ name: "lookup", description: "", inputSchema: {} }],
    });
    expect(r.toolUses).toEqual([{ id: "call_1", name: "lookup", input: { q: "weather" } }]);
  });

  it("omits tools field when none provided", async () => {
    const fetchFn = makeMockFetch({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const a = new MistralAdapter({ apiKey: "k", fetch: fetchFn });
    await a.generate({ system: "", messages: [{ role: "user", content: "x" }] });
    const init = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.tools).toBeUndefined();
  });
});
