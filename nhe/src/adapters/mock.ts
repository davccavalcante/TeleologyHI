import type { GenerateRequest, GenerateResponse, LlmAdapter, StreamEvent } from "./types.js";

export interface MockAdapterConfig {
  /** Fixed reply, or a function producing one. */
  reply?: string | ((req: GenerateRequest) => string);
  /** Override the adapter id surfaced in audit logs. */
  id?: string;
  /** Chunk size for `generateStream` (default: 8 chars per delta). */
  streamChunkSize?: number;
}

/**
 * MockAdapter, deterministic adapter for tests and offline development.
 *
 * Default reply echoes the last user message prefixed with "[mock] ". Override
 * via `reply` (string or function) for specific test scenarios.
 *
 * Implements `generateStream` (D-N8): emits the reply in fixed-size chunks
 * followed by an `end` event with token counts. Useful for testing
 * downstream stream consumers without hitting a real provider.
 *
 * `supportsTools = true` is declared so reasoning strategies (e.g. `reAct`)
 * will route through this adapter in tests; tool calls are silently dropped
 * because the mock has no model to invoke them, provide a custom `reply`
 * function if a test needs to observe tool inputs or simulate tool outputs.
 */
export class MockAdapter implements LlmAdapter {
  readonly id: string;
  readonly supportsTools = true;
  readonly supportsStreaming = true;
  readonly calls: GenerateRequest[] = [];
  private readonly reply: string | ((req: GenerateRequest) => string);
  private readonly streamChunkSize: number;

  constructor(config: MockAdapterConfig = {}) {
    this.id = config.id ?? "mock:fixed";
    this.reply = config.reply ?? defaultReply;
    this.streamChunkSize = config.streamChunkSize ?? 8;
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    this.calls.push(req);
    const text = typeof this.reply === "function" ? this.reply(req) : this.reply;
    return {
      text,
      tokensIn: estimateTokens(req.system) + sumMessageTokens(req.messages),
      tokensOut: estimateTokens(text),
    };
  }

  async *generateStream(req: GenerateRequest): AsyncIterable<StreamEvent> {
    this.calls.push(req);
    const text = typeof this.reply === "function" ? this.reply(req) : this.reply;
    const tokensIn = estimateTokens(req.system) + sumMessageTokens(req.messages);
    for (let i = 0; i < text.length; i += this.streamChunkSize) {
      yield { kind: "delta", text: text.slice(i, i + this.streamChunkSize) };
    }
    yield { kind: "end", tokensIn, tokensOut: estimateTokens(text) };
  }
}

function defaultReply(req: GenerateRequest): string {
  const last = req.messages[req.messages.length - 1];
  return `[mock] ${last?.content ?? ""}`;
}

function estimateTokens(text: string): number {
  // Rough heuristic: ~4 chars per token.
  return Math.max(1, Math.ceil(text.length / 4));
}

function sumMessageTokens(messages: { content: string }[]): number {
  let sum = 0;
  for (const m of messages) sum += estimateTokens(m.content);
  return sum;
}
