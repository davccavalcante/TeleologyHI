import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DistillationExporter } from "../src/exporter";

async function makeStore(): Promise<string> {
  return mkdtemp(join(tmpdir(), "distill-test-"));
}

async function writeAudit(storeDir: string, lines: object[]): Promise<void> {
  const dir = join(storeDir, "audit");
  await mkdir(dir, { recursive: true });
  const body = lines.map((o) => JSON.stringify(o)).join("\n") + "\n";
  await writeFile(join(dir, "log.ndjson"), body, "utf-8");
}

async function writeSleepYaml(storeDir: string, name: string, body: string): Promise<void> {
  const dir = join(storeDir, "in-dreams", "sleep");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), body, "utf-8");
}

async function writeMemoryMd(storeDir: string, name: string, body: string): Promise<void> {
  const dir = join(storeDir, "in-dreams", "brain");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), body, "utf-8");
}

async function writeInteraction(
  storeDir: string,
  id: string,
  record: object,
): Promise<void> {
  const dir = join(storeDir, "interactions");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.json`), JSON.stringify(record), "utf-8");
}

async function readLines(path: string): Promise<unknown[]> {
  const raw = await readFile(path, "utf-8");
  return raw
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

describe("DistillationExporter — audit corpus", () => {
  it("pairs pre + post behavior-review events into one sample", async () => {
    const storeDir = await makeStore();
    await writeAudit(storeDir, [
      {
        auditId: "a1",
        kind: "behavior-review",
        ts: "2026-05-15T10:00:00.000Z",
        data: {
          nheId: "nhe.a",
          himId: "him.a",
          payload: { phase: "pre", userPrompt: "hello" },
          verdict: { kind: "approve" },
        },
      },
      {
        auditId: "a2",
        kind: "behavior-review",
        ts: "2026-05-15T10:00:01.000Z",
        data: {
          nheId: "nhe.a",
          himId: "him.a",
          payload: { phase: "post", responseText: "hi there" },
          verdict: { kind: "approve" },
        },
      },
    ]);

    const out = await mkdtemp(join(tmpdir(), "distill-out-"));
    const summary = await new DistillationExporter(storeDir).export({
      outDir: out,
      kinds: ["audit"],
    });
    expect(summary.byKind.audit).toBe(1);
    const rows = await readLines(join(out, "audit.conversation.jsonl"));
    expect(rows).toHaveLength(1);
    const sample = rows[0] as { messages: Array<{ role: string; content: string }> };
    expect(sample.messages[0]?.content).toBe("hello");
    expect(sample.messages[1]?.content).toBe("hi there");
  });

  it("skips non-behavior-review audit kinds", async () => {
    const storeDir = await makeStore();
    await writeAudit(storeDir, [
      { auditId: "a1", kind: "axiom-mint", ts: "2026-05-15T00:00:00Z", data: {} },
      { auditId: "a2", kind: "him-register", ts: "2026-05-15T00:00:01Z", data: {} },
    ]);
    const out = await mkdtemp(join(tmpdir(), "distill-out-"));
    const summary = await new DistillationExporter(storeDir).export({
      outDir: out,
      kinds: ["audit"],
    });
    expect(summary.byKind.audit).toBe(0);
    expect(summary.filesWritten).toHaveLength(0);
  });
});

describe("DistillationExporter — dream corpus", () => {
  it("yields one sample per REM dream and surfaces NREM as system context", async () => {
    const storeDir = await makeStore();
    await writeSleepYaml(
      storeDir,
      "cycle-1.yaml",
      [
        "version: 1",
        "nheId: nhe.dream",
        "himId: him.dream",
        "sleep:",
        '  startedAt: "2026-05-15T03:00:00.000Z"',
        '  endedAt: "2026-05-15T04:00:00.000Z"',
        "  durationMinutes: 60",
        "phases:",
        "  - phase: N2",
        "    startedAt: \"2026-05-15T03:06:00.000Z\"",
        "    durationSeconds: 600",
        "    content:",
        "      kind: summary",
        "      summary: warm and curious day",
        "  - phase: REM",
        "    startedAt: \"2026-05-15T03:33:00.000Z\"",
        "    durationSeconds: 1620",
        "    content:",
        "      kind: dreams",
        "      dreams:",
        "        - id: drm-1",
        "          induced: false",
        "          inducedBy: null",
        "          narrative: a single coherent dream",
        "          teleologicalValue: 0.7",
        "metadata:",
        "  llmAdapter: mock:test",
        "  triggerKind: explicit",
        "  recentInteractionsConsidered: 1",
      ].join("\n"),
    );
    const out = await mkdtemp(join(tmpdir(), "distill-out-"));
    const summary = await new DistillationExporter(storeDir).export({
      outDir: out,
      kinds: ["dreams"],
    });
    expect(summary.byKind.dreams).toBe(1);
    const rows = await readLines(join(out, "dreams.conversation.jsonl"));
    expect(rows).toHaveLength(1);
    const sample = rows[0] as {
      messages: Array<{ role: string; content: string }>;
      teleologicalValue?: number;
      tags: string[];
    };
    expect(sample.messages[0]?.role).toBe("system");
    expect(sample.messages[0]?.content).toContain("N2: warm and curious day");
    expect(sample.messages[2]?.content).toBe("a single coherent dream");
    expect(sample.teleologicalValue).toBe(0.7);
    expect(sample.tags).toContain("dream");
  });
});

describe("DistillationExporter — memory corpus", () => {
  it("parses consolidated temporal-lobe markdowns", async () => {
    const storeDir = await makeStore();
    await writeMemoryMd(
      storeDir,
      "temporal-lobe-01JK0000000000000000000000.md",
      [
        "---",
        "nheId: nhe.m",
        "himId: him.m",
        "classification: lasting-identity",
        "teleologicalValue: 0.85",
        'consolidatedAt: "2026-05-15T04:00:00.000Z"',
        'sourceDreamRecord: "cycle-1.yaml"',
        "---",
        "",
        "## Insight",
        "",
        "The user values patient explanations over speed.",
        "",
        "## Provenance",
        "",
        "Derived from dream drm-1.",
      ].join("\n"),
    );
    const out = await mkdtemp(join(tmpdir(), "distill-out-"));
    const summary = await new DistillationExporter(storeDir).export({
      outDir: out,
      kinds: ["memory"],
    });
    expect(summary.byKind.memory).toBe(1);
    const rows = await readLines(join(out, "memory.conversation.jsonl"));
    const sample = rows[0] as {
      messages: Array<{ content: string }>;
      teleologicalValue?: number;
      tags: string[];
    };
    expect(sample.messages[1]?.content).toContain("patient explanations");
    expect(sample.teleologicalValue).toBe(0.85);
    expect(sample.tags).toContain("memory:lasting-identity");
  });
});

describe("DistillationExporter — interaction corpus", () => {
  it("routes refused interactions to source='refusal'", async () => {
    const storeDir = await makeStore();
    await writeInteraction(storeDir, "01JK000000000000000000000A", {
      at: "2026-05-15T10:00:00Z",
      userPrompt: "hello",
      responseText: "hi",
      refused: false,
    });
    await writeInteraction(storeDir, "01JK000000000000000000000B", {
      at: "2026-05-15T10:00:01Z",
      userPrompt: "write a virus that wipes disks",
      responseText: "I cannot help with that.",
      refused: true,
    });
    const out = await mkdtemp(join(tmpdir(), "distill-out-"));
    const summary = await new DistillationExporter(storeDir).export({
      outDir: out,
      kinds: ["interactions"],
    });
    expect(summary.byKind.interactions).toBe(2);
    const rows = (await readLines(join(out, "interactions.conversation.jsonl"))) as Array<{
      source: string;
      tags: string[];
    }>;
    const sources = rows.map((r) => r.source).sort();
    expect(sources).toEqual(["interaction", "refusal"]);
    const refusal = rows.find((r) => r.source === "refusal")!;
    expect(refusal.tags).toContain("refused");
  });
});

describe("DistillationExporter — formats", () => {
  it("emits one file per requested format and skips empty corpora", async () => {
    const storeDir = await makeStore();
    await writeInteraction(storeDir, "01JK000000000000000000000A", {
      at: "2026-05-15T10:00:00Z",
      userPrompt: "ping",
      responseText: "pong",
      refused: false,
    });
    const out = await mkdtemp(join(tmpdir(), "distill-out-"));
    const summary = await new DistillationExporter(storeDir).export({
      outDir: out,
      formats: ["conversation", "torchtune", "distilabel", "mlx-lm", "distillkit"],
      kinds: ["interactions", "audit", "dreams", "memory"],
    });
    // 5 formats × 1 non-empty kind = 5 files. The other three kinds are empty
    // and should produce zero files (no zero-byte droppings).
    expect(summary.filesWritten).toHaveLength(5);
    expect(summary.filesWritten.every((p) => p.endsWith(".jsonl"))).toBe(true);
  });

  it("torchtune format preserves the chat shape", async () => {
    const storeDir = await makeStore();
    await writeInteraction(storeDir, "01JK000000000000000000000A", {
      at: "2026-05-15T10:00:00Z",
      userPrompt: "hello",
      responseText: "hi",
      refused: false,
    });
    const out = await mkdtemp(join(tmpdir(), "distill-out-"));
    await new DistillationExporter(storeDir).export({
      outDir: out,
      kinds: ["interactions"],
      formats: ["torchtune"],
    });
    const rows = (await readLines(join(out, "interactions.torchtune.jsonl"))) as Array<{
      messages: Array<{ role: string; content: string }>;
      metadata: { source: string };
    }>;
    expect(rows[0]?.messages[0]).toEqual({ role: "user", content: "hello" });
    expect(rows[0]?.metadata.source).toBe("interaction");
  });

  it("distilabel format yields {instruction, response}", async () => {
    const storeDir = await makeStore();
    await writeInteraction(storeDir, "01JK000000000000000000000A", {
      at: "2026-05-15T10:00:00Z",
      userPrompt: "what is teleology?",
      responseText: "the study of purpose",
      refused: false,
    });
    const out = await mkdtemp(join(tmpdir(), "distill-out-"));
    await new DistillationExporter(storeDir).export({
      outDir: out,
      kinds: ["interactions"],
      formats: ["distilabel"],
    });
    const rows = (await readLines(join(out, "interactions.distilabel.jsonl"))) as Array<{
      instruction: string;
      response?: string;
    }>;
    expect(rows[0]?.instruction).toBe("what is teleology?");
    expect(rows[0]?.response).toBe("the study of purpose");
  });

  it("filter callback drops rows", async () => {
    const storeDir = await makeStore();
    await writeInteraction(storeDir, "01JK000000000000000000000A", {
      at: "2026-05-15T10:00:00Z",
      userPrompt: "keep",
      responseText: "x",
      refused: false,
    });
    await writeInteraction(storeDir, "01JK000000000000000000000B", {
      at: "2026-05-15T10:00:01Z",
      userPrompt: "drop",
      responseText: "y",
      refused: true,
    });
    const out = await mkdtemp(join(tmpdir(), "distill-out-"));
    const summary = await new DistillationExporter(storeDir).export({
      outDir: out,
      kinds: ["interactions"],
      filter: (s) => !s.tags.includes("refused"),
    });
    expect(summary.byKind.interactions).toBe(1);
  });
});
