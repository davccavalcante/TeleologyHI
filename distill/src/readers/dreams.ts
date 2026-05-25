import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { ConversationSample } from "../types.js";

interface PartialDreamRecord {
  nheId?: string;
  himId?: string;
  sleep?: { startedAt?: string };
  phases?: Array<{
    phase?: string;
    content?:
      | { kind: "empty" }
      | { kind: "fragments"; fragments?: string[] }
      | { kind: "summary"; summary?: string }
      | {
          kind: "dreams";
          dreams?: Array<{
            id?: string;
            narrative?: string;
            teleologicalValue?: number;
            induced?: boolean;
            inducedBy?: string | null;
          }>;
        };
  }>;
}

/**
 * Read every sleep YAML under `<storeDir>/<nheId>/in-dreams/sleep/*.yaml` or
 * `<storeDir>/in-dreams/sleep/*.yaml` and yield one `ConversationSample` per
 * REM dream. The `system` slot carries the NREM context (N2/N3/N4 summaries)
 * when present, so a downstream trainer can teach a student to produce dreams
 * with the same emotional/identity/discard framing.
 */
export async function* readDreamCorpus(
  storeDir: string,
): AsyncIterable<ConversationSample> {
  for await (const yamlPath of walkSleepYamls(storeDir)) {
    let text: string;
    try {
      text = await readFile(yamlPath, "utf-8");
    } catch {
      continue;
    }
    let record: PartialDreamRecord;
    try {
      record = parse(text) as PartialDreamRecord;
    } catch {
      continue;
    }
    const nheId = record.nheId ?? "";
    const himId = record.himId ?? "";
    const ts = record.sleep?.startedAt ?? new Date(0).toISOString();

    // Collect NREM summaries to use as system context for each REM dream.
    const nremSummaries: string[] = [];
    let dreams: NonNullable<NonNullable<PartialDreamRecord["phases"]>[number]["content"]> | null = null;
    for (const p of record.phases ?? []) {
      const c = p.content;
      if (!c) continue;
      if (c.kind === "summary" && c.summary) {
        nremSummaries.push(`${p.phase}: ${c.summary}`);
      } else if (c.kind === "dreams") {
        dreams = c;
      }
    }
    if (!dreams || dreams.kind !== "dreams") continue;

    const system = nremSummaries.length
      ? `NREM summaries from this sleep cycle:\n${nremSummaries.join("\n")}`
      : "";

    for (const d of dreams.dreams ?? []) {
      const narrative = d.narrative ?? "";
      if (!narrative) continue;
      const tags: string[] = ["dream"];
      if (d.induced) tags.push("induced");
      if (d.inducedBy) tags.push(`induced-by:${d.inducedBy}`);
      yield {
        id: d.id ?? ts,
        source: "dream",
        ...(d.id ? { sourceId: d.id } : {}),
        ...(nheId ? { nheId } : {}),
        ...(himId ? { himId } : {}),
        ts,
        tags,
        messages: [
          ...(system ? ([{ role: "system" as const, content: system }] as const) : []),
          {
            role: "user",
            content: "Recall and narrate a single dream from the recent sleep cycle.",
          },
          { role: "assistant", content: narrative },
        ],
        ...(typeof d.teleologicalValue === "number"
          ? { teleologicalValue: d.teleologicalValue }
          : {}),
      };
    }
  }
}

async function* walkSleepYamls(storeDir: string): AsyncIterable<string> {
  // Try `<storeDir>/in-dreams/sleep` first (single-NHE layout used by the
  // bootstrap CLI), then `<storeDir>/<nheId>/in-dreams/sleep` (per-NHE layout).
  yield* listSleep(join(storeDir, "in-dreams", "sleep"));
  let nheDirs: string[];
  try {
    nheDirs = await readdir(storeDir);
  } catch {
    return;
  }
  for (const sub of nheDirs) {
    yield* listSleep(join(storeDir, sub, "in-dreams", "sleep"));
  }
}

async function* listSleep(dir: string): AsyncIterable<string> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const f of entries) {
    if (f.endsWith(".yaml")) yield join(dir, f);
  }
}
