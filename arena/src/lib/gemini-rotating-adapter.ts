/**
 * `GeminiRotatingAdapter` — drop-in `LlmAdapter` replacement for the
 * stock `GeminiAdapter` shipped in `@teleologyhi-sdk/nhe`, with
 * automatic key rotation backed by `gemini-rotating-call`.
 *
 * Why this lives in the arena (not in the published package): the
 * key-rotation pool is an arena-operator concern. The published
 * adapter intentionally takes a single `apiKey` because that is the
 * portable contract any consumer can satisfy; the arena layers
 * rotation on top by substituting this adapter into `teleology.ts`
 * before constructing the `Nhe` instance.
 *
 * The adapter implements the canonical `LlmAdapter` interface
 * (`generate(req): Promise<GenerateResponse>`) using the same REST
 * payload shape as the stock adapter, so NHE's downstream code — the
 * MAIC pre/post review, persona projection, REM dream cycle, etc. —
 * is unchanged.
 *
 * Streaming is NOT implemented in this first cut. The arena only
 * exercises non-streaming `generate`; if/when streaming is needed,
 * `generateStream` can be added with the same rotation logic against
 * the `:streamGenerateContent?alt=sse` endpoint.
 */
import { DEFAULT_GEMINI_MODEL } from "./constants";
import {
  generateWithRotation,
  type GeminiContent,
} from "./gemini-rotating-call";

// Imported via the published package — same interface the stock
// GeminiAdapter implements. We import the shape only via `type` to
// avoid pulling the SDK's runtime into the bundle by accident.
type ChatRole = "user" | "assistant" | "system";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface GenerateRequest {
  system: string;
  messages: ChatMessage[];
  maxOutputTokens?: number;
  // `tools` are accepted but ignored (the stock adapter also ignores
  // them at the time of this cut — tool-calling is a follow-up).
  tools?: unknown;
}

interface GenerateResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

interface LlmAdapter {
  readonly id: string;
  readonly supportsTools?: boolean;
  readonly supportsStreaming?: boolean;
  generate(req: GenerateRequest): Promise<GenerateResponse>;
}

export interface GeminiRotatingAdapterConfig {
  /** Model identifier. Default: `DEFAULT_GEMINI_MODEL` from `constants.ts`. */
  model?: string;
  /** Adapter id surfaced in audit logs. Default: `gemini-rotating`. */
  id?: string;
  /** Default max output tokens. Default: 1024. */
  defaultMaxOutputTokens?: number;
}

/**
 * Convert a NHE `ChatMessage[]` into the Gemini REST `contents` shape.
 * Roles: `user` → `user`, `assistant` → `model`. `system` messages are
 * filtered here because they belong on the top-level
 * `systemInstruction` field; the caller composes the `system` string
 * before calling `generate`.
 */
function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  const out: GeminiContent[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    out.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }
  return out;
}

export class GeminiRotatingAdapter implements LlmAdapter {
  readonly id: string;
  readonly supportsTools = false;
  readonly supportsStreaming = false;
  private readonly model: string;
  private readonly defaultMaxOutputTokens: number;

  constructor(config: GeminiRotatingAdapterConfig = {}) {
    this.id = config.id ?? "gemini-rotating";
    this.model = config.model ?? DEFAULT_GEMINI_MODEL;
    this.defaultMaxOutputTokens = config.defaultMaxOutputTokens ?? 1024;
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const contents = toGeminiContents(req.messages);
    const result = await generateWithRotation({
      model: this.model,
      contents,
      system: req.system,
      maxOutputTokens: req.maxOutputTokens ?? this.defaultMaxOutputTokens,
    });
    return {
      text: result.text,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    };
  }
}
