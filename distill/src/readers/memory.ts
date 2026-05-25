import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ConversationSample } from "../types.js";

/**
 * Read consolidated temporal-lobe memories (markdown with YAML frontmatter)
 * and yield one `ConversationSample` per memory. The `insight` body becomes
 * the assistant turn; the user turn is a synthetic recall prompt so the
 * resulting JSONL trains a student to produce memory-shaped explanations.
 */
export async function* readMemoryCorpus(
  storeDir: string,
): AsyncIterable<ConversationSample> {
  for await (const mdPath of walkTemporalLobes(storeDir)) {
    let raw: string;
    try {
      raw = await readFile(mdPath, "utf-8");
    } catch {
      continue;
    }
    const parsed = parseMemoryMarkdown(raw, mdPath);
    if (!parsed) continue;
    yield parsed;
  }
}

interface ParsedMemory {
  sample: ConversationSample;
}

function parseMemoryMarkdown(raw: string, filePath: string): ConversationSample | null {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;
  const fm = parseFrontmatter(fmMatch[1]!);
  const body = fmMatch[2]!;
  const insight = extractSection(body, "Insight") ?? body.trim();
  if (!insight) return null;

  const filename = filePath.split("/").pop() ?? "";
  const id =
    /temporal-lobe-([0-9A-HJKMNP-TV-Z]{26})\.md$/i.exec(filename)?.[1] ?? filename;
  const ts = stripQuotes(fm.consolidatedAt ?? new Date(0).toISOString());
  const classification = fm.classification ?? "noise-distortion";
  const nheId = fm.nheId ?? "";
  const himId = fm.himId ?? "";
  const tags = [`memory:${classification}`];

  const tv = Number(fm.teleologicalValue);
  const sample: ConversationSample = {
    id,
    source: "memory",
    sourceId: id,
    ...(nheId ? { nheId } : {}),
    ...(himId ? { himId } : {}),
    ts,
    tags,
    messages: [
      {
        role: "user",
        content:
          "Recall a consolidated insight from your temporal lobe relevant to this archetype.",
      },
      { role: "assistant", content: insight },
    ],
    ...(Number.isFinite(tv) ? { teleologicalValue: Math.max(0, Math.min(1, tv)) } : {}),
  };
  return sample;
}

async function* walkTemporalLobes(storeDir: string): AsyncIterable<string> {
  yield* listMemory(join(storeDir, "in-dreams", "brain"));
  let entries: string[];
  try {
    entries = await readdir(storeDir);
  } catch {
    return;
  }
  for (const sub of entries) {
    yield* listMemory(join(storeDir, sub, "in-dreams", "brain"));
  }
}

async function* listMemory(dir: string): AsyncIterable<string> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const f of entries) {
    if (f.startsWith("temporal-lobe-") && f.endsWith(".md")) {
      yield join(dir, f);
    }
  }
}

function parseFrontmatter(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (m?.[1]) out[m[1]] = m[2] ?? "";
  }
  return out;
}

function extractSection(body: string, heading: string): string | null {
  const re = new RegExp(`##\\s+${heading}\\s*\\n+([\\s\\S]*?)(?=\\n##\\s+|$)`, "i");
  const m = re.exec(body);
  return m ? m[1]!.trim() : null;
}

function stripQuotes(s: string): string {
  return s.replace(/^"|"$/g, "");
}

// `ParsedMemory` is exported for tests that want the strict shape; the
// generator above narrows directly to `ConversationSample` for downstream use.
export type { ParsedMemory };
