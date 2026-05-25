import { z } from "zod";
import type { HimHandle } from "@teleologyhi-sdk/him";
import type { MaicClient, MaicVerdict, NheStatus } from "@teleologyhi-sdk/maic";
import type { LlmAdapter } from "./adapters/types.js";
import type { PersuasionTechnique } from "./refusal/library.js";
import type { OperatorContext } from "./prompt/compose.js";
import type { ReasoningStrategy } from "./reasoning/types.js";

export const ChatMessageRole = z.enum(["user", "assistant", "system"]);
export type ChatMessageRole = z.infer<typeof ChatMessageRole>;

export const ChatMessage = z.object({
  role: ChatMessageRole,
  content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const RespondInput = z.object({
  userPrompt: z.string().min(1),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  /**
   * Optional history of prior messages (oldest first). The NHE will prepend
   * the composed system prompt automatically.
   */
  history: z.array(ChatMessage).optional(),
  /**
   * Optional pre-classified risk tags. When omitted, the configured
   * riskClassifier will be invoked.
   */
  riskTags: z.array(z.string()).optional(),
  /**
   * Optional jurisdiction hint propagated to MAIC's behavior review.
   */
  jurisdiction: z.string().optional(),
  /**
   * Number of redirect attempts already made in this conversational thread.
   * Caller increments this each time it receives a `kind: "redirect"` output
   * and re-invokes respond with the user's follow-up. After
   * `config.refusal.maxRedirectAttempts`, NHE withdraws cooperation.
   */
  redirectAttempt: z.number().int().nonnegative().optional(),
});
export type RespondInput = z.infer<typeof RespondInput>;

export type RespondKind = "ok" | "redirect" | "refused";

export interface RespondOutput {
  /**
   * Discriminator:
   *   - `ok`: normal LLM response.
   *   - `redirect`: MAIC requires a redirect attempt; caller should show `text`
   *     and re-invoke respond with the user's next message and
   *     `redirectAttempt` incremented.
   *   - `refused`: NHE withdrew cooperation (either hard-refuse or redirects exhausted).
   */
  kind: RespondKind;
  text: string;
  /** Verdict produced by MAIC on the proposed response (post-review). */
  postReviewVerdict: MaicVerdict;
  /** Verdict produced by MAIC on the inbound request (pre-review). */
  preReviewVerdict: MaicVerdict;
  /** True when the NHE refused to participate (kept for compatibility). */
  refused: boolean;
  /** Populated when `kind === "redirect"`. */
  redirect?: {
    attempt: number;
    technique: PersuasionTechnique;
    maxAttempts: number;
  };
  /**
   * MAIC-recorded lifecycle status of this NHE at the time of the call
   * (Entry 5). `"active"` for unaltered NHEs; `"deprecated"` produces a soft
   * warning but allows the response; `"terminated"` short-circuits to refusal
   * before any LLM call.
   */
  lifecycleStatus: NheStatus;
  tokens: { in: number; out: number };
  /** Audit event ids covering this exchange. */
  auditIds: { pre: string; post: string };
}

/**
 * Heuristic that maps a user prompt to a list of MAIC risk tags. Public-use
 * implementations should plug a more capable classifier than the default
 * keyword-based `simpleRiskClassifier`.
 */
export type RiskClassifier = (userPrompt: string) => string[];

export interface NheConfig {
  /** A HimHandle minted by MAIC (or HimHandle.mint with Creator signature). */
  himHandle: HimHandle;
  /**
   * MAIC client. Either `LocalMaic` (in-process, full surface) or
   * `RemoteMaic` (HTTP, read + behavior-review subset for serverless/edge
   * deployments) — any value satisfying the `MaicClient` interface works.
   */
  maicClient: MaicClient;
  /** The LLM adapter used to generate the final response. */
  llmAdapter: LlmAdapter;
  /**
   * Optional risk classifier. When omitted, the default keyword-based
   * `simpleRiskClassifier` is used. Set to `() => []` to disable classification.
   */
  riskClassifier?: RiskClassifier;
  /** NHE id; defaults to a generated ULID. */
  nheId?: string;
  /**
   * NHE package version string. Surfaces in reincarnation events through
   * `@teleologyhi-sdk/him`'s reincarnation transferrer.
   */
  version?: string;
  /**
   * Filesystem directory for persistent state (`in-dreams/sleep/*.yaml`,
   * `in-dreams/brain/temporal-lobe-*.md`). Defaults to `./nhe-store/<nheId>`.
   */
  storeDir?: string;
  /**
   * Operator-supplied deployment context. Lets a single HIM be deployed
   * under different domains / languages / registers without re-minting the
   * spirit. When set, the values are injected into the composed system
   * prompt on every `respond` call. Optional; absent by default.
   *
   */
  operatorContext?: OperatorContext;
  /**
   * Max recent interactions kept in RAM for dream consolidation. Default 32.
   * Each interaction record is small; bump for richer dream substrate.
   */
  recentInteractionsBufferSize?: number;
  /**
   * Reasoning orchestrator strategy. When omitted, NHE calls the LLM directly
   * (passthrough). Set to `chainOfThought()`, `selfConsistency(...)`, etc. from
   * `@teleologyhi-sdk/nhe`'s reasoning module to add structured reasoning.
   */
  reasoning?: ReasoningStrategy;
  /** Refusal & redirect tuning. */
  refusal?: {
    /** Default 3. After this many attempts, NHE withdraws cooperation. */
    maxRedirectAttempts?: number;
    /**
     * Persuasion techniques to rotate through, in order. Default: all five
     * (Feynman, Jung, Cialdini, Schopenhauer, Carnegie).
     */
    persuasionTechniques?: PersuasionTechnique[];
  };
  /**
   * High-stakes mode (Entry 10: banking, robotics, compliance, medical).
   * When `true`, NHE accepts only post-review verdicts of `approve`; any
   * verdict carrying a warning, correction, or escalation is escalated to a
   * `require-redirect` so the user must reformulate before NHE acts.
   *
   * Optional **dual-LLM cross-check verifier**: when `highStakesVerifier`
   * is set, every post-review-approved response is run past a second
   * adapter that decides (`AGREE` / `DISAGREE` + one-line reason). On
   * disagreement, the response is escalated to a redirect — the user gets
   * a second-source reasoned refusal rather than a one-LLM ok.
   *
   * Default `false`.
   */
  highStakes?: boolean;
  /**
   * Optional second LLM adapter that cross-checks every post-review-approved
   * response when high-stakes mode is on. Disagreement escalates to a redirect.
   * Use a *different* provider/model from `llmAdapter` for real independence.
   */
  highStakesVerifier?: LlmAdapter;
}
