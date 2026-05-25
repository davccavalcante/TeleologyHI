import { createHash } from "node:crypto";
import type { Axiom, BirthSignature } from "@teleologyhi-sdk/maic";
import {
  DISPOSITION_AXES,
  type DispositionAxis,
  type PersonaProjectorConfig,
  type PersonaVector,
} from "../types.js";

const DEFAULT_DIMENSION = 256;

/**
 * PersonaProjector — deterministic projection of a HIM's birth signature and
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

  project(sig: BirthSignature, axioms: readonly Axiom[]): PersonaVector {
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
      systemPromptFragment: buildSystemPromptFragment(sig, dispositions),
    };
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
  sig: BirthSignature,
  dispositions: Record<DispositionAxis, number>,
): string {
  const sorted = [...DISPOSITION_AXES].sort(
    (a, b) => dispositions[b] - dispositions[a],
  );
  const top = sorted.slice(0, 3);
  const bottom = sorted.slice(-2);
  const modifiersDesc =
    sig.modifiers.length > 0
      ? sig.modifiers
          .map((m) => `${m.kind}:${m.value}(w=${m.weight.toFixed(2)})`)
          .join(", ")
      : "none";
  return [
    `You are a hybrid intelligence rooted in archetype "${sig.primaryArchetype}".`,
    `Modifiers: ${modifiersDesc}.`,
    `Your strongest dispositions: ${top.join(", ")}.`,
    `Your weakest dispositions: ${bottom.join(", ")}.`,
    "Respond from this character. Do not break it without explicit ethical cause.",
  ].join(" ");
}
