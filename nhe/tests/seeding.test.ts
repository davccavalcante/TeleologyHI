/**
 * Tests for the SeedingSource plug-in interface + default
 * CryptoSeedingSource (J-N1, Entry 21).
 */
import { describe, expect, it } from "vitest";
import type { SeedingSource } from "../src/index.js";
import { CryptoSeedingSource, withFallback } from "../src/index.js";

describe("CryptoSeedingSource (J-N1)", () => {
  it("returns n bytes for a positive integer n", () => {
    const src = new CryptoSeedingSource();
    const bytes = src.bytes(32);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
  });

  it("produces non-equal bytes across calls (statistical sanity)", () => {
    const src = new CryptoSeedingSource();
    const a = src.bytes(32);
    const b = src.bytes(32);
    expect(a).not.toEqual(b);
  });

  it("rejects non-positive or non-integer n", () => {
    const src = new CryptoSeedingSource();
    expect(() => src.bytes(0)).toThrow();
    expect(() => src.bytes(-1)).toThrow();
    expect(() => src.bytes(1.5)).toThrow();
  });

  it("exposes a stable `id`", () => {
    const src = new CryptoSeedingSource();
    expect(src.id).toBe("crypto.csprng");
  });
});

class FailingSource implements SeedingSource {
  readonly id: string;
  constructor(id: string) {
    this.id = id;
  }
  bytes(): Uint8Array {
    throw new Error(`${this.id} unavailable`);
  }
}

describe("withFallback (J-N1)", () => {
  it("uses the primary when it succeeds", async () => {
    const chain = withFallback(new CryptoSeedingSource());
    const bytes = await chain.bytes(16);
    expect(bytes.length).toBe(16);
    expect(chain.getLastUsedId()).toBe("crypto.csprng");
  });

  it("falls through to the next source when the primary fails", async () => {
    const chain = withFallback(new FailingSource("primary"), new CryptoSeedingSource());
    const bytes = await chain.bytes(8);
    expect(bytes.length).toBe(8);
    expect(chain.getLastUsedId()).toBe("crypto.csprng");
  });

  it("throws when ALL sources in the chain fail", async () => {
    const chain = withFallback(
      new FailingSource("a"),
      new FailingSource("b"),
      new FailingSource("c"),
    );
    await expect(chain.bytes(4)).rejects.toThrow(/all sources failed/);
  });

  it("exposes the chain ids in order", () => {
    const chain = withFallback(new FailingSource("primary"), new CryptoSeedingSource());
    expect(chain.id).toBe("chain:primary>crypto.csprng");
    expect(chain.chainIds).toEqual(["primary", "crypto.csprng"]);
  });
});
