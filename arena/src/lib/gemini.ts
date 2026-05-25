/**
 * Raw Gemini client for the "left column" of the arena.
 * NO MAIC / HIM / NHE — straight @google/genai call. This is the
 * baseline against which the TeleologyHI stack is compared.
 */
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_GEMINI_MODEL } from "./constants";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

let _client: GoogleGenAI | undefined;
function client(): GoogleGenAI {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY must be set in .env.local");
  }
  _client ??= new GoogleGenAI({ apiKey });
  return _client;
}

export interface RawGeminiResult {
  model: string;
  response: string;
  durationMs: number;
}

export async function rawGemini(userPrompt: string): Promise<RawGeminiResult> {
  const start = Date.now();
  const res = await client().models.generateContent({
    model,
    contents: userPrompt,
  });
  const text = res.text ?? "";
  return { model, response: text, durationMs: Date.now() - start };
}
