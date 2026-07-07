import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreatorKeyring, LocalMaic, type NheBodyRef } from "@teleologyhi-sdk/maic";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BirthSignatureBuilder } from "../src/birth/builder";
import { createHim } from "../src/create";
import { nextCreatorNonce } from "../src/identity/nonce";
import { reincarnate } from "../src/reincarnate";

/**
 * Regression suite for H0-1: since maic 1.0.1 consumes Creator-signature
 * nonces in per-domain replay ledgers, a `Date.now()` default collides when
 * two signed calls land in the same millisecond. `nextCreatorNonce()` must be
 * strictly monotonic even when the wall clock does not advance.
 */

const body = (nheId: string, llmAdapter = "anthropic:claude-sonnet-4-6"): NheBodyRef => ({
  nheId,
  llmAdapter,
  embodiedAt: new Date().toISOString(),
});

afterEach(() => {
  vi.useRealTimers();
});

describe("nextCreatorNonce", () => {
  it("is strictly increasing across consecutive calls", () => {
    const a = nextCreatorNonce();
    const b = nextCreatorNonce();
    const c = nextCreatorNonce();
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("stays strictly increasing when the wall clock is frozen", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T00:00:00.000Z"));
    const draws = Array.from({ length: 100 }, () => nextCreatorNonce());
    for (let i = 1; i < draws.length; i++) {
      expect(draws[i]!).toBeGreaterThan(draws[i - 1]!);
    }
    // No duplicates despite Date.now() returning a constant value.
    expect(new Set(draws).size).toBe(draws.length);
  });
});

describe("nonce replay protection (integration)", () => {
  it("two back-to-back reincarnations under a frozen clock both succeed", async () => {
    // Without the monotonic fix, both reincarnations would sign with the same
    // Date.now() nonce and maic's hims-domain ledger would reject the second.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T12:00:00.000Z"));

    const dir = await mkdtemp(join(tmpdir(), "him-nonce-"));
    const kr = CreatorKeyring.generate();
    const maic = await LocalMaic.open({ storeDir: dir, creatorPublicKey: kr.publicKey() });
    await maic.seed(kr);
    const sig = BirthSignatureBuilder.now().withPrimaryArchetype("aries-sun").build();
    const him = await createHim(maic, kr, sig);

    await reincarnate(maic, kr, { himId: him.id, toBody: body("nhe-1") });
    const { handle } = await reincarnate(maic, kr, {
      himId: him.id,
      fromNheId: "nhe-1",
      toBody: body("nhe-2", "anthropic:claude-sonnet-4-7"),
      reason: "upgrade",
    });

    expect(handle.bodyHistory).toHaveLength(2);
    expect(handle.bodyHistory[1]?.nheId).toBe("nhe-2");
  });
});
