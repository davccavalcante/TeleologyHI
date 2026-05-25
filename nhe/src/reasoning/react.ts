import {
  makeStep,
  type GenerateRequest,
  type LlmAdapter,
  type ReasoningResult,
  type ReasoningStrategy,
} from "./types.js";

/** A ReAct tool. The string `args` is the bracketed expression from the model. */
export type ReActTool = (args: string) => Promise<string>;
export type ReActToolRegistry = Record<string, ReActTool>;

export interface ReActOptions {
  /** Tool registry. */
  tools: ReActToolRegistry;
  /** Maximum Thought→Action→Observation cycles before forcing an answer. Default 5. */
  maxSteps?: number;
  /** Override the ReAct system prompt prefix. */
  systemPrefix?: string;
}

const DEFAULT_REACT_SYSTEM = (toolNames: string[]): string =>
  [
    "You are a ReAct agent. Follow this format STRICTLY on every turn:",
    "  Thought: <one line of reasoning>",
    "  Action: <tool>[<args>]",
    "OR",
    "  Thought: <one line>",
    "  Answer: <final user-facing reply>",
    "",
    `Available tools: ${toolNames.map((t) => `${t}[args]`).join(", ")}.`,
    "Use only listed tools. When you have the answer, emit 'Answer:' instead of 'Action:'.",
    "Stop immediately after either 'Answer:' or 'Action:' on a given turn.",
  ].join("\n");

/**
 * ReAct — Thought / Action / Observation loop.
 *
 * Each cycle the model emits either an Action (tool call) or an Answer.
 * Action results are appended as Observation lines and fed back into the next turn.
 * If maxSteps is reached without an Answer, the last assistant message is returned
 * with `[max-steps]` annotation in the trace.
 */
export function reAct(opts: ReActOptions): ReasoningStrategy {
  const maxSteps = Math.max(1, opts.maxSteps ?? 5);
  const toolNames = Object.keys(opts.tools);
  const sysPrefix = opts.systemPrefix ?? DEFAULT_REACT_SYSTEM(toolNames);
  return async (input, llm) => {
    const system = input.system ? `${input.system}\n\n${sysPrefix}` : sysPrefix;
    const messages = [...input.messages];
    const trace = [];
    let stepIdx = 0;
    let tokensIn = 0;
    let tokensOut = 0;

    for (let step = 0; step < maxSteps; step++) {
      const req: GenerateRequest = { system, messages };
      const out = await llm.generate(req);
      tokensIn += out.tokensIn;
      tokensOut += out.tokensOut;
      const parsed = parseReActTurn(out.text);

      trace.push(
        makeStep({
          index: stepIdx++,
          technique: "react-thought",
          thought: parsed.thought ?? out.text,
        }),
      );

      if (parsed.answer !== undefined) {
        trace.push(
          makeStep({
            index: stepIdx++,
            technique: "react-answer",
            thought: parsed.answer,
          }),
        );
        return { text: parsed.answer, tokensIn, tokensOut, trace };
      }

      if (parsed.action) {
        const { tool, args } = parsed.action;
        const handler = opts.tools[tool];
        let observation: string;
        if (!handler) {
          observation = `ERROR: unknown tool "${tool}". Available: ${toolNames.join(", ")}.`;
        } else {
          try {
            observation = await handler(args);
          } catch (e: unknown) {
            observation = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
        trace.push(
          makeStep({
            index: stepIdx++,
            technique: "react-action",
            thought: `${tool}[${args}]`,
            action: { tool, args },
            observation,
          }),
        );
        messages.push({ role: "assistant", content: out.text });
        messages.push({ role: "user", content: `Observation: ${observation}` });
        continue;
      }

      // No Action and no Answer — bail out, return raw output.
      return {
        text: out.text,
        tokensIn,
        tokensOut,
        trace: [
          ...trace,
          makeStep({
            index: stepIdx++,
            technique: "react-bail",
            thought: "No Action or Answer in model output; returning raw text.",
          }),
        ],
      };
    }

    // Max steps reached without Answer.
    const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
    const text = lastAssistant?.content ?? "";
    return {
      text,
      tokensIn,
      tokensOut,
      trace: [
        ...trace,
        makeStep({
          index: stepIdx++,
          technique: "react-max-steps",
          thought: `Max ${maxSteps} steps reached; returning last assistant text.`,
        }),
      ],
    };
  };
}

/** Visible for testing. */
export function parseReActTurn(text: string): {
  thought?: string;
  action?: { tool: string; args: string };
  answer?: string;
} {
  const thoughtMatch = text.match(/Thought\s*:\s*([^\n]+)/i);
  const answerMatch = text.match(/Answer\s*:\s*([\s\S]+?)$/i);
  if (answerMatch) {
    return {
      ...(thoughtMatch ? { thought: thoughtMatch[1]!.trim() } : {}),
      answer: answerMatch[1]!.trim(),
    };
  }
  const actionMatch = text.match(/Action\s*:\s*([A-Za-z_][\w-]*)\s*\[\s*([\s\S]*?)\s*\]/i);
  if (actionMatch) {
    return {
      ...(thoughtMatch ? { thought: thoughtMatch[1]!.trim() } : {}),
      action: { tool: actionMatch[1]!, args: actionMatch[2]! },
    };
  }
  return {
    ...(thoughtMatch ? { thought: thoughtMatch[1]!.trim() } : {}),
  };
}
