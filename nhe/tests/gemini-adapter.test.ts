import { describe, expect, it, vi } from "vitest";
import { GeminiAdapter } from "../src/adapters/gemini";

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

describe("GeminiAdapter", () => {
  it("throws when no API key is provided and env var is absent", () => {
    const prev = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(() => new GeminiAdapter()).toThrow(/api key/i);
    if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
  });

  it("accepts an explicit apiKey", () => {
    const a = new GeminiAdapter({ apiKey: "k", fetch: makeMockFetch({}) });
    expect(a.id).toContain("gemini:");
  });

  it("uses the user-specified model in the URL", async () => {
    const fetchFn = makeMockFetch({
      candidates: [{ content: { parts: [{ text: "hi" }] } }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1 },
    });
    const a = new GeminiAdapter({
      apiKey: "k",
      model: "gemini-3.5-flash",
      fetch: fetchFn,
    });
    await a.generate({ system: "be brief", messages: [{ role: "user", content: "hi" }] });
    const call = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const url = call[0] as string;
    expect(url).toContain("models/gemini-3.5-flash:generateContent");
  });

  it("sends API key in x-goog-api-key header (not query string)", async () => {
    const fetchFn = makeMockFetch({ candidates: [{ content: { parts: [{ text: "" }] } }] });
    const a = new GeminiAdapter({ apiKey: "sekret", fetch: fetchFn });
    await a.generate({ system: "", messages: [{ role: "user", content: "x" }] });
    const call = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).not.toContain("sekret");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("sekret");
  });

  it("maps role 'assistant' to 'model' and lifts system to systemInstruction", async () => {
    const fetchFn = makeMockFetch({ candidates: [{ content: { parts: [{ text: "" }] } }] });
    const a = new GeminiAdapter({ apiKey: "k", fetch: fetchFn });
    await a.generate({
      system: "you are a sage",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "a" },
        { role: "user", content: "q2" },
      ],
    });
    const init = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("you are a sage");
    expect(body.contents).toHaveLength(3);
    expect(body.contents[0].role).toBe("user");
    expect(body.contents[1].role).toBe("model");
    expect(body.contents[2].role).toBe("user");
  });

  it("parses candidates[*].content.parts[*].text into a single string", async () => {
    const fetchFn = makeMockFetch({
      candidates: [{ content: { parts: [{ text: "hello " }, { text: "world" }] } }],
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 2 },
    });
    const a = new GeminiAdapter({ apiKey: "k", fetch: fetchFn });
    const r = await a.generate({ system: "", messages: [{ role: "user", content: "x" }] });
    expect(r.text).toBe("hello world");
    expect(r.tokensIn).toBe(7);
    expect(r.tokensOut).toBe(2);
  });

  it("throws with a useful message on HTTP error", async () => {
    const fetchFn = makeMockFetch({ error: { message: "API key invalid" } }, 401);
    const a = new GeminiAdapter({ apiKey: "k", fetch: fetchFn });
    await expect(
      a.generate({ system: "", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow(/HTTP 401/);
  });

  it("throws when the API returns a body-level error", async () => {
    const fetchFn = makeMockFetch({ error: { message: "quota exceeded" } });
    const a = new GeminiAdapter({ apiKey: "k", fetch: fetchFn });
    await expect(
      a.generate({ system: "", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow(/quota exceeded/);
  });
});
