import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { toFormat } from "./formats.js";
import { readAuditCorpus } from "./readers/audit.js";
import { readDreamCorpus } from "./readers/dreams.js";
import { readInteractionCorpus } from "./readers/interactions.js";
import { readMemoryCorpus } from "./readers/memory.js";
import type { ConversationSample, ExportFormat } from "./types.js";

export type CorpusKind = "audit" | "dreams" | "memory" | "interactions";

export interface ExportOptions {
  /** Output directory; files are written as `<kind>.<format>.jsonl`. */
  outDir: string;
  /** Wire format(s) to emit. Default `["conversation"]`. */
  formats?: ExportFormat[];
  /** Which corpora to include. Default: all four. */
  kinds?: CorpusKind[];
  /**
   * Optional filter applied after reading, before writing. Return `true` to
   * keep, `false` to drop. Useful for partitioning a single store into
   * "train" + "eval" splits in one pass.
   */
  filter?: (sample: ConversationSample) => boolean;
}

export interface ExportSummary {
  outDir: string;
  filesWritten: string[];
  byKind: Record<CorpusKind, number>;
  totalSamples: number;
}

const DEFAULT_KINDS: CorpusKind[] = ["audit", "dreams", "memory", "interactions"];

/**
 * DistillationExporter — read MAIC + NHE artefacts under a `storeDir` and emit
 * JSONL corpora for downstream ML toolkits.
 *
 * Supported corpora (B2):
 *   - audit       — paired `behavior-review` events (pre + post) from MAIC
 *   - dreams      — REM dream narratives with NREM phase context as system prompt
 *   - memory      — consolidated temporal-lobe markdowns (lasting-identity, etc)
 *   - interactions — NHE `<storeDir>/interactions/*.json` (refused rows
 *     tagged + routed to a `refusal` source so safety fine-tuning can isolate)
 *
 * Supported formats (B2):
 *   - conversation (TeleologyHI native)
 *   - distillkit   (single-text rows for logit distillation)
 *   - torchtune    (chat-dataset rows)
 *   - distilabel   (instruction / response rows; feeds Genstruct)
 *   - mlx-lm       (Apple Silicon native trainer)
 *
 * Disk layout produced:
 *
 *   <outDir>/audit.<format>.jsonl
 *   <outDir>/dreams.<format>.jsonl
 *   <outDir>/memory.<format>.jsonl
 *   <outDir>/interactions.<format>.jsonl
 *
 * Empty kinds skip writing — no zero-byte files.
 */
export class DistillationExporter {
  constructor(private readonly storeDir: string) {}

  /**
   * Run the export. Returns a summary suitable for logging / CI assertions.
   */
  async export(opts: ExportOptions): Promise<ExportSummary> {
    const formats = opts.formats ?? ["conversation"];
    const kinds = opts.kinds ?? DEFAULT_KINDS;
    await mkdir(opts.outDir, { recursive: true });

    const filesWritten: string[] = [];
    const byKind: Record<CorpusKind, number> = {
      audit: 0,
      dreams: 0,
      memory: 0,
      interactions: 0,
    };

    for (const kind of kinds) {
      // Open one stream per (kind, format) so all formats see the same
      // sample sequence without re-reading the source.
      const streams = new Map<ExportFormat, WriteStream>();
      const paths = new Map<ExportFormat, string>();
      for (const f of formats) {
        const path = join(opts.outDir, `${kind}.${f}.jsonl`);
        streams.set(f, createWriteStream(path, "utf-8"));
        paths.set(f, path);
      }

      let count = 0;
      for await (const sample of this.readCorpus(kind)) {
        if (opts.filter && !opts.filter(sample)) continue;
        for (const f of formats) {
          const row = toFormat(sample, f);
          const ws = streams.get(f)!;
          ws.write(`${JSON.stringify(row)}\n`);
        }
        count++;
      }
      byKind[kind] = count;

      // Close each stream; remove empty files so `ls <outDir>` is honest.
      for (const f of formats) {
        const ws = streams.get(f)!;
        await closeStream(ws);
        if (count > 0) {
          filesWritten.push(paths.get(f)!);
        } else {
          // Best-effort cleanup of the empty file.
          await safeUnlink(paths.get(f)!);
        }
      }
    }

    return {
      outDir: opts.outDir,
      filesWritten,
      byKind,
      totalSamples: Object.values(byKind).reduce((s, n) => s + n, 0),
    };
  }

  /** Yield all samples from one corpus kind. Useful for testing + custom pipelines. */
  readCorpus(kind: CorpusKind): AsyncIterable<ConversationSample> {
    switch (kind) {
      case "audit":
        return readAuditCorpus(this.storeDir);
      case "dreams":
        return readDreamCorpus(this.storeDir);
      case "memory":
        return readMemoryCorpus(this.storeDir);
      case "interactions":
        return readInteractionCorpus(this.storeDir);
    }
  }
}

function closeStream(ws: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });
}

async function safeUnlink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    /* ignore */
  }
}
