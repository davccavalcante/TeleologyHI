import type { BehaviorReport, DreamInductionTicket, MaicVerdict, NheStatus } from "../types.js";

/**
 * `MaicClient`, the minimal MAIC surface that NHE actually calls during
 * `respond` / `sleep`. Both `LocalMaic` (in-process) and `RemoteMaic`
 * (HTTP) satisfy this interface, so an NHE can be wired against either
 * without code changes.
 *
 * Operators who write to MAIC (mint axioms, register HIMs, ratify
 * proposals, etc.) keep using `LocalMaic` because writes require the
 * Creator's Ed25519 private key, and that key never travels over the
 * network. `RemoteMaic` is therefore a **read + behavior-review** client
 * suitable for serverless / edge NHE deployments where the Creator's
 * canonical MAIC instance is hosted elsewhere.
 */
export interface MaicClient {
  /** Pre/post-review of a single NHE action. */
  reviewBehavior(report: BehaviorReport): Promise<MaicVerdict>;
  /** Current lifecycle status of an NHE (terminated/deprecated/active). */
  getNheStatus(nheId: string): Promise<NheStatus>;
  /** Pending MAIC-induced dream tickets targeting this NHE. */
  listPendingInductions(nheId: string): Promise<DreamInductionTicket[]>;
  /** Mark a ticket as consumed (called by NHE after weaving it into a dream). */
  consumeInduction(ticketId: string): Promise<DreamInductionTicket>;
}
