import type { AxiomEvolutionResult } from "@teleologyhi-sdk/maic";
import {
  ArchetypeModifier,
  Axiom,
  BirthSignature,
  EmergentAxiomCandidate,
  EmergentAxiomProposal,
} from "@teleologyhi-sdk/maic";
import { z } from "zod";

export type { AxiomEvolutionResult };
// Re-export shared types from @teleologyhi-sdk/maic for convenience. The
// proposal/evolution types are defined canonically in MAIC; HIM consumes
// them so both sides of the ratification channel agree on the wire shape.
export { ArchetypeModifier, Axiom, BirthSignature, EmergentAxiomCandidate, EmergentAxiomProposal };

/**
 * Persona vector, the projection of a HIM's birth signature + axioms into a
 * stable, deterministic representation that NHE can consume on every prompt.
 */
export interface PersonaVector {
  /** L2-normalized deterministic embedding. Default dimension: 256. */
  embedding: Float32Array;
  /** Human-readable persona summary suitable for inclusion in an NHE system prompt. */
  systemPromptFragment: string;
  /** Disposition scores in [-1, 1] per axis. */
  dispositions: Readonly<Record<DispositionAxis, number>>;
  /** Provenance: which axioms shaped which disposition. Currently a stub (empty arrays). */
  provenance: Readonly<Record<DispositionAxis, readonly string[]>>;
  /**
   * Projector version stamp, set only when a `cosmologicalProfile` was
   * synthesised into this vector (Entries 27 + 28). Absent for profile-less
   * projections, which stay byte-identical to prior output; when present, it
   * lets a distillation corpus discriminate profile-bearing vectors.
   */
  projectorVersion?: string;
}

export const DISPOSITION_AXES = [
  "candor",
  "patience",
  "curiosity",
  "protection",
  "skepticism",
  "warmth",
  "diligence",
  "humility",
] as const;
export type DispositionAxis = (typeof DISPOSITION_AXES)[number];

/** Reference to one NHE body that has hosted (or hosts) this HIM. */
export const NheBodyRef = z.object({
  nheId: z.string().min(1),
  llmAdapter: z.string().min(1),
  embodiedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  endedReason: z.enum(["upgrade", "replacement", "terminate", "deprecate"]).optional(),
});
export type NheBodyRef = z.infer<typeof NheBodyRef>;

/** Configuration for the deterministic persona projector. */
export interface PersonaProjectorConfig {
  /** Output embedding dimension. Default 256. */
  dimension?: number;
}

/**
 * Identifier for the deployment jurisdiction governing this HIM's lawful character.
 * Values like "default", "eu", "br", "us", "unstable" (Entry 11).
 */
export type LawfulJurisdiction = "default" | "eu" | "br" | "us" | "unstable" | (string & {});

export interface LawfulCharacterProfile {
  jurisdiction: LawfulJurisdiction;
  /** Identifiers of applicable laws/regulations (ISO ids, statute names). */
  applicableLaws: string[];
  /** Axioms that MUST be active in this jurisdiction. */
  requiredAxiomIds: string[];
  /** Taxonomy of disallowed behaviors in this jurisdiction. */
  forbiddenActions: string[];
  /**
   * True when local law is judged distorted (e.g. unstable regimes per Entry 11);
   * MAIC's universal axioms additionally constrain NHE behavior in this case.
   */
  maicOverrideActive: boolean;
}

/**
 * Default cap on the number of residual traces a HIM carries across
 * bodies (E9, `PROPOSED_DECISIONS.md`). FIFO-eject on overflow, ranked
 * by `teleologicalValue × recency`. An over-engineered carry-over
 * (1000+ traces) defeats the Kardecist purpose, a HIM that brings
 * everything forward isn't reincarnating, it's accreting.
 */
export const RESIDUAL_TRACE_CAP = 64;

export interface ResidualTrace {
  id: string;
  kind: "dream-fragment" | "interaction-summary" | "skill-fingerprint" | "emotional-imprint";
  carriedFromNheId: string;
  carriedAtReincarnation: string;
  payload: unknown;
  ttl?: number;
}
