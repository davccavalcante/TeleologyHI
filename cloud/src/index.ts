/**
 * `@teleologyhi-sdk/cloud` — public surface.
 *
 * HTTP server fronting the `RemoteMaic` wire contract. Internal workspace,
 * not published to npm — the Creator runs the canonical instance at
 * `teleologyhi.com`. See `SPEC.md` for the frozen public API contract.
 *
 * Read-public, write-Creator-only by construction: the Ed25519 private key
 * NEVER lives on this server. Bearer tokens only keep abusive clients out.
 */

export { startCloud, startCloudFromEnv } from "./server.js";
export type { CloudConfig, CloudHandle } from "./types.js";

// Auth primitives — exposed so embedders can plug their own middleware.
export {
  authorize,
  constantTimeTokenMatch,
  isAuthDisabled,
  isProductionEnv,
} from "./auth.js";

// Zod schemas — exposed so clients can validate request/response shapes
// before persisting or forwarding them.
export {
  BehaviorReviewRequestSchema,
  BehaviorReviewResponseSchema,
  ConsumeInductionResponseSchema,
  ErrorResponseSchema,
  NheStatusResponseSchema,
  PendingInductionsResponseSchema,
} from "./types.js";

export type {
  BehaviorReviewRequest,
  BehaviorReviewResponse,
  ConsumeInductionResponse,
  ErrorResponse,
  NheStatusResponse,
  PendingInductionsResponse,
} from "./types.js";
