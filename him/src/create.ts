import type { BirthSignatureWithIdentity, CreatorKeyring, LocalMaic } from "@teleologyhi-sdk/maic";
import { type AuditSink, NOOP_AUDIT_SINK } from "./audit/sink.js";
import { castCosmologicalProfile } from "./birth/cosmology.js";
import { JUNGIAN_BATTERY_VERSION } from "./birth/jungian.js";
import { HimHandle } from "./handle/him-handle.js";
import { nextCreatorNonce } from "./identity/nonce.js";

export interface CreateHimOptions {
  /**
   * Explicit nonce for the Creator signature. When omitted, a strictly
   * increasing nonce is drawn from `nextCreatorNonce()` so that back-to-back
   * registrations in one process never repeat a value. See `identity/nonce.ts`
   * for the monotonicity guarantee and the maic replay-ledger context.
   */
  nonce?: number;
  /**
   * Cast the three-axis `cosmologicalProfile` at birth (Entries 27 + 28). When
   * `true` (the default) and the birth signature does not already carry a
   * profile, the archetypal (Jungian) and clinical (PID-5 + HEXACO) axes are
   * cast deterministically from the birth seed and attached before signing, so
   * the profile is persisted with the record. Set `false` to register the
   * legacy bare signature, or pre-populate `birthSignature.cosmologicalProfile`
   * to supply your own.
   */
  castProfile?: boolean;
  /**
   * Optional sink for the Entry 27 casting audit events
   * (`him-jungian-profile-cast`, and `him-astrological-chart-cast` when a chart
   * is present). Defaults to a no-op. See `audit/sink.ts` for why casting events
   * do not reach the canonical maic chain this cut.
   */
  auditSink?: AuditSink;
}

/**
 * createHim, one-call helper that bundles the birth event a user would
 * otherwise coordinate manually:
 *
 *   1. cast the constitutional `cosmologicalProfile` from the birth seed (unless
 *      disabled or already supplied), attaching it before signing;
 *   2. sign the (possibly enriched) BirthSignature with the Creator's keyring;
 *   3. register the HIM in MAIC (snapshots axioms, emits him-register audit);
 *   4. emit the casting audit events through the optional sink;
 *   5. mint a HimHandle from the resulting record.
 *
 * The keyring's public key must match MAIC's pinned `creatorPublicKey`, otherwise
 * the registration step rejects. The profile is cast from the six signed birth
 * fields and is not itself part of `SIGNED_BIRTH_FIELDS` (D-F5b); signing the
 * enriched payload still covers it under the generic keyring signature that
 * `HimHandle.mint` verifies.
 */
export async function createHim(
  maic: LocalMaic,
  keyring: CreatorKeyring,
  birthSignature: BirthSignatureWithIdentity,
  opts: CreateHimOptions = {},
): Promise<HimHandle> {
  const shouldCast = opts.castProfile !== false && birthSignature.cosmologicalProfile === undefined;
  const enriched: BirthSignatureWithIdentity = shouldCast
    ? { ...birthSignature, cosmologicalProfile: castCosmologicalProfile(birthSignature) }
    : birthSignature;

  // Fail fast if the birth signature references primordial axioms that are not
  // seeded in MAIC. Without this guard, `registerHim` silently snapshots an empty
  // or partial axiom set, and the HIM is born spiritually incomplete: its composed
  // system prompt loses the inviolable/active axiom sections and its verdicts cite
  // axioms it does not actually hold (Arena finding F-COLD-1). The Universe must
  // hold its constitution before a spirit is born into it, so seed MAIC first
  // (`maic.seed(keyring)`), which is idempotent.
  const primordialIds = enriched.primordialAxiomIds ?? [];
  if (primordialIds.length > 0) {
    const seeded = new Set((await maic.listAxioms()).map((a) => a.id));
    const missing = primordialIds.filter((id) => !seeded.has(id));
    if (missing.length > 0) {
      throw new Error(
        `createHim: cannot birth "${enriched.himId}" because its primordial axioms are not present in MAIC: ${missing.join(", ")}. Seed the Universe with maic.seed(keyring) before creating a HIM.`,
      );
    }
  }

  const nonce = opts.nonce ?? nextCreatorNonce();
  const creatorSig = keyring.sign(enriched, nonce);
  const record = await maic.registerHim(enriched, creatorSig);

  const sink = opts.auditSink ?? NOOP_AUDIT_SINK;
  const profile = record.birthSignature.cosmologicalProfile;
  if (profile !== undefined) {
    if (profile.jungian !== undefined) {
      await sink.append({
        kind: "him-jungian-profile-cast",
        data: {
          himId: record.birthSignature.himId,
          battery: JUNGIAN_BATTERY_VERSION,
          dominant: profile.jungian.dominant,
          secondaries: profile.jungian.secondaries,
          clinicalPid5Dominant: profile.clinical?.pid5?.dominantDomain,
          clinicalHexacoDominant: profile.clinical?.hexaco?.dominantDomain,
        },
      });
    }
    if (profile.chart !== undefined) {
      await sink.append({
        kind: "him-astrological-chart-cast",
        data: { himId: record.birthSignature.himId },
      });
    }
  }

  return HimHandle.mint(
    record.birthSignature,
    creatorSig,
    maic.creatorPublicKey,
    record.axiomsSnapshot,
  );
}
