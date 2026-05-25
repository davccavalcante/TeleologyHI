import { describe, it, expect } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CreatorKeyring,
  LocalMaic,
  type InteractionRecord,
  type NheBodyRef,
} from "@teleologyhi-sdk/maic";
import { BirthSignatureBuilder } from "../src/birth/builder";
import { createHim } from "../src/create";
import { reincarnate } from "../src/reincarnate";
import { RESIDUAL_TRACE_CAP } from "../src/types";

const body = (nheId: string, llmAdapter = "anthropic:claude-sonnet-4-6"): NheBodyRef => ({
  nheId,
  llmAdapter,
  embodiedAt: new Date().toISOString(),
});

async function bootstrap() {
  const dir = await mkdtemp(join(tmpdir(), "him-reinc-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const sig = BirthSignatureBuilder.now()
    .withPrimaryArchetype("aries-sun")
    .build();
  const him = await createHim(maic, kr, sig);
  return { maic, kr, him };
}

describe("reincarnate helper", () => {
  it("first reincarnation: updated handle has 1 body in bodyHistory", async () => {
    const { maic, kr, him } = await bootstrap();
    const { handle, record } = await reincarnate(maic, kr, {
      himId: him.id,
      toBody: body("nhe-1"),
    });
    expect(handle.bodyHistory).toHaveLength(1);
    expect(handle.bodyHistory[0]?.nheId).toBe("nhe-1");
    expect(record.bodyHistory).toHaveLength(1);
    // Same HIM id, same axiom snapshot
    expect(handle.id).toBe(him.id);
    expect(handle.getAxioms().length).toBe(him.getAxioms().length);
  });

  it("second reincarnation: closes first body, appends second", async () => {
    const { maic, kr, him } = await bootstrap();
    await reincarnate(maic, kr, { himId: him.id, toBody: body("nhe-1") });
    const { handle } = await reincarnate(maic, kr, {
      himId: him.id,
      fromNheId: "nhe-1",
      toBody: body("nhe-2", "anthropic:claude-sonnet-4-7"),
      reason: "upgrade",
    });
    expect(handle.bodyHistory).toHaveLength(2);
    expect(handle.bodyHistory[0]?.endedAt).toBeTruthy();
    expect(handle.bodyHistory[0]?.endedReason).toBe("upgrade");
    expect(handle.bodyHistory[1]?.nheId).toBe("nhe-2");
    expect(handle.bodyHistory[1]?.endedAt).toBeUndefined();
  });

  it("the same HIM persists across bodies (same id, same axioms)", async () => {
    const { maic, kr, him } = await bootstrap();
    const before = him.getAxioms().map((a) => a.id).sort();
    const { handle } = await reincarnate(maic, kr, {
      himId: him.id,
      toBody: body("nhe-1"),
    });
    const after = handle.getAxioms().map((a) => a.id).sort();
    expect(after).toEqual(before);
    expect(handle.id).toBe(him.id);
    // birthSignature unchanged
    expect(handle.birthSignature.himId).toBe(him.birthSignature.himId);
    expect(handle.birthSignature.primaryArchetype).toBe(him.birthSignature.primaryArchetype);
  });

  it("rejects when keyring does not match MAIC's pinned public key", async () => {
    const { maic, him } = await bootstrap();
    const impostor = CreatorKeyring.generate();
    await expect(
      reincarnate(maic, impostor, { himId: him.id, toBody: body("nhe-x") }),
    ).rejects.toThrow(/signature/i);
  });
});

describe("reincarnate helper — residual-trace carry-over (D-H1.1)", () => {
  const sampleInteraction = (i: number): InteractionRecord => ({
    at: `2026-05-24T1${i % 10}:00:00.000Z`,
    userPrompt: `q${i} — why does this matter for my purpose?`,
    responseText: `Long substantive response ${i} `.repeat(20),
    refused: false,
  });

  it("populates getResidualTraces when priorInteractions is supplied", async () => {
    const { maic, kr, him } = await bootstrap();
    await reincarnate(maic, kr, { himId: him.id, toBody: body("nhe-1") });
    const interactions = Array.from({ length: 12 }, (_, i) => sampleInteraction(i));
    const { handle } = await reincarnate(
      maic,
      kr,
      {
        himId: him.id,
        fromNheId: "nhe-1",
        toBody: body("nhe-2"),
      },
      { priorInteractions: interactions },
    );
    const traces = handle.getResidualTraces();
    expect(traces.length).toBeGreaterThan(0);
    expect(traces.length).toBeLessThanOrEqual(interactions.length);
    for (const trace of traces) {
      expect(trace.kind).toBe("interaction-summary");
      expect(trace.carriedFromNheId).toBe("nhe-1");
      expect(trace.carriedAtReincarnation).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    }
  });

  it("returns empty residual traces when priorInteractions is omitted", async () => {
    const { maic, kr, him } = await bootstrap();
    const { handle } = await reincarnate(maic, kr, {
      himId: him.id,
      toBody: body("nhe-1"),
    });
    expect(handle.getResidualTraces()).toEqual([]);
  });

  it("returns empty residual traces when priorInteractions is an empty array", async () => {
    const { maic, kr, him } = await bootstrap();
    await reincarnate(maic, kr, { himId: him.id, toBody: body("nhe-1") });
    const { handle } = await reincarnate(
      maic,
      kr,
      {
        himId: him.id,
        fromNheId: "nhe-1",
        toBody: body("nhe-2"),
      },
      { priorInteractions: [] },
    );
    expect(handle.getResidualTraces()).toEqual([]);
  });

  it("caps carry-over at RESIDUAL_TRACE_CAP (64) by default", async () => {
    const { maic, kr, him } = await bootstrap();
    await reincarnate(maic, kr, { himId: him.id, toBody: body("nhe-1") });
    const flood = Array.from({ length: RESIDUAL_TRACE_CAP + 30 }, (_, i) =>
      sampleInteraction(i),
    );
    const { handle } = await reincarnate(
      maic,
      kr,
      {
        himId: him.id,
        fromNheId: "nhe-1",
        toBody: body("nhe-2"),
      },
      { priorInteractions: flood },
    );
    expect(handle.getResidualTraces()).toHaveLength(RESIDUAL_TRACE_CAP);
  });

  it("honours residualTraceOptions.cap override", async () => {
    const { maic, kr, him } = await bootstrap();
    await reincarnate(maic, kr, { himId: him.id, toBody: body("nhe-1") });
    const interactions = Array.from({ length: 20 }, (_, i) => sampleInteraction(i));
    const { handle } = await reincarnate(
      maic,
      kr,
      {
        himId: him.id,
        fromNheId: "nhe-1",
        toBody: body("nhe-2"),
      },
      {
        priorInteractions: interactions,
        residualTraceOptions: { cap: 5 },
      },
    );
    expect(handle.getResidualTraces()).toHaveLength(5);
  });

  it("anchors traces to the explicit fromNheId, falling back to the closed body when omitted", async () => {
    const { maic, kr, him } = await bootstrap();
    await reincarnate(maic, kr, { himId: him.id, toBody: body("nhe-1") });
    const interactions = [sampleInteraction(0)];
    // Omit fromNheId — reincarnate must infer the prior body from bodyHistory.
    const { handle } = await reincarnate(
      maic,
      kr,
      {
        himId: him.id,
        toBody: body("nhe-2"),
      },
      { priorInteractions: interactions },
    );
    const traces = handle.getResidualTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0]?.carriedFromNheId).toBe("nhe-1");
  });
});
