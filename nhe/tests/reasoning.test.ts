import { describe, it, expect } from "vitest";
import { MockAdapter } from "../src/adapters/mock";
import {
  passthrough,
  chainOfThought,
  parseCotOutput,
  selfConsistency,
  reflexion,
  parseVerdict,
  selfRefine,
  reAct,
  parseReActTurn,
} from "../src/reasoning";

const baseInput = {
  system: "you are helpful",
  messages: [{ role: "user" as const, content: "what is 2+2?" }],
};

describe("passthrough strategy", () => {
  it("returns the LLM text verbatim with a single trace step", async () => {
    const llm = new MockAdapter({ reply: "hello" });
    const r = await passthrough(baseInput, llm);
    expect(r.text).toBe("hello");
    expect(r.trace).toHaveLength(1);
    expect(r.trace[0]!.technique).toBe("passthrough");
  });
});

describe("chainOfThought", () => {
  it("appends a step-by-step instruction to the system prompt", async () => {
    let capturedSystem = "";
    const llm = new MockAdapter({
      reply: (req) => {
        capturedSystem = req.system;
        return "REASONING: 2+2 is addition.\nANSWER: 4";
      },
    });
    await chainOfThought()(baseInput, llm);
    expect(capturedSystem).toContain("step by step");
    expect(capturedSystem).toContain("REASONING:");
    expect(capturedSystem).toContain("ANSWER:");
  });

  it("parses REASONING + ANSWER headers", async () => {
    const llm = new MockAdapter({
      reply: "REASONING: think.\nANSWER: forty-two.",
    });
    const r = await chainOfThought()(baseInput, llm);
    expect(r.text).toBe("forty-two.");
    expect(r.trace).toHaveLength(2);
    expect(r.trace[0]!.technique).toBe("cot-reasoning");
    expect(r.trace[0]!.thought).toBe("think.");
    expect(r.trace[1]!.technique).toBe("cot-answer");
  });

  it("falls back to entire text when headers are absent", () => {
    const parsed = parseCotOutput("just a plain answer");
    expect(parsed.answer).toBe("just a plain answer");
    expect(parsed.reasoning).toBe("");
  });
});

describe("selfConsistency", () => {
  it("samples k times and votes by normalized majority", async () => {
    let call = 0;
    const llm = new MockAdapter({
      reply: () => {
        call++;
        // 3 samples: "4", "  4 ", "five"
        return call <= 2 ? "Answer: 4" : "Answer: five";
      },
    });
    const r = await selfConsistency(passthrough, { k: 3, voter: "majority-normalized" })(
      baseInput,
      llm,
    );
    // "Answer: 4" (normalized) appears twice → wins
    expect(r.text.toLowerCase()).toContain("4");
    const sampleSteps = r.trace.filter((s) => s.technique === "self-consistency-sample");
    expect(sampleSteps).toHaveLength(3);
    const voteStep = r.trace.find((s) => s.technique === "self-consistency-vote");
    expect(voteStep).toBeDefined();
  });

  it("voter=longest picks the longest sample", async () => {
    let call = 0;
    const replies = ["short", "this is the longest reply by far", "medium reply"];
    const llm = new MockAdapter({
      reply: () => {
        const r = replies[call % replies.length]!;
        call++;
        return r;
      },
    });
    const r = await selfConsistency(passthrough, { k: 3, voter: "longest" })(
      baseInput,
      llm,
    );
    expect(r.text).toBe("this is the longest reply by far");
  });

  it("k=1 is clamped up to 2", async () => {
    const llm = new MockAdapter({ reply: "x" });
    const r = await selfConsistency(passthrough, { k: 1 })(baseInput, llm);
    expect(r.trace.filter((s) => s.technique === "self-consistency-sample")).toHaveLength(2);
  });
});

describe("reflexion", () => {
  it("accepts a draft on the first cycle when critique returns VERDICT: ACCEPT", async () => {
    let call = 0;
    const llm = new MockAdapter({
      reply: () => (call++ === 0 ? "draft v1" : "VERDICT: ACCEPT"),
    });
    const r = await reflexion(passthrough, { maxCycles: 3 })(baseInput, llm);
    expect(r.text).toBe("draft v1");
    expect(r.trace).toHaveLength(2); // draft + critique
  });

  it("revises when critique returns VERDICT: REVISE", async () => {
    const responses = [
      "first draft",
      "VERDICT: REVISE\nISSUE: too short",
      "second draft, more thorough",
      "VERDICT: ACCEPT",
    ];
    let i = 0;
    const llm = new MockAdapter({ reply: () => responses[i++]! });
    const r = await reflexion(passthrough, { maxCycles: 3 })(baseInput, llm);
    expect(r.text).toBe("second draft, more thorough");
    expect(r.trace.filter((s) => s.technique === "reflexion-draft")).toHaveLength(2);
  });

  it("parseVerdict ACCEPT vs REVISE", () => {
    expect(parseVerdict("VERDICT: ACCEPT").accept).toBe(true);
    const r = parseVerdict("VERDICT: REVISE\nISSUE: not enough detail");
    expect(r.accept).toBe(false);
    expect(r.issue).toBe("not enough detail");
  });
});

describe("selfRefine", () => {
  it("produces draft → critique → refined trace", async () => {
    const responses = [
      "draft",            // inner passthrough → draft
      "- weak intro",     // critique
      "polished version", // refine
    ];
    let i = 0;
    const llm = new MockAdapter({ reply: () => responses[i++]! });
    const r = await selfRefine(passthrough)(baseInput, llm);
    expect(r.text).toBe("polished version");
    expect(r.trace.map((s) => s.technique)).toEqual([
      "self-refine-draft",
      "self-refine-critique",
      "self-refine-refined",
    ]);
  });
});

describe("reAct", () => {
  it("answers on the first turn if the model emits Answer:", async () => {
    const llm = new MockAdapter({
      reply: "Thought: trivial.\nAnswer: 42",
    });
    const r = await reAct({ tools: {}, maxSteps: 3 })(baseInput, llm);
    expect(r.text).toBe("42");
    const answers = r.trace.filter((s) => s.technique === "react-answer");
    expect(answers).toHaveLength(1);
  });

  it("invokes a tool when the model emits Action: tool[args]", async () => {
    const responses = [
      "Thought: need search.\nAction: search[capital of Brazil]",
      "Thought: I know now.\nAnswer: Brasília",
    ];
    let i = 0;
    const llm = new MockAdapter({ reply: () => responses[i++]! });
    const tools = {
      search: async (q: string) => `results for "${q}": Brasília is the capital.`,
    };
    const r = await reAct({ tools, maxSteps: 3 })(baseInput, llm);
    expect(r.text).toBe("Brasília");
    const actionSteps = r.trace.filter((s) => s.technique === "react-action");
    expect(actionSteps).toHaveLength(1);
    expect(actionSteps[0]!.action).toEqual({ tool: "search", args: "capital of Brazil" });
  });

  it("reports an error observation for unknown tools", async () => {
    const responses = [
      "Thought: try.\nAction: nonexistent[x]",
      "Thought: bail.\nAnswer: failed",
    ];
    let i = 0;
    const llm = new MockAdapter({ reply: () => responses[i++]! });
    const r = await reAct({ tools: {}, maxSteps: 3 })(baseInput, llm);
    const action = r.trace.find((s) => s.technique === "react-action");
    expect(String(action?.observation)).toContain("unknown tool");
  });

  it("stops at maxSteps with a max-steps trace step", async () => {
    const llm = new MockAdapter({
      reply: "Thought: looping.\nAction: tick[1]",
    });
    const tools = { tick: async () => "tock" };
    const r = await reAct({ tools, maxSteps: 2 })(baseInput, llm);
    expect(r.trace.some((s) => s.technique === "react-max-steps")).toBe(true);
  });

  it("parseReActTurn handles Answer, Action, neither", () => {
    expect(parseReActTurn("Thought: a.\nAnswer: b").answer).toBe("b");
    const act = parseReActTurn("Thought: c.\nAction: foo[bar baz]").action;
    expect(act).toEqual({ tool: "foo", args: "bar baz" });
    expect(parseReActTurn("just thinking").action).toBeUndefined();
    expect(parseReActTurn("just thinking").answer).toBeUndefined();
  });
});

describe("strategy composition", () => {
  it("selfConsistency over chainOfThought yields a CoT-parsed winner", async () => {
    const llm = new MockAdapter({
      reply: "REASONING: 2+2 is basic.\nANSWER: 4",
    });
    const r = await selfConsistency(chainOfThought(), { k: 2 })(baseInput, llm);
    expect(r.text).toBe("4");
    // K samples × (cot-reasoning + cot-answer) + vote = 5 steps
    expect(r.trace.length).toBeGreaterThanOrEqual(3);
  });
});
