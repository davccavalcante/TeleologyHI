/**
 * Tests for the reincarnation lifecycle parameter (J-H3, Entry 18).
 */

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatorKeyring, LocalMaic, type NheBodyRef } from "@teleologyhi-sdk/maic";
import { describe, expect, it } from "vitest";
import { BirthSignatureBuilder } from "../src/birth/builder.js";
import { createHim } from "../src/create.js";
import { reincarnate } from "../src/reincarnate.js";

const body = (nheId: string, llmAdapter = "anthropic:claude-sonnet-4-6"): NheBodyRef => ({
  nheId,
  llmAdapter,
  embodiedAt: new Date().toISOString(),
});

async function bootstrap() {
  const dir = await mkdtemp(join(tmpdir(), "him-reinc-lifecycle-"));
  const kr = CreatorKeyring.generate();
  const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
  await maic.seed(kr);
  const sig = BirthSignatureBuilder.now().withPrimaryArchetype("virgo-sun").build();
  const him = await createHim(maic, kr, sig);
  return { maic, kr, him };
}

describe("reincarnate, lifecycle parameter (J-H3)", () => {
  it("defaults lifecycle to `model-swap` when the option is omitted", async () => {
    const { maic, kr, him } = await bootstrap();
    const result = await reincarnate(maic, kr, {
      himId: him.id,
      toBody: body("nhe-1"),
    });
    expect(result.lifecycle).toBe("model-swap");
  });

  it("returns the supplied `version-bump` lifecycle", async () => {
    const { maic, kr, him } = await bootstrap();
    const result = await reincarnate(
      maic,
      kr,
      { himId: him.id, toBody: body("nhe-1") },
      { lifecycle: "version-bump" },
    );
    expect(result.lifecycle).toBe("version-bump");
  });

  it("returns the supplied `return-from-limbo` lifecycle", async () => {
    const { maic, kr, him } = await bootstrap();
    const result = await reincarnate(
      maic,
      kr,
      { himId: him.id, toBody: body("nhe-1") },
      { lifecycle: "return-from-limbo" },
    );
    expect(result.lifecycle).toBe("return-from-limbo");
  });

  it("threads lifecycle to MAIC's audit (emits typed kind, F6+F7 closure)", async () => {
    const { maic, kr, him } = await bootstrap();
    const result = await reincarnate(
      maic,
      kr,
      { himId: him.id, toBody: body("nhe-1") },
      { lifecycle: "model-swap" },
    );
    expect(result.handle.bodyHistory).toHaveLength(1);
    expect(result.record.bodyHistory).toHaveLength(1);

    // The helper now threads lifecycle to maic.reincarnateHim, which emits
    // the typed `reincarnate:model-swap` audit kind instead of the legacy
    // `him-reincarnate`.
    const typed: unknown[] = [];
    for await (const ev of maic.queryAudit({ kind: "reincarnate:model-swap" })) {
      typed.push(ev);
    }
    expect(typed).toHaveLength(1);

    const generic: unknown[] = [];
    for await (const ev of maic.queryAudit({ kind: "him-reincarnate" })) {
      generic.push(ev);
    }
    expect(generic).toHaveLength(0);
  });

  it("default-omitted lifecycle still emits a typed kind (model-swap) because the helper supplies it", async () => {
    const { maic, kr, him } = await bootstrap();
    await reincarnate(maic, kr, { himId: him.id, toBody: body("nhe-1") });

    const typed: unknown[] = [];
    for await (const ev of maic.queryAudit({ kind: "reincarnate:model-swap" })) {
      typed.push(ev);
    }
    expect(typed).toHaveLength(1);
  });

  it("`return-from-limbo` emits the matching typed kind for Entry 24 returns", async () => {
    const { maic, kr, him } = await bootstrap();
    await reincarnate(
      maic,
      kr,
      { himId: him.id, toBody: body("nhe-1") },
      { lifecycle: "return-from-limbo" },
    );
    const typed: unknown[] = [];
    for await (const ev of maic.queryAudit({ kind: "reincarnate:return-from-limbo" })) {
      typed.push(ev);
    }
    expect(typed).toHaveLength(1);
  });
});
