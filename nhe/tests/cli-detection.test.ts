import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADAPTER_NAME_LIST, detectAdapter, isAdapterName } from "../src/cli/adapter-detection";

const ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "MISTRAL_API_KEY",
  "DEEPSEEK_API_KEY",
  "XAI_API_KEY",
] as const;

const ENV_BACKUP: Record<string, string | undefined> = {};

function captureEnv() {
  for (const k of ENV_KEYS) ENV_BACKUP[k] = process.env[k];
}

function restoreEnv() {
  for (const k of ENV_KEYS) {
    const v = ENV_BACKUP[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function clearAllAdapterEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

describe("detectAdapter", () => {
  beforeEach(captureEnv);
  afterEach(restoreEnv);

  it("exports a deterministic adapter name list and matching type guard", () => {
    expect(ADAPTER_NAME_LIST).toEqual([
      "anthropic",
      "gemini",
      "mistral",
      "deepseek",
      "grok",
      "ollama",
    ]);
    expect(isAdapterName("anthropic")).toBe(true);
    expect(isAdapterName("mistral")).toBe(true);
    expect(isAdapterName("nope")).toBe(false);
    expect(isAdapterName(undefined)).toBe(false);
  });

  it("respects explicit --adapter anthropic", async () => {
    clearAllAdapterEnv();
    process.env.ANTHROPIC_API_KEY = "x";
    const r = await detectAdapter({ adapter: "anthropic", model: "claude-X" });
    expect(r.source).toBe("anthropic");
    expect(r.model).toBe("claude-X");
  });

  it("respects explicit --adapter gemini", async () => {
    clearAllAdapterEnv();
    process.env.GEMINI_API_KEY = "y";
    const r = await detectAdapter({ adapter: "gemini", model: "gemini-X" });
    expect(r.source).toBe("gemini");
    expect(r.model).toBe("gemini-X");
  });

  it("respects explicit --adapter mistral", async () => {
    clearAllAdapterEnv();
    process.env.MISTRAL_API_KEY = "m";
    const r = await detectAdapter({ adapter: "mistral", model: "mistral-small-latest" });
    expect(r.source).toBe("mistral");
    expect(r.model).toBe("mistral-small-latest");
  });

  it("respects explicit --adapter deepseek", async () => {
    clearAllAdapterEnv();
    process.env.DEEPSEEK_API_KEY = "d";
    const r = await detectAdapter({ adapter: "deepseek", model: "deepseek-reasoner" });
    expect(r.source).toBe("deepseek");
    expect(r.model).toBe("deepseek-reasoner");
  });

  it("respects explicit --adapter grok", async () => {
    clearAllAdapterEnv();
    process.env.XAI_API_KEY = "g";
    const r = await detectAdapter({ adapter: "grok", model: "grok-4-fast" });
    expect(r.source).toBe("grok");
    expect(r.model).toBe("grok-4-fast");
  });

  it("respects explicit --adapter ollama (no auth needed)", async () => {
    clearAllAdapterEnv();
    const r = await detectAdapter({ adapter: "ollama", model: "qwen2.5:7b" });
    expect(r.source).toBe("ollama");
    expect(r.model).toBe("qwen2.5:7b");
  });

  it("auto-detects ANTHROPIC_API_KEY first", async () => {
    clearAllAdapterEnv();
    process.env.ANTHROPIC_API_KEY = "x";
    const r = await detectAdapter();
    expect(r.source).toBe("anthropic");
    expect(r.model).toBe("claude-sonnet-4-6");
  });

  it("falls back to GEMINI_API_KEY when no Anthropic key", async () => {
    clearAllAdapterEnv();
    process.env.GEMINI_API_KEY = "y";
    const r = await detectAdapter();
    expect(r.source).toBe("gemini");
  });

  it("falls back to MISTRAL_API_KEY after Anthropic + Gemini are missing", async () => {
    clearAllAdapterEnv();
    process.env.MISTRAL_API_KEY = "m";
    const r = await detectAdapter();
    expect(r.source).toBe("mistral");
    expect(r.model).toBe("mistral-large-latest");
  });

  it("falls back to DEEPSEEK_API_KEY after the prior three are missing", async () => {
    clearAllAdapterEnv();
    process.env.DEEPSEEK_API_KEY = "d";
    const r = await detectAdapter();
    expect(r.source).toBe("deepseek");
    expect(r.model).toBe("deepseek-chat");
  });

  it("falls back to XAI_API_KEY after the prior four are missing", async () => {
    clearAllAdapterEnv();
    process.env.XAI_API_KEY = "g";
    const r = await detectAdapter();
    expect(r.source).toBe("grok");
    expect(r.model).toBe("grok-4");
  });

  it("falls back to Ollama when all five API keys are absent and Ollama is alive", async () => {
    clearAllAdapterEnv();
    const fetch = vi.fn(async () => ({ ok: true }) as unknown as Response);
    const r = await detectAdapter({ fetch: fetch as unknown as typeof globalThis.fetch });
    expect(r.source).toBe("ollama");
  });

  it("throws with a helpful message listing all five env vars when nothing is available", async () => {
    clearAllAdapterEnv();
    const fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(
      detectAdapter({ fetch: fetch as unknown as typeof globalThis.fetch }),
    ).rejects.toThrow(/no llm adapter detected/i);
    await expect(
      detectAdapter({ fetch: fetch as unknown as typeof globalThis.fetch }),
    ).rejects.toThrow(/MISTRAL_API_KEY/);
    await expect(
      detectAdapter({ fetch: fetch as unknown as typeof globalThis.fetch }),
    ).rejects.toThrow(/XAI_API_KEY/);
  });
});
