import { AnthropicAdapter } from "../adapters/anthropic.js";
import { DeepSeekAdapter } from "../adapters/deepseek.js";
import { GeminiAdapter } from "../adapters/gemini.js";
import { GrokAdapter } from "../adapters/grok.js";
import { MistralAdapter } from "../adapters/mistral.js";
import { OllamaAdapter } from "../adapters/ollama.js";
import type { LlmAdapter } from "../adapters/types.js";

export type AdapterName =
  | "anthropic"
  | "gemini"
  | "mistral"
  | "deepseek"
  | "grok"
  | "ollama";

const ADAPTER_NAMES: readonly AdapterName[] = [
  "anthropic",
  "gemini",
  "mistral",
  "deepseek",
  "grok",
  "ollama",
];

function isAdapterName(s: string | undefined): s is AdapterName {
  return s !== undefined && (ADAPTER_NAMES as readonly string[]).includes(s);
}

export const ADAPTER_NAME_LIST = ADAPTER_NAMES;
export { isAdapterName };

export interface DetectOptions {
  /** Explicit adapter choice; overrides auto-detection. */
  adapter?: AdapterName;
  /** Explicit model name for the chosen adapter. */
  model?: string;
  /** Ollama base URL. Default `http://localhost:11434`. */
  ollamaBaseUrl?: string;
  /** Custom fetch for testing. */
  fetch?: typeof globalThis.fetch;
}

export interface DetectedAdapter {
  adapter: LlmAdapter;
  source: AdapterName;
  model: string;
}

const OLLAMA_DEFAULT_MODEL = "qwen2.5:7b";
const OLLAMA_DEFAULT_URL = "http://localhost:11434";

const DEFAULT_MODELS: Record<AdapterName, string> = {
  anthropic: "claude-sonnet-4-6",
  gemini: "gemini-3.5-flash",
  mistral: "mistral-large-latest",
  deepseek: "deepseek-chat",
  grok: "grok-4",
  ollama: OLLAMA_DEFAULT_MODEL,
};

/**
 * Pick an LlmAdapter using explicit flags first, then env-based auto-detection.
 *
 * Preference order when nothing is forced (cloud API keys first, then local):
 *   1. ANTHROPIC_API_KEY → AnthropicAdapter
 *   2. GEMINI_API_KEY    → GeminiAdapter
 *   3. MISTRAL_API_KEY   → MistralAdapter
 *   4. DEEPSEEK_API_KEY  → DeepSeekAdapter
 *   5. XAI_API_KEY       → GrokAdapter
 *   6. Local Ollama (pingable /api/tags) → OllamaAdapter
 *
 * Throws a helpful error when no adapter can be constructed.
 */
export async function detectAdapter(opts: DetectOptions = {}): Promise<DetectedAdapter> {
  const fetchFn = opts.fetch ?? globalThis.fetch;

  if (opts.adapter) {
    return buildAdapter(opts.adapter, opts);
  }

  // Auto-detect cloud providers first (deterministic order via env vars).
  if (process.env.ANTHROPIC_API_KEY) return buildAdapter("anthropic", opts);
  if (process.env.GEMINI_API_KEY) return buildAdapter("gemini", opts);
  if (process.env.MISTRAL_API_KEY) return buildAdapter("mistral", opts);
  if (process.env.DEEPSEEK_API_KEY) return buildAdapter("deepseek", opts);
  if (process.env.XAI_API_KEY) return buildAdapter("grok", opts);
  if (await ollamaAlive(opts.ollamaBaseUrl ?? OLLAMA_DEFAULT_URL, fetchFn)) {
    return buildAdapter("ollama", opts);
  }

  throw new Error(
    [
      "No LLM adapter detected. Choose one:",
      "  - export ANTHROPIC_API_KEY=...   (Anthropic Claude)",
      "  - export GEMINI_API_KEY=...      (Google Gemini)",
      "  - export MISTRAL_API_KEY=...     (Mistral)",
      "  - export DEEPSEEK_API_KEY=...    (DeepSeek)",
      "  - export XAI_API_KEY=...         (xAI Grok)",
      "  - run an Ollama server locally   (ollama serve; then ollama pull qwen2.5:7b)",
      "Or pass --adapter <anthropic|gemini|mistral|deepseek|grok|ollama> --model <name> explicitly.",
    ].join("\n"),
  );
}

function buildAdapter(name: AdapterName, opts: DetectOptions): DetectedAdapter {
  const model = opts.model ?? DEFAULT_MODELS[name];
  switch (name) {
    case "anthropic":
      return { adapter: new AnthropicAdapter({ model }), source: "anthropic", model };
    case "gemini":
      return { adapter: new GeminiAdapter({ model }), source: "gemini", model };
    case "mistral":
      return { adapter: new MistralAdapter({ model }), source: "mistral", model };
    case "deepseek":
      return { adapter: new DeepSeekAdapter({ model }), source: "deepseek", model };
    case "grok":
      return { adapter: new GrokAdapter({ model }), source: "grok", model };
    case "ollama": {
      const baseUrl = opts.ollamaBaseUrl ?? OLLAMA_DEFAULT_URL;
      return { adapter: new OllamaAdapter({ model, baseUrl }), source: "ollama", model };
    }
  }
}

async function ollamaAlive(
  baseUrl: string,
  fetchFn: typeof globalThis.fetch,
): Promise<boolean> {
  try {
    const url = `${baseUrl.replace(/\/$/, "")}/api/tags`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 500);
    const r = await fetchFn(url, { signal: controller.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}
