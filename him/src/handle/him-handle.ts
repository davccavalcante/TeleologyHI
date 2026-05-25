import {
  CreatorKeyring,
  META_AXIOM_ID,
  projectOntologicalKernel,
  type Axiom,
  type AxiomEvolutionResult,
  type BirthSignature,
  type CreatorSignature,
  type EmergentAxiomProposal,
  type LocalMaic,
  type OntologicalKernel,
  type ProjectKernelOptions,
} from "@teleologyhi-sdk/maic";
import { PersonaProjector } from "../persona/projector.js";
import { resolveLawfulProfile } from "../lawful/profiles.js";
import type {
  LawfulCharacterProfile,
  LawfulJurisdiction,
  NheBodyRef,
  PersonaVector,
  ResidualTrace,
} from "../types.js";

/**
 * HimHandle — opaque, sealed reference to a HIM instance.
 *
 * **There is no public constructor.** A handle is minted only via `HimHandle.mint`
 * after a valid Creator signature over the BirthSignature has been verified. In
 * production, `@teleologyhi-sdk/maic`'s `registerHim` calls `HimHandle.mint` internally.
 *
 * Surface:
 *   - read-only accessors: id, birthSignature, bodyHistory, getAxioms, getPersonaVector
 *   - getLawfulCharacter / setJurisdiction (default profile today)
 *   - getResidualTraces (carried over from the previous body when `reincarnate`
 *     scores and threads them via `selectResidualTraces`; empty otherwise)
 *   - proposeAxiomEvolution(maic, proposal): forwards the proposal to MAIC,
 *     which queues it for Creator ratification. Returns
 *     `{ outcome: "deferred-for-creator-review", proposalId }`. Once the
 *     Creator ratifies via `maic.ratifyAxiomProposal`, the resulting axiom is
 *     appended to the HimRecord's `emergentAxioms` and surfaces in subsequent
 *     `HimHandle.mint` calls (e.g. via `reincarnate`).
 */
export class HimHandle {
  private readonly _axioms: readonly Axiom[];
  private readonly _bodyHistory: readonly NheBodyRef[];
  private readonly _residualTraces: readonly ResidualTrace[];
  private readonly _projector: PersonaProjector;
  private _personaCache: PersonaVector | null = null;
  private _jurisdiction: LawfulJurisdiction = "default";

  private constructor(
    public readonly id: string,
    public readonly birthSignature: Readonly<BirthSignature>,
    axioms: readonly Axiom[],
    bodyHistory: readonly NheBodyRef[],
    residualTraces: readonly ResidualTrace[],
    projector: PersonaProjector,
  ) {
    this._axioms = Object.freeze([...axioms]);
    this._bodyHistory = Object.freeze([...bodyHistory]);
    this._residualTraces = Object.freeze([...residualTraces]);
    this._projector = projector;
  }

  /**
   * Mint a HimHandle from a Creator-signed BirthSignature.
   *
   * @param birthSignature  The signed payload describing this HIM's natal pattern.
   * @param signature       Creator signature over the birthSignature.
   * @param expectedCreatorPublicKey  Pinned Creator public key (base64url).
   * @param axioms          Initial axiom corpus inherited from MAIC.
   * @param bodyHistory     Prior NHE bodies (empty for a fresh HIM).
   * @param residualTraces  Optional carry-over traces from the previous body
   *                        (produced by `selectResidualTraces` during a
   *                        `reincarnate` call). Defaults to empty.
   */
  static mint(
    birthSignature: BirthSignature,
    signature: CreatorSignature,
    expectedCreatorPublicKey: string,
    axioms: readonly Axiom[],
    bodyHistory: readonly NheBodyRef[] = [],
    residualTraces: readonly ResidualTrace[] = [],
  ): HimHandle {
    if (
      !CreatorKeyring.verifyWith(
        expectedCreatorPublicKey,
        birthSignature,
        signature,
      )
    ) {
      throw new Error(
        "HimHandle.mint: invalid Creator signature for the given birth signature",
      );
    }
    return new HimHandle(
      birthSignature.himId,
      Object.freeze({ ...birthSignature }) as Readonly<BirthSignature>,
      axioms,
      bodyHistory,
      residualTraces,
      new PersonaProjector(),
    );
  }

  get bodyHistory(): readonly NheBodyRef[] {
    return this._bodyHistory;
  }

  /** Frozen snapshot of the current axiom corpus. Mutations throw in strict mode. */
  getAxioms(): readonly Axiom[] {
    return this._axioms;
  }

  /**
   * Cached deterministic persona projection. Stable across calls until a future
   * iteration introduces axiom evolution that mutates the corpus.
   */
  getPersonaVector(): PersonaVector {
    if (!this._personaCache) {
      this._personaCache = this._projector.project(this.birthSignature, this._axioms);
    }
    return this._personaCache;
  }

  /**
   * Propose an axiom evolution derived from lived experience.
   *
   * Forwards the proposal to MAIC, which queues it in the pending-proposal
   * store. The Creator ratifies or rejects out of band via
   * `maic.ratifyAxiomProposal` / `maic.rejectAxiomProposal`. Callers should
   * poll `maic.getAxiomProposal(result.proposalId!)` to observe the decision,
   * or re-mint a fresh HimHandle (e.g. via `reincarnate`) to pick up newly
   * ratified emergent axioms.
   */
  async proposeAxiomEvolution(
    maic: LocalMaic,
    proposal: EmergentAxiomProposal,
  ): Promise<AxiomEvolutionResult> {
    return maic.proposeAxiomEvolution(this.id, proposal);
  }

  /**
   * Residual memory traces transferred from previous bodies. Populated by
   * `reincarnate` when the caller passes the prior NHE body's interaction
   * buffer (it scores them via `selectResidualTraces`, caps at
   * `RESIDUAL_TRACE_CAP`, and threads the result into `HimHandle.mint`).
   * Empty for a fresh `createHim` or when the caller declined to surface
   * the prior interactions.
   */
  getResidualTraces(): readonly ResidualTrace[] {
    return this._residualTraces;
  }

  /**
   * Project the Ontological Kernel narrowed to this HIM's axiom corpus
   * (per the `@teleologyhi-sdk/maic` SPEC §3.1.3 follow-up note: "The
   * HIM-specific projection (per-HIM kernel narrowed to its
   * primordialAxiomIds) is the natural follow-up but lives upstream in
   * `@teleologyhi-sdk/him` because it needs the HIM context.").
   *
   * The narrowing rule is intersection with `primordialAxiomIds` when the
   * birth signature carries any; otherwise the kernel uses the full
   * axiom corpus the HIM was minted with. The meta-axiom
   * `META_AXIOM_ID` is always retained regardless of the narrowing so
   * the projection remains valid per Entry 13 ("MAIC expands continuously
   * — it is a Conscious Entity"; the meta-axiom is its anchor).
   *
   * The returned kernel is tagged with `himId = this.id` so downstream
   * tooling (compliance auditors, Φ′ runner, `@teleologyhi-sdk/nhe` brain
   * regions) can attribute the projection back to this HIM.
   *
   * @param opts Optional `jurisdiction` filter; `himId` is ignored
   *             because the HimHandle owns its own id.
   */
  projectOntologicalKernel(
    opts: Omit<ProjectKernelOptions, "himId"> = {},
  ): OntologicalKernel {
    const primordialIds = this.birthSignature.primordialAxiomIds;
    const narrowed =
      primordialIds.length > 0
        ? this._axioms.filter(
            (a) => primordialIds.includes(a.id) || a.id === META_AXIOM_ID,
          )
        : this._axioms;
    return projectOntologicalKernel(narrowed, { ...opts, himId: this.id });
  }

  getLawfulCharacter(): LawfulCharacterProfile {
    return resolveLawful(this._jurisdiction);
  }

  /**
   * Switch jurisdiction (e.g. the deployment moves region or a tenant is
   * onboarded under a new regulatory regime). Five baselines ship in
   * `LAWFUL_PROFILES` per D-H2: `default` / `eu` / `br` / `us` /
   * `unstable`. Unknown keys fall back to `default` with the supplied key
   * recorded on the returned profile so the NHE audit shows what the
   * operator asked for. Operators in regulated industries SHOULD layer
   * their own profile on top — the baselines are conservative but do not
   * replace legal counsel.
   */
  async setJurisdiction(j: LawfulJurisdiction): Promise<LawfulCharacterProfile> {
    this._jurisdiction = j;
    return resolveLawful(j);
  }
}

function resolveLawful(j: LawfulJurisdiction): LawfulCharacterProfile {
  return resolveLawfulProfile(j);
}
