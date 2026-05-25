import { sseEvents } from "./sse.js";
import type {
  GenerateRequest,
  GenerateResponse,
  LlmAdapter,
  StreamEvent,
} from "./types.js";

export interface GeminiAdapterConfig {
  /** Gemini API key. Falls back to `GEMINI_API_KEY` when omitted. */
  apiKey?: string;
  /** Model identifier. Default: `gemini-3.5-flash`. */
  model?: string;
  /** API base URL. Defaults to Google's public Generative Language API. */
  baseUrl?: string;
  /** Default max output tokens. Default: 1024. */
  defaultMaxOutputTokens?: number;
  /** Override the adapter id surfaced in audit logs. */
  id?: string;
  /** Inject a custom fetch (testing). Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
}

const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiRequestBody {
  systemInstruction?: { parts: { text: string }[] };
  contents: { role: "user" | "model"; parts: { text: string }[] }[];
  generationConfig: { maxOutputTokens: number };
}

interface GeminiResponseBody {
  candidates?: {
    content?: { parts?: { text?: string }[]; role?: string };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: { message?: string; status?: string };
}

/**
 * GeminiAdapter — production adapter for Google's Gemini models via the
 * Generative Language REST API. No SDK dependency.
 *
 * Reads the API key from constructor config or the `GEMINI_API_KEY` env var.
 * Default model is `gemini-3.5-flash`; override via `model`.
 *
 * Surface (D-N8): non-streaming `generate` + streaming `generateStream`
 * (`:streamGenerateContent?alt=sse` endpoint). Tool calling, structured
 * output (`responseSchema`), and vision remain follow-up cuts.
 */
export class GeminiAdapter implements LlmAdapter {
  readonly id: string;
  readonly supportsStreaming = true;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly defaultMaxOutputTokens: number;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config: GeminiAdapterConfig = {}) {
    const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GeminiAdapter: no API key provided and GEMINI_API_KEY is not set",
      );
    }
    this.apiKey = apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.defaultMaxOutputTokens = config.defaultMaxOutputTokens ?? 1024;
    this.id = config.id ?? `gemini:${this.model}`;
    this.fetchFn = config.fetch ?? globalThis.fetch;
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const body: GeminiRequestBody = {
      contents: req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      generationConfig: {
        maxOutputTokens: req.maxOutputTokens ?? this.defaultMaxOutputTokens,
      },
    };
    if (req.system) {
      body.systemInstruction = { parts: [{ text: req.system }] };
    }

    const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`;
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await safeReadText(response);
      throw new Error(
        `GeminiAdapter: HTTP ${response.status} ${response.statusText}: ${errText}`,
      );
    }

    const parsed = (await response.json()) as GeminiResponseBody;
    if (parsed.error) {
      throw new Error(`GeminiAdapter: ${parsed.error.message ?? "unknown error"}`);
    }

    const text =
      parsed.candidates
        ?.flatMap((c) => c.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("") ?? "";

    return {
      text,
      tokensIn: parsed.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: parsed.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  async *generateStream(req: GenerateRequest): AsyncIterable<StreamEvent> {
    const body: GeminiRequestBody = {
      contents: req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      generationConfig: {
        maxOutputTokens: req.maxOutputTokens ?? this.defaultMaxOutputTokens,
      },
    };
    if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };

    const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse`;
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok || !response.body) {
      throw new Error(
        `GeminiAdapter: HTTP ${response.status} ${response.statusText}: ${await safeReadText(response)}`,
      );
    }

    let tokensIn = 0;
    let tokensOut = 0;
    for await (const data of sseEvents(response.body)) {
      if (data === "[DONE]") break;
      let parsed: GeminiResponseBody;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      const chunk = parsed.candidates
        ?.flatMap((c) => c.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("");
      if (chunk) yield { kind: "delta", text: chunk };
      if (parsed.usageMetadata) {
        tokensIn = parsed.usageMetadata.promptTokenCount ?? tokensIn;
        tokensOut = parsed.usageMetadata.candidatesTokenCount ?? tokensOut;
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
