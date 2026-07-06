/**
 * SeedingSource plug-in interface (J-N1, Entry 21 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md).
 *
 * Entry 21 commits to a pluggable randomness source so REM-spontaneous
 * generation, dream seeding, and any future stochastic NHE behaviour
 * can be driven by:
 *
 *   - the OS CSPRNG (the default, `CryptoSeedingSource` below);
 *   - the ANU quantum RNG (`AnuQrngSeedingSource`, future);
 *   - the IBM Quantum experience (`IbmQuantumSeedingSource`, future);
 *   - a hardware TRNG (`HardwareTrngSeedingSource`, future);
 *   - or any operator-supplied implementation.
 *
 * The contract is intentionally minimal: a single `bytes(n)` call
 * that returns `n` uniform-random bytes, plus an `id` for audit /
 * telemetry. Implementations MUST throw or reject (never silently
 * fall back to `Math.random`) so the operator's fallback chain is
 * always explicit.
 */

export interface SeedingSource {
  /** Stable id surfaced in logs / audit so different sources are distinguishable. */
  readonly id: string;
  /**
   * Return `n` uniform-random bytes. Implementations MUST be either
   * synchronous OR return a Promise, they MUST NOT silently fall back
   * to a weaker source on failure. Callers wire fallback chains
   * explicitly via `withFallback()` so the audit trail records which
   * source actually produced the seed.
   */
  bytes(n: number): Uint8Array | Promise<Uint8Array>;
}

/**
 * Compose a primary source with one or more fallbacks. The primary is
 * tried first; on throw / reject, the next in the chain is tried in
 * turn. The id of the source that actually produced the bytes is
 * available via `getLastUsedId()` so audit consumers can record it.
 *
 * This composition is **opt-in**. Operators who want strict no-fallback
 * behaviour pass the primary source directly.
 */
export interface SeedingChain extends SeedingSource {
  /** The id of the source that produced the most recent `bytes()` result. */
  getLastUsedId(): string | undefined;
  /** Ordered list of source ids in this chain, primary first. */
  readonly chainIds: readonly string[];
}
