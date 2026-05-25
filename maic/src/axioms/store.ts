import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ulid } from "ulid";
import { CreatorKeyring } from "../creator/keyring.js";
import { Axiom, type AxiomFilter, type CreatorSignature, type MintAxiomRequest } from "../types.js";

/**
 * AxiomStore — persistent, signature-gated repository of Creator-authored axioms.
 *
 * Disk layout:
 *   <storeDir>/axioms/creator/<axiomId>.json   (one signed envelope per axiom)
 *   <storeDir>/axioms/nonces.log               (NDJSON; one used nonce per line)
 *
 * Mutations require a Creator signature that verifies against the pinned public key.
 * Nonces must be strictly unused — replay protection.
 *
 * Scope: mint + list. Updates / retirement come in a later iteration.
 */
export class AxiomStore {
  private readonly axiomsDir: string;
  private readonly noncesPath: string;
  private readonly usedNonces = new Set<number>();
  private cache = new Map<string, Axiom>();

  private constructor(
    private readonly storeDir: string,
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

    await writeFile(
      join(this.axiomsDir, `${id}.json`),
      JSON.stringify({ axiom, signature: sig }, null, 2),
      "utf-8",
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
      for (const line of raw.split("\n")) {
        if (!line) continue;
        const n = Number(line.trim());
        if (Number.isInteger(n)) this.usedNonces.add(n);
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  private async recordNonce(n: number): Promise<void> {
    this.usedNonces.add(n);
    await writeFile(this.noncesPath, `${[...this.usedNonces].join("\n")}\n`, "utf-8");
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
      const raw = await readFile(join(this.axiomsDir, file), "utf-8");
      const env = JSON.parse(raw);
      const axiom = Axiom.parse(env.axiom);
      this.cache.set(axiom.id, axiom);
    }
  }
}
