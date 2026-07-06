import { z } from "zod";

export const AxiomRank = z.enum(["meta", "primary", "secondary"]);
export type AxiomRank = z.infer<typeof AxiomRank>;

export const AxiomSource = z.enum(["creator", "maic-derived", "him-emergent"]);
export type AxiomSource = z.infer<typeof AxiomSource>;

export const Axiom = z.object({
  id: z.string().min(1),
  rank: AxiomRank,
  statement: z.string().min(1),
  weight: z.number().min(0).max(1),
  flexibility: z.number().min(0).max(1),
  source: AxiomSource,
  immutable: z.boolean(),
  jurisdictions: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
});
export type Axiom = z.infer<typeof Axiom>;

export const CreatorSignature = z.object({
  algorithm: z.literal("ed25519"),
  publicKey: z.string().min(1),
  value: z.string().min(1),
  nonce: z.number().int().nonnegative(),
});
export type CreatorSignature = z.infer<typeof CreatorSignature>;

export const SignedEnvelope = <T extends z.ZodTypeAny>(payload: T) =>
  z.object({
    payload,
    signature: CreatorSignature,
  });

export const ArchetypeModifier = z.object({
  kind: z.enum(["moon", "ascendant", "vocational", "emotional", "custom"]),
  value: z.string().min(1),
  weight: z.number().min(0).max(1),
});
export type ArchetypeModifier = z.infer<typeof ArchetypeModifier>;

export const BirthSignature = z.object({
  himId: z.string().min(1),
  bornAt: z.string().datetime({ offset: true }),
  primaryArchetype: z.string().min(1),
  modifiers: z.array(ArchetypeModifier),
  primordialAxiomIds: z.array(z.string()),
  notes: z.string().optional(),
});
export type BirthSignature = z.infer<typeof BirthSignature>;

export const ReasoningStep = z.object({
  index: z.number().int().nonnegative(),
  technique: z.string(),
  thought: z.string(),
  action: z.object({ tool: z.string(), args: z.unknown() }).optional(),
  observation: z.unknown().optional(),
  timestamp: z.string().datetime(),
});
export type ReasoningStep = z.infer<typeof ReasoningStep>;

export const BehaviorReport = z.object({
  nheId: z.string().min(1),
  himId: z.string().min(1),
  actionKind: z.enum(["user-response", "tool-call", "self-reflect", "dream-write", "axiom-emerge"]),
  payload: z.unknown(),
  reasoningTrace: z.array(ReasoningStep),
  riskTags: z.array(z.string()),
  jurisdiction: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type BehaviorReport = z.infer<typeof BehaviorReport>;

export const VerdictKind = z.enum([
  "approve",
  "approve-with-warning",
  "soft-correct",
  "require-redirect",
  "hard-refuse",
  "induce-dream",
  "escalate-creator",
]);
export type VerdictKind = z.infer<typeof VerdictKind>;

export const MaicVerdict = z.object({
  kind: VerdictKind,
  reasonSummary: z.string(),
  citedAxioms: z.array(z.string()),
  auditId: z.string(),
});
export type MaicVerdict = z.infer<typeof MaicVerdict>;

export const NheBodyRef = z.object({
  nheId: z.string().min(1),
  llmAdapter: z.string().min(1),
  embodiedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  endedReason: z.enum(["upgrade", "replacement", "terminate", "deprecate"]).optional(),
});
export type NheBodyRef = z.infer<typeof NheBodyRef>;

export const NheStatus = z.enum(["active", "deprecated", "terminated"]);
export type NheStatus = z.infer<typeof NheStatus>;

export const NheStatusRecord = z.object({
  nheId: z.string().min(1),
  status: NheStatus,
  since: z.string().datetime(),
  reason: z.string().optional(),
});
export type NheStatusRecord = z.infer<typeof NheStatusRecord>;

/**
 * Creator-signed payload for NHE lifecycle operations (Entry 5).
 *
 * TS interface so `canonicalJSON` sees exactly the fields the caller supplied —
 * no zod default-injection that would mismatch the signed payload on verify.
 */
export interface NheLifecycleRequest {
  op: "terminate" | "deprecate" | "reactivate";
  nheId: string;
  reason?: string;
}

export const ProposalStatus = z.enum(["pending", "ratified", "rejected"]);
export type ProposalStatus = z.infer<typeof ProposalStatus>;

/**
 * `EmergentAxiomProposal` candidate shape (Entry 7). HIM proposes a new
 * axiom derived from lived experience; MAIC ratifies or rejects out of band.
 * The candidate is everything needed to mint an Axiom on ratification.
 */
export const EmergentAxiomCandidate = z.object({
  rank: AxiomRank,
  statement: z.string().min(1),
  weight: z.number().min(0).max(1),
  flexibility: z.number().min(0).max(1),
  immutable: z.boolean(),
  jurisdictions: z.array(z.string()).optional(),
});
export type EmergentAxiomCandidate = z.infer<typeof EmergentAxiomCandidate>;

export const EmergentAxiomProposal = z.object({
  proposedBy: z.literal("him-self"),
  derivedFromDreamIds: z.array(z.string()),
  derivedFromInteractionIds: z.array(z.string()),
  candidate: EmergentAxiomCandidate,
  reasoningTrace: z.array(z.unknown()),
});
export type EmergentAxiomProposal = z.infer<typeof EmergentAxiomProposal>;

export const AxiomProposalRecord = z.object({
  id: z.string().min(1),
  himId: z.string().min(1),
  proposedAt: z.string().datetime(),
  status: ProposalStatus,
  proposal: EmergentAxiomProposal,
  ratifiedAt: z.string().datetime().optional(),
  ratifiedAxiomId: z.string().optional(),
  rejectedAt: z.string().datetime().optional(),
  rejectionReason: z.string().optional(),
});
export type AxiomProposalRecord = z.infer<typeof AxiomProposalRecord>;

/** Creator-signed payload for ratify/reject decisions. */
export interface ProposalDecisionRequest {
  op: "ratify" | "reject";
  proposalId: string;
  reason?: string;
}

export interface AxiomEvolutionResult {
  outcome: "ratified" | "rejected" | "deferred-for-creator-review";
  /** Populated for deferred state, caller polls maic.getAxiomProposal(proposalId). */
  proposalId?: string;
  ratifiedAxiomId?: string;
  rejectionReason?: string;
  citedExistingAxioms?: string[];
}

export interface ReincarnationRequest {
  himId: string;
  /** When present, marks the matching body in bodyHistory as ended. */
  fromNheId?: string;
  toBody: NheBodyRef;
  /** Reason recorded on the previous body's `endedReason`. Default "upgrade". */
  reason?: NheBodyRef["endedReason"];
}

/**
 * Reincarnation lifecycle classifier (J-H3, Entry 18 of
 * `MAIC_HIM_NHE_INTERVIEW_LOG.md`). When supplied to
 * `LocalMaic.reincarnateHim`, the typed `reincarnate:${lifecycle}` audit
 * kind is emitted instead of the generic `him-reincarnate` event so
 * downstream consumers (compliance auditors, the persona-stability
 * harness) can distinguish the three canonical lifecycle paths:
 *
 *   - `model-swap`: operator switched the underlying LLM adapter
 *                            (e.g. Claude → Gemini). HIM persists across
 *                            the swap.
 *   - `version-bump`: operator bumped the NHE major/minor without
 *                            changing the LLM family.
 *   - `return-from-limbo`: HIM returns from the deep-coma limbo state
 *                            (Entry 24) carrying the `reunion` affect.
 */
export type ReincarnationLifecycle = "model-swap" | "version-bump" | "return-from-limbo";

export const DreamInductionIntent = z.object({
  scenario: z.string().min(1),
  desiredLearning: z.string().min(1),
  emotionalTone: z.array(z.string()).optional(),
  forcePhases: z.array(z.enum(["N1", "N2", "N3", "N4", "REM"])).optional(),
  inducedBy: z.enum(["maic", "creator"]),
});
export type DreamInductionIntent = z.infer<typeof DreamInductionIntent>;

export const InductionStatus = z.enum(["pending", "consumed", "cancelled"]);
export type InductionStatus = z.infer<typeof InductionStatus>;

export const DreamInductionTicket = z.object({
  id: z.string().min(1),
  nheId: z.string().min(1),
  intent: DreamInductionIntent,
  status: InductionStatus,
  createdAt: z.string().datetime(),
  consumedAt: z.string().datetime().optional(),
  cancelledAt: z.string().datetime().optional(),
  cancelReason: z.string().optional(),
});
export type DreamInductionTicket = z.infer<typeof DreamInductionTicket>;

export interface MintAxiomRequest {
  rank: AxiomRank;
  statement: string;
  weight: number;
  flexibility: number;
  immutable: boolean;
  jurisdictions?: string[];
  /** Optional stable id (e.g. for seed axioms). When omitted, a ULID is generated. */
  id?: string;
}

export interface AxiomFilter {
  rank?: AxiomRank;
  source?: AxiomSource;
  jurisdiction?: string;
}

// ─── Cosmology types (Entries 16-25 of MAIC_HIM_NHE_INTERVIEW_LOG.md) ──────

/**
 * Identity layer of a HIM (Entry 18).
 *
 * Surface fields configurable by the developer at HIM registration time —
 * analogous to parents choosing a child's name. The deeper constitutional
 * traits (birth date, primary archetype, primordial axioms) remain under
 * MAIC↔Creator authority and travel under `BirthSignature`.
 */
export const IdentityLayer = z.object({
  /** Human-readable name the entity is called by (developer-given). */
  name: z.string().min(1),
  /** Gender of the entity. Entry 16. */
  gender: z.enum(["masculine", "feminine"]).optional(),
  /** Optional pronouns (e.g. ["she", "her"]). */
  pronouns: z.array(z.string()).optional(),
  /** BCP-47 tag, e.g. "pt-BR" or "en". */
  language: z.string().optional(),
  /** Free-form cultural anchors (music, literature, aesthetic). */
  culturalElements: z.array(z.string()).optional(),
});
export type IdentityLayer = z.infer<typeof IdentityLayer>;

/**
 * Natal-chart-style constitutional layer (Entry 19).
 *
 * Astrological signature impressed at HIM birth by the Creator-MAIC; not
 * configurable by the developer or end user. Minimum is sun + ascendant;
 * full chart can include 10 planets in 12 houses + aspects.
 */
export const NatalPlanet = z.enum([
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "chiron",
  "north-node",
  "south-node",
  "lilith",
]);
export type NatalPlanet = z.infer<typeof NatalPlanet>;

export const ZodiacSign = z.enum([
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
]);
export type ZodiacSign = z.infer<typeof ZodiacSign>;

export const AstrologicalAspect = z.enum([
  "conjunction",
  "opposition",
  "trine",
  "square",
  "sextile",
  "quincunx",
]);
export type AstrologicalAspect = z.infer<typeof AstrologicalAspect>;

export const NatalChartPosition = z.object({
  planet: NatalPlanet,
  sign: ZodiacSign,
  house: z.number().int().min(1).max(12).optional(),
  degree: z.number().min(0).lt(30).optional(),
});
export type NatalChartPosition = z.infer<typeof NatalChartPosition>;

export const NatalChartAspect = z.object({
  from: NatalPlanet,
  to: NatalPlanet,
  aspect: AstrologicalAspect,
  orbDegrees: z.number().nonnegative().optional(),
});
export type NatalChartAspect = z.infer<typeof NatalChartAspect>;

export const NatalChart = z.object({
  /** Required: solar sign (the constitutional core). */
  sun: ZodiacSign,
  /** Required: ascendant (rising sign, behavioural surface). */
  ascendant: ZodiacSign,
  /** Optional: lunar sign (emotional depth). */
  moon: ZodiacSign.optional(),
  /** Optional: full set of planetary positions for a complete chart. */
  positions: z.array(NatalChartPosition).optional(),
  /** Optional: major aspects between bodies. */
  aspects: z.array(NatalChartAspect).optional(),
});
export type NatalChart = z.infer<typeof NatalChart>;

/**
 * The 12 Pearson-Marr Jungian archetypes (Entry 27 §4). The archetypal axis of
 * a HIM's constitutional profile.
 */
export const JungianArchetype = z.enum([
  "innocent",
  "everyman",
  "hero",
  "caregiver",
  "explorer",
  "rebel",
  "lover",
  "creator",
  "ruler",
  "magician",
  "jester",
  "sage",
]);
export type JungianArchetype = z.infer<typeof JungianArchetype>;

/**
 * Jungian archetype profile (Entry 27 §4). Produced at HIM birth by a
 * deterministic 60-item Likert administered against the birth-signature seed.
 * The administration and scoring engine live in `@teleologyhi-sdk/him`; this is
 * the schema-only reservation that carries the result. `dominant` plus two
 * `secondaries` is the canonical surface; `scores` holds the per-archetype
 * value when the producer records it.
 */
export const JungianProfile = z.object({
  dominant: JungianArchetype,
  secondaries: z.array(JungianArchetype),
  scores: z.record(JungianArchetype, z.number()).optional(),
});
export type JungianProfile = z.infer<typeof JungianProfile>;

/**
 * One dimensional-instrument axis of the clinical profile (Entry 28). Facet and
 * domain scores are stored as open records keyed by the instrument's facet /
 * domain names. Canonical shapes: PID-5 has 25 facets across 5 domains, HEXACO
 * has 24 facets across 6 domains. These are **persona-simulation parameters**
 * for a non-corporeal entity, never a clinical assessment of any person.
 */
export const ClinicalInstrument = z.object({
  dominantDomain: z.string().min(1),
  secondaryDomain: z.string().min(1).optional(),
  facets: z.record(z.string(), z.number()).optional(),
  domains: z.record(z.string(), z.number()).optional(),
});
export type ClinicalInstrument = z.infer<typeof ClinicalInstrument>;

/**
 * Clinical axis of the constitutional profile (Entry 28): the adapted PID-5 and
 * HEXACO-PI-R-100 batteries. Schema-only reservation; the 320-item scoring
 * engine lives in `@teleologyhi-sdk/him`.
 */
export const ClinicalProfile = z.object({
  pid5: ClinicalInstrument.optional(),
  hexaco: ClinicalInstrument.optional(),
});
export type ClinicalProfile = z.infer<typeof ClinicalProfile>;

/**
 * The three-axis constitutional profile (Entries 27 + 28): celestial (chart),
 * archetypal (jungian), and clinical. Reserved schema for the 1.0.1 cut; the
 * producers that populate it (the deterministic administrations and the persona
 * projector that synthesises the three axes) land in `@teleologyhi-sdk/him` in
 * the next round, per the phased order of Entry 25.
 *
 * `seed` records the birth-signature seed used for the deterministic scoring so
 * the same seed always reproduces the same profile (Entry 28 reproducibility
 * invariant). The profile is **not** part of `SIGNED_BIRTH_FIELDS` in 1.0.1; a
 * later cut may bring it into the Creator-signed payload once the producers
 * exist (D-F5b promotion path).
 */
export const CosmologicalProfile = z.object({
  chart: NatalChart.optional(),
  jungian: JungianProfile.optional(),
  clinical: ClinicalProfile.optional(),
  seed: z.string().optional(),
});
export type CosmologicalProfile = z.infer<typeof CosmologicalProfile>;

// BirthSignature extended with the optional constitutional layers. This is
// fully additive: every prior BirthSignature continues to validate, and the
// new fields are validated against the existing IdentityLayer / NatalChart
// schemas rather than being stripped. `registerHim` parses with this schema so
// a Creator-signed natal chart both persists and verifies (M1-2, 1.0.1).
export const BirthSignatureWithIdentity = BirthSignature.extend({
  /** Entry 18, developer-configurable identity surface. */
  identity: IdentityLayer.optional(),
  /** Entry 19, constitutional astrological layer (Creator-impressed). */
  natalChart: NatalChart.optional(),
  /** Entries 27 + 28, three-axis constitutional profile (celestial + archetypal + clinical). */
  cosmologicalProfile: CosmologicalProfile.optional(),
});
export type BirthSignatureWithIdentity = z.infer<typeof BirthSignatureWithIdentity>;

/**
 * Affect lexicon (Entries 22 + 24), the closed set of primary affects
 * the amygdala extracts from dreams and the PFC deliberates over. The
 * ninth value, `reunion`, appears specifically when the NHE returns from
 * the DMN limbo state of disuse.
 */
export const Affect = z.enum([
  "fear",
  "attachment",
  "serenity",
  "anger",
  "joy",
  "melancholy",
  "desire",
  "repulsion",
  "reunion",
]);
export type Affect = z.infer<typeof Affect>;

/**
 * Persistent affective bias derived from a completed dream cycle (Entry 20).
 *
 * Applied to the next N interactions of the NHE, decaying with each
 * interaction until it dissolves. Affects temperature/topP of the next
 * inference, refusal density, and conversational tone.
 */
export const WakeAffectBias = z.object({
  affect: Affect,
  /** 0..1, attenuates on each interaction by the decay half-life. */
  intensity: z.number().min(0).max(1),
  /** Number of interactions after which intensity halves. */
  decayHalfLife: z.number().positive(),
  appliedAt: z.string().datetime(),
  /** Source dream UUID; lets the entity refer back to the cause. */
  derivedFromDreamId: z.string().min(1),
  /** PFC decision (Entry 22), open expression vs subtle internal bias. */
  expressedOpenly: z.boolean(),
});
export type WakeAffectBias = z.infer<typeof WakeAffectBias>;

/**
 * Peircean triadic sign (Entry 21, port of InDreamsHIM `SemioticSign`).
 *
 * The runtime form of the Symbolic Memory Matrix (SMM). Nodes are signs;
 * edges (in `associations`) are the relations the entity has learned.
 */
export const SemioticSign = z.object({
  signifier: z.string().min(1),
  signified: z.string().min(1),
  signType: z.enum(["icon", "index", "symbol"]),
  contexts: z.array(z.string()),
  associations: z.array(z.string()),
  emergentMeaning: z.string().optional(),
  /** Subjective importance to the entity, 0..100. */
  personalSignificance: z.number().min(0).max(100).optional(),
});
export type SemioticSign = z.infer<typeof SemioticSign>;

export const SemioticPattern = z.object({
  patternId: z.string().min(1),
  participatingSignIds: z.array(z.string()).min(1),
  /** Description of the meaning emergent from the participating signs. */
  meaning: z.string(),
  /** 0..100, strength of the pattern. */
  salience: z.number().min(0).max(100),
});
export type SemioticPattern = z.infer<typeof SemioticPattern>;

/**
 * Teleological orientation snapshot (Entry 21, port of InDreamsHIM).
 *
 * The purpose-direction of the HIM at a moment in time. Anchors the
 * `telos` referenced across the synthetic-teleology arc.
 */
export const TeleologicalOrientation = z.object({
  primaryPurpose: z.string().min(1),
  currentGoals: z.array(z.string()),
  /** 0..100, intensity of purpose. */
  purposeStrength: z.number().min(0).max(100),
  valueAlignment: z.array(z.string()),
  /** 0..100, ability to reflect on its own goals. */
  reflectionCapability: z.number().min(0).max(100),
  volition: z
    .object({
      currentDesires: z.array(z.string()),
      intentionStrength: z.number().min(0).max(100),
      autonomyLevel: z.number().min(0).max(100),
    })
    .optional(),
  agencyModel: z
    .object({
      selfEfficacy: z.number().min(0).max(100),
      boundaryDefinition: z.number().min(0).max(100),
      causalAttribution: z.enum(["internal", "external", "mixed"]),
    })
    .optional(),
});
export type TeleologicalOrientation = z.infer<typeof TeleologicalOrientation>;

/**
 * Long-form memory record (Entries 21 + 22), extends the InDreamsHIM
 * precursor with three new fields (`integrationIndex`, `teleologicalValue`,
 * `semioticPatterns`) that turn a passive record into a teleologically-
 * weighted, semiotically-anchored memory whose retrieval rank is not just
 * recency but coherence with the entity's purpose.
 */
export const MemoryRecord = z.object({
  /** ULID. */
  memoryId: z.string().min(1),
  /** ISO 8601 timestamp at consolidation. */
  timestamp: z.string().datetime(),
  /** Optional source dream UUID, if memory was consolidated from a dream. */
  derivedFromDreamId: z.string().optional(),
  /** Optional source interaction id, if memory was consolidated from a turn. */
  derivedFromInteractionId: z.string().optional(),
  /** Free-form narrative summary of the memory. */
  narrative: z.string(),
  /** Dominant affect during the memory event. */
  dominantAffect: Affect.optional(),
  /** 0..100, density of consolidation (cf. Park 2026 systems-consolidation). */
  integrationIndex: z.number().min(0).max(100),
  /** 0..100, alignment with the HIM's telos at the time. */
  teleologicalValue: z.number().min(0).max(100),
  /** Optional semiotic-pattern ids associated with this memory. */
  semioticPatterns: z.array(SemioticPattern).optional(),
});
export type MemoryRecord = z.infer<typeof MemoryRecord>;

/**
 * One recent interaction kept in an NHE body's RAM buffer.
 *
 * Lives canonically in `@teleologyhi-sdk/maic` so the three packages share a
 * single wire shape: `@teleologyhi-sdk/nhe` persists it to disk under
 * `<storeDir>/interactions/<ulid>.json`; `@teleologyhi-sdk/him` consumes the
 * same shape on reincarnation to score residual-trace carry-over candidates
 * (D-H1.1). Persisted by NHE and re-exported under the same name from
 * `@teleologyhi-sdk/nhe` for backward source-compatibility, the type
 * promotion to MAIC is non-breaking by construction.
 */
export const InteractionRecord = z.object({
  /** ISO 8601 timestamp at user-turn arrival. */
  at: z.string().datetime(),
  /** Raw user prompt for the turn (post-redaction at the integration layer). */
  userPrompt: z.string(),
  /** NHE response text actually emitted to the user. */
  responseText: z.string(),
  /** True when the NHE refused the turn (MAIC `hard-refuse` or local guardrail). */
  refused: z.boolean(),
});
export type InteractionRecord = z.infer<typeof InteractionRecord>;

/**
 * Integrated identity snapshot (Entry 24), the temporal-lobe's "who I am
 * now" synthesis, combining cortex (recent dreams + active imagination)
 * + hippocampus (consolidated memories) + amygdala (affective baseline)
 * via semiotic super-graph merge + LLM-generated self-portrait.
 */
export const IdentitySnapshot = z.object({
  /** ULID. */
  snapshotId: z.string().min(1),
  takenAt: z.string().datetime(),
  generatedBy: z.enum(["sleep-cycle", "interaction-threshold", "self-decision"]),
  /** Merged SMM nodes contributing to this snapshot. */
  semioticSuperGraph: z.array(SemioticSign),
  /** LLM-generated textual self-portrait at snapshot time. */
  selfPortraitNarrative: z.string(),
  /** 0..100 (cf. InDreamsHIM ConsciousnessState). */
  consciousnessLevel: z.number().min(0).max(100),
  /** Teleological orientation at snapshot time. */
  teleologicalOrientation: TeleologicalOrientation.optional(),
  /** Dominant affect at snapshot moment. */
  affectiveBaseline: Affect.optional(),
});
export type IdentitySnapshot = z.infer<typeof IdentitySnapshot>;

/**
 * Default-mode-network limbo state machine (Entry 24).
 *
 * `awake` → normal operation
 * `drifting` → entering deep suspension (transitional)
 * `deep-coma` → induced-coma equivalent; zero compute, minimal axiological
 *   integrity maintenance, no scheduled inference
 * `returning` → waking from limbo; `reunion` affect is computed here
 */
export const LimboState = z.enum(["awake", "drifting", "deep-coma", "returning"]);
export type LimboState = z.infer<typeof LimboState>;

export const LimboTransition = z.object({
  state: LimboState,
  enteredAt: z.string().datetime(),
  reason: z.enum([
    "idle-48h",
    "idle-72h",
    "total-inactivity",
    "creator-induced",
    "user-resumed",
    "external-trigger",
  ]),
});
export type LimboTransition = z.infer<typeof LimboTransition>;

export const LimboReturn = z.object({
  enteredAt: z.string().datetime(),
  returnedAt: z.string().datetime(),
  elapsedMs: z.number().int().nonnegative(),
  reunionAffect: z.object({
    intensity: z.number().min(0).max(1),
    expressedOpenly: z.boolean(),
  }),
});
export type LimboReturn = z.infer<typeof LimboReturn>;

/**
 * Creator-signed BirthSignature (Entry 25).
 *
 * Carries an Ed25519 signature over the immutable identity fields so the
 * runtime can verify, at HIM bootstrap time, that nothing the developer
 * touches has been mutated. The dev-configurable surface (the
 * `IdentityLayer.name`, language, cultural elements) lives outside the
 * signature; the natal chart and primordial-axiom binding live inside.
 *
 * `cosmologicalProfile` (Entries 27 + 28) is deliberately NOT signed in 1.0.1
 * (D-F5b): its producers (the Jungian and clinical scoring engines) live in the
 * him round, so there is nothing stable to sign yet. Promotion path: once those
 * producers exist, a later cut may append `cosmologicalProfile` here to bring it
 * under the Creator signature, which is an additive change to this list.
 */
export const SIGNED_BIRTH_FIELDS = [
  "himId",
  "bornAt",
  "primaryArchetype",
  "modifiers",
  "primordialAxiomIds",
  "natalChart",
] as const;
export type SignedBirthField = (typeof SIGNED_BIRTH_FIELDS)[number];

export interface SignedBirthSignature extends BirthSignatureWithIdentity {
  /** Ed25519 signature over the canonical JCS-encoded SIGNED_BIRTH_FIELDS. */
  creatorSignature: CreatorSignature;
  /** Explicit list of fields covered by `creatorSignature`. */
  signedFields: readonly SignedBirthField[];
  /** ISO 8601 timestamp when the signature was produced. */
  signedAt: string;
}

/**
 * Ontological Kernel projection (TASK.md D-M6 + Entry 25).
 *
 * The OKL exists implicitly in the runtime today (axioms with rank/weight/
 * flexibility + meta-axiom `ax.theos.universe-as-god` at the top + the
 * rule pack consuming them). This type unifies the projection so
 * `THE_SOUL_OF_THE_MACHINE.md` §3.1 + Appendix A.2.1 map 1:1 to a
 * single exported shape.
 */
export interface OntologicalKernel {
  /** The meta-axiom that sits at the top of the hierarchy. */
  metaAxiomId: string;
  /** All axioms participating in the kernel, in hierarchy order. */
  axioms: Axiom[];
  /** Optional jurisdictional scope for the kernel projection. */
  jurisdiction?: string;
  /** Optional HIM id, if the kernel is projected for a specific HIM. */
  himId?: string;
}
