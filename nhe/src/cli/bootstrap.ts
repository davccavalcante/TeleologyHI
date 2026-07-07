import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { BirthSignatureBuilder, createHim, HimHandle } from "@teleologyhi-sdk/him";
import { CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import type { LlmAdapter } from "../adapters/types.js";
import { Nhe } from "../nhe.js";

export interface BootstrapOptions {
  /** Directory where MAIC + HIM + NHE state lives. Default `./teleologyhi-store`. */
  storeDir?: string;
  /** LLM adapter used by the NHE. */
  llmAdapter: LlmAdapter;
  /** Stable HIM id used by the CLI. Default `him.cli.default`. */
  himId?: string;
  /** Primary archetype if a new HIM is being birthed. Default `aries-sun`. */
  archetype?: string;
}

export interface BootstrapResult {
  nhe: Nhe;
  maic: LocalMaic;
  him: HimHandle;
  keyring: CreatorKeyring;
  storeDir: string;
  freshInstall: boolean;
}

/**
 * Bootstrap a working MAIC + HIM + NHE trio from a single directory.
 *
 * On first run:
 *   - generates a Creator Ed25519 keyring (saved to `<storeDir>/creator.pem`),
 *   - seeds MAIC with the foundational axiom corpus,
 *   - births a HIM with the configured id + archetype,
 *   - constructs an NHE wired to all of the above.
 *
 * On subsequent runs:
 *   - reuses the keyring, MAIC store, and HIM.
 *
 * NOTE: storing the Creator's private key in plaintext on disk is acceptable
 * for single-user development environments. Production deployments should
 * load the keyring from an HSM or secrets manager.
 */
export async function bootstrap(opts: BootstrapOptions): Promise<BootstrapResult> {
  const storeDir = opts.storeDir ?? "./teleologyhi-store";
  await mkdir(storeDir, { recursive: true });
  const keyringPath = join(storeDir, "creator.pem");

  const exists = await pathExists(keyringPath);
  let keyring: CreatorKeyring;
  if (exists) {
    keyring = await CreatorKeyring.fromFile(keyringPath);
  } else {
    keyring = CreatorKeyring.generate();
    await keyring.saveTo(keyringPath);
  }

  const maic = await LocalMaic.open({ storeDir, creatorPublicKey: keyring.publicKey() });
  const existingAxioms = await maic.listAxioms();
  if (existingAxioms.length === 0) {
    await maic.seed(keyring);
  }

  const himId = opts.himId ?? "him.cli.default";
  let him: HimHandle;
  const existingHim = await maic.getHimRecord(himId);
  if (existingHim) {
    him = HimHandle.mint(
      existingHim.birthSignature,
      // We re-sign because we don't persist the original CreatorSignature
      // alongside the public HimRecord projection; the AxiomStore retains the
      // canonical signed envelope on disk.
      keyring.sign(existingHim.birthSignature, Date.now()),
      maic.creatorPublicKey,
      // Merge any HIM-emergent axioms ratified in prior sessions (Entry 7).
      [...existingHim.axiomsSnapshot, ...existingHim.emergentAxioms],
    );
  } else {
    const birthSig = BirthSignatureBuilder.now()
      .withHimId(himId)
      .withPrimaryArchetype(opts.archetype ?? "aries-sun")
      .withNotes("CLI default HIM")
      .build();
    him = await createHim(maic, keyring, birthSig);
  }

  const nhe = new Nhe({
    himHandle: him,
    maicClient: maic,
    llmAdapter: opts.llmAdapter,
    storeDir: join(storeDir, "nhe", him.id),
  });

  return {
    nhe,
    maic,
    him,
    keyring,
    storeDir,
    freshInstall: !exists,
  };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
