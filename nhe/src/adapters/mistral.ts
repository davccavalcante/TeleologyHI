import { sseEvents } from "./sse.js";
import type {
  GenerateRequest,
  GenerateResponse,
  LlmAdapter,
  StreamEvent,
  ToolUse,
} from "./types.js";

export interface MistralAdapterConfig {
  /** Mistral API key. Falls back to `MISTRAL_API_KEY` when omitted. */
  apiKey?: string;
  /** Model identifier. Default: `mistral-large-latest`. */
  model?: string;
  /** API base URL. Defaults to Mistral's public REST endpoint. */
  baseUrl?: string;
  /** Default max output tokens. Default: 1024. */
  defaultMaxOutputTokens?: number;
  /** Override the adapter id surfaced in audit logs. */
  id?: string;
  /** Inject a custom fetch (testing). Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
}

const DEFAULT_MODEL = "mistral-large-latest";
const DEFAULT_BASE_URL = "https://api.mistral.ai/v1";

interface OpenAIToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIToolCall {
  id: string;
  type?: "function";
  function: { name: string; arguments: string };
}

interface ChatRequestBody {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  max_tokens?: number;
  stream?: boolean;
  /** Request per-stream token usage in the terminal SSE frame (ND-5). */
  stream_options?: { include_usage: boolean };
  tools?: OpenAIToolDef[];
}

interface ChatResponseBody {
  choices?: {
    message?: {
      role?: string;
      content?: string;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: string;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: { message?: string; type?: string };
  message?: string;
}

/**
 * MistralAdapter, production adapter for Mistral's Chat Completions REST
 * endpoint. No SDK dependency.
 *
 * Reads the API key from constructor config or the `MISTRAL_API_KEY` env var.
 * Default model is `mistral-large-latest`; pass `mistral-small-latest` for
 * cheaper inference, or `open-mistral-nemo` etc. for the open-weights line.
 *
 * Surface (D-N8): non-streaming `generate` + streaming `generateStream`
 * (SSE) + tool-calling via the `tools` field on `GenerateRequest`. Vision +
 * JSON-mode remain follow-up cuts.
 */
export class MistralAdapter implements LlmAdapter {
  readonly id: string;
  readonly supportsTools = true;
  readonly supportsStreaming = true;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly defaultMaxOutputTokens: number;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config: MistralAdapterConfig = {}) {
    const apiKey = config.apiKey ?? process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error("MistralAdapter: no API key provided and MISTRAL_API_KEY is not set");
    }
    this.apiKey = apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.defaultMaxOutputTokens = config.defaultMaxOutputTokens ?? 1024;
    this.id = config.id ?? `mistral:${this.model}`;
    this.fetchFn = config.fetch ?? globalThis.fetch;
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const messages: ChatRequestBody["messages"] = [];
    if (req.system) messages.push({ role: "system", content: req.system });
    for (const m of req.messages) {
      messages.push({ role: m.role, content: m.content });
    }

    const body: ChatRequestBody = {
      model: this.model,
      messages,
      max_tokens: req.maxOutputTokens ?? this.defaultMaxOutputTokens,
      stream: false,
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }

    const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await safeReadText(response);
      throw new Error(`MistralAdapter: HTTP ${response.status} ${response.statusText}: ${errText}`);
    }

    const parsed = (await response.json()) as ChatResponseBody;
    if (parsed.error) {
      throw new Error(`MistralAdapter: ${parsed.error.message ?? "unknown error"}`);
    }

    const message = parsed.choices?.[0]?.message;
    const out: GenerateResponse = {
      text: message?.content ?? "",
      tokensIn: parsed.usage?.prompt_tokens ?? 0,
      tokensOut: parsed.usage?.completion_tokens ?? 0,
    };
    const toolUses = parseToolCalls(message?.tool_calls);
    if (toolUses.length > 0) out.toolUses = toolUses;
    return out;
  }

  async *generateStream(req: GenerateRequest): AsyncIterable<StreamEvent> {
    const messages: ChatRequestBody["messages"] = [];
    if (req.system) messages.push({ role: "system", content: req.system });
    for (const m of req.messages) messages.push({ role: m.role, content: m.content });

    const body: ChatRequestBody = {
      model: this.model,
      messages,
      max_tokens: req.maxOutputTokens ?? this.defaultMaxOutputTokens,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }
    const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok || !response.body) {
      throw new Error(
        `MistralAdapter: HTTP ${response.status} ${response.statusText}: ${await safeReadText(response)}`,
      );
    }

    let tokensIn = 0;
    let tokensOut = 0;
    const pendingTools = new Map<number, { id: string; name: string; partial: string }>();
    for await (const data of sseEvents(response.body)) {
      if (data === "[DONE]") break;
      let parsed: {
        choices?: {
          delta?: {
            content?: string;
            tool_calls?: {
              index: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }[];
          };
          finish_reason?: string;
        }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      const choice = parsed.choices?.[0];
      const delta = choice?.delta?.content;
      if (delta) yield { kind: "delta", text: delta };
      const toolDeltas = choice?.delta?.tool_calls;
      if (toolDeltas) {
        for (const td of toolDeltas) {
          const slot = pendingTools.get(td.index) ?? { id: "", name: "", partial: "" };
          if (td.id) slot.id = td.id;
          if (td.function?.name) slot.name = td.function.name;
          if (td.function?.arguments) slot.partial += td.function.arguments;
          pendingTools.set(td.index, slot);
        }
      }
      if (choice?.finish_reason === "tool_calls" || choice?.finish_reason === "stop") {
        for (const [, slot] of pendingTools) {
          if (!slot.id || !slot.name) continue;
          let input: Record<string, unknown> = {};
          try {
            input = slot.partial ? JSON.parse(slot.partial) : {};
          } catch {
            input = { _raw: slot.partial };
          }
          yield { kind: "tool-use", toolUse: { id: slot.id, name: slot.name, input } };
        }
        pendingTools.clear();
      }
      if (parsed.usage) {
        tokensIn = parsed.usage.prompt_tokens ?? tokensIn;
        tokensOut = parsed.usage.completion_tokens ?? tokensOut;
      }
    }
    yield { kind: "end", tokensIn, tokensOut };
  }
}

async function safeReadText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "<unreadable>";
  }
}

function parseToolCalls(calls: OpenAIToolCall[] | undefined): ToolUse[] {
  if (!calls || calls.length === 0) return [];
  const out: ToolUse[] = [];
  for (const c of calls) {
    let input: Record<string, unknown> = {};
    try {
      input = c.function.arguments ? JSON.parse(c.function.arguments) : {};
    } catch {
      input = { _raw: c.function.arguments };
    }
    out.push({ id: c.id, name: c.function.name, input });
  }
  return out;
}
