import { describe, expect, it } from "vitest";
import { MockAdapter } from "../src/adapters/mock";
import { extractPrinciple, stepBack } from "../src/reasoning/step-back";

describe("extractPrinciple", () => {
  it("pulls the principle from a well-formed line", () => {
    expect(extractPrinciple("PRINCIPLE: errors are learning")).toBe("errors are learning");
  });

  it("handles 'PRINCIPLE:' followed by newline content", () => {
    expect(extractPrinciple("PRINCIPLE: x\nadditional context")).toBe("x");
  });

  it("falls back to the first line when no marker is present", () => {
    expect(extractPrinciple("just an answer\nwith more text")).toBe("just an answer");
  });

  it("returns an empty string for empty input", () => {
    expect(extractPrinciple("")).toBe("");
  });
});

describe("stepBack (D-N7)", () => {
  it("runs two LLM calls and merges trace + tokens", async () => {
    let call = 0;
    const adapter = new MockAdapter({
      reply: (_req) => {
        call++;
        if (call === 1) return "PRINCIPLE: rooms shape behaviour";
        return "The final answer that honours the principle.";
      },
    });
    const sb = stepBack();
    const r = await sb(
      { system: "be brief", messages: [{ role: "user", content: "Why do offices feel cold?" }] },
      adapter,
    );
    expect(r.text).toBe("The final answer that honours the principle.");
    const techniques = r.trace.map((s) => s.technique);
    expect(techniques).toContain("step-back-abstraction");
    expect(techniques).toContain("step-back-final");
  });

  it("injects the principle into the final system prompt", async () => {
    const seenSystems: string[] = [];
    const adapter = new MockAdapter({
      reply: (req) => {
        seenSystems.push(req.system);
        return seenSystems.length === 1 ? "PRINCIPLE: clarity over speed" : "ok";
      },
    });
    const sb = stepBack();
    await sb({ system: "be brief", messages: [{ role: "user", content: "How?" }] }, adapter);
    // Second call should carry the principle in the system prompt.
    expect(seenSystems[1]).toContain(
      "Guiding principle (derived via Step-Back): clarity over speed",
    );
  });

  it("custom abstractionPrompt overrides the default", async () => {
    const seen: string[] = [];
    const adapter = new MockAdapter({
      reply: (req) => {
        const last = req.messages[req.messages.length - 1];
        seen.push(last?.content ?? "");
        return "x";
      },
    });
    const sb = stepBack({ abstractionPrompt: "WHAT IS THE TELOS?" });
    await sb({ system: "", messages: [{ role: "user", content: "Solve y." }] }, adapter);
    expect(seen[0]).toContain("WHAT IS THE TELOS?");
  });
});
