import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ulid } from "ulid";
import type { Dream, DreamRecord, MemoryClass, MemoryEntry } from "./types.js";
import { dreamRecordFromYaml } from "./yaml.js";

export interface ConsolidationResult {
  processedSleepFiles: string[];
  memoriesWritten: MemoryEntry[];
  discarded: number;
}

export interface ClassificationThresholds {
  /** teleologicalValue >= this → lasting-identity. Default 0.6. */
  lastingIdentity?: number;
  /** teleologicalValue >= this → temporary-emotion. Default 0.3. */
  temporaryEmotion?: number;
  /**
   * Override the traumatic-knowledge detector. When `true`, any dream that
   * matches `TRAUMATIC_PATTERNS` AND has `teleologicalValue >= traumaticMin`
   * is classified as `traumatic-knowledge` regardless of the
   * lasting-identity / temporary-emotion thresholds. Default `true`.
   */
  detectTraumatic?: boolean;
  /** Floor on teleologicalValue before traumatic-knowledge can fire. Default 0.4. */
  traumaticMin?: number;
}

/**
 * Lexical heuristic for traumatic-knowledge detection (D-N2, Entry 9).
 *
 * A reliable classifier needs a labelled dataset; this regex is the
 * minimum-viable initial detector that lets the four-class taxonomy be
 * active end-to-end. Operators expecting clinical-grade detection should
 * swap in a learned model behind the same `classifyDream` signature.
 *
 * Coverage: death/grief/loss, abuse/violence, betrayal/abandonment, fear/
 * terror/panic, regret/shame, suicide/self-harm. The intent is to err on
 * the side of *flagging*: traumatic memories are written but NOT recalled
 * by `recallFromTemporalLobe` unless the caller explicitly opts in via
 * `classes: ["traumatic-knowledge"]`.
 */
export const TRAUMATIC_PATTERNS =
  /\b(death|dying|died|murder|kill(ed|ing)?|grief|griev(ed|ing)?|mourn(ed|ing)?|loss|lost (a|my)|orphan(ed)?|abandon(ed|ing|ment)?|betray(ed|ing|al)?|abus(ed|er|ive|e)?|violen(ce|t)|trauma(tic|tised)?|fear(ful|ed)?|terror(ised|ized)?|panic(ked)?|regret(ted|ting)?|shame(d|ful)?|suici(de|dal)|self[- ]harm|cutting myself|harm(ed|ing)? (myself|themselves))\b/i;

/**
 * Classify a single dream. Four classes:
 *   - `traumatic-knowledge`, fires when the narrative matches
 *     `TRAUMATIC_PATTERNS` AND `teleologicalValue >= traumaticMin`. Default
 *     can be disabled via `detectTraumatic: false`.
 *   - `lasting-identity` , teleologicalValue >= lastingIdentity threshold.
 *   - `temporary-emotion`, teleologicalValue >= temporaryEmotion threshold.
 *   - `noise-distortion` , below both.
 *
 * Traumatic-knowledge is checked BEFORE the value thresholds so a
 * high-value dream about loss doesn't get filed as lasting-identity.
 */
export function classifyDream(dream: Dream, th: ClassificationThresholds = {}): MemoryClass {
  const hi = th.lastingIdentity ?? 0.6;
  const lo = th.temporaryEmotion ?? 0.3;
  const detectTraumatic = th.detectTraumatic ?? true;
  const traumaticMin = th.traumaticMin ?? 0.4;

  if (
    detectTraumatic &&
    dream.teleologicalValue >= traumaticMin &&
    TRAUMATIC_PATTERNS.test(dream.narrative)
  ) {
    return "traumatic-knowledge";
  }
  if (dream.teleologicalValue >= hi) return "lasting-identity";
  if (dream.teleologicalValue >= lo) return "temporary-emotion";
  return "noise-distortion";
}

/**
 * Walk the unprocessed sleep YAML files under <storeDir>/in-dreams/sleep,
 * classify each REM dream, and write the lasting/temporary memories to
 * <storeDir>/in-dreams/brain/temporal-lobe-<ulid>.md.
 *
 * A file is considered "unprocessed" if a marker .done file is absent next
 * to it. The current implementation marks processed files inline (file.yaml.done sentinel).
 */
export async function consolidateAll(
  storeDir: string,
  thresholds: ClassificationThresholds = {},
): Promise<ConsolidationResult> {
  const sleepDir = join(storeDir, "in-dreams", "sleep");
  const brainDir = join(storeDir, "in-dreams", "brain");
  await mkdir(brainDir, { recursive: true });

  let entries: string[];
  try {
    entries = await readdir(sleepDir);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { processedSleepFiles: [], memoriesWritten: [], discarded: 0 };
    }
    throw err;
  }

  const yamlFiles = entries.filter((f) => f.endsWith(".yaml") && !entries.includes(`${f}.done`));

  const processedSleepFiles: string[] = [];
  const memoriesWritten: MemoryEntry[] = [];
  let discarded = 0;

  for (const fname of yamlFiles) {
    const fpath = join(sleepDir, fname);
    const raw = await readFile(fpath, "utf-8");
    const record: DreamRecord = dreamRecordFromYaml(raw);

    const remPhase = record.phases.find((p) => p.phase === "REM");
    if (!remPhase || remPhase.content.kind !== "dreams") {
      await writeFile(`${fpath}.done`, "", "utf-8");
      processedSleepFiles.push(fname);
      continue;
    }

    for (const dream of remPhase.content.dreams) {
      const cls = classifyDream(dream, thresholds);
      if (cls === "noise-distortion") {
        discarded++;
        continue;
      }
      const entry = await writeTemporalLobe(brainDir, record, dream, cls, fname);
      memoriesWritten.push(entry);
    }

    await writeFile(`${fpath}.done`, "", "utf-8");
    processedSleepFiles.push(fname);
  }

  return { processedSleepFiles, memoriesWritten, discarded };
}

async function writeTemporalLobe(
  brainDir: string,
  record: DreamRecord,
  dream: Dream,
  classification: MemoryClass,
  sourceFile: string,
): Promise<MemoryEntry> {
  const id = ulid();
  const consolidatedAt = new Date().toISOString();
  const filename = `temporal-lobe-${id}.md`;
  const filePath = join(brainDir, filename);

  const body = [
    "---",
    `nheId: ${record.nheId}`,
    `himId: ${record.himId}`,
    `consolidatedAt: "${consolidatedAt}"`,
    `sourceDreamRecord: "${sourceFile}"`,
    `dreamId: ${dream.id}`,
    `classification: ${classification}`,
    `teleologicalValue: ${dream.teleologicalValue}`,
    `induced: ${dream.induced}`,
    `inducedBy: ${dream.inducedBy ?? "null"}`,
    "---",
    "",
    `# Temporal Lobe Memory, ${consolidatedAt.slice(0, 10)}`,
    "",
    "## Insight",
    "",
    dream.narrative,
    "",
  ].join("\n");

  await writeFile(filePath, body, "utf-8");

  return {
    id,
    nheId: record.nheId,
    himId: record.himId,
    classification,
    teleologicalValue: dream.teleologicalValue,
    consolidatedAt,
    sourceDreamRecord: sourceFile,
    insight: dream.narrative,
    filePath,
  };
}
