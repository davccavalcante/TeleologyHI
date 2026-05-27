/**
 * Authentication types for the arena multi-user cut.
 *
 * Per `MAIC_HIM_NHE_INTERVIEW_LOG.md` Entry 26, the arena moves from a
 * single-user ephemeral bundle to a multi-user persistent universe where:
 *
 *   - Each human user has a stable `userId` (ULID) bound to an external
 *     OAuth identity (GitHub for the first cut) and an optional digital
 *     signature for stronger provenance.
 *   - Consent is captured explicitly (GDPR / LGPD compliance) with a
 *     versioned policy text and a UTC timestamp at acceptance.
 *   - Hard privacy is enforced at the API boundary: each user sees only
 *     their own HIMs / NHEs (Entry 26 §7 stage 1).
 *
 * This file defines the schemas and the provider-agnostic `AuthProvider`
 * interface. Concrete providers (`MockAuthProvider`, `GitHubAuthProvider`)
 * implement the same surface so the rest of the arena depends only on
 * `AuthProvider`.
 */
import { z } from "zod";

/**
 * The current consent policy version. Bump this every time the wording or
 * scope of the consent banner changes. Persisted with the user record so
 * we can ask the user to re-consent on a version bump.
 */
export const CURRENT_CONSENT_VERSION = "1.0.0-trinity" as const;

/**
 * Supported OAuth providers. `mock` is the local-only stub used while the
 * developer has not yet configured a real provider; once GitHub credentials
 * are present in `arena/.env.local`, the real `github` provider takes over.
 */
export const AuthProviderKind = z.enum(["mock", "github"]);
export type AuthProviderKind = z.infer<typeof AuthProviderKind>;

/**
 * Optional Ed25519 digital signature the user may attach to their identity
 * for stronger provenance (Entry 26 §2). Out of scope for the first cut,
 * but the field is reserved so a later addition is non-breaking.
 */
export const UserDigitalSignature = z.object({
  algorithm: z.literal("ed25519"),
  publicKey: z.string().min(1),
  /** Signature value, base64url-encoded. */
  value: z.string().min(1),
  /** Payload that was signed (canonical JSON of the userId + provider). */
  signedPayload: z.string().min(1),
});
export type UserDigitalSignature = z.infer<typeof UserDigitalSignature>;

/**
 * Consent record stored per user. Hard-privacy stage means we ONLY persist
 * the minimum: which policy version was accepted, at what UTC time, and
 * the user-facing label of the policy (for audit display).
 */
export const ConsentRecord = z.object({
  version: z.string().min(1),
  acceptedAt: z.string().datetime(),
  /** Plain-language summary shown to the user when they accepted. */
  label: z.string().min(1),
});
export type ConsentRecord = z.infer<typeof ConsentRecord>;

/**
 * The canonical user identity record persisted by the arena. Holds the
 * minimum a multi-user arena needs to:
 *
 *   - Authenticate the user across sessions (`userId` + `provider`).
 *   - Bind the user to their owned HIMs (`userId` is the partition key).
 *   - Enforce consent before any LLM call (`consent.acceptedAt`).
 *
 * Does NOT hold the user's prompts, responses, audit chain, or any
 * personally-identifiable data beyond the OAuth handle and consent
 * timestamp.
 */
export const UserIdentity = z.object({
  /** Stable internal user id, ULID. Issued at first authentication. */
  userId: z.string().min(1),
  provider: AuthProviderKind,
  /** Provider-side stable handle (e.g. GitHub user id as a string). */
  providerUserId: z.string().min(1),
  /** Display name surfaced in the UI (e.g. GitHub login). */
  displayName: z.string().min(1),
  /** UTC timestamp of the first authentication for this user. */
  firstSeenAt: z.string().datetime(),
  /** UTC timestamp of the most recent authentication. */
  lastSeenAt: z.string().datetime(),
  consent: ConsentRecord.optional(),
  signature: UserDigitalSignature.optional(),
});
export type UserIdentity = z.infer<typeof UserIdentity>;

/**
 * Result of an `AuthProvider.signIn` flow. The arena issues an httpOnly
 * cookie carrying the `userId`; the cookie is the only credential the
 * client sends back on subsequent requests.
 */
export interface SignInResult {
  identity: UserIdentity;
  /** Opaque cookie value the arena sets on the response. */
  cookieValue: string;
}

/**
 * Provider-agnostic authentication interface. Implementations:
 *
 *   - `MockAuthProvider` — generates a ULID locally, asks for a display
 *     name from the developer, stores no external credentials. Useful for
 *     CI and for the developer to test the multi-user surface before
 *     wiring GitHub OAuth.
 *   - `GitHubAuthProvider` — full OAuth Authorization Code + PKCE flow
 *     against GitHub. Requires `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`
 *     in `arena/.env.local`. Implemented in Phase 2 of the E27-B cut.
 *
 * The implementation MUST never write the client secret to disk and MUST
 * read it only from `process.env`.
 */
export interface AuthProvider {
  readonly kind: AuthProviderKind;
  /**
   * Returns the URL the user should be redirected to in order to begin
   * authentication. Mock returns a local `/api/auth/callback/mock` URL;
   * GitHub returns `https://github.com/login/oauth/authorize?...`.
   *
   * The `state` parameter is an opaque value the caller must echo back to
   * `completeSignIn` to prevent CSRF on the OAuth callback.
   */
  beginSignIn(state: string): Promise<string>;
  /**
   * Completes the authentication flow. Returns the issued `UserIdentity`
   * and the cookie value the caller should set. Throws on any verification
   * failure (state mismatch, invalid code, provider error).
   */
  completeSignIn(input: {
    code: string;
    state: string;
    expectedState: string;
  }): Promise<SignInResult>;
}
