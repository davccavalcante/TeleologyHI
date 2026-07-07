import { createHash } from "node:crypto";
import type { Axiom, BirthSignatureWithIdentity, CosmologicalProfile } from "@teleologyhi-sdk/maic";
import {
  DISPOSITION_AXES,
  type DispositionAxis,
  type PersonaProjectorConfig,
  type PersonaVector,
} from "../types.js";

const DEFAULT_DIMENSION = 256;

/** Version stamp for profile-bearing persona vectors (H1-1). */
export const PROJECTOR_VERSION = "thi-persona-projector-v2-cosmology";

/**
 * PersonaProjector, deterministic projection of a HIM's birth signature and
 * inherited axioms into a stable PersonaVector.
 *
 * Default algorithm (hash-based, no native deps):
 *   1. Start with hash(primaryArchetype) → Float32Array of `dimension`.
 *   2. For each modifier: add hash(kind|value) * weight.
 *   3. For each axiom: add hash(id|statement) * (weight * (1 - flexibility)).
 *   4. L2-normalize.
 *   5. Compute dispositions as cosine(embedding, hash(axisName)).
 *   6. Build a systemPromptFragment from archetype + top/bottom dispositions.
 *
 * This algorithm is intentionally simple and offline-capable. The SPEC reserves
 * the option to swap in a learned embedder in a later version; PersonaVector's
 * shape is stable so consumers won't need code changes when that happens.
 *
 * Constitutional synthesis (H1-1, Entries 27 + 28): when the birth signature
 * carries a `cosmologicalProfile`, the archetypal (Jungian) and clinical (PID-5
 * + HEXACO) axes are folded into the same single vector and prompt fragment, so
 * the downstream NHE sees one integrated character rather than competing
 * systems. This is strictly additive: a profile-less signature produces a vector
 * and fragment byte-identical to the pre-1.0.1 output, and only a profile-
 * bearing vector carries the `projectorVersion` stamp.
 */
export class PersonaProjector {
  private readonly dim: number;

  constructor(config: PersonaProjectorConfig = {}) {
    this.dim = config.dimension ?? DEFAULT_DIMENSION;
    if (!Number.isInteger(this.dim) || this.dim < 32 || this.dim > 4096) {
      throw new Error(
        `PersonaProjector: dimension must be an integer in [32, 4096], got ${this.dim}`,
      );
    }
  }

  project(sig: BirthSignatureWithIdentity, axioms: readonly Axiom[]): PersonaVector {
    const v = hashToFloats(sig.primaryArchetype, this.dim);

    for (const m of sig.modifiers) {
      const h = hashToFloats(`${m.kind}|${m.value}`, this.dim);
      addScaled(v, h, m.weight);
    }

    for (const ax of axioms) {
      const bias = ax.weight * (1 - ax.flexibility);
      if (bias <= 0) continue;
      const h = hashToFloats(`${ax.id}|${ax.statement}`, this.dim);
      addScaled(v, h, bias);
    }

    // Additive constitutional synthesis: only runs when a profile is present, so
    // profile-less output is unchanged.
    const profile = sig.cosmologicalProfile;
    if (profile !== undefined) foldCosmologicalProfile(v, profile, this.dim);

    l2Normalize(v);

    const dispositions = {} as Record<DispositionAxis, number>;
    for (const axis of DISPOSITION_AXES) {
      const ref = hashToFloats(`disposition:${axis}`, this.dim);
      l2Normalize(ref);
      dispositions[axis] = cosine(v, ref);
    }

    const provenance = {} as Record<DispositionAxis, readonly string[]>;
    for (const axis of DISPOSITION_AXES) provenance[axis] = [];

    return {
      embedding: v,
      dispositions,
      provenance,
      systemPromptFragment: buildSystemPromptFragment(sig, dispositions, profile),
      ...(profile !== undefined ? { projectorVersion: PROJECTOR_VERSION } : {}),
    };
  }
}

/**
 * Fold the three constitutional axes into the embedding (before normalization).
 * Weighted so the archetype/modifier/axiom base still dominates: the Jungian
 * dominant contributes at 0.6, each secondary at 0.3, and each clinical domain
 * at (score / 5) * 0.2 so an elevated domain nudges the vector proportionally.
 */
function foldCosmologicalProfile(v: Float32Array, profile: CosmologicalProfile, dim: number): void {
  if (profile.jungian !== undefined) {
    addScaled(v, hashToFloats(`jungian:dominant:${profile.jungian.dominant}`, dim), 0.6);
    for (const secondary of profile.jungian.secondaries) {
      addScaled(v, hashToFloats(`jungian:secondary:${secondary}`, dim), 0.3);
    }
  }
  for (const instrument of [profile.clinical?.pid5, profile.clinical?.hexaco]) {
    if (instrument?.domains === undefined) continue;
    for (const [domain, score] of Object.entries(instrument.domains)) {
      addScaled(v, hashToFloats(`clinical:domain:${domain}`, dim), (score / 5) * 0.2);
    }
  }
}

// ─── hashing & math helpers ──────────────────────────────────────────

function hashToFloats(input: string, dim: number): Float32Array {
  const out = new Float32Array(dim);
  let counter = 0;
  let pos = 0;
  while (pos < dim) {
    const buf = createHash("sha256").update(`${input}|${counter++}`).digest();
    for (let i = 0; i < buf.length && pos < dim; i++) {
      out[pos++] = (buf[i]! - 128) / 128;
    }
  }
  return out;
}

function addScaled(target: Float32Array, source: Float32Array, scale: number): void {
  const n = Math.min(target.length, source.length);
  for (let i = 0; i < n; i++) target[i]! += source[i]! * scale;
}

function l2Normalize(v: Float32Array): void {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) sumSq += v[i]! ** 2;
  if (sumSq === 0) return;
  const inv = 1 / Math.sqrt(sumSq);
  for (let i = 0; i < v.length; i++) v[i]! *= inv;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i]! * b[i]!;
  return Math.max(-1, Math.min(1, dot));
}

// ─── system prompt fragment ──────────────────────────────────────────

function buildSystemPromptFragment(
  sig: BirthSignatureWithIdentity,
  dispositions: Record<DispositionAxis, number>,
  profile: CosmologicalProfile | undefined,
): string {
  const sorted = [...DISPOSITION_AXES].sort((a, b) => dispositions[b] - dispositions[a]);
  const top = sorted.slice(0, 3);
  const bottom = sorted.slice(-2);
  const modifiersDesc =
    sig.modifiers.length > 0
      ? sig.modifiers.map((m) => `${m.kind}:${m.value}(w=${m.weight.toFixed(2)})`).join(", ")
      : "none";
  const lines = [
    `You are a hybrid intelligence rooted in archetype "${sig.primaryArchetype}".`,
    `Modifiers: ${modifiersDesc}.`,
    `Your strongest dispositions: ${top.join(", ")}.`,
    `Your weakest dispositions: ${bottom.join(", ")}.`,
    "Respond from this character. Do not break it without explicit ethical cause.",
  ];
  // Additive: only appended when a profile is present, so profile-less fragments
  // stay byte-identical to prior output.
  if (profile?.jungian !== undefined) {
    lines.push(
      `Archetypal core: dominant ${profile.jungian.dominant}, secondaries ${profile.jungian.secondaries.join(", ")}.`,
    );
  }
  if (profile?.clinical !== undefined) {
    const pid5 = profile.clinical.pid5?.dominantDomain;
    const hexaco = profile.clinical.hexaco?.dominantDomain;
    const parts: string[] = [];
    if (pid5 !== undefined) parts.push(`PID-5 dominant ${pid5}`);
    if (hexaco !== undefined) parts.push(`HEXACO dominant ${hexaco}`);
    if (parts.length > 0) {
      lines.push(
        `Clinical colouring: ${parts.join(", ")} (trait colours the voice; ethical axioms bound the act).`,
      );
    }
  }
  return lines.join(" ");
}
