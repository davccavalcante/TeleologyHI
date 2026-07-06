import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { SEED_AXIOMS } from "../src/axioms/seed";
import { LocalMaic } from "../src/client/local";
import { EU_AI_ACT_MAPPING, ISO_42001_MAPPING } from "../src/compliance/mapper";
import { CreatorKeyring } from "../src/creator/keyring";
import type {
  BehaviorReport,
  BirthSignature,
  DreamInductionIntent,
  NheLifecycleRequest,
} from "../src/types";

const bsig = (id: string): BirthSignature => ({
  himId: id,
  bornAt: new Date().toISOString(),
  primaryArchetype: "aries-sun",
  modifiers: [],
  primordialAxiomIds: [],
});

const behaviorReport = (overrides: Partial<BehaviorReport> = {}): BehaviorReport => ({
  nheId: "n1",
  himId: "h1",
  actionKind: "user-response",
  payload: {},
  reasoningTrace: [],
  riskTags: [],
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe("ComplianceMapper, declarative mapping tables", () => {
  it("ISO 42001 maps every audit kind to at least one control", () => {
    for (const kind of Object.keys(ISO_42001_MAPPING)) {
      const ctrls = ISO_42001_MAPPING[kind as keyof typeof ISO_42001_MAPPING];
      expect(ctrls.length).toBeGreaterThan(0);
    }
  });

  it("EU AI Act maps every audit kind to at least one article", () => {
    for (const kind of Object.keys(EU_AI_ACT_MAPPING)) {
      const arts = EU_AI_ACT_MAPPING[kind as keyof typeof EU_AI_ACT_MAPPING];
      expect(arts.length).toBeGreaterThan(0);
    }
  });

  it("ISO_42001_MAPPING and EU_AI_ACT_MAPPING cover the same kinds", () => {
    expect(Object.keys(ISO_42001_MAPPING).sort()).toEqual(Object.keys(EU_AI_ACT_MAPPING).sort());
  });
});

describe("LocalMaic.toCompliance, end-to-end", () => {
  let dir: string;
  let kr: CreatorKeyring;
  let maic: LocalMaic;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-compliance-"));
    kr = CreatorKeyring.generate();
    maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  });

  it("empty audit log produces an empty report with zero events", async () => {
    const r = await maic.toCompliance("iso-42001");
    expect(r.framework).toBe("iso-42001");
    expect(r.totalEvents).toBe(0);
    expect(r.mappedEvents).toBe(0);
    expect(r.controls).toEqual([]);
    expect(r.uncoveredKinds).toEqual([]);
  });

  it("every seed axiom-mint surfaces under ISO §5.2 (policy) and §7.5 (docs)", async () => {
    await maic.seed(kr);
    const r = await maic.toCompliance("iso-42001");
    const ctrls = Object.fromEntries(r.controls.map((c) => [c.control, c]));
    expect(ctrls["5.2"]?.count).toBe(SEED_AXIOMS.length);
    expect(ctrls["7.5"]?.count).toBe(SEED_AXIOMS.length);
    expect(ctrls["5.2"]?.events[0]?.kind).toBe("axiom-mint");
    expect(ctrls["5.2"]?.events[0]?.summary).toMatch(/Axiom minted/);
  });

  it("EU AI Act projects seed mints under Art 11 (technical documentation)", async () => {
    await maic.seed(kr);
    const r = await maic.toCompliance("eu-ai-act");
    const ctrls = Object.fromEntries(r.controls.map((c) => [c.control, c]));
    expect(ctrls["art-11"]?.count).toBe(SEED_AXIOMS.length);
    expect(ctrls["art-13"]?.count).toBe(SEED_AXIOMS.length);
  });

  it("behavior-review events surface under §7.5 + §8.3 (ISO) and Art 12 + Art 14 (EU)", async () => {
    await maic.reviewBehavior(behaviorReport());
    const iso = await maic.toCompliance("iso-42001");
    const isoCtrls = Object.fromEntries(iso.controls.map((c) => [c.control, c]));
    expect(isoCtrls["7.5"]?.count).toBeGreaterThanOrEqual(1);
    expect(isoCtrls["8.3"]?.count).toBeGreaterThanOrEqual(1);

    const eu = await maic.toCompliance("eu-ai-act");
    const euCtrls = Object.fromEntries(eu.controls.map((c) => [c.control, c]));
    expect(euCtrls["art-12"]?.count).toBeGreaterThanOrEqual(1);
    expect(euCtrls["art-14"]?.count).toBeGreaterThanOrEqual(1);
  });

  it("lifecycle terminate surfaces under §10.1 (ISO) and Art 14 (EU)", async () => {
    const req: NheLifecycleRequest = { op: "terminate", nheId: "n1", reason: "drift" };
    await maic.terminate("n1", "drift", kr.sign(req, 1));

    const iso = await maic.toCompliance("iso-42001");
    const isoCtrls = Object.fromEntries(iso.controls.map((c) => [c.control, c]));
    expect(isoCtrls["10.1"]?.events.some((e) => e.kind === "terminate")).toBe(true);

    const eu = await maic.toCompliance("eu-ai-act");
    const euCtrls = Object.fromEntries(eu.controls.map((c) => [c.control, c]));
    expect(euCtrls["art-14"]?.events.some((e) => e.kind === "terminate")).toBe(true);
  });

  it("dream-induce surfaces under §8.3/§9.1 (ISO) and Art 14 (EU)", async () => {
    const intent: DreamInductionIntent = {
      scenario: "x",
      desiredLearning: "y",
      inducedBy: "maic",
    };
    await maic.induceDream("n1", intent);

    const iso = await maic.toCompliance("iso-42001");
    const ctrls = Object.fromEntries(iso.controls.map((c) => [c.control, c]));
    expect(ctrls["8.3"]?.events.some((e) => e.kind === "dream-induce")).toBe(true);
    expect(ctrls["9.1"]?.events.some((e) => e.kind === "dream-induce")).toBe(true);
  });

  it("him-register + him-reincarnate are projected correctly", async () => {
    const sig = bsig("him.r");
    await maic.registerHim(sig, kr.sign(sig, 1));
    const req = {
      himId: "him.r",
      toBody: { nheId: "nhe-1", llmAdapter: "x", embodiedAt: new Date().toISOString() },
    };
    await maic.reincarnateHim(req, kr.sign(req, 2));

    const iso = await maic.toCompliance("iso-42001");
    const ctrls = Object.fromEntries(iso.controls.map((c) => [c.control, c]));
    expect(ctrls["7.5"]?.events.some((e) => e.kind === "him-register")).toBe(true);
    expect(ctrls["10.2"]?.events.some((e) => e.kind === "him-reincarnate")).toBe(true);
  });

  it("supports since/until filters", async () => {
    await maic.seed(kr);
    const future = "2099-01-01T00:00:00.000Z";
    const r = await maic.toCompliance("iso-42001", { since: future });
    expect(r.totalEvents).toBe(0);
  });

  it("perControlLimit caps events per control (oldest dropped)", async () => {
    await maic.seed(kr); // every seed axiom-mint surfaces under 5.2 + 7.5
    const r = await maic.toCompliance("iso-42001", { perControlLimit: 3 });
    const c52 = r.controls.find((c) => c.control === "5.2");
    expect(c52?.count).toBe(SEED_AXIOMS.length); // full count preserved
    expect(c52?.events).toHaveLength(3); // but only 3 surface
  });

  it("uncoveredKinds is empty when every event has a mapping", async () => {
    await maic.seed(kr);
    const r = await maic.toCompliance("iso-42001");
    expect(r.uncoveredKinds).toEqual([]);
  });

  it("report includes generatedAt and the requested range", async () => {
    const r = await maic.toCompliance("iso-42001", { since: "2026-01-01T00:00:00.000Z" });
    expect(r.generatedAt).toMatch(/^\d{4}-/);
    expect(r.range.since).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("ComplianceMapper, summaries are human-readable", () => {
  it("each summary references the relevant entity (axiom id / nhe id / him id)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "maic-summaries-"));
    const kr = CreatorKeyring.generate();
    const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    await maic.seed(kr);
    await maic.reviewBehavior(behaviorReport({ nheId: "nhe-summarize" }));

    const r = await maic.toCompliance("iso-42001");
    const flat = r.controls.flatMap((c) => c.events);
    expect(flat.some((e) => e.summary.includes("ax."))).toBe(true);
    expect(flat.some((e) => e.summary.includes("nhe-summarize"))).toBe(true);
  });
});
