import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MemoryClass, MemoryEntry } from "../sleep/types.js";
import { bm25 } from "./bm25.js";

/**
 * Optional embedder hook for embedding-based retrieval (D-N3 step 2).
 * Anything that produces a numeric vector for a string satisfies this,
 * `@huggingface/transformers` (ONNX sentence-transformers), `@xenova/transformers`,
 * a remote `/embed` endpoint, etc. When supplied, recall uses cosine
 * similarity instead of BM25.
 *
 * The contract is intentionally narrow: the embedder is the operator's
 * choice (bundle size, model quality, runtime) and NHE doesn't pin one.
 */
export interface RecallEmbedder {
  /** Stable id surfaced in audit so different embedders are distinguishable. */
  readonly id: string;
  /** Vector size; recall checks this matches between query and corpus. */
  readonly dimension: number;
  /** Embed a single string. Returns an L2-normalised vector. */
  embed(text: string): Promise<Float32Array> | Float32Array;
}

export interface RecallOptions {
  /** Max results to return. Default 5. */
  limit?: number;
  /** Restrict to a specific class. Default: all retrievable classes. */
  classes?: MemoryClass[];
  /**
   * Override the retrieval algorithm:
   *   - `"bm25"`    , Okapi BM25 (default; replaces the legacy keyword count).
   *   - `"keyword"` , legacy substring-count ranking (kept for back-compat).
   *   - `"embedding"`, cosine similarity. Requires `embedder` to also be set.
   */
  scorer?: "bm25" | "keyword" | "embedding";
  /** Embedder used when `scorer: "embedding"`. */
  embedder?: RecallEmbedder;
}

/**
 * Rank consolidated temporal-lobe memories against a free-form query.
 *
 * **Default**: Okapi BM25, proper term-frequency saturation +
 * document-length normalisation + IDF over the corpus of stored memories.
 * Strictly better than the legacy keyword-count ranker.
 *
 * **Embedding path** (`scorer: "embedding"` + `embedder`): cosine similarity
 * over the corpus. Linear scan today; an HNSW index for >10k memories is
 * tracked under TASK.md D-N3 follow-up.
 *
 * **Legacy** (`scorer: "keyword"`): the substring-count ranker preserved
 * for back-compat regression testing.
 */
export async function recallFromTemporalLobe(
  storeDir: string,
  query: string,
  opts: RecallOptions = {},
): Promise<MemoryEntry[]> {
  const limit = opts.limit ?? 5;
  const allowed: Set<MemoryClass> = new Set(
    opts.classes ?? ["lasting-identity", "temporary-emotion"],
  );
  const scorer = opts.scorer ?? "bm25";
  const brainDir = join(storeDir, "in-dreams", "brain");

  let files: string[];
  try {
    files = (await readdir(brainDir)).filter(
      (f) => f.startsWith("temporal-lobe-") && f.endsWith(".md"),
    );
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  // Load + parse + filter by class, common across all scorers.
  const entries: MemoryEntry[] = [];
  for (const fname of files) {
    const fpath = join(brainDir, fname);
    const raw = await readFile(fpath, "utf-8");
    const entry = parseTemporalLobe(raw, fpath);
    if (!entry) continue;
    if (!allowed.has(entry.classification)) continue;
    entries.push(entry);
  }
  if (entries.length === 0) return [];

  if (scorer === "embedding") {
    if (!opts.embedder) {
      throw new Error("recallFromTemporalLobe: scorer 'embedding' requires opts.embedder");
    }
    return recallByEmbedding(entries, query, opts.embedder, limit);
  }

  if (scorer === "keyword") {
    return recallByKeyword(entries, query, limit);
  }

  // BM25 (default)
  const docs = entries.map((e) => ({ id: e.id, text: e.insight, entry: e }));
  const ranked = bm25(query, docs).slice(0, limit);
  return ranked.map((r) => r.doc.entry);
}

async function recallByEmbedding(
  entries: MemoryEntry[],
  query: string,
  embedder: RecallEmbedder,
  limit: number,
): Promise<MemoryEntry[]> {
  const qv = await embedder.embed(query);
  const scored: Array<{ entry: MemoryEntry; score: number }> = [];
  for (const e of entries) {
    const v = await embedder.embed(e.insight);
    if (v.length !== qv.length) continue;
    let dot = 0;
    for (let i = 0; i < v.length; i++) dot += (qv[i] ?? 0) * (v[i] ?? 0);
    scored.push({ entry: e, score: dot });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}

function recallByKeyword(entries: MemoryEntry[], query: string, limit: number): MemoryEntry[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  const scored: Array<{ entry: MemoryEntry; score: number }> = [];
  for (const e of entries) {
    const hay = e.insight.toLowerCase();
    let score = 0;
    for (const t of tokens) score += countOccurrences(hay, t);
    if (score > 0) scored.push({ entry: e, score });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.entry.consolidatedAt.localeCompare(a.entry.consolidatedAt);
  });
  return scored.slice(0, limit).map((s) => s.entry);
}

function parseTemporalLobe(raw: string, filePath: string): MemoryEntry | null {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;
  const fm = parseFrontmatter(fmMatch[1]!);
  const body = fmMatch[2]!;
  const insight = extractSection(body, "Insight") ?? body.trim();
  const filename = filePath.split("/").pop() ?? filePath;
  const id = /temporal-lobe-([0-9A-HJKMNP-TV-Z]{26})\.md$/i.exec(filename)?.[1] ?? "";
  return {
    id,
    nheId: fm.nheId ?? "",
    himId: fm.himId ?? "",
    classification: (fm.classification as MemoryClass) ?? "noise-distortion",
    teleologicalValue: Number(fm.teleologicalValue ?? 0),
    consolidatedAt: stripQuotes(fm.consolidatedAt ?? ""),
    sourceDreamRecord: stripQuotes(fm.sourceDreamRecord ?? ""),
    insight,
    filePath,
  };
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

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    count++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return count;
}
