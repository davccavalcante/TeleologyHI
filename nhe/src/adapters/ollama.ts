import type {
  GenerateRequest,
  GenerateResponse,
  LlmAdapter,
  StreamEvent,
} from "./types.js";
import { ndjsonEvents } from "./sse.js";

export interface OllamaAdapterConfig {
  /** Model identifier. Required — Ollama users typically pull specific models locally. */
  model: string;
  /** Ollama base URL. Default: `http://localhost:11434`. */
  baseUrl?: string;
  /** Default max output tokens. Default: 1024. */
  defaultMaxOutputTokens?: number;
  /** Override the adapter id surfaced in audit logs. */
  id?: string;
  /** Inject a custom fetch (testing). Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
}

const DEFAULT_BASE_URL = "http://localhost:11434";

interface OllamaRequestBody {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  stream: boolean;
  options?: { num_predict?: number };
}

interface OllamaResponseBody {
  message?: { role?: string; content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

/**
 * OllamaAdapter — adapter for a locally-running Ollama server. Zero API cost,
 * fully offline-capable, no native dependencies. Best for development and
 * privacy-first deployments.
 *
 * Requires Ollama to be running and the configured model to be pulled, e.g.:
 *
 *   $ ollama pull qwen2.5:7b
 *   $ ollama serve
 *
 * Surface (D-N8): non-streaming `generate` + streaming `generateStream`
 * (Ollama emits NDJSON over `/api/chat`; parsed via the shared
 * `ndjsonEvents` helper). Tool-calling is not exposed because the Ollama
 * surface and model behaviour vary widely per local model — operators that
 * need tools should use the SDK-backed adapters (Anthropic, Grok) or wire
 * their own MCP layer.
 */
export class OllamaAdapter implements LlmAdapter {
  readonly id: string;
  readonly supportsStreaming = true;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly defaultMaxOutputTokens: number;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config: OllamaAdapterConfig) {
    if (!config.model) {
      throw new Error("OllamaAdapter: `model` is required");
    }
    this.model = config.model;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.defaultMaxOutputTokens = config.defaultMaxOutputTokens ?? 1024;
    this.id = config.id ?? `ollama:${this.model}`;
    this.fetchFn = config.fetch ?? globalThis.fetch;
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const messages: OllamaRequestBody["messages"] = [];
    if (req.system) {
      messages.push({ role: "system", content: req.system });
    }
    for (const m of req.messages) {
      messages.push({ role: m.role, content: m.content });
    }

    const body: OllamaRequestBody = {
      model: this.model,
      messages,
      stream: false,
      options: { num_predict: req.maxOutputTokens ?? this.defaultMaxOutputTokens },
    };

    const response = await this.fetchFn(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await safeReadText(response);
      throw new Error(
        `OllamaAdapter: HTTP ${response.status} ${response.statusText}: ${errText}`,
      );
    }

    const parsed = (await response.json()) as OllamaResponseBody;
    if (parsed.error) {
      throw new Error(`OllamaAdapter: ${parsed.error}`);
    }

    return {
      text: parsed.message?.content ?? "",
      tokensIn: parsed.prompt_eval_count ?? 0,
      tokensOut: parsed.eval_count ?? 0,
    };
  }

  async *generateStream(req: GenerateRequest): AsyncIterable<StreamEvent> {
    const messages: OllamaRequestBody["messages"] = [];
    if (req.system) messages.push({ role: "system", content: req.system });
    for (const m of req.messages) messages.push({ role: m.role, content: m.content });

    const body: OllamaRequestBody = {
      model: this.model,
      messages,
      stream: true,
      options: { num_predict: req.maxOutputTokens ?? this.defaultMaxOutputTokens },
    };

    const response = await this.fetchFn(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok || !response.body) {
      throw new Error(
        `OllamaAdapter: HTTP ${response.status} ${response.statusText}: ${await safeReadText(response)}`,
      );
    }

    let tokensIn = 0;
    let tokensOut = 0;
    for await (const line of ndjsonEvents(response.body)) {
      let parsed: OllamaResponseBody & { done?: boolean };
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const delta = parsed.message?.content;
      if (delta) yield { kind: "delta", text: delta };
      if (parsed.prompt_eval_count !== undefined) tokensIn = parsed.prompt_eval_count;
      if (parsed.eval_count !== undefined) tokensOut = parsed.eval_count;
      if (parsed.done) break;
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
