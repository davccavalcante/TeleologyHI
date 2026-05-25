import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ConversationSample } from "../types.js";

interface PartialInteractionRecord {
  at?: string;
  userPrompt?: string;
  responseText?: string;
  refused?: boolean;
}

/**
 * Stream NHE interaction records (the ULID-named JSONs written by the
 * D-N4 InteractionStore) and yield one `ConversationSample` per exchange.
 *
 * Refused exchanges are emitted with `source: "refusal"` and a `refused` tag
 * so a downstream pipeline can isolate the refusal corpus for safety
 * fine-tuning (B6 — adversarial-corpus eval).
 */
export async function* readInteractionCorpus(
  storeDir: string,
): AsyncIterable<ConversationSample> {
  for await (const jsonPath of walkInteractions(storeDir)) {
    let raw: string;
    try {
      raw = await readFile(jsonPath, "utf-8");
    } catch {
      continue;
    }
    let record: PartialInteractionRecord;
    try {
      record = JSON.parse(raw) as PartialInteractionRecord;
    } catch {
      continue;
    }
    const user = record.userPrompt ?? "";
    const response = record.responseText ?? "";
    if (!user || !response) continue;

    const filename = jsonPath.split("/").pop() ?? "";
    const id = filename.replace(/\.json$/, "");
    const ts = record.at ?? new Date(0).toISOString();
    const refused = record.refused === true;
    const tags = refused ? ["refused"] : [];
    yield {
      id,
      source: refused ? "refusal" : "interaction",
      sourceId: id,
      ts,
      tags,
      messages: [
        { role: "user", content: user },
        { role: "assistant", content: response },
      ],
    };
  }
}

async function* walkInteractions(storeDir: string): AsyncIterable<string> {
  yield* listInteractions(join(storeDir, "interactions"));
  let entries: string[];
  try {
    entries = await readdir(storeDir);
  } catch {
    return;
  }
  for (const sub of entries) {
    yield* listInteractions(join(storeDir, sub, "interactions"));
  }
}

async function* listInteractions(dir: string): AsyncIterable<string> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const f of entries) {
    if (f.endsWith(".json")) yield join(dir, f);
  }
}
