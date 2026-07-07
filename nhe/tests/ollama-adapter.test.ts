import { describe, expect, it, vi } from "vitest";
import { OllamaAdapter } from "../src/adapters/ollama";

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

describe("OllamaAdapter", () => {
  it("throws when model is missing", () => {
    expect(() => new OllamaAdapter({ model: "" } as { model: string })).toThrow(/model/);
  });

  it("defaults baseUrl to localhost:11434", async () => {
    const fetchFn = makeMockFetch({ message: { content: "" } });
    const a = new OllamaAdapter({ model: "qwen2.5:7b", fetch: fetchFn });
    await a.generate({ system: "", messages: [{ role: "user", content: "x" }] });
    const url = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(url).toBe("http://localhost:11434/api/chat");
  });

  it("strips trailing slash on baseUrl", async () => {
    const fetchFn = makeMockFetch({ message: { content: "" } });
    const a = new OllamaAdapter({
      model: "x",
      baseUrl: "http://example.com:11434/",
      fetch: fetchFn,
    });
    await a.generate({ system: "", messages: [{ role: "user", content: "x" }] });
    const url = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(url).toBe("http://example.com:11434/api/chat");
  });

  it("sends system prompt as the first message when present", async () => {
    const fetchFn = makeMockFetch({ message: { content: "" } });
    const a = new OllamaAdapter({ model: "x", fetch: fetchFn });
    await a.generate({
      system: "be terse",
      messages: [{ role: "user", content: "hi" }],
    });
    const init = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.messages[0]).toEqual({ role: "system", content: "be terse" });
    expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
    expect(body.stream).toBe(false);
  });

  it("parses message.content and token counts", async () => {
    const fetchFn = makeMockFetch({
      message: { role: "assistant", content: "the answer" },
      prompt_eval_count: 12,
      eval_count: 3,
      done: true,
    });
    const a = new OllamaAdapter({ model: "x", fetch: fetchFn });
    const r = await a.generate({ system: "", messages: [{ role: "user", content: "q" }] });
    expect(r.text).toBe("the answer");
    expect(r.tokensIn).toBe(12);
    expect(r.tokensOut).toBe(3);
  });

  it("throws with a useful message on HTTP error", async () => {
    const fetchFn = makeMockFetch({ error: "model not found" }, 404);
    const a = new OllamaAdapter({ model: "x", fetch: fetchFn });
    await expect(
      a.generate({ system: "", messages: [{ role: "user", content: "q" }] }),
    ).rejects.toThrow(/HTTP 404/);
  });

  it("throws when the API returns a body-level error", async () => {
    const fetchFn = makeMockFetch({ error: "context exhausted" });
    const a = new OllamaAdapter({ model: "x", fetch: fetchFn });
    await expect(
      a.generate({ system: "", messages: [{ role: "user", content: "q" }] }),
    ).rejects.toThrow(/context exhausted/);
  });

  it("forwards maxOutputTokens as options.num_predict", async () => {
    const fetchFn = makeMockFetch({ message: { content: "" } });
    const a = new OllamaAdapter({ model: "x", fetch: fetchFn });
    await a.generate({
      system: "",
      messages: [{ role: "user", content: "q" }],
      maxOutputTokens: 250,
    });
    const init = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.options.num_predict).toBe(250);
  });
});
