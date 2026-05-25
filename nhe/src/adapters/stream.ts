import type {
  GenerateRequest,
  GenerateResponse,
  LlmAdapter,
  StreamEvent,
  ToolUse,
} from "./types.js";

/**
 * Drain a streaming generation into a `GenerateResponse` that's
 * compatible with the non-streaming pipeline. Optional `onDelta` callback
 * fires for every delta event — useful for piping tokens to a UI while
 * the orchestrator collects the full text.
 *
 * If the adapter does not implement `generateStream`, falls back to
 * `generate` and emits a single delta + end pair so the consumer's
 * stream-handler shape works uniformly.
 */
export async function collectStream(
  adapter: LlmAdapter,
  req: GenerateRequest,
  onDelta?: (chunk: string) => void,
): Promise<GenerateResponse> {
  if (!adapter.generateStream) {
    const r = await adapter.generate(req);
    onDelta?.(r.text);
    return r;
  }

  let text = "";
  let tokensIn = 0;
  let tokensOut = 0;
  const toolUses: ToolUse[] = [];

  for await (const ev of adapter.generateStream(req)) {
    switch (ev.kind) {
      case "delta":
        text += ev.text;
        onDelta?.(ev.text);
        break;
      case "tool-use":
        toolUses.push(ev.toolUse);
        break;
      case "end":
        tokensIn = ev.tokensIn;
        tokensOut = ev.tokensOut;
        break;
    }
  }

  const out: GenerateResponse = { text, tokensIn, tokensOut };
  if (toolUses.length > 0) out.toolUses = toolUses;
  return out;
}

/**
 * Re-export so callers can `import { StreamEvent } from "@teleologyhi-sdk/nhe"`.
 */
export type { StreamEvent };
