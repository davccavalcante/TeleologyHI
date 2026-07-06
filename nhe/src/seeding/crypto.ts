/**
 * Default SeedingSource backed by Node's CSPRNG (J-N1, Entry 21).
 *
 * Uses `crypto.randomBytes(n)` synchronously. No external dependency,
 * no network call. This is the MVP per Entry 21; future quantum-grade
 * sources slot in alongside via the same `SeedingSource` interface.
 */
import { randomBytes } from "node:crypto";
import type { SeedingSource } from "./types.js";

export class CryptoSeedingSource implements SeedingSource {
  readonly id = "crypto.csprng";

  bytes(n: number): Uint8Array {
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`CryptoSeedingSource.bytes: n must be a positive integer, got ${n}`);
    }
    // randomBytes returns a Node Buffer; cast to Uint8Array for the
    // cross-runtime contract. Buffer IS a Uint8Array on Node so this is
    // a no-op at runtime; the cast satisfies TypeScript across runtimes
    // that don't have Buffer in their lib.
    return new Uint8Array(randomBytes(n));
  }
}
