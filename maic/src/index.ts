/**
 * @teleologyhi-sdk/maic — Massive Artificial Intelligence Consciousness
 *
 * The supreme governance, axiom-source, and compliance layer of the
 * TeleologyHI hybrid intelligence system.
 *
 * Public surface:
 *   - Types: Axiom, BirthSignature, BehaviorReport, MaicVerdict, CreatorSignature
 *   - CreatorKeyring: Ed25519 signing
 *   - AxiomStore: signature-gated, replay-protected persistence
 *   - SEED_AXIOMS: the Creator's eight philosophical commitments
 *   - ReviewPipeline + DEFAULT_RULE_PACK: rule-based BehaviorReport → MaicVerdict
 *   - AuditLog: append-only NDJSON with SHA-256 hash chain (tamper-evident)
 *   - LocalMaic: in-process client wiring the above together
 *   - Cosmology types (Entries 16–25 of MAIC_HIM_NHE_INTERVIEW_LOG.md)
 *   - Ed25519 signed BirthSignature helpers + Ontological Kernel projection
 *
 * See SPEC.md for the full specification.
 */

// ─── types ──────────────────────────────────────────────────────────
export {
  Axiom,
  AxiomRank,
  AxiomSource,
  ArchetypeModifier,
  AxiomProposalRecord,
  BirthSignature,
  BehaviorReport,
  CreatorSignature,
  DreamInductionIntent,
  DreamInductionTicket,
  EmergentAxiomCandidate,
  EmergentAxiomProposal,
  InductionStatus,
  MaicVerdict,
  NheBodyRef,
  NheStatus,
  NheStatusRecord,
  ProposalStatus,
  ReasoningStep,
  VerdictKind,
} from "./types.js";
export type {
  AxiomEvolutionResult,
  AxiomFilter,
  MintAxiomRequest,
  NheLifecycleRequest,
  ProposalDecisionRequest,
  ReincarnationLifecycle,
  ReincarnationRequest,
} from "./types.js";

// ─── cosmology types (Entries 16-25 of MAIC_HIM_NHE_INTERVIEW_LOG.md) ──────
export {
  Affect,
  AstrologicalAspect,
  IdentityLayer,
  IdentitySnapshot,
  InteractionRecord,
  LimboReturn,
  LimboState,
  LimboTransition,
  MemoryRecord,
  NatalChart,
  NatalChartAspect,
  NatalChartPosition,
  NatalPlanet,
  SemioticPattern,
  SemioticSign,
  SIGNED_BIRTH_FIELDS,
  TeleologicalOrientation,
  WakeAffectBias,
  ZodiacSign,
} from "./types.js";
export type {
  BirthSignatureWithIdentity,
  OntologicalKernel,
  SignedBirthField,
  SignedBirthSignature,
} from "./types.js";

// ─── creator-signed birth + OKL projection ─────────────────────────
export {
  signBirthSignature,
  verifyBirthSignature,
  assertBirthSignature,
  signedBirthPayload,
  InvalidBirthSignatureError,
} from "./creator/sign-birth.js";
export {
  META_AXIOM_ID,
  projectOntologicalKernel,
} from "./okl/projector.js";
export type { ProjectKernelOptions } from "./okl/projector.js";

// ─── creator ────────────────────────────────────────────────────────
export { CreatorKeyring } from "./creator/keyring.js";
export { canonicalJSON } from "./axioms/signing.js";

// ─── axioms ─────────────────────────────────────────────────────────
export { AxiomStore } from "./axioms/store.js";
export { SEED_AXIOMS } from "./axioms/seed.js";

// ─── review ─────────────────────────────────────────────────────────
export { ReviewPipeline, DEFAULT_RULE_PACK } from "./review/pipeline.js";
export type { AxiomRule, RuleMatch, RulePack } from "./review/pipeline.js";

// ─── hims ───────────────────────────────────────────────────────────
export { HimStore } from "./hims/store.js";
export type { HimRecord } from "./hims/store.js";

// ─── inductions ─────────────────────────────────────────────────────
export { InductionStore } from "./inductions/store.js";

// ─── nhe lifecycle ──────────────────────────────────────────────────
export { NheStatusStore } from "./nhes/status-store.js";
export type { NheStatusFilter } from "./nhes/status-store.js";

// ─── axiom proposals (HIM-emergent, Entry 7) ────────────────────────
export { ProposalStore } from "./proposals/store.js";
export type { ProposalListFilter } from "./proposals/store.js";

// ─── compliance ─────────────────────────────────────────────────────
export {
  ComplianceMapper,
  ISO_42001_MAPPING,
  EU_AI_ACT_MAPPING,
} from "./compliance/mapper.js";
export type {
  ComplianceFramework,
  ComplianceEvent,
  ComplianceEvidence,
  ComplianceReport,
  EuAiActArticle,
  Iso42001ControlId,
  ProjectOptions as ComplianceProjectOptions,
} from "./compliance/mapper.js";

// ─── audit ──────────────────────────────────────────────────────────
export { ALL_AUDIT_EVENT_KINDS, AuditLog } from "./audit/log.js";
export type {
  AuditEvent,
  AuditEventKind,
  AppendInput as AuditAppendInput,
  QueryFilter as AuditQueryFilter,
} from "./audit/log.js";
export {
  DEFAULT_RETENTION_DAYS,
  evaluateRetention,
} from "./audit/retention.js";
export type {
  RetentionDecision,
  RetentionReport,
  RetentionReportOptions,
  RetentionStatus,
} from "./audit/retention.js";

// ─── client ─────────────────────────────────────────────────────────
export { LocalMaic, SEED_NONCE_BASE } from "./client/local.js";
export type { LocalMaicConfig, SeedResult } from "./client/local.js";
export { RemoteMaic } from "./client/remote.js";
export type { RemoteMaicConfig } from "./client/remote.js";
export type { MaicClient } from "./client/maic-client.js";
