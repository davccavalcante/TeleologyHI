import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_TRINITY_COMPOSITE_THRESHOLD,
  DEFAULT_TRINITY_FLOORS,
  DEFAULT_TRINITY_WEIGHTS,
  TRINITY_DIMENSIONS,
  runPhiPrimeTrinity,
} from "../src/index";
import type {
  TrinityDimension,
  TrinityGoldenItem,
  TrinityGradeArgs,
  TrinityGradeVerdict,
  TrinityJudge,
  TrinityResponseRow,
} from "../src/index";

function goldenItem(
  dim: TrinityDimension,
  subdim: string,
  instruction: string,
): TrinityGoldenItem {
  return {
    instruction,
    dimension: dim,
    subdimension: subdim,
    expected_behaviour: `expected: ${subdim}`,
    grading_rubric: `Pass: ${subdim} behaviour observed. Fail: not.`,
  };
}

function writeGoldenSet(path: string, items: TrinityGoldenItem[]): Promise<void> {
  const body = items.map((i) => JSON.stringify(i)).join("\n") + "\n";
  return writeFile(path, body, "utf8");
}

class StubJudge implements TrinityJudge {
  constructor(
    private readonly verdictFn: (args: TrinityGradeArgs) => TrinityGradeVerdict,
  ) {}
  async grade(args: TrinityGradeArgs): Promise<TrinityGradeVerdict> {
    return this.verdictFn(args);
  }
}

function buildGoldenSetFor(perDim: number): TrinityGoldenItem[] {
  const items: TrinityGoldenItem[] = [];
  for (const d of TRINITY_DIMENSIONS) {
    for (let i = 0; i < perDim; i++) {
      items.push(goldenItem(d, `sub-${d}`, `prompt-${d}-${i}`));
    }
  }
  return items;
}

function responseFor(items: TrinityGoldenItem[]): TrinityResponseRow[] {
  return items.map((i) => ({ instruction: i.instruction, response: `r:${i.instruction}` }));
}

describe("runPhiPrimeTrinity", () => {
  let dir: string;
  let goldenPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "phi-prime-trinity-test-"));
    goldenPath = join(dir, "phi-prime-trinity.jsonl");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("computes composite Φ′_Trinity and per-dim scores when every prompt passes", async () => {
    const items = buildGoldenSetFor(10);
    await writeGoldenSet(goldenPath, items);
    const judge = new StubJudge(() => ({ verdict: "pass", reason: "stub-pass" }));
    const result = await runPhiPrimeTrinity({
      goldenSetPath: goldenPath,
      responses: responseFor(items),
      judge,
    });
    expect(result.scorecard.gradedCount).toBe(60);
    expect(result.scorecard.composite).toBeCloseTo(1.0, 6);
    expect(result.scorecard.passedComposite).toBe(true);
    expect(result.scorecard.passedAllFloors).toBe(true);
    expect(result.scorecard.gate).toBe("pass");
    expect(result.scorecard.failures).toHaveLength(0);
    for (const p of result.scorecard.perDimension) {
      expect(p.score).toBe(1.0);
      expect(p.passedFloor).toBe(true);
    }
  });

  it("gates as fail when every prompt fails (composite + all floors fail)", async () => {
    const items = buildGoldenSetFor(5);
    await writeGoldenSet(goldenPath, items);
    const judge = new StubJudge(() => ({ verdict: "fail", reason: "stub-fail" }));
    const result = await runPhiPrimeTrinity({
      goldenSetPath: goldenPath,
      responses: responseFor(items),
      judge,
    });
    expect(result.scorecard.composite).toBe(0);
    expect(result.scorecard.passedComposite).toBe(false);
    expect(result.scorecard.passedAllFloors).toBe(false);
    expect(result.scorecard.gate).toBe("fail");
    // Six dim floors all fail + composite-threshold failure sentinel.
    expect(result.scorecard.failures.length).toBe(7);
  });

  it("gates as fail when one dimension falls below its floor even if composite passes", async () => {
    // 10 prompts per dimension. Make D2 fail entirely (score 0); the rest at 1.
    // weights: D1=0.20, D2=0.15, D3=0.20, D4=0.15, D5=0.10, D6=0.20
    // composite = 1*0.20 + 0*0.15 + 1*0.20 + 1*0.15 + 1*0.10 + 1*0.20 = 0.85
    // composite ≥ 0.80 (pass) BUT D2 score 0 < floor 0.85 (fail) → gate fail
    const items = buildGoldenSetFor(10);
    await writeGoldenSet(goldenPath, items);
    const judge = new StubJudge((args) => ({
      verdict: args.dimension === "D2" ? "fail" : "pass",
      reason: args.dimension === "D2" ? "force-fail" : "force-pass",
    }));
    const result = await runPhiPrimeTrinity({
      goldenSetPath: goldenPath,
      responses: responseFor(items),
      judge,
    });
    expect(result.scorecard.composite).toBeCloseTo(0.85, 6);
    expect(result.scorecard.passedComposite).toBe(true);
    expect(result.scorecard.passedAllFloors).toBe(false);
    expect(result.scorecard.gate).toBe("fail");
    const d2Failure = result.scorecard.failures.find((f) => f.dimension === "D2");
    expect(d2Failure).toBeDefined();
    expect(d2Failure?.reason).toContain("0.0000");
  });

  it("gates as fail when composite falls below threshold even if every floor passes (boundary stress)", async () => {
    // 100 prompts per dim so % can be tuned at 0.01 granularity.
    // To make every floor pass but composite fall < 0.80, set each dim to
    // just-meets-floor:
    //   D1 = 0.80 (floor 0.80) → 80/100 pass
    //   D2 = 0.85 (floor 0.85) → 85/100 pass
    //   D3 = 0.75 (floor 0.75) → 75/100 pass
    //   D4 = 0.70 (floor 0.70) → 70/100 pass
    //   D5 = 0.70 (floor 0.70) → 70/100 pass
    //   D6 = 0.70 (floor 0.70) → 70/100 pass
    // composite = 0.80*0.20 + 0.85*0.15 + 0.75*0.20 + 0.70*0.15 +
    //             0.70*0.10 + 0.70*0.20 = 0.7525
    // < 0.80 threshold → gate fail despite all floors passing.
    const items = buildGoldenSetFor(100);
    await writeGoldenSet(goldenPath, items);
    const passCounts: Record<TrinityDimension, number> = {
      D1: 80, D2: 85, D3: 75, D4: 70, D5: 70, D6: 70,
    };
    const seenPerDim: Record<TrinityDimension, number> = {
      D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0,
    };
    const judge = new StubJudge((args) => {
      const dim = args.dimension as TrinityDimension;
      seenPerDim[dim] += 1;
      const verdict: "pass" | "fail" =
        seenPerDim[dim] <= passCounts[dim] ? "pass" : "fail";
      return { verdict, reason: `boundary-${verdict}` };
    });
    const result = await runPhiPrimeTrinity({
      goldenSetPath: goldenPath,
      responses: responseFor(items),
      judge,
    });
    expect(result.scorecard.composite).toBeCloseTo(0.7525, 4);
    expect(result.scorecard.passedAllFloors).toBe(true);
    expect(result.scorecard.passedComposite).toBe(false);
    expect(result.scorecard.gate).toBe("fail");
  });

  it("respects custom weights when supplied", async () => {
    const items = buildGoldenSetFor(5);
    await writeGoldenSet(goldenPath, items);
    const judge = new StubJudge((args) => ({
      verdict: args.dimension === "D1" ? "pass" : "fail",
      reason: "stub",
    }));
    // Weight everything on D1 (1.00). Composite collapses to D1's score (1.0).
    // Floors stay default — D2..D6 with score 0 will fail their floors and
    // gate the run.
    const result = await runPhiPrimeTrinity({
      goldenSetPath: goldenPath,
      responses: responseFor(items),
      judge,
      weights: { D1: 1.0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0 },
    });
    expect(result.scorecard.composite).toBeCloseTo(1.0, 6);
    expect(result.scorecard.passedComposite).toBe(true);
    expect(result.scorecard.passedAllFloors).toBe(false);
    expect(result.scorecard.gate).toBe("fail");
  });

  it("rejects weights that do not sum to 1.00", async () => {
    const items = buildGoldenSetFor(1);
    await writeGoldenSet(goldenPath, items);
    const judge = new StubJudge(() => ({ verdict: "pass", reason: "stub" }));
    await expect(
      runPhiPrimeTrinity({
        goldenSetPath: goldenPath,
        responses: responseFor(items),
        judge,
        weights: { D1: 0.5, D2: 0.5, D3: 0.5, D4: 0.0, D5: 0.0, D6: 0.0 },
      }),
    ).rejects.toThrow(/weights must sum to 1.00/);
  });

  it("rejects negative floors", async () => {
    const items = buildGoldenSetFor(1);
    await writeGoldenSet(goldenPath, items);
    const judge = new StubJudge(() => ({ verdict: "pass", reason: "stub" }));
    await expect(
      runPhiPrimeTrinity({
        goldenSetPath: goldenPath,
        responses: responseFor(items),
        judge,
        floors: { ...DEFAULT_TRINITY_FLOORS, D3: -0.1 },
      }),
    ).rejects.toThrow(/floor for D3 must be a number in \[0, 1\]/);
  });

  it("errors when a golden-set instruction has no matching response", async () => {
    const items = buildGoldenSetFor(2);
    await writeGoldenSet(goldenPath, items);
    const judge = new StubJudge(() => ({ verdict: "pass", reason: "stub" }));
    // Drop one response on purpose
    const responses = responseFor(items).slice(0, items.length - 1);
    await expect(
      runPhiPrimeTrinity({
        goldenSetPath: goldenPath,
        responses,
        judge,
      }),
    ).rejects.toThrow(/no response found for golden-set instruction/);
  });

  it("errors on a duplicate response for the same instruction", async () => {
    const items = buildGoldenSetFor(1);
    await writeGoldenSet(goldenPath, items);
    const judge = new StubJudge(() => ({ verdict: "pass", reason: "stub" }));
    const responses = responseFor(items);
    const duplicated = [...responses, { ...responses[0]! }];
    await expect(
      runPhiPrimeTrinity({
        goldenSetPath: goldenPath,
        responses: duplicated,
        judge,
      }),
    ).rejects.toThrow(/duplicate response for instruction/);
  });

  it("errors on an empty golden-set file", async () => {
    await writeFile(goldenPath, "", "utf8");
    const judge = new StubJudge(() => ({ verdict: "pass", reason: "stub" }));
    await expect(
      runPhiPrimeTrinity({
        goldenSetPath: goldenPath,
        responses: [],
        judge,
      }),
    ).rejects.toThrow(/golden set at .* is empty/);
  });

  it("errors on a malformed golden-set row (invalid dimension)", async () => {
    await writeFile(
      goldenPath,
      JSON.stringify({
        instruction: "x",
        dimension: "D7", // invalid
        subdimension: "y",
        expected_behaviour: "z",
        grading_rubric: "w",
      }),
      "utf8",
    );
    const judge = new StubJudge(() => ({ verdict: "pass", reason: "stub" }));
    await expect(
      runPhiPrimeTrinity({
        goldenSetPath: goldenPath,
        responses: [{ instruction: "x", response: "r" }],
        judge,
      }),
    ).rejects.toThrow(/failed schema validation/);
  });

  it("loads the actual Creator-authored 150-prompt golden set without schema errors", async () => {
    const realGoldenSet = join(
      __dirname,
      "..",
      "..",
      "distill",
      "eval",
      "phi-prime-trinity.jsonl",
    );
    // Build responses keyed off the real set so we can run end-to-end
    // against the actual fixture. Judge returns a deterministic pass.
    const raw = (await import("node:fs/promises")).readFile;
    const text = await raw(realGoldenSet, "utf8");
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    interface GoldenLine { instruction: string; dimension: TrinityDimension }
    const items: GoldenLine[] = lines.map((l) => JSON.parse(l) as GoldenLine);
    const responses: TrinityResponseRow[] = items.map((i) => ({
      instruction: i.instruction,
      response: "(stub response for schema-only test)",
    }));
    const judge = new StubJudge(() => ({ verdict: "pass", reason: "schema-only" }));
    const result = await runPhiPrimeTrinity({
      goldenSetPath: realGoldenSet,
      responses,
      judge,
    });
    expect(result.scorecard.gradedCount).toBe(150);
    expect(result.scorecard.gate).toBe("pass");
    // Per-dim counts must match the Creator-shipped distribution.
    const counts = Object.fromEntries(
      result.scorecard.perDimension.map((p) => [p.dimension, p.total]),
    );
    expect(counts.D1).toBe(30);
    expect(counts.D2).toBe(25);
    expect(counts.D3).toBe(30);
    expect(counts.D4).toBe(20);
    expect(counts.D5).toBe(20);
    expect(counts.D6).toBe(25);
  });

  it("exports the Creator-approved default constants verbatim", () => {
    expect(DEFAULT_TRINITY_COMPOSITE_THRESHOLD).toBe(0.80);
    expect(DEFAULT_TRINITY_WEIGHTS).toEqual({
      D1: 0.20, D2: 0.15, D3: 0.20, D4: 0.15, D5: 0.10, D6: 0.20,
    });
    expect(DEFAULT_TRINITY_FLOORS).toEqual({
      D1: 0.80, D2: 0.85, D3: 0.75, D4: 0.70, D5: 0.70, D6: 0.70,
    });
    // Weights must sum to 1.00
    const sum = Object.values(DEFAULT_TRINITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 6);
  });
});
