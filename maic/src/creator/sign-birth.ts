/**
 * Creator-signed BirthSignature helpers (Entry 25 of MAIC_HIM_NHE_INTERVIEW_LOG.md).
 *
 * `personality_immutable` enforcement: the Creator signs an Ed25519 signature
 * over a canonical subset of `BirthSignature` fields (see `SIGNED_BIRTH_FIELDS`
 * in `types.ts`). The runtime verifies the signature on every NHE-body bootstrap;
 * tampering with the natal chart, primary archetype, modifiers, primordial
 * axioms, or `himId`/`bornAt` invalidates the signature and the runtime refuses
 * to start that HIM.
 *
 * The developer-configurable surface (`identity.name`, `identity.language`,
 * `identity.culturalElements`, `notes`) lives *outside* the signature, so it
 * can be edited by a parent-like configuration call at install time. The
 * spirit-level constitution is sealed; the body's name is not.
 */
import { CreatorKeyring } from "./keyring.js";
import type {
  BirthSignatureWithIdentity,
  SignedBirthField,
  SignedBirthSignature,
} from "../types.js";
import { SIGNED_BIRTH_FIELDS } from "../types.js";

/**
 * Build the canonical signing payload from a BirthSignature.
 *
 * Only the fields in `SIGNED_BIRTH_FIELDS` are included; everything else
 * (notes, identity surface) is excluded so it remains editable post-sign.
 */
export function signedBirthPayload(
  birth: BirthSignatureWithIdentity,
): Record<SignedBirthField, unknown> {
  return {
    himId: birth.himId,
    bornAt: birth.bornAt,
    primaryArchetype: birth.primaryArchetype,
    modifiers: birth.modifiers,
    primordialAxiomIds: birth.primordialAxiomIds,
    natalChart: birth.natalChart ?? null,
  };
}

/**
 * Sign a BirthSignature with a CreatorKeyring private key.
 *
 * The nonce is the byte length of the canonicalised signing payload — a
 * deterministic non-negative integer derived from the signed fields. This
 * keeps every signature uniquely scoped to its payload without requiring
 * the caller to track a monotonic counter (the natal-chart commitment is
 * one-shot and immutable; no replay concern within a single HIM).
 */
export function signBirthSignature(
  birth: BirthSignatureWithIdentity,
  keyring: CreatorKeyring,
): SignedBirthSignature {
  const payload = signedBirthPayload(birth);
  const nonce = Buffer.byteLength(JSON.stringify(payload), "utf-8");
  const signature = keyring.sign(payload, nonce);
  return {
    ...birth,
    creatorSignature: signature,
    signedFields: SIGNED_BIRTH_FIELDS,
    signedAt: new Date().toISOString(),
  };
}

/**
 * Verify a signed BirthSignature against an expected public key.
 *
 * Returns true when the signature is valid AND was produced over exactly the
 * fields in `SIGNED_BIRTH_FIELDS`. Any tamper of those fields (including a
 * natal-chart edit, a primordial-axiom-id swap, or a himId mutation) breaks
 * verification.
 */
export function verifyBirthSignature(
  signed: SignedBirthSignature,
  expectedPublicKey: string,
): boolean {
  if (signed.signedFields.length !== SIGNED_BIRTH_FIELDS.length) return false;
  for (const f of SIGNED_BIRTH_FIELDS) {
    if (!signed.signedFields.includes(f)) return false;
  }
  if (signed.creatorSignature.publicKey !== expectedPublicKey) return false;
  const payload = signedBirthPayload(signed);
  return CreatorKeyring.verifyWith(
    expectedPublicKey,
    payload,
    signed.creatorSignature,
  );
}

/**
 * Strict-mode wrapper: throws an `InvalidBirthSignatureError` instead of
 * returning false. Useful at HIM-bootstrap when the desired behaviour is to
 * refuse to start rather than to continue silently.
 */
export class InvalidBirthSignatureError extends Error {
  constructor(himId: string) {
    super(
      `InvalidBirthSignature: signature verification failed for HIM '${himId}'. The signed birth fields may have been mutated, or the public key does not match.`,
    );
    this.name = "InvalidBirthSignatureError";
  }
}

export function assertBirthSignature(
  signed: SignedBirthSignature,
  expectedPublicKey: string,
): void {
  if (!verifyBirthSignature(signed, expectedPublicKey)) {
    throw new InvalidBirthSignatureError(signed.himId);
  }
}
