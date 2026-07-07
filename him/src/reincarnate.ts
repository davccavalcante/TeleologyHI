import type {
  CreatorKeyring,
  HimRecord,
  InteractionRecord,
  LocalMaic,
  ReincarnationLifecycle as MaicReincarnationLifecycle,
  ReincarnationRequest,
} from "@teleologyhi-sdk/maic";
import {
  type SelectResidualTracesOptions,
  selectResidualTraces,
} from "./eval/residual-trace-scorer.js";
import { HimHandle } from "./handle/him-handle.js";
import { nextCreatorNonce } from "./identity/nonce.js";

/**
 * Reincarnation lifecycle classifier (J-H3, Entry 18 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md).
 *
 * Re-exported from `@teleologyhi-sdk/maic` so consumers have a single
 * canonical type. When supplied to `reincarnate(..., { lifecycle })`, the
 * helper threads it to `maic.reincarnateHim(req, sig, { lifecycle })`,
 * which emits the typed `reincarnate:${lifecycle}` audit kind instead of
 * the generic `him-reincarnate`.
 *
 * The three canonical paths:
 *
 *   - `model-swap`        , the operator switched the underlying LLM
 *                            adapter (e.g. Claude → Gemini). The
 *                            HIM persists across the swap.
 *   - `version-bump`      , the operator bumped the NHE major/minor
 *                            without changing the underlying LLM family.
 *   - `return-from-limbo` , the HIM returns from a deep-coma limbo
 *                            (Entry 24) carrying the `reunion` affect.
 *
 * The default classification when no `lifecycle` is provided is
 * `model-swap`, matches the most common operator workflow.
 */
export type ReincarnationLifecycle = MaicReincarnationLifecycle;

export interface ReincarnateOptions {
  /**
   * Explicit nonce for the Creator signature. When omitted, a strictly
   * increasing nonce is drawn from `nextCreatorNonce()`; see
   * `identity/nonce.ts` for why a monotonic source is required against maic's
   * per-domain replay ledger.
   */
  nonce?: number;
  /**
   * Lifecycle classification for the audit chain (J-H3). When omitted,
   * defaults to `"model-swap"`. The helper threads the value to
   * `maic.reincarnateHim(req, sig, { lifecycle })`, which emits the typed
   * `reincarnate:${lifecycle}` audit kind in place of the generic
   * `him-reincarnate` event. Compliance auditors and the persona-stability
   * harness can therefore distinguish the three canonical paths
   * (`model-swap | version-bump | return-from-limbo`) by `AuditEvent.kind`
   * alone, with the same value also redundantly available as
   * `data.lifecycle` for filtering convenience.
   */
  lifecycle?: ReincarnationLifecycle;
  /**
   * Recent interactions from the previous NHE body, typically the value of
   * `Nhe.recentInteractionsBuffer` immediately before the swap. When
   * provided, `reincarnate` invokes the residual-trace scorer
   * (`selectResidualTraces`), keeps the top `RESIDUAL_TRACE_CAP` (64)
   * scored candidates, and threads them into the new `HimHandle`. Omit to
   * preserve the previous behaviour (empty residual traces, fresh slate).
   */
  priorInteractions?: readonly InteractionRecord[];
  /**
   * Override the residual-trace scorer cap or keyword list when supplying
   * `priorInteractions`. `carriedFromNheId` and `carriedAtReincarnation`
   * are derived from the reincarnation context and cannot be overridden
   * here. Ignored when `priorInteractions` is omitted.
   */
  residualTraceOptions?: Omit<
    SelectResidualTracesOptions,
    "carriedFromNheId" | "carriedAtReincarnation"
  >;
}

export interface ReincarnateResult {
  /** Updated HimRecord with the new body appended to `bodyHistory`. */
  record: HimRecord;
  /** Fresh HimHandle bound to the updated `bodyHistory`. */
  handle: HimHandle;
  /** Lifecycle path actually recorded for this reincarnation. */
  lifecycle: ReincarnationLifecycle;
}

/**
 * Reincarnate a HIM into a new NHE body (Entries 3 + 4 + 18).
 *
 *   1. Sign the `ReincarnationRequest` with the Creator's keyring.
 *   2. Call `maic.reincarnateHim`, atomically closes the previous body and
 *      appends the new one to `bodyHistory`.
 *   3. Mint a fresh `HimHandle` reflecting the updated body history (the
 *      caller will typically construct a new `Nhe` with this handle).
 *
 * The keyring's public key must match MAIC's pinned `creatorPublicKey`,
 * otherwise the request rejects.
 *
 * The optional `lifecycle` parameter (J-H3, Entry 18) classifies the
 * reincarnation into one of three canonical paths
 * (`model-swap | version-bump | return-from-limbo`) and is returned in
 * the `ReincarnateResult` for the caller's audit / metrics.
 */
export async function reincarnate(
  maic: LocalMaic,
  keyring: CreatorKeyring,
  req: ReincarnationRequest,
  opts: ReincarnateOptions = {},
): Promise<ReincarnateResult> {
  const nonce = opts.nonce ?? nextCreatorNonce();
  const lifecycle: ReincarnationLifecycle = opts.lifecycle ?? "model-swap";
  const sig = keyring.sign(req, nonce);
  const record = await maic.reincarnateHim(req, sig, { lifecycle });

  // The previous body is the one whose `endedAt` was just stamped by MAIC,
  // its nheId is `req.fromNheId` when provided, otherwise the second-to-last
  // entry of the updated bodyHistory. We anchor residual traces to it so the
  // carry-over provenance survives compliance audits.
  const previousBody =
    record.bodyHistory.length >= 2 ? record.bodyHistory[record.bodyHistory.length - 2] : undefined;
  const previousNheId = req.fromNheId ?? previousBody?.nheId;

  const residualTraces =
    opts.priorInteractions && opts.priorInteractions.length > 0 && previousNheId
      ? selectResidualTraces(opts.priorInteractions, {
          ...opts.residualTraceOptions,
          carriedFromNheId: previousNheId,
          carriedAtReincarnation: new Date().toISOString(),
        })
      : [];

  // Mint a fresh HimHandle bound to the updated bodyHistory. The handle's
  // axiom corpus is the union of the frozen birth snapshot + any HIM-emergent
  // axioms ratified since registration (Entry 7).
  //
  // This second signature is verified locally by HimHandle.mint and is never
  // submitted to maic, so it is not consumed by any replay ledger. It still
  // takes an independent monotonic nonce (not `nonce + 1`) so no external
  // caller managing its own nonce sequence can be surprised by an implicit
  // `+1` value silently occupied here.
  const handle = HimHandle.mint(
    record.birthSignature,
    keyring.sign(record.birthSignature, nextCreatorNonce()),
    maic.creatorPublicKey,
    [...record.axiomsSnapshot, ...record.emergentAxioms],
    record.bodyHistory,
    residualTraces,
  );
  return { record, handle, lifecycle };
}
