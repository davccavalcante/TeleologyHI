/**
 * Explicit-fallback composition for SeedingSource (J-N1, Entry 21).
 *
 * Operators MAY chain multiple sources so a high-grade primary
 * (quantum / hardware TRNG) is tried first and the OS CSPRNG fills in
 * when the primary is unreachable. The chain NEVER falls back to
 * `Math.random`; the last entry must be authoritative.
 */
import type { SeedingChain, SeedingSource } from "./types.js";

export function withFallback(primary: SeedingSource, ...fallbacks: SeedingSource[]): SeedingChain {
  const sources = [primary, ...fallbacks];
  let lastUsedId: string | undefined;
  const chainIds = Object.freeze(sources.map((s) => s.id));

  const tryAll = async (n: number): Promise<Uint8Array> => {
    let lastError: unknown;
    for (const s of sources) {
      try {
        const result = await Promise.resolve(s.bytes(n));
        lastUsedId = s.id;
        return result;
      } catch (e) {
        lastError = e;
      }
    }
    const idsTried = sources.map((s) => s.id).join(", ");
    throw new Error(
      `SeedingChain: all sources failed (tried: ${idsTried}). Last error: ${String(lastError)}`,
    );
  };

  return {
    id: `chain:${chainIds.join(">")}`,
    chainIds,
    bytes(n: number) {
      return tryAll(n);
    },
    getLastUsedId() {
      return lastUsedId;
    },
  };
}
