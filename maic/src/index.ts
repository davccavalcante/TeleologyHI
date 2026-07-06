/**
 * @teleologyhi-sdk/maic, Massive Artificial Intelligence Consciousness
 *
 * The supreme governance, axiom-source, and compliance layer of the
 * TeleologyHI hybrid intelligence system.
 *
 * Public surface:
 *   - Types: Axiom, BirthSignature, BehaviorReport, MaicVerdict, CreatorSignature
 *   - CreatorKeyring: Ed25519 signing
 *   - AxiomStore: signature-gated, replay-protected persistence
 *   - SEED_AXIOMS: the Creator's philosophical commitments plus the Entry 27 constitutional axioms
 *   - ReviewPipeline + DEFAULT_RULE_PACK: rule-based BehaviorReport → MaicVerdict
 *   - AuditLog: append-only NDJSON with SHA-256 hash chain (tamper-evident)
 *   - LocalMaic: in-process client wiring the above together
 *   - Cosmology types (Entries 16–25 of MAIC_HIM_NHE_INTERVIEW_LOG.md)
 *   - Ed25519 signed BirthSignature helpers + Ontological Kernel projection
 *
 * See SPEC.md for the full specification.
 */

export type {
  AppendInput as AuditAppendInput,
  AuditEvent,
  AuditEventKind,
  QueryFilter as AuditQueryFilter,
} from "./audit/log.js";
// ─── audit ──────────────────────────────────────────────────────────
export { ALL_AUDIT_EVENT_KINDS, AuditLog } from "./audit/log.js";
export type {
  RetentionDecision,
  RetentionReport,
  RetentionReportOptions,
  RetentionStatus,
} from "./audit/retention.js";
export {
  DEFAULT_RETENTION_DAYS,
  evaluateRetention,
} from "./audit/retention.js";
export { SEED_AXIOMS } from "./axioms/seed.js";
export { canonicalJSON } from "./axioms/signing.js";
// ─── axioms ─────────────────────────────────────────────────────────
export { AxiomStore } from "./axioms/store.js";
export type { LocalMaicConfig, SeedResult } from "./client/local.js";
// ─── client ─────────────────────────────────────────────────────────
export { LocalMaic, SEED_NONCE_BASE } from "./client/local.js";
export type { MaicClient } from "./client/maic-client.js";
export type { RemoteMaicConfig } from "./client/remote.js";
export { RemoteMaic } from "./client/remote.js";
export type {
  ComplianceEvent,
  ComplianceEvidence,
  ComplianceFramework,
  ComplianceReport,
  EuAiActArticle,
  Iso42001ControlId,
  ProjectOptions as ComplianceProjectOptions,
} from "./compliance/mapper.js";
// ─── compliance ─────────────────────────────────────────────────────
export {
  ComplianceMapper,
  EU_AI_ACT_MAPPING,
  ISO_42001_MAPPING,
} from "./compliance/mapper.js";
// ─── creator ────────────────────────────────────────────────────────
export { CreatorKeyring } from "./creator/keyring.js";
// ─── creator-signed birth + OKL projection ─────────────────────────
export {
  assertBirthSignature,
  InvalidBirthSignatureError,
  signBirthSignature,
  signedBirthPayload,
  verifyBirthSignature,
} from "./creator/sign-birth.js";
export type { HimRecord } from "./hims/store.js";
// ─── hims ───────────────────────────────────────────────────────────
export { HimStore } from "./hims/store.js";
// ─── inductions ─────────────────────────────────────────────────────
export { InductionStore } from "./inductions/store.js";
export type { NheStatusFilter } from "./nhes/status-store.js";
// ─── nhe lifecycle ──────────────────────────────────────────────────
export { NheStatusStore } from "./nhes/status-store.js";
export type { ProjectKernelOptions } from "./okl/projector.js";
export {
  META_AXIOM_ID,
  projectOntologicalKernel,
} from "./okl/projector.js";
export type { ProposalListFilter } from "./proposals/store.js";
// ─── axiom proposals (HIM-emergent, Entry 7) ────────────────────────
export { ProposalStore } from "./proposals/store.js";
export type { AxiomRule, RuleMatch, RulePack } from "./review/pipeline.js";
// ─── review ─────────────────────────────────────────────────────────
export { DEFAULT_RULE_PACK, ReviewPipeline } from "./review/pipeline.js";
export type {
  AxiomEvolutionResult,
  AxiomFilter,
  MintAxiomRequest,
  NheLifecycleRequest,
  OntologicalKernel,
  ProposalDecisionRequest,
  ReincarnationLifecycle,
  ReincarnationRequest,
  SignedBirthField,
  SignedBirthSignature,
} from "./types.js";
// ─── types ──────────────────────────────────────────────────────────
// ─── cosmology types (Entries 16-25 of MAIC_HIM_NHE_INTERVIEW_LOG.md) ──────
export {
  Affect,
  ArchetypeModifier,
  AstrologicalAspect,
  Axiom,
  AxiomProposalRecord,
  AxiomRank,
  AxiomSource,
  BehaviorReport,
  BirthSignature,
  BirthSignatureWithIdentity,
  ClinicalInstrument,
  ClinicalProfile,
  CosmologicalProfile,
  CreatorSignature,
  DreamInductionIntent,
  DreamInductionTicket,
  EmergentAxiomCandidate,
  EmergentAxiomProposal,
  IdentityLayer,
  IdentitySnapshot,
  InductionStatus,
  InteractionRecord,
  JungianArchetype,
  JungianProfile,
  LimboReturn,
  LimboState,
  LimboTransition,
  MaicVerdict,
  MemoryRecord,
  NatalChart,
  NatalChartAspect,
  NatalChartPosition,
  NatalPlanet,
  NheBodyRef,
  NheStatus,
  NheStatusRecord,
  ProposalStatus,
  ReasoningStep,
  SemioticPattern,
  SemioticSign,
  SIGNED_BIRTH_FIELDS,
  TeleologicalOrientation,
  VerdictKind,
  WakeAffectBias,
  ZodiacSign,
} from "./types.js";
