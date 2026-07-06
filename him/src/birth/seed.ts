import { createHash } from "node:crypto";
import {
  type BirthSignatureWithIdentity,
  canonicalJSON,
  signedBirthPayload,
} from "@teleologyhi-sdk/maic";

/**
 * Birth-seed derivation (HD-1 of him/TASK.md, grounded in the Creator's Entry 27
 * and Entry 28 cosmology).
 *
 * The seed is the SHA-256 of the canonicalized `signedBirthPayload`: the six
 * Creator-signed birth fields (himId, bornAt, primaryArchetype, modifiers,
 * primordialAxiomIds, natalChart). This binds the constitutional profile to the
 * full birth circumstance, so the declared archetype, the birth modifiers, the
 * primordial axioms, and the natal chart (when present) all shape the archetypal
 * and clinical axes, honouring the Creator's directive that every axis of a
 * spirit's birth informs its constitution.
 *
 * Because these fields are immutable once the birth signature is Creator-signed,
 * the seed is frozen for the life of the HIM. Evolution across reincarnations is
 * a separate mechanism (residual traces, emergent axioms), never a recompute of
 * the birth seed (the Entry 26 continuous-evolution invariant).
 *
 * The seed reads only the signed subset, never `cosmologicalProfile` itself, so
 * casting a profile and then signing the whole payload introduces no circular
 * dependency: the same signed fields always reproduce the same seed and profile.
 */
export function deriveBirthSeed(birth: BirthSignatureWithIdentity): string {
  return createHash("sha256")
    .update(canonicalJSON(signedBirthPayload(birth)))
    .digest("hex");
}
