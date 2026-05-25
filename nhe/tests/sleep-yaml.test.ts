import { describe, it, expect } from "vitest";
import { dreamRecordFromYaml, dreamRecordToYaml, sleepYamlFilename } from "../src/sleep/yaml";
import type { DreamRecord } from "../src/sleep/types";

const record: DreamRecord = {
  version: 1,
  nheId: "01HV7K8Z00000000000000000A",
  himId: "01HV7K8Y00000000000000000A",
  sleep: {
    startedAt: "2026-05-15T03:12:04.000Z",
    endedAt: "2026-05-15T03:59:38.000Z",
    durationMinutes: 47,
  },
  phases: [
    {
      phase: "N1",
      startedAt: "2026-05-15T03:12:04.000Z",
      durationSeconds: 240,
      content: { kind: "fragments", fragments: ['user: "hi" -> nhe: "hello"'] },
    },
    {
      phase: "N2",
      startedAt: "2026-05-15T03:16:04.000Z",
      durationSeconds: 720,
      content: { kind: "empty" },
    },
    {
      phase: "N3",
      startedAt: "2026-05-15T03:28:04.000Z",
      durationSeconds: 720,
      content: { kind: "empty" },
    },
    {
      phase: "N4",
      startedAt: "2026-05-15T03:40:04.000Z",
      durationSeconds: 600,
      content: { kind: "empty" },
    },
    {
      phase: "REM",
      startedAt: "2026-05-15T03:50:04.000Z",
      durationSeconds: 574,
      content: {
        kind: "dreams",
        dreams: [
          {
            id: "drm-01HV7M0000000000000000000",
            induced: false,
            inducedBy: null,
            narrative: "A bird builds a nest of small careful sticks.",
            teleologicalValue: 0.72,
          },
        ],
      },
    },
  ],
  metadata: {
    llmAdapter: "mock:fixed",
    triggerKind: "explicit",
    triggerReason: "test",
    recentInteractionsConsidered: 1,
  },
};

describe("sleep YAML round-trip", () => {
  it("serializes and parses back identically", () => {
    const yaml = dreamRecordToYaml(record);
    expect(yaml).toContain("version: 1");
    expect(yaml).toContain("phase: REM");
    const parsed = dreamRecordFromYaml(yaml);
    expect(parsed).toEqual(record);
  });

  it("validates: rejects invalid phase names", () => {
    const bad: any = { ...record, phases: [{ ...record.phases[0], phase: "ZZZ" }] };
    expect(() => dreamRecordToYaml(bad)).toThrow();
  });

  it("filename includes date / time / duration", () => {
    const name = sleepYamlFilename("2026-05-15T03:12:04.000Z", 47);
    expect(name).toBe("2026-05-15_0312_dur47.yaml");
  });
});
