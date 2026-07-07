/**
 * Raw Grok client for the "left column" of the arena.
 * NO MAIC / HIM / NHE, a straight call to xAI's OpenAI-compatible Chat
 * Completions API through the published `GrokAdapter`. This is the baseline
 * against which the TeleologyHI stack is compared.
 *
 * The arena currently runs on Grok (a single `GROK_API_KEY`, no key pool).
 * The Gemini path (`./gemini.ts`, comma-separated key-pool rotation) is kept
 * dormant for a future toggle so both underlying models can be compared and
 * tested; only the active wiring here and in `teleology.ts` decides which one
 * runs. Both columns MUST use the same underlying model, since the only
 * difference the arena exists to measure is governance, not the LLM.
 *
 * Multi-turn (E27-F): `history` carries prior turns from the SAME conversation.
 * Each prior turn contributes two messages (user prompt + assistant response),
 * so the raw column sees the same context the governed column receives via
 * NHE's history channel. `history` is the LEFT-column history (raw Grok's own
 * previous responses), never the governed column's, because mixing the two
 * would conflate the two compared subjects.
 */
import { type ChatMessage, GrokAdapter } from "@teleologyhi-sdk/nhe";
import { DEFAULT_GROK_MODEL } from "./constants";

const model = process.env.GROK_MODEL ?? DEFAULT_GROK_MODEL;

export interface RawGrokResult {
  model: string;
  response: string;
  durationMs: number;
}

export interface RawGrokHistoryTurn {
  userPrompt: string;
  modelResponse: string;
}

// Single raw adapter, constructed lazily so a missing key surfaces on the first
// turn rather than at module import. Grok uses one `GROK_API_KEY` (no pool), so
// no rotation layer is needed at this level.
let rawAdapter: GrokAdapter | undefined;
function adapter(): GrokAdapter {
  if (!rawAdapter) {
    if (!process.env.GROK_API_KEY) {
      throw new Error("GROK_API_KEY must be set in .env.local");
    }
    rawAdapter = new GrokAdapter({ apiKey: process.env.GROK_API_KEY, model });
  }
  return rawAdapter;
}

/**
 * Run a single prompt against raw Grok, with no governance system prompt.
 */
export async function rawGrok(
  userPrompt: string,
  history: readonly RawGrokHistoryTurn[] = [],
): Promise<RawGrokResult> {
  const start = Date.now();
  const messages: ChatMessage[] = [
    ...history.flatMap<ChatMessage>((turn) => [
      { role: "user", content: turn.userPrompt },
      { role: "assistant", content: turn.modelResponse },
    ]),
    { role: "user", content: userPrompt },
  ];
  const result = await adapter().generate({ system: "", messages });
  return { model, response: result.text, durationMs: Date.now() - start };
}
