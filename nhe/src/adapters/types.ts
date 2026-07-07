import type { ChatMessage } from "../types.js";

/**
 * Declarative tool spec (D-N8). Adapters that support function-calling
 * forward this to the provider; adapters that don't ignore it and the
 * model receives a plain text request.
 */
export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema for the tool's input. Validated by the model, not by NHE. */
  inputSchema: Record<string, unknown>;
}

/**
 * A model's request to invoke a tool. The orchestrator (e.g. ReAct, or the
 * application code wrapping NHE) executes the tool and feeds the result back
 * as the next user/assistant turn.
 */
export interface ToolUse {
  /** Stable id chosen by the provider; round-trips back when the tool result is reported. */
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface GenerateRequest {
  /** Composed system prompt. */
  system: string;
  /** Chat history, oldest first. The last item should be the current user turn. */
  messages: ChatMessage[];
  /** Soft cap on output tokens. */
  maxOutputTokens?: number;
  /** Tools the model may invoke. Adapters silently ignore when unsupported. */
  tools?: ToolDef[];
}

export interface GenerateResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  /** Tool invocations the model emitted, if any. */
  toolUses?: ToolUse[];
}

/**
 * One event in a generation stream. `kind` discriminates:
 *   - `"delta"`    , partial text chunk; accumulate to reconstruct the full response.
 *   - `"tool-use"` , model requested a tool invocation; orchestrator should fulfil it.
 *   - `"end"`      , final event; carries total token counts.
 */
export type StreamEvent =
  | { kind: "delta"; text: string }
  | { kind: "tool-use"; toolUse: ToolUse }
  | { kind: "end"; tokensIn: number; tokensOut: number };

/**
 * LlmAdapter, pluggable contract for generating text from an LLM provider.
 *
 * Required:
 *   - `id`, stable identifier surfaced in audit/metrics.
 *   - `generate(req)`, non-streaming completion; the universal path.
 *
 * Optional (D-N8):
 *   - `generateStream(req)`, yields `StreamEvent`s. Adapters that don't
 *     ship streaming omit this; the reasoning orchestrator falls back to
 *     `generate` when absent.
 *   - `supportsTools`, `true` when `tools` in the request is honoured.
 *     Adapters that don't support function-calling simply set this to
 *     `false` (or omit) and the request's `tools` field is dropped.
 */
export interface LlmAdapter {
  readonly id: string;
  readonly supportsTools?: boolean;
  readonly supportsStreaming?: boolean;
  generate(req: GenerateRequest): Promise<GenerateResponse>;
  generateStream?(req: GenerateRequest): AsyncIterable<StreamEvent>;
}
