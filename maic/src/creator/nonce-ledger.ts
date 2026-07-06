import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * NonceLedger, an append-only record of consumed Creator-signature nonces.
 *
 * Every Creator signature binds a monotonic `nonce` into the signed payload
 * (`canonicalJSON({ payload, nonce })`), so a captured signature is valid only
 * for its exact payload, which routes to exactly one signature-gated operation.
 * Recording each consumed nonce therefore makes every accepted Creator-signed
 * request single-use: a captured request cannot be replayed (M1-5, 1.0.1).
 *
 * Nonce spaces are per-operation-domain (one ledger per store) rather than
 * global. Because the signature already binds the payload, cross-domain replay
 * is impossible regardless, and per-domain ledgers let the Creator reuse a
 * nonce value across unrelated operation types without a false rejection.
 *
 * Persistence mirrors the AxiomStore fix (M1-3): one nonce per appended line,
 * never a whole-file rewrite, so an interrupted write can at worst drop the
 * final line and never resurrects a previously consumed nonce.
 */
export class NonceLedger {
  private readonly path: string;
  private readonly used = new Set<number>();

  private constructor(dir: string) {
    this.path = join(dir, "nonces.log");
  }

  /** Open (or create) a ledger rooted at `dir`, loading any prior nonces. */
  static async open(dir: string): Promise<NonceLedger> {
    const ledger = new NonceLedger(dir);
    await mkdir(dir, { recursive: true });
    await ledger.load();
    return ledger;
  }

  /** True when the nonce has already been consumed. */
  has(nonce: number): boolean {
    return this.used.has(nonce);
  }

  /**
   * Record a nonce as consumed. Throws when the nonce was already used, which
   * is the replay-protection gate. Callers invoke this immediately after a
   * successful Creator-signature verification and before the mutation, so a
   * replayed request is rejected before it can take effect.
   */
  async consume(nonce: number): Promise<void> {
    if (!Number.isInteger(nonce) || nonce < 0) {
      throw new Error(`NonceLedger.consume: nonce must be a non-negative integer, got ${nonce}`);
    }
    if (this.used.has(nonce)) {
      throw new Error(`NonceLedger: nonce ${nonce} already used (replay protection)`);
    }
    this.used.add(nonce);
    await appendFile(this.path, `${nonce}\n`, "utf-8");
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.path, "utf-8");
      const endsWithNewline = raw.endsWith("\n");
      const rows = raw.split("\n");
      for (let i = 0; i < rows.length; i++) {
        // A crash mid-append can leave a torn final line with no trailing
        // newline; a partially written integer (for example "4" of "42") would
        // silently mis-record and free the real nonce for replay, so drop an
        // unterminated final line. Only strictly numeric lines are accepted.
        if (i === rows.length - 1 && !endsWithNewline) break;
        const line = rows[i]!.trim();
        if (!/^\d+$/.test(line)) continue;
        this.used.add(Number(line));
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}
