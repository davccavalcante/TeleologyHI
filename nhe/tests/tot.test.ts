import { describe, it, expect } from "vitest";
import { treeOfThoughts } from "../src/reasoning/tot";
import { MockAdapter } from "../src/adapters/mock";

describe("treeOfThoughts (D-N7)", () => {
  it("generates `branches` candidates and picks the longest by default", async () => {
    let n = 0;
    const adapter = new MockAdapter({
      reply: () => {
        n++;
        return n === 2 ? "this is the longer thoughtful answer" : "short";
      },
    });
    const tot = treeOfThoughts({ branches: 3 });
    const r = await tot(
      { system: "be brief", messages: [{ role: "user", content: "x" }] },
      adapter,
    );
    expect(r.text).toBe("this is the longer thoughtful answer");
    expect(r.trace.filter((s) => s.technique === "tot-branch")).toHaveLength(3);
    const winnerStep = r.trace.find((s) => s.technique === "tot-select");
    expect(winnerStep).toBeDefined();
  });

  it("each branch receives a distinct directive in the system prompt", async () => {
    const seen: string[] = [];
    const adapter = new MockAdapter({
      reply: (req) => {
        seen.push(req.system);
        return "branch reply";
      },
    });
    const tot = treeOfThoughts({ branches: 3 });
    await tot({ system: "base", messages: [{ role: "user", content: "x" }] }, adapter);
    // Three branch directives, each different.
    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(3);
    expect(seen.every((s) => s.startsWith("base"))).toBe(true);
  });

  it("honours a custom scorer (highest score wins)", async () => {
    let i = 0;
    const adapter = new MockAdapter({
      reply: () => {
        i++;
        return `branch-${i}`;
      },
    });
    const tot = treeOfThoughts({
      branches: 3,
      scorer: (text) => (text === "branch-2" ? 100 : 0),
    });
    const r = await tot(
      { system: "be brief", messages: [{ role: "user", content: "x" }] },
      adapter,
    );
    expect(r.text).toBe("branch-2");
  });

  it("topK limits the number of branches actually scored", async () => {
    let scored = 0;
    const adapter = new MockAdapter({ reply: () => "x" });
    const tot = treeOfThoughts({
      branches: 5,
      topK: 2,
      scorer: () => {
        scored++;
        return 1;
      },
    });
    await tot(
      { system: "be brief", messages: [{ role: "user", content: "x" }] },
      adapter,
    );
    expect(scored).toBe(2);
  });

  it("respects branches floor (>= 2)", async () => {
    const adapter = new MockAdapter({ reply: () => "a" });
    const tot = treeOfThoughts({ branches: 1 });
    const r = await tot(
      { system: "be brief", messages: [{ role: "user", content: "x" }] },
      adapter,
    );
    expect(r.trace.filter((s) => s.technique === "tot-branch")).toHaveLength(2);
  });
});
