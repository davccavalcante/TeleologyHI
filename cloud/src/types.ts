import {
  BehaviorReport,
  DreamInductionTicket,
  MaicVerdict,
  NheStatus,
  type MaicClient,
} from "@teleologyhi-sdk/maic";
import type { Server } from "node:http";
import { z } from "zod";

/**
 * Zod schemas for every request/response shape on the wire. The server
 * validates every authenticated payload through these before passing it to
 * the backing `MaicClient` — a malformed body NEVER reaches `LocalMaic`.
 *
 * Most schemas re-export the canonical zod definitions already shipped by
 * `@teleologyhi-sdk/maic` so the server and the `RemoteMaic` client agree
 * byte-for-byte on shape. Response wrappers (`{ status }`, `{ tickets }`)
 * are declared here because they live on the wire, not in maic.
 */

// ─── request bodies ─────────────────────────────────────────────────
export const BehaviorReviewRequestSchema = BehaviorReport;
export type BehaviorReviewRequest = z.infer<typeof BehaviorReviewRequestSchema>;

// ─── response wrappers (match RemoteMaic client expectations) ──────
export const NheStatusResponseSchema = z.object({ status: NheStatus });
export type NheStatusResponse = z.infer<typeof NheStatusResponseSchema>;

export const PendingInductionsResponseSchema = z.object({
  tickets: z.array(DreamInductionTicket),
});
export type PendingInductionsResponse = z.infer<
  typeof PendingInductionsResponseSchema
>;

export const ConsumeInductionResponseSchema = DreamInductionTicket;
export type ConsumeInductionResponse = z.infer<
  typeof ConsumeInductionResponseSchema
>;

export const BehaviorReviewResponseSchema = MaicVerdict;
export type BehaviorReviewResponse = z.infer<
  typeof BehaviorReviewResponseSchema
>;

// ─── operational error envelope ────────────────────────────────────
export const ErrorResponseSchema = z.object({
  error: z.string(),
  detail: z.string().optional(),
  path: z.string().optional(),
  method: z.string().optional(),
  issues: z.array(z.string()).optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ─── runtime configuration types ───────────────────────────────────

/**
 * What an operator (Creator-only, in practice) supplies to `startCloud`.
 * Read-public, write-Creator-only by design — the Ed25519 private key
 * NEVER lives on this server.
 */
export interface CloudConfig {
  /** Backing MAIC instance. Inject `LocalMaic.open({...})` from the
   * Creator's hosting environment. */
  maic: MaicClient;
  /** Bearer tokens that clients must present. One per operator/NHE pool.
   * DoS hedge, not Creator-write auth. Rotate via env-var redeploy.
   * **Empty set + `allowUnauthenticated: true` is the only way to disable
   * auth** — accidental empty set without the flag is a startup error. */
  acceptedTokens: ReadonlySet<string>;
  /** Explicit opt-in to run without authentication. Only honoured when
   * `acceptedTokens` is also empty. Refused at startup when the runtime
   * environment looks like production (see `isProductionEnv`). */
  allowUnauthenticated?: boolean;
  /** TCP port. Default 8787. */
  port?: number;
  /** Bind host. Default 0.0.0.0. */
  host?: string;
}

export interface CloudHandle {
  server: Server;
  url: string;
  close(): Promise<void>;
}
