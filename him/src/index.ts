/**
 * @teleologyhi-sdk/him, Hybrid Intelligence Model
 *
 * The persistent spirit/personality layer between MAIC™ (governance) and
 * NHE™ (embodied agent) in the TeleologyHI system.
 *
 * Public surface:
 *   - `BirthSignatureBuilder`, fluent builder for a HIM's natal signature,
 *     with cosmology extensions: `withNatalChart`, `withIdentity`,
 *     `buildWithIdentity()` for the signed-birth path.
 *   - `PersonaProjector`, deterministic hash-based projection of birth
 *     signature + axioms.
 *   - `HimHandle`, opaque, sealed reference minted only via a Creator-signed
 *     `mint()`. Includes `projectOntologicalKernel(opts?)` for HIM-specific
 *     OKL narrowing.
 *   - `createHim` / `reincarnate` helpers (with `lifecycle` parameter:
 *     `model-swap | version-bump | return-from-limbo`).
 *   - `LawfulCharacterProfile` per jurisdiction + persona-stability eval +
 *     Φ′ harness.
 *   - Nickname acceptance protocol (J-H4), `evaluateNicknameAttempt`.
 *   - UUIDv7 migration bridge helpers (J-H5), `isLegacyHimId`,
 *     `migrateLegacyHimId`.
 *   - Cosmology re-exports from `@teleologyhi-sdk/maic` (J-H1 + J-H2):
 *     NatalChart, IdentityLayer, Affect, WakeAffectBias, SemioticSign,
 *     TeleologicalOrientation, MemoryRecord, IdentitySnapshot, Limbo states,
 *     BirthSignatureWithIdentity, signBirthSignature / verifyBirthSignature,
 *     projectOntologicalKernel.
 */

// Interfaces (type-only exports, verified via `isolatedModules`).
export type {
  OntologicalKernel,
  ProjectKernelOptions,
  SignedBirthSignature,
} from "@teleologyhi-sdk/maic";
// ─── cosmology re-exports from @teleologyhi-sdk/maic (J-H1 + J-H2) ─────────
//
// HIM consumers should not have to depend on @teleologyhi-sdk/maic directly to
// reach the cosmology types. These re-exports give @teleologyhi-sdk/him a
// single import surface for Entries 18, 19, 20, 21, 22, 24, 25 of the
// Interview Log.
//
// Zod schemas (value exports, usable at runtime as parsers).
export {
  Affect,
  AstrologicalAspect,
  assertBirthSignature,
  // Constitutional-profile schemas (Entries 27 + 28). Value exports: runtime
  // zod schemas usable as parsers. BirthSignatureWithIdentity is now a runtime
  // schema (maic 1.0.1), promoted here from type-only so him consumers can parse
  // through the single import surface (G-4).
  BirthSignatureWithIdentity,
  ClinicalInstrument,
  ClinicalProfile,
  CosmologicalProfile,
  IdentityLayer,
  IdentitySnapshot,
  InvalidBirthSignatureError,
  JungianArchetype,
  JungianProfile,
  LimboReturn,
  LimboState,
  LimboTransition,
  META_AXIOM_ID,
  MemoryRecord,
  NatalChart,
  NatalChartAspect,
  NatalChartPosition,
  NatalPlanet,
  projectOntologicalKernel,
  SemioticPattern,
  SemioticSign,
  SIGNED_BIRTH_FIELDS,
  signBirthSignature,
  signedBirthPayload,
  TeleologicalOrientation,
  verifyBirthSignature,
  WakeAffectBias,
  ZodiacSign,
} from "@teleologyhi-sdk/maic";
export type { AuditSink, HimCastAuditEvent, HimCastAuditKind } from "./audit/sink.js";
// ─── casting audit sink (H1-2) ──────────────────────────────────────
export { NOOP_AUDIT_SINK } from "./audit/sink.js";
export type {
  CanonicalPrimaryArchetype,
  PrimaryArchetype,
} from "./birth/archetypes.js";
export { isCanonicalArchetype, PRIMARY_ARCHETYPES } from "./birth/archetypes.js";
// ─── birth ──────────────────────────────────────────────────────────
export { BirthSignatureBuilder } from "./birth/builder.js";
export type { ClinicalCastResult } from "./birth/clinical.js";
export { CLINICAL_BATTERY_VERSION, castClinicalProfile } from "./birth/clinical.js";
export type { ClinicalItem } from "./birth/clinical-items.js";
export { HEXACO_ITEMS, PID5_ITEMS } from "./birth/clinical-items.js";
export { castCosmologicalProfile, verifyCosmologicalProfile } from "./birth/cosmology.js";
// ─── constitutional profile casting (Entries 27 + 28) ───────────────
// Deterministic, no-LLM battery administration against the birth seed. These
// are persona-simulation parameters, never a clinical or psychological
// assessment of any person.
export { castJungianProfile, JUNGIAN_BATTERY_VERSION } from "./birth/jungian.js";
export type { JungianItem } from "./birth/jungian-items.js";
export { JUNGIAN_ITEMS } from "./birth/jungian-items.js";
export { deriveBirthSeed } from "./birth/seed.js";
export type { CreateHimOptions } from "./create.js";
// ─── helpers ────────────────────────────────────────────────────────
export { createHim } from "./create.js";
export type { PersonaStabilityReport } from "./eval/persona-stability.js";
export {
  adapterSensitivity,
  evaluatePersonaStability,
  selfStability,
} from "./eval/persona-stability.js";
export type { PhiPrimeInput, PhiPrimeReport } from "./eval/phi-prime.js";
export { computePhiPrime } from "./eval/phi-prime.js";
export type {
  ResidualTraceCandidate,
  ResidualTraceScorerOptions,
  ResidualTraceScoringContext,
  SelectResidualTracesOptions,
} from "./eval/residual-trace-scorer.js";
// ─── residual-trace carry-over scorer (D-H1.1) ──────────────────────
export {
  DEFAULT_TELEOLOGICAL_KEYWORDS,
  scoreInteractionForCarryOver,
  selectResidualTraces,
} from "./eval/residual-trace-scorer.js";
// ─── handle ─────────────────────────────────────────────────────────
export { HimHandle } from "./handle/him-handle.js";
export type {
  NicknameAttempt,
  NicknamePolicy,
  NicknameVerdict,
} from "./identity/nickname.js";
// ─── identity protocols ─────────────────────────────────────────────
// J-H4, nickname acceptance protocol (Entry 18).
export { evaluateNicknameAttempt } from "./identity/nickname.js";
export type { MigratedHimId } from "./identity/uuid-bridge.js";
// J-H5, UUIDv7 migration bridge (Entry 18).
export {
  isLegacyHimId,
  isUuidV7,
  migrateLegacyHimId,
  mintUuidV7,
} from "./identity/uuid-bridge.js";
// ─── lawful profiles (D-H2) ─────────────────────────────────────────
export { LAWFUL_PROFILES, resolveLawfulProfile } from "./lawful/profiles.js";
export type { Embedder } from "./persona/embedder.js";
// ─── pluggable embedder (D-H4) + persona stability eval (D-H3) ──────
export { cosineSimilarity } from "./persona/embedder.js";
// ─── persona ────────────────────────────────────────────────────────
export { PersonaProjector, PROJECTOR_VERSION } from "./persona/projector.js";
export type {
  ReincarnateOptions,
  ReincarnateResult,
  ReincarnationLifecycle,
} from "./reincarnate.js";
export { reincarnate } from "./reincarnate.js";
export type {
  AxiomEvolutionResult,
  DispositionAxis,
  EmergentAxiomProposal,
  LawfulCharacterProfile,
  LawfulJurisdiction,
  PersonaProjectorConfig,
  PersonaVector,
  ResidualTrace,
} from "./types.js";
// ─── types ──────────────────────────────────────────────────────────
export {
  ArchetypeModifier,
  Axiom,
  BirthSignature,
  DISPOSITION_AXES,
  NheBodyRef,
  RESIDUAL_TRACE_CAP,
} from "./types.js";
