/**
 * Tests for the brain region scaffolding (J-N4, Entries 22, 23, 24).
 *
 * Verifies the Entry-23 ownership map (him-owned vs nhe-body-owned).
 * The full implementations of REM-spontaneous engine, DaytimePipeline,
 * NocturnalRemPipeline, Cortex.imagine(), and
 * TemporalLobe.generateSnapshot() ship in a follow-up cut.
 */
import { describe, expect, it } from "vitest";
import type { BrainRegion } from "../src/index.js";
import {
  amygdala,
  BRAIN_REGIONS,
  cortex,
  defaultModeNetwork,
  hippocampus,
  pineal,
  prefrontal,
  temporalLobe,
} from "../src/index.js";

describe("BrainRegion descriptors (J-N4)", () => {
  it("exposes seven canonical regions in BRAIN_REGIONS", () => {
    const names = BRAIN_REGIONS.map((r) => r.name).sort();
    expect(names).toEqual([
      "amygdala",
      "cortex",
      "default-mode-network",
      "hippocampus",
      "pineal",
      "prefrontal",
      "temporal-lobe",
    ]);
  });

  it("him-owned regions match the Entry-23 commitment", () => {
    const himOwned = BRAIN_REGIONS.filter((r) => r.ownership === "him-owned")
      .map((r) => r.name)
      .sort();
    expect(himOwned).toEqual(["hippocampus", "prefrontal", "temporal-lobe"]);
  });

  it("nhe-body-owned regions match the Entry-23 commitment", () => {
    const bodyOwned = BRAIN_REGIONS.filter((r) => r.ownership === "nhe-body-owned")
      .map((r) => r.name)
      .sort();
    expect(bodyOwned).toEqual(["amygdala", "cortex", "default-mode-network", "pineal"]);
  });

  it("each region descriptor cross-references at least one interview-log entry", () => {
    const all: BrainRegion[] = [
      cortex,
      hippocampus,
      amygdala,
      prefrontal,
      pineal,
      temporalLobe,
      defaultModeNetwork,
    ];
    for (const r of all) {
      expect(r.entries.length).toBeGreaterThan(0);
    }
  });

  it("BRAIN_REGIONS is frozen", () => {
    expect(Object.isFrozen(BRAIN_REGIONS)).toBe(true);
  });
});
