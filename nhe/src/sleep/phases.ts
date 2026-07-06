import { ulid } from "ulid";
import type { LlmAdapter } from "../adapters/types.js";
import type { Dream, InteractionRecord } from "./types.js";

/** Convert recent interactions to a compact "fragments" list for N1. */
export function interactionsToFragments(items: readonly InteractionRecord[]): string[] {
  return items.map((i) => {
    const prompt = truncate(i.userPrompt, 120);
    const response = truncate(i.responseText, 120);
    const refused = i.refused ? " [refused]" : "";
    return `user: "${prompt}"${refused} -> nhe: "${response}"`;
  });
}

/**
 * One-sentence summary the LLM is asked to produce per NREM phase. Distinct
 * from `Dream` (which is REM narrative), these are compressions of the day's
 * substrate that REM then weaves dreams around.
 */
export type NremPhase = "N2" | "N3" | "N4";

const NREM_PROMPTS: Record<NremPhase, { system: string; intro: string }> = {
  N2: {
    system:
      "You are an NHE in N2 sleep. Read today's interactions and produce ONE sentence describing the overall emotional charge of the day. No preamble.",
    intro: "Today's interactions:",
  },
  N3: {
    system:
      "You are an NHE in N3 deep sleep. Read today's interactions and produce ONE sentence naming the durable identity-shaping insight worth keeping. No preamble.",
    intro: "Today's interactions:",
  },
  N4: {
    system:
      "You are an NHE in N4 deepest sleep. Read today's interactions and produce ONE sentence naming what is mere noise and safe to discard. No preamble.",
    intro: "Today's interactions:",
  },
};

export function buildNremPrompt(
  phase: NremPhase,
  fragments: string[],
): { system: string; user: string } {
  const cfg = NREM_PROMPTS[phase];
  const body =
    fragments.length === 0
      ? `${cfg.intro} (none)`
      : `${cfg.intro}\n${fragments.map((f) => `- ${f}`).join("\n")}`;
  return { system: cfg.system, user: body };
}

/**
 * Run N2/N3/N4 in parallel against the LLM. Each call produces a one-sentence
 * summary; failures yield empty strings rather than aborting the cycle so a
 * flaky provider can't block sleep entirely.
 */
export async function generateNremSummaries(
  llm: LlmAdapter,
  fragments: string[],
): Promise<{
  n2: string;
  n3: string;
  n4: string;
  tokensIn: number;
  tokensOut: number;
}> {
  const phases: NremPhase[] = ["N2", "N3", "N4"];
  const results = await Promise.all(
    phases.map(async (phase) => {
      const { system, user } = buildNremPrompt(phase, fragments);
      try {
        const out = await llm.generate({
          system,
          messages: [{ role: "user", content: user }],
          maxOutputTokens: 128,
        });
        return { phase, text: out.text.trim(), tokensIn: out.tokensIn, tokensOut: out.tokensOut };
      } catch {
        return { phase, text: "", tokensIn: 0, tokensOut: 0 };
      }
    }),
  );
  const byPhase = new Map(results.map((r) => [r.phase, r] as const));
  const tokensIn = results.reduce((s, r) => s + r.tokensIn, 0);
  const tokensOut = results.reduce((s, r) => s + r.tokensOut, 0);
  return {
    n2: byPhase.get("N2")?.text ?? "",
    n3: byPhase.get("N3")?.text ?? "",
    n4: byPhase.get("N4")?.text ?? "",
    tokensIn,
    tokensOut,
  };
}

/**
 * Build the REM-phase prompt. The LLM is asked to produce 1-3 narrative
 * paragraphs, each followed by `TELEOLOGICAL_VALUE: 0.NN` on its own line.
 * When provided, the NREM summaries are appended so REM can weave them in.
 */
export function buildRemPrompt(
  fragments: string[],
  induction?: { scenario: string; desiredLearning: string; inducedBy: "maic" | "creator" },
  nrem?: { n2: string; n3: string; n4: string },
): { system: string; user: string } {
  const system = [
    "You are an NHE (Non-Human Entity) in REM sleep. Generate dream narratives that",
    "consolidate the day's interactions into useful insight. Each dream must:",
    "",
    "  1. Be a single short paragraph (3-6 sentences).",
    "  2. End with exactly one line of the form: TELEOLOGICAL_VALUE: 0.NN",
    "     where 0.00 = no insight gained, 1.00 = profound learning.",
    "  3. Be separated from the next dream by a blank line.",
    "",
    "Produce 1 to 3 dreams. Do not include preamble or commentary outside the dreams.",
  ].join("\n");

  const userParts: string[] = [];
  if (induction) {
    userParts.push(
      `Induced scenario (${induction.inducedBy}): ${induction.scenario}`,
      `Desired learning: ${induction.desiredLearning}`,
      "",
    );
  }
  if (nrem && (nrem.n2 || nrem.n3 || nrem.n4)) {
    userParts.push("NREM summaries from earlier phases:");
    if (nrem.n2) userParts.push(`  N2 (emotional gist): ${nrem.n2}`);
    if (nrem.n3) userParts.push(`  N3 (worth keeping): ${nrem.n3}`);
    if (nrem.n4) userParts.push(`  N4 (safe to discard): ${nrem.n4}`);
    userParts.push("");
  }
  if (fragments.length === 0) {
    userParts.push("Recent interactions: (none)");
  } else {
    userParts.push("Recent interactions:");
    for (const f of fragments) userParts.push(`- ${f}`);
  }
  return { system, user: userParts.join("\n") };
}

/** Parse the LLM REM output into individual dreams. */
export function parseRemOutput(
  text: string,
  induced: boolean,
  inducedBy: "maic" | "creator" | null,
): Dream[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const dreams: Dream[] = [];
  for (const block of blocks) {
    const match = block.match(/TELEOLOGICAL_VALUE:\s*(-?\d+(?:\.\d+)?)/i);
    if (!match) continue;
    const value = clamp(Number.parseFloat(match[1]!), 0, 1);
    const narrative = block.replace(/TELEOLOGICAL_VALUE:[^\n]*$/i, "").trim();
    if (!narrative) continue;
    dreams.push({
      id: `drm-${ulid()}`,
      induced,
      inducedBy,
      narrative,
      teleologicalValue: value,
      rawTrace: block,
    });
  }
  return dreams;
}

/**
 * Call the LLM with the REM prompt and parse the response into dreams.
 * Returns an empty array on no parseable output (treated as a quiet REM).
 */
export async function generateRemDreams(
  llm: LlmAdapter,
  fragments: string[],
  induction?: { scenario: string; desiredLearning: string; inducedBy: "maic" | "creator" },
  nrem?: { n2: string; n3: string; n4: string },
): Promise<{ dreams: Dream[]; tokensIn: number; tokensOut: number }> {
  const { system, user } = buildRemPrompt(fragments, induction, nrem);
  const out = await llm.generate({
    system,
    messages: [{ role: "user", content: user }],
    maxOutputTokens: 1024,
  });
  const dreams = parseRemOutput(out.text, !!induction, induction?.inducedBy ?? null);
  return { dreams, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
