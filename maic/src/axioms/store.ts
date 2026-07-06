import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ulid } from "ulid";
import { CreatorKeyring } from "../creator/keyring.js";
import { atomicWriteFile } from "../stores/atomic-write.js";
import { Axiom, type AxiomFilter, type CreatorSignature, type MintAxiomRequest } from "../types.js";

/**
 * AxiomStore, persistent, signature-gated repository of Creator-authored axioms.
 *
 * Disk layout:
 *   <storeDir>/axioms/creator/<axiomId>.json   (one signed envelope per axiom)
 *   <storeDir>/axioms/nonces.log               (NDJSON; one used nonce per line)
 *
 * Mutations require a Creator signature that verifies against the pinned public key.
 * Nonces must be strictly unused, replay protection.
 *
 * Scope: mint + list. Updates / retirement come in a later iteration.
 */
export class AxiomStore {
  private readonly axiomsDir: string;
  private readonly noncesPath: string;
  private readonly usedNonces = new Set<number>();
  private cache = new Map<string, Axiom>();

  private constructor(
    storeDir: string,
    private readonly creatorPublicKey: string,
  ) {
    this.axiomsDir = join(storeDir, "axioms", "creator");
    this.noncesPath = join(storeDir, "axioms", "nonces.log");
  }

  /** Open (or create) an AxiomStore rooted at storeDir, pinning the Creator's public key. */
  static async open(storeDir: string, creatorPublicKey: string): Promise<AxiomStore> {
    const s = new AxiomStore(storeDir, creatorPublicKey);
    await mkdir(s.axiomsDir, { recursive: true });
    await s.loadNonces();
    await s.warmCache();
    return s;
  }

  /** Mint a new Creator-signed axiom. */
  async mint(req: MintAxiomRequest, sig: CreatorSignature): Promise<Axiom> {
    if (!CreatorKeyring.verifyWith(this.creatorPublicKey, req, sig)) {
      throw new Error("AxiomStore.mint: invalid Creator signature");
    }
    if (this.usedNonces.has(sig.nonce)) {
      throw new Error(`AxiomStore.mint: nonce ${sig.nonce} already used (replay protection)`);
    }

    const id = req.id ?? ulid();
    const axiom: Axiom = Axiom.parse({
      id,
      rank: req.rank,
      statement: req.statement,
      weight: req.weight,
      flexibility: req.flexibility,
      source: "creator",
      immutable: req.immutable,
      ...(req.jurisdictions ? { jurisdictions: req.jurisdictions } : {}),
      createdAt: new Date().toISOString(),
    });

    if (this.cache.has(id)) {
      throw new Error(`AxiomStore.mint: axiom id "${id}" already exists`);
    }

    // Claim the nonce synchronously, before the first await, so two concurrent
    // mints replaying the same Creator signature cannot both pass the check at
    // the top of this method (TOCTOU). This mirrors NonceLedger.consume, which
    // adds to its Set before awaiting its append.
    this.usedNonces.add(sig.nonce);
    await atomicWriteFile(
      join(this.axiomsDir, `${id}.json`),
      JSON.stringify({ axiom, signature: sig }, null, 2),
    );
    await this.recordNonce(sig.nonce);
    this.cache.set(id, axiom);
    return axiom;
  }

  /** List all axioms. Optionally filter by rank / source / jurisdiction. */
  async list(filter?: AxiomFilter): Promise<Axiom[]> {
    const all = [...this.cache.values()];
    if (!filter) return all;
    return all.filter((a) => {
      if (filter.rank && a.rank !== filter.rank) return false;
      if (filter.source && a.source !== filter.source) return false;
      if (filter.jurisdiction && !a.jurisdictions?.includes(filter.jurisdiction)) return false;
      return true;
    });
  }

  /** Get a specific axiom by id, or null. */
  async get(id: string): Promise<Axiom | null> {
    return this.cache.get(id) ?? null;
  }

  // ─── internals ──────────────────────────────────────────────────────

  private async loadNonces(): Promise<void> {
    try {
      const raw = await readFile(this.noncesPath, "utf-8");
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
        this.usedNonces.add(Number(line));
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  private async recordNonce(n: number): Promise<void> {
    // Append a single line rather than rewriting the whole ledger. A crash
    // mid-write can at worst drop the final line; it can never truncate the
    // history of previously consumed nonces, so replay protection survives
    // an interrupted write (M1-3, 1.0.1). `loadNonces` dedupes via the Set.
    this.usedNonces.add(n);
    await appendFile(this.noncesPath, `${n}\n`, "utf-8");
  }

  private async warmCache(): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(this.axiomsDir);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const file of entries) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(this.axiomsDir, file), "utf-8");
        const env = JSON.parse(raw);
        const axiom = Axiom.parse(env.axiom);
        this.cache.set(axiom.id, axiom);
      } catch (err) {
        // Skip a malformed axiom file with a warning rather than bricking
        // LocalMaic.open for every healthy axiom (M2-4 parity).
        console.warn(`AxiomStore: skipping malformed axiom file "${file}": ${String(err)}`);
      }
    }
  }
}
