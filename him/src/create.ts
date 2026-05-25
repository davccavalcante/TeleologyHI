import type { BirthSignature, CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { HimHandle } from "./handle/him-handle.js";

export interface CreateHimOptions {
  /**
   * Explicit nonce for the Creator signature. Defaults to `Date.now()`, which is
   * strictly increasing in practice and well below the seed nonce range used by MAIC.
   */
  nonce?: number;
}

/**
 * createHim — one-call helper that bundles the three steps a user would
 * otherwise need to coordinate manually:
 *
 *   1. sign the BirthSignature with the Creator's keyring
 *   2. register the HIM in MAIC (snapshots axioms, emits him-register audit)
 *   3. mint a HimHandle from the resulting record
 *
 * The keyring's public key must match MAIC's pinned `creatorPublicKey`, otherwise
 * the registration step rejects.
 */
export async function createHim(
  maic: LocalMaic,
  keyring: CreatorKeyring,
  birthSignature: BirthSignature,
  opts: CreateHimOptions = {},
): Promise<HimHandle> {
  const nonce = opts.nonce ?? Date.now();
  const creatorSig = keyring.sign(birthSignature, nonce);
  const record = await maic.registerHim(birthSignature, creatorSig);
  return HimHandle.mint(
    record.birthSignature,
    creatorSig,
    maic.creatorPublicKey,
    record.axiomsSnapshot,
  );
}
