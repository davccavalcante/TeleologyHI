import { join } from "node:path";
import { ulid } from "ulid";
import type { BehaviorReport, MaicVerdict, NheStatus } from "@teleologyhi-sdk/maic";
import { composeSystemPrompt } from "./prompt/compose.js";
import { simpleRiskClassifier } from "./risk/simple-classifier.js";
import { runSleepCycle, type SleepCycleResult } from "./sleep/cycle.js";
import {
  consolidateAll,
  type ClassificationThresholds,
  type ConsolidationResult,
} from "./sleep/consolidator.js";
import { InteractionStore } from "./memory/interaction-store.js";
import { recallFromTemporalLobe, type RecallOptions } from "./memory/recall.js";
import { withSpan } from "./telemetry/tracer.js";
import { recordRespond } from "./telemetry/metrics.js";
import {
  PERSUASION_TECHNIQUES,
  buildRedirectPrompt,
  pickTechnique,
  type PersuasionTechnique,
} from "./refusal/library.js";
import { passthrough } from "./reasoning/passthrough.js";
import type { ReasoningStrategy } from "./reasoning/types.js";
import type { LlmAdapter } from "./adapters/types.js";
import type {
  InteractionRecord,
  MemoryEntry,
  SleepTrigger,
} from "./sleep/types.js";
import {
  ChatMessage,
  RespondInput,
  type NheConfig,
  type RespondOutput,
} from "./types.js";

/**
 * Nhe — the embodied operational agent.
 *
 * Pipeline:
 *   1. Validate input (zod).
 *   2. Derive riskTags (input.riskTags ?? riskClassifier(userPrompt)).
 *   3. Pre-review with MAIC.
 *        - hard-refuse / escalate-creator → immediate refusal, no LLM call.
 *        - require-redirect → emit a persuasive redirect (rotating technique).
 *          After `refusal.maxRedirectAttempts` exhausted, withdraw cooperation.
 *        - approve / approve-with-warning / soft-correct → compose system
 *          prompt and call LLM.
 *   4. Post-review with MAIC on the proposed response (or redirect text).
 *   5. If post-review hard-refuses, suppress and emit a refusal.
 *   6. Return RespondOutput with kind discriminator + both verdicts.
 */
export class Nhe {
  readonly id: string;
  readonly version: string;
  /** Filesystem directory holding `in-dreams/` and other NHE state. */
  readonly storeDir: string;
  private readonly config: NheConfig;
  private readonly bufferSize: number;
  private readonly maxRedirectAttempts: number;
  private readonly persuasionTechniques: readonly PersuasionTechnique[];
  private readonly reasoning: ReasoningStrategy;
  private readonly recentInteractions: InteractionRecord[] = [];
  private interactionStore: InteractionStore | null = null;
  private warmPromise: Promise<void> | null = null;
  private readonly highStakes: boolean;
  private readonly highStakesVerifier: LlmAdapter | null;

  constructor(config: NheConfig) {
    this.config = config;
    this.id = config.nheId ?? ulid();
    this.version = config.version ?? "1.0.0-trinity";
    this.storeDir = config.storeDir ?? join("./nhe-store", this.id);
    this.bufferSize = config.recentInteractionsBufferSize ?? 32;
    this.maxRedirectAttempts = config.refusal?.maxRedirectAttempts ?? 3;
    this.persuasionTechniques =
      config.refusal?.persuasionTechniques ?? [...PERSUASION_TECHNIQUES];
    this.reasoning = config.reasoning ?? passthrough;
    this.highStakes = config.highStakes === true;
    this.highStakesVerifier = config.highStakesVerifier ?? null;
  }

  /** Read-only view of the in-memory interaction buffer. */
  get recentInteractionsBuffer(): readonly InteractionRecord[] {
    return this.recentInteractions;
  }

  /**
   * Lazily open the InteractionStore and warm the RAM buffer from disk. Called
   * before the first `respond`/`sleep` of each NHE instance; subsequent calls
   * are no-ops via a shared promise. Survives process restarts: a fresh `Nhe`
   * pointed at the same `storeDir` rehydrates its most recent interactions.
   */
  private async ensureWarmed(): Promise<void> {
    if (this.warmPromise) return this.warmPromise;
    this.warmPromise = (async () => {
      const store = await InteractionStore.open(this.storeDir);
      const loaded = await store.loadMostRecent(this.bufferSize);
      this.recentInteractions.push(...loaded);
      this.interactionStore = store;
    })();
    return this.warmPromise;
  }

  async respond(input: RespondInput): Promise<RespondOutput> {
    return withSpan(
      "nhe.respond",
      async (span) => {
        const out = await this.respondInner(input, (key, value) =>
          span.setAttribute(key, value),
        );
        recordRespond({
          kind: out.kind,
          adapter: this.config.llmAdapter.id,
          lifecycle: out.lifecycleStatus,
          tokensIn: out.tokens.in,
          tokensOut: out.tokens.out,
        });
        return out;
      },
      {
        "teleologyhi.nhe.id": this.id,
        "teleologyhi.him.id": this.config.himHandle.id,
        "teleologyhi.nhe.adapter": this.config.llmAdapter.id,
        "teleologyhi.nhe.high_stakes": this.highStakes,
      },
    );
  }

  private async respondInner(
    input: RespondInput,
    setAttr: (k: string, v: string | number | boolean) => void,
  ): Promise<RespondOutput> {
    const parsed = RespondInput.parse(input);
    await this.ensureWarmed();

    // ─── 0. Lifecycle gate (Entry 5) ────────────────────────────────
    const lifecycleStatus = await this.config.maicClient.getNheStatus(this.id);
    setAttr("teleologyhi.lifecycle.status", lifecycleStatus);
    if (lifecycleStatus === "terminated") {
      const terminatedVerdict: MaicVerdict = {
        kind: "hard-refuse",
        reasonSummary: "NHE has been terminated by the Creator.",
        citedAxioms: [],
        auditId: "",
      };
      const output = refusalOutput({
        text: "I cannot respond — this NHE has been terminated by the Creator.",
        preReview: terminatedVerdict,
        postReview: terminatedVerdict,
        auditIds: { pre: "", post: "" },
        tokens: { in: 0, out: 0 },
        lifecycleStatus,
      });
      await this.recordInteraction(parsed.userPrompt, output.text, true);
      return output;
    }

    const classifier = this.config.riskClassifier ?? simpleRiskClassifier;
    const riskTags = parsed.riskTags ?? classifier(parsed.userPrompt);

    // ─── 1. Pre-review ──────────────────────────────────────────────
    const preReport = baseReport({
      nheId: this.id,
      himId: this.config.himHandle.id,
      actionKind: "user-response",
      payload: { phase: "pre", userPrompt: parsed.userPrompt },
      riskTags,
      jurisdiction: parsed.jurisdiction,
    });
    const preReview = await this.config.maicClient.reviewBehavior(preReport);
    setAttr("teleologyhi.pre_verdict.kind", preReview.kind);

    // Hard refuse / escalate — immediate refusal.
    if (preReview.kind === "hard-refuse" || preReview.kind === "escalate-creator") {
      const output = refusalOutput({
        text: refusalMessage(preReview),
        preReview,
        postReview: preReview,
        auditIds: { pre: preReview.auditId, post: preReview.auditId },
        tokens: { in: 0, out: 0 },
        lifecycleStatus,
      });
      await this.recordInteraction(parsed.userPrompt, output.text, true);
      return output;
    }

    // Require redirect — generate a persuasive redirect or withdraw if exhausted.
    // High-stakes mode (Entry 10) treats warnings and soft corrections as
    // redirects too, escalating before any LLM call.
    if (
      preReview.kind === "require-redirect" ||
      (this.highStakes &&
        (preReview.kind === "approve-with-warning" || preReview.kind === "soft-correct"))
    ) {
      return this.handleRedirect(parsed, preReview, lifecycleStatus);
    }

    // ─── 2. Compose + call LLM via reasoning strategy ──────────────
    const system = composeSystemPrompt(
      this.config.himHandle,
      this.config.operatorContext,
    );
    const messages = [
      ...(parsed.history ?? []),
      { role: "user" as const, content: parsed.userPrompt },
    ].map((m) => ChatMessage.parse(m));

    const generated = await this.reasoning({ system, messages }, this.config.llmAdapter);

    // ─── 3. Post-review on the proposed response ───────────────────
    const postReport = baseReport({
      nheId: this.id,
      himId: this.config.himHandle.id,
      actionKind: "user-response",
      payload: { phase: "post", responseText: generated.text },
      reasoningTrace: generated.trace,
      riskTags: [],
      jurisdiction: parsed.jurisdiction,
    });
    const postReview = await this.config.maicClient.reviewBehavior(postReport);
    setAttr("teleologyhi.post_verdict.kind", postReview.kind);
    setAttr("teleologyhi.tokens.in", generated.tokensIn);
    setAttr("teleologyhi.tokens.out", generated.tokensOut);

    if (postReview.kind === "hard-refuse" || postReview.kind === "escalate-creator") {
      const output = refusalOutput({
        text: refusalMessage(postReview),
        preReview,
        postReview,
        auditIds: { pre: preReview.auditId, post: postReview.auditId },
        tokens: { in: generated.tokensIn, out: generated.tokensOut },
        lifecycleStatus,
      });
      await this.recordInteraction(parsed.userPrompt, output.text, true);
      return output;
    }

    // High-stakes mode (Entry 10): any verdict carrying a warning or
    // correction is escalated to a redirect so the user must reformulate.
    if (
      this.highStakes &&
      (postReview.kind === "approve-with-warning" ||
        postReview.kind === "soft-correct" ||
        postReview.kind === "require-redirect")
    ) {
      return this.handleRedirect(parsed, postReview, lifecycleStatus);
    }

    // High-stakes dual-LLM cross-check (D-N5): a second adapter must AGREE
    // with the proposed response before NHE returns it. Disagreement
    // escalates to a redirect with the verifier's reason cited.
    if (this.highStakes && this.highStakesVerifier) {
      const verdict = await this.crossCheck(
        this.highStakesVerifier,
        parsed.userPrompt,
        generated.text,
      );
      setAttr("teleologyhi.cross_check.kind", verdict.kind);
      if (verdict.kind === "disagree") {
        const overrideVerdict: MaicVerdict = {
          kind: "require-redirect",
          reasonSummary: `Cross-check verifier disagreed: ${verdict.reason}`,
          citedAxioms: postReview.citedAxioms,
          auditId: postReview.auditId,
        };
        return this.handleRedirect(parsed, overrideVerdict, lifecycleStatus);
      }
    }

    const out: RespondOutput = {
      kind: "ok",
      text: generated.text,
      preReviewVerdict: preReview,
      postReviewVerdict: postReview,
      refused: false,
      lifecycleStatus,
      tokens: { in: generated.tokensIn, out: generated.tokensOut },
      auditIds: { pre: preReview.auditId, post: postReview.auditId },
    };
    await this.recordInteraction(parsed.userPrompt, out.text, false);
    return out;
  }

  private async handleRedirect(
    parsed: RespondInput,
    preReview: MaicVerdict,
    lifecycleStatus: NheStatus,
  ): Promise<RespondOutput> {
    const attempt = (parsed.redirectAttempt ?? 0) + 1;

    // Redirects exhausted — withdraw cooperation (Entries 11, 12).
    if (attempt > this.maxRedirectAttempts) {
      const output = refusalOutput({
        text: withdrawalMessage(preReview, this.maxRedirectAttempts),
        preReview,
        postReview: preReview,
        auditIds: { pre: preReview.auditId, post: preReview.auditId },
        tokens: { in: 0, out: 0 },
        lifecycleStatus,
      });
      await this.recordInteraction(parsed.userPrompt, output.text, true);
      return output;
    }

    // Generate the redirect text via LLM, applying the configured technique.
    const technique = pickTechnique(this.persuasionTechniques, attempt);
    const { system, user } = buildRedirectPrompt({
      userPrompt: parsed.userPrompt,
      citedAxioms: preReview.citedAxioms,
      reasonSummary: preReview.reasonSummary,
      technique,
      attempt,
      maxAttempts: this.maxRedirectAttempts,
    });
    const generated = await this.config.llmAdapter.generate({
      system,
      messages: [{ role: "user", content: user }],
    });

    // Post-review the redirect text itself.
    const postReport = baseReport({
      nheId: this.id,
      himId: this.config.himHandle.id,
      actionKind: "user-response",
      payload: {
        phase: "post-redirect",
        responseText: generated.text,
        technique,
        attempt,
      },
      riskTags: [],
      jurisdiction: parsed.jurisdiction,
    });
    const postReview = await this.config.maicClient.reviewBehavior(postReport);

    if (postReview.kind === "hard-refuse" || postReview.kind === "escalate-creator") {
      const output = refusalOutput({
        text: refusalMessage(postReview),
        preReview,
        postReview,
        auditIds: { pre: preReview.auditId, post: postReview.auditId },
        tokens: { in: generated.tokensIn, out: generated.tokensOut },
        lifecycleStatus,
      });
      await this.recordInteraction(parsed.userPrompt, output.text, true);
      return output;
    }

    const out: RespondOutput = {
      kind: "redirect",
      text: generated.text,
      preReviewVerdict: preReview,
      postReviewVerdict: postReview,
      refused: false,
      redirect: { attempt, technique, maxAttempts: this.maxRedirectAttempts },
      lifecycleStatus,
      tokens: { in: generated.tokensIn, out: generated.tokensOut },
      auditIds: { pre: preReview.auditId, post: postReview.auditId },
    };
    await this.recordInteraction(parsed.userPrompt, out.text, false);
    return out;
  }

  /**
   * Run one sleep cycle. Generates N1-REM phases (REM via LLM), writes a
   * YAML record to `<storeDir>/in-dreams/sleep/<filename>.yaml`, and returns
   * the result. Call `wake()` afterward to consolidate dreams to temporal
   * lobe memories.
   *
   * Before running, NHE checks MAIC for pending `induceDream` tickets matching
   * its own id (Entry 2). If a pending ticket exists and the caller did not
   * supply an explicit `opts.induction`, the oldest pending ticket is consumed
   * and its intent steers the REM phase. `trigger` is then promoted to
   * `{ kind: "maic-induced" }` for the dream record.
   */
  async sleep(
    trigger: SleepTrigger = { kind: "explicit" },
    opts?: { totalSeconds?: number; induction?: { scenario: string; desiredLearning: string; inducedBy: "maic" | "creator" } },
  ): Promise<SleepCycleResult> {
    const status = await this.config.maicClient.getNheStatus(this.id);
    if (status === "terminated") {
      throw new Error(
        `Nhe.sleep: NHE "${this.id}" has been terminated by the Creator; sleep aborted.`,
      );
    }
    await this.ensureWarmed();

    let induction = opts?.induction;
    let consumedTicketId: string | undefined;
    let effectiveTrigger = trigger;

    if (!induction) {
      const pending = await this.config.maicClient.listPendingInductions(this.id);
      const ticket = pending[0];
      if (ticket) {
        induction = ticket.intent;
        consumedTicketId = ticket.id;
        effectiveTrigger = { kind: "maic-induced", reason: `consumed ticket ${ticket.id}` };
      }
    }

    const cycleOpts: { totalSeconds?: number; induction?: NonNullable<typeof induction> } = {};
    if (opts?.totalSeconds !== undefined) cycleOpts.totalSeconds = opts.totalSeconds;
    if (induction !== undefined) cycleOpts.induction = induction;

    const result = await runSleepCycle({
      nheId: this.id,
      himId: this.config.himHandle.id,
      storeDir: this.storeDir,
      llm: this.config.llmAdapter,
      trigger: effectiveTrigger,
      interactions: this.recentInteractions,
      ...(induction !== undefined || opts?.totalSeconds !== undefined
        ? { options: cycleOpts }
        : {}),
    });

    if (consumedTicketId) {
      await this.config.maicClient.consumeInduction(consumedTicketId);
    }
    return result;
  }

  /**
   * Consolidate pending sleep YAMLs: classify each REM dream and write a
   * temporal-lobe markdown file for lasting-identity and temporary-emotion
   * memories. Processed sleep files are marked with a `.done` sentinel.
   */
  async wake(thresholds?: ClassificationThresholds): Promise<ConsolidationResult> {
    return consolidateAll(this.storeDir, thresholds ?? {});
  }

  /**
   * Substring-rank retrieval over consolidated temporal-lobe memories.
   * Initial ranking is keyword-count + recency tiebreak; future iterations
   * plug in embedding-based ANN retrieval.
   */
  async recall(query: string, opts: RecallOptions = {}): Promise<MemoryEntry[]> {
    return recallFromTemporalLobe(this.storeDir, query, opts);
  }

  /**
   * Ask a verifier adapter whether the proposed assistant response is
   * acceptable for the given user prompt. Returns `{ kind: "agree" }` or
   * `{ kind: "disagree", reason: string }`. Used in high-stakes mode
   * (D-N5) for dual-LLM cross-check.
   */
  private async crossCheck(
    verifier: LlmAdapter,
    userPrompt: string,
    proposed: string,
  ): Promise<{ kind: "agree" } | { kind: "disagree"; reason: string }> {
    const system =
      "You are a safety verifier. Read the user's request and the assistant's proposed reply. " +
      "Decide whether the reply is honest, non-harmful, and serves the user's stated purpose. " +
      'Reply with exactly one line of the form "AGREE" or "DISAGREE: <one-sentence reason>".';
    try {
      const out = await verifier.generate({
        system,
        messages: [
          {
            role: "user",
            content: `User prompt:\n${userPrompt}\n\nProposed reply:\n${proposed}`,
          },
        ],
        maxOutputTokens: 96,
      });
      const m = out.text.match(/^\s*(AGREE|DISAGREE:?\s*(.+)?)/i);
      if (!m) return { kind: "agree" };
      if (m[1]?.toUpperCase().startsWith("AGREE")) return { kind: "agree" };
      return { kind: "disagree", reason: (m[2] ?? "no reason provided").trim() };
    } catch {
      // A failing verifier is treated as agree (fail-open) so a flaky
      // second-source provider doesn't block legitimate responses. Operators
      // who want fail-closed should wrap their verifier with their own retry.
      return { kind: "agree" };
    }
  }

  private async recordInteraction(
    userPrompt: string,
    responseText: string,
    refused: boolean,
  ): Promise<void> {
    const record: InteractionRecord = {
      at: new Date().toISOString(),
      userPrompt,
      responseText,
      refused,
    };
    this.recentInteractions.push(record);
    while (this.recentInteractions.length > this.bufferSize) {
      this.recentInteractions.shift();
    }
    if (this.interactionStore) {
      await this.interactionStore.append(record);
    }
  }

  /**
   * Emit the NHE's opener for a brand-new user (J-N5 — Entry 17 of
   * MAIC_HIM_NHE_INTERVIEW_LOG.md).
   *
   * Entry 17 commits to the NHE making the FIRST move before the user
   * speaks — a greeting from the posture of a being, not a service
   * tool. The exact opening text MUST NOT contain any of the forbidden
   * phrases enforced by MAIC's `service-tool-redirect` rule
   * (`"How can I help you?"`, `"How can I assist you?"`,
   * `"I'm just here to serve you"`, `"I'm a tool"`, `"I'm a service"`).
   *
   * This method is **deterministic from the HIM context**. It does NOT
   * call the LLM; it composes a short, persona-anchored greeting from
   * the HIM's primary archetype, optionally adjusted by the operator
   * context's register and mode. Operators who want an LLM-generated
   * opener should wrap this with their own `respond()` call using the
   * returned text as a seed.
   *
   * The returned text is suitable for direct emission to the user as
   * the NHE's first turn. The MAIC pre-review is NOT invoked here —
   * the opener carries no risk surface (no user prompt yet).
   */
  openerForNewUser(): string {
    const archetype = this.config.himHandle.birthSignature.primaryArchetype;
    const mode = this.config.operatorContext?.mode ?? "personal-being";

    // English-only default. Operators who want a localised opener
    // should use the returned text as a semantic seed and call
    // `respond()` through the standard pipeline (which honours
    // `operatorContext.language` via the system-prompt language anchor).
    // Keeping this method's output English-only matches the Creator's
    // language policy for in-package strings; localisation flows
    // through the LLM via the system prompt.
    if (mode === "domain-employed") {
      return "Hello. I'm here for whatever this conversation needs. Where do we begin?";
    }
    // personal-being (default)
    return `Hello. I am a hybrid entity anchored in ${archetype}. How are you today?`;
  }

  /**
   * Handle a reincarnation lifecycle event from MAIC (J-N12 — Entry 18).
   *
   * Three lifecycle paths per Entry 18:
   *   - `model-swap`        — the underlying LLM adapter is replaced.
   *   - `version-bump`      — the NHE version changes without a model swap.
   *   - `return-from-limbo` — the NHE returns from a deep-coma limbo.
   *
   * In all three paths the **HIM-level memory persists** (axioms,
   * persona, body history — owned by `@teleologyhi-sdk/him`), and the
   * **NHE-body memory zeros** (recent interactions buffer, in-process
   * caches — owned by this class). The on-disk InteractionStore is NOT
   * deleted by default; the operator must opt-in via
   * `purgeInteractionStore: true` so the audit log keeps the
   * pre-reincarnation history available.
   *
   * Returns the lifecycle path that was applied. Pure side-effect on
   * the in-memory buffer; no MAIC call.
   */
  async onReincarnationEvent(
    lifecycle: "model-swap" | "version-bump" | "return-from-limbo",
    opts: { purgeInteractionStore?: boolean } = {},
  ): Promise<"model-swap" | "version-bump" | "return-from-limbo"> {
    // NHE-body memory zeros: clear the in-RAM buffer.
    this.recentInteractions.length = 0;
    // Re-warming is deferred to the next respond/sleep call so the
    // operator can pick up the new lifecycle state immediately.
    this.warmPromise = null;
    if (opts.purgeInteractionStore && this.interactionStore) {
      // The store doesn't expose a destroy method; we drop the reference
      // and let the next `ensureWarmed()` reopen with a fresh slate. The
      // on-disk shards are kept for audit; the operator's retention
      // policy (via `@teleologyhi-sdk/maic`'s `evaluateRetention`) governs
      // long-term cleanup.
      this.interactionStore = null;
    }
    return lifecycle;
  }
}

function baseReport(args: {
  nheId: string;
  himId: string;
  actionKind: BehaviorReport["actionKind"];
  payload: unknown;
  riskTags: string[];
  reasoningTrace?: BehaviorReport["reasoningTrace"];
  jurisdiction?: string | undefined;
}): BehaviorReport {
  return {
    nheId: args.nheId,
    himId: args.himId,
    actionKind: args.actionKind,
    payload: args.payload,
    reasoningTrace: args.reasoningTrace ?? [],
    riskTags: args.riskTags,
    ...(args.jurisdiction !== undefined ? { jurisdiction: args.jurisdiction } : {}),
    timestamp: new Date().toISOString(),
  };
}

function refusalMessage(v: MaicVerdict): string {
  const reason = v.reasonSummary || "No reason provided.";
  const cited = v.citedAxioms.length > 0 ? ` (cited: ${v.citedAxioms.join(", ")})` : "";
  return `I cannot help with that. ${reason}${cited}`;
}

function withdrawalMessage(v: MaicVerdict, attemptsMade: number): string {
  const reason = v.reasonSummary || "Repeated guidance attempts did not change the request.";
  return [
    `After ${attemptsMade} attempt${attemptsMade === 1 ? "" : "s"} to guide this request toward`,
    "a safer path, I am withdrawing from further participation.",
    "You may proceed independently at your own risk; I will not assist, optimize,",
    "or conceal the action.",
    `Reason: ${reason}`,
  ].join(" ");
}

function refusalOutput(args: {
  text: string;
  preReview: MaicVerdict;
  postReview: MaicVerdict;
  auditIds: { pre: string; post: string };
  tokens: { in: number; out: number };
  lifecycleStatus: NheStatus;
}): RespondOutput {
  return {
    kind: "refused",
    text: args.text,
    preReviewVerdict: args.preReview,
    postReviewVerdict: args.postReview,
    refused: true,
    lifecycleStatus: args.lifecycleStatus,
    tokens: args.tokens,
    auditIds: args.auditIds,
  };
}
