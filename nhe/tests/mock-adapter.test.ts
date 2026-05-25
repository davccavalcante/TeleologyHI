import { describe, it, expect } from "vitest";
import { MockAdapter } from "../src/adapters/mock";

describe("MockAdapter", () => {
  it("echoes the last user message by default", async () => {
    const a = new MockAdapter();
    const r = await a.generate({
      system: "sys",
      messages: [{ role: "user", content: "hello" }],
    });
    expect(r.text).toBe("[mock] hello");
    expect(r.tokensIn).toBeGreaterThan(0);
    expect(r.tokensOut).toBeGreaterThan(0);
  });

  it("uses a fixed string reply when configured", async () => {
    const a = new MockAdapter({ reply: "hi there" });
    const r = await a.generate({ system: "", messages: [{ role: "user", content: "x" }] });
    expect(r.text).toBe("hi there");
  });

  it("uses a function reply when configured", async () => {
    const a = new MockAdapter({
      reply: (req) => `seen-${req.messages.length}`,
    });
    const r = await a.generate({
      system: "",
      messages: [
        { role: "user", content: "a" },
        { role: "assistant", content: "b" },
        { role: "user", content: "c" },
      ],
    });
    expect(r.text).toBe("seen-3");
  });

  it("records calls for assertion", async () => {
    const a = new MockAdapter({ reply: "ok" });
    await a.generate({ system: "s", messages: [{ role: "user", content: "1" }] });
    await a.generate({ system: "s", messages: [{ role: "user", content: "2" }] });
    expect(a.calls).toHaveLength(2);
    expect(a.calls[0]?.messages[0]?.content).toBe("1");
  });
});
