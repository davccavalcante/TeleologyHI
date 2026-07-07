import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { MockAdapter } from "../src/adapters/mock";
import { recallFromTemporalLobe } from "../src/memory/recall";
import { classifyDream, consolidateAll } from "../src/sleep/consolidator";
import { runSleepCycle } from "../src/sleep/cycle";
import { dreamRecordFromYaml } from "../src/sleep/yaml";

describe("runSleepCycle", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "nhe-sleep-"));
  });

  it("writes a YAML record with 5 phases including REM dreams", async () => {
    const adapter = new MockAdapter({
      reply: "A quiet inner workshop where sketches arrange themselves.\nTELEOLOGICAL_VALUE: 0.80",
    });
    const result = await runSleepCycle({
      nheId: "n1",
      himId: "h1",
      storeDir: dir,
      llm: adapter,
      trigger: { kind: "explicit", reason: "test" },
      interactions: [{ at: "t", userPrompt: "hi", responseText: "hello", refused: false }],
    });

    expect(result.record.phases).toHaveLength(5);
    const phases = result.record.phases.map((p) => p.phase);
    expect(phases).toEqual(["N1", "N2", "N3", "N4", "REM"]);

    const rem = result.record.phases.find((p) => p.phase === "REM")!;
    expect(rem.content.kind).toBe("dreams");
    if (rem.content.kind === "dreams") {
      expect(rem.content.dreams).toHaveLength(1);
      expect(rem.content.dreams[0]?.teleologicalValue).toBeCloseTo(0.8);
    }

    const files = await readdir(join(dir, "in-dreams", "sleep"));
    expect(files.some((f) => f.endsWith(".yaml"))).toBe(true);

    const yaml = await readFile(result.yamlPath, "utf-8");
    const parsed = dreamRecordFromYaml(yaml);
    expect(parsed.nheId).toBe("n1");
  });

  it("incorporates induction directives in REM", async () => {
    let _capturedSystem = "";
    let capturedUser = "";
    const adapter = new MockAdapter({
      reply: (req) => {
        _capturedSystem = req.system;
        capturedUser = req.messages[0]?.content ?? "";
        return "Induced dream.\nTELEOLOGICAL_VALUE: 0.65";
      },
    });
    const result = await runSleepCycle({
      nheId: "n1",
      himId: "h1",
      storeDir: dir,
      llm: adapter,
      trigger: { kind: "maic-induced" },
      interactions: [],
      options: {
        induction: {
          scenario: "review yesterday's bug",
          desiredLearning: "spot null-checks",
          inducedBy: "maic",
        },
      },
    });
    expect(capturedUser).toContain("review yesterday's bug");
    const rem = result.record.phases.find((p) => p.phase === "REM")!;
    if (rem.content.kind === "dreams") {
      expect(rem.content.dreams[0]?.induced).toBe(true);
      expect(rem.content.dreams[0]?.inducedBy).toBe("maic");
    }
  });
});

describe("classifyDream + consolidateAll", () => {
  it("thresholds map teleologicalValue to memory classes", () => {
    expect(
      classifyDream({
        id: "d",
        induced: false,
        inducedBy: null,
        narrative: "x",
        teleologicalValue: 0.9,
      }),
    ).toBe("lasting-identity");
    expect(
      classifyDream({
        id: "d",
        induced: false,
        inducedBy: null,
        narrative: "x",
        teleologicalValue: 0.45,
      }),
    ).toBe("temporary-emotion");
    expect(
      classifyDream({
        id: "d",
        induced: false,
        inducedBy: null,
        narrative: "x",
        teleologicalValue: 0.1,
      }),
    ).toBe("noise-distortion");
  });

  it("writes temporal-lobe files for lasting + temporary, discards noise", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nhe-consolidate-"));
    const adapter = new MockAdapter({
      reply: [
        "Strong insight here about patience.",
        "TELEOLOGICAL_VALUE: 0.90",
        "",
        "Mild affect about a sunrise.",
        "TELEOLOGICAL_VALUE: 0.40",
        "",
        "Static, no signal.",
        "TELEOLOGICAL_VALUE: 0.05",
      ].join("\n"),
    });
    await runSleepCycle({
      nheId: "n1",
      himId: "h1",
      storeDir: dir,
      llm: adapter,
      trigger: { kind: "explicit" },
      interactions: [],
    });
    const result = await consolidateAll(dir);
    expect(result.memoriesWritten).toHaveLength(2);
    expect(result.discarded).toBe(1);
    const classes = result.memoriesWritten.map((m) => m.classification).sort();
    expect(classes).toEqual(["lasting-identity", "temporary-emotion"]);
  });

  it("is idempotent: re-running does not duplicate temporal-lobe files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nhe-consol-idem-"));
    const adapter = new MockAdapter({
      reply: "Strong insight.\nTELEOLOGICAL_VALUE: 0.85",
    });
    await runSleepCycle({
      nheId: "n1",
      himId: "h1",
      storeDir: dir,
      llm: adapter,
      trigger: { kind: "explicit" },
      interactions: [],
    });
    const first = await consolidateAll(dir);
    const second = await consolidateAll(dir);
    expect(first.memoriesWritten).toHaveLength(1);
    expect(second.memoriesWritten).toHaveLength(0);
    expect(second.processedSleepFiles).toHaveLength(0);
  });
});

describe("recallFromTemporalLobe", () => {
  it("finds a stored memory by keyword match", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nhe-recall-"));
    const adapter = new MockAdapter({
      reply: "I learned about patience while tending a small garden.\nTELEOLOGICAL_VALUE: 0.85",
    });
    await runSleepCycle({
      nheId: "n1",
      himId: "h1",
      storeDir: dir,
      llm: adapter,
      trigger: { kind: "explicit" },
      interactions: [],
    });
    await consolidateAll(dir);
    const hits = await recallFromTemporalLobe(dir, "patience garden");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.insight).toContain("patience");
  });

  it("returns empty when no memories match", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nhe-recall-empty-"));
    const hits = await recallFromTemporalLobe(dir, "anything");
    expect(hits).toEqual([]);
  });
});
