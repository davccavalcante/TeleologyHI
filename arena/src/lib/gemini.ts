/**
 * Raw Gemini client for the "left column" of the arena.
 * NO MAIC / HIM / NHE — straight REST call to Google's Generative
 * Language API. This is the baseline against which the TeleologyHI
 * stack is compared.
 *
 * Per E27-G, the underlying transport is `generateWithRotation` from
 * `./gemini-rotating-call`, which automatically rotates through the
 * comma-separated `GEMINI_API_KEY` pool when individual keys hit
 * quota or auth failures. The rotation is invisible at this layer —
 * the route handler only sees `text` + `durationMs`.
 *
 * Multi-turn (E27-F): `history` carries prior turns from the SAME
 * conversation. Each prior turn contributes two messages (user prompt
 * + model response) to the Gemini `contents` array, so the model
 * receives the same context the governed column receives via NHE's
 * history channel.
 */
import { DEFAULT_GEMINI_MODEL } from "./constants";
import {
  generateWithRotation,
  type GeminiContent,
} from "./gemini-rotating-call";

const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

export interface RawGeminiResult {
  model: string;
  response: string;
  durationMs: number;
}

/**
 * Prior turn pair (one user prompt + one model response) used to build
 * the multi-turn context. Matches the shape `Conversation.turns[i]`
 * exposes through `prompt` + `left.response`.
 */
export interface RawGeminiHistoryTurn {
  userPrompt: string;
  modelResponse: string;
}

/**
 * Run a single prompt against raw Gemini. When `history` is provided
 * the prior turns are prepended so the model sees the full
 * conversation context. `history` is the LEFT-column history (raw
 * Gemini's own previous responses) — never the governed column's
 * responses, because mixing the two would conflate the two compared
 * subjects.
 */
export async function rawGemini(
  userPrompt: string,
  history: readonly RawGeminiHistoryTurn[] = [],
): Promise<RawGeminiResult> {
  const start = Date.now();
  const contents: GeminiContent[] = [
    ...history.flatMap<GeminiContent>((turn) => [
      { role: "user", parts: [{ text: turn.userPrompt }] },
      { role: "model", parts: [{ text: turn.modelResponse }] },
    ]),
    { role: "user", parts: [{ text: userPrompt }] },
  ];

  const result = await generateWithRotation({ model, contents });
  return { model, response: result.text, durationMs: Date.now() - start };
}
