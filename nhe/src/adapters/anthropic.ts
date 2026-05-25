import Anthropic from "@anthropic-ai/sdk";
import type {
  GenerateRequest,
  GenerateResponse,
  LlmAdapter,
  StreamEvent,
  ToolUse,
} from "./types.js";

export interface AnthropicAdapterConfig {
  /** Anthropic API key. Falls back to `ANTHROPIC_API_KEY` when omitted. */
  apiKey?: string;
  /** Model identifier. Default: "claude-sonnet-4-6". */
  model?: string;
  /** Default max output tokens. Default: 1024. */
  defaultMaxOutputTokens?: number;
  /** Override the adapter id surfaced in audit logs. */
  id?: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * AnthropicAdapter — production adapter for Anthropic Claude.
 *
 * Requires an Anthropic API key. The recommended default model in the
 * TeleologyHI ecosystem is `claude-sonnet-4-6`; override via `model`.
 *
 * Surface (D-N8): non-streaming `generate` + streaming `generateStream`
 * (yields `delta` / `tool-use` / `end` events) + tool-calling via the
 * `tools` field on `GenerateRequest`. Vision + prompt caching land later.
 */
export class AnthropicAdapter implements LlmAdapter {
  readonly id: string;
  readonly supportsTools = true;
  readonly supportsStreaming = true;
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly defaultMaxOutputTokens: number;

  constructor(config: AnthropicAdapterConfig = {}) {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AnthropicAdapter: no API key provided and ANTHROPIC_API_KEY is not set",
      );
    }
    this.client = new Anthropic({ apiKey });
    this.model = config.model ?? DEFAULT_MODEL;
    this.defaultMaxOutputTokens = config.defaultMaxOutputTokens ?? 1024;
    this.id = config.id ?? `anthropic:${this.model}`;
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const turns = this.buildTurns(req);
    const response = await this.client.messages.create({
      model: this.model,
      system: req.system,
      messages: turns,
      max_tokens: req.maxOutputTokens ?? this.defaultMaxOutputTokens,
      ...(req.tools && req.tools.length > 0
        ? {
            tools: req.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.inputSchema as never,
            })),
          }
        : {}),
    });

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    const toolUses: ToolUse[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({
        id: b.id,
        name: b.name,
        input: (b.input as Record<string, unknown>) ?? {},
      }));

    const out: GenerateResponse = {
      text,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
    };
    if (toolUses.length > 0) out.toolUses = toolUses;
    return out;
  }

  async *generateStream(req: GenerateRequest): AsyncIterable<StreamEvent> {
    const turns = this.buildTurns(req);
    const stream = this.client.messages.stream({
      model: this.model,
      system: req.system,
      messages: turns,
      max_tokens: req.maxOutputTokens ?? this.defaultMaxOutputTokens,
      ...(req.tools && req.tools.length > 0
        ? {
            tools: req.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.inputSchema as never,
            })),
          }
        : {}),
    });

    let tokensIn = 0;
    let tokensOut = 0;
    const pendingTools = new Map<number, { id: string; name: string; partial: string }>();

    for await (const ev of stream) {
      // The SDK emits content_block_delta with text_delta sub-events for text
      // and input_json_delta sub-events for tool inputs. We translate both to
      // our StreamEvent shape.
      if (ev.type === "content_block_start") {
        const block = ev.content_block;
        if (block.type === "tool_use") {
          pendingTools.set(ev.index, { id: block.id, name: block.name, partial: "" });
        }
      } else if (ev.type === "content_block_delta") {
        if (ev.delta.type === "text_delta") {
          yield { kind: "delta", text: ev.delta.text };
        } else if (ev.delta.type === "input_json_delta") {
          const pending = pendingTools.get(ev.index);
          if (pending) pending.partial += ev.delta.partial_json;
        }
      } else if (ev.type === "content_block_stop") {
        const pending = pendingTools.get(ev.index);
        if (pending) {
          let input: Record<string, unknown> = {};
          try {
            input = pending.partial ? JSON.parse(pending.partial) : {};
          } catch {
            input = { _raw: pending.partial };
          }
          yield { kind: "tool-use", toolUse: { id: pending.id, name: pending.name, input } };
          pendingTools.delete(ev.index);
        }
      } else if (ev.type === "message_delta") {
        if (ev.usage) tokensOut = ev.usage.output_tokens;
      } else if (ev.type === "message_start") {
        if (ev.message.usage) {
          tokensIn = ev.message.usage.input_tokens;
          tokensOut = ev.message.usage.output_tokens;
        }
      }
    }

    yield { kind: "end", tokensIn, tokensOut };
  }

  private buildTurns(req: GenerateRequest): Anthropic.MessageParam[] {
    return req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
  }
}
