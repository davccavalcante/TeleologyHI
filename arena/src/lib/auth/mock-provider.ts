/**
 * `MockAuthProvider` — a developer-only stub that satisfies the
 * `AuthProvider` interface without contacting any external provider.
 *
 * Behaviour:
 *
 *   - `beginSignIn(state)` returns a local URL
 *     `/api/auth/callback/mock?code=mock-{state}&state={state}`.
 *     The user can hit this URL directly in the browser to complete a
 *     fake sign-in.
 *   - `completeSignIn` validates that `code` was issued by the matching
 *     `beginSignIn` (via the `state` echo), then issues a `UserIdentity`
 *     with `provider: "mock"`, a generated ULID `userId`, and the
 *     `displayName` extracted from the code suffix.
 *
 * This provider exists so the rest of the arena auth surface
 * (cookies, identity store, consent banner, hard-privacy filters) can be
 * exercised end-to-end before the GitHub OAuth flow lands in Phase 2.
 * It is NEVER selected in production; the selection happens in
 * `provider.ts` based on whether `GITHUB_CLIENT_ID` is set in env.
 */
import {
  AuthProvider,
  CURRENT_CONSENT_VERSION,
  SignInResult,
  UserIdentity,
} from "./types";
import { findByProvider, mintUserId, saveUser } from "./store";

const PROVIDER_KIND = "mock" as const;

/**
 * Extract the display name from a mock auth code. The code shape is
 * `mock-{state}` where state was returned by `beginSignIn`. We treat the
 * post-`mock-` portion as the display name; if it starts with `state-`,
 * we strip that prefix to leave a stable "default-developer" handle.
 */
function displayNameFromCode(code: string): string {
  const stripped = code.startsWith("mock-") ? code.slice("mock-".length) : code;
  return stripped || "default-developer";
}

export class MockAuthProvider implements AuthProvider {
  readonly kind = PROVIDER_KIND;

  async beginSignIn(state: string): Promise<string> {
    const params = new URLSearchParams({
      code: `mock-${state}`,
      state,
    });
    return `/api/auth/callback/mock?${params.toString()}`;
  }

  async completeSignIn(input: {
    code: string;
    state: string;
    expectedState: string;
  }): Promise<SignInResult> {
    if (input.state !== input.expectedState) {
      throw new Error("MockAuthProvider: state mismatch (possible CSRF)");
    }
    if (!input.code.startsWith("mock-")) {
      throw new Error("MockAuthProvider: invalid mock code");
    }
    const displayName = displayNameFromCode(input.code);
    const providerUserId = `mock:${displayName}`;
    const now = new Date().toISOString();

    // If this mock user already signed in once, refresh `lastSeenAt`
    // rather than minting a new userId. This is exactly the contract the
    // GitHub provider will follow in Phase 2.
    const existing = await findByProvider(PROVIDER_KIND, providerUserId);
    const identity: UserIdentity = existing
      ? { ...existing, lastSeenAt: now }
      : {
          userId: mintUserId(),
          provider: PROVIDER_KIND,
          providerUserId,
          displayName,
          firstSeenAt: now,
          lastSeenAt: now,
        };

    await saveUser(identity);
    return { identity, cookieValue: identity.userId };
  }
}

/**
 * Convenience export used while the GitHub provider has not been wired in.
 * Production code should depend on the `AuthProvider` interface and inject
 * the concrete provider via `provider.ts`, NOT import this directly.
 */
export const mockAuthProvider = new MockAuthProvider();

/**
 * Surface the current consent version for callers that want to assert it
 * matches the version persisted on a `UserIdentity.consent.version`. Kept
 * here (rather than re-exported elsewhere) so the mock + real providers
 * share the same constant from the same module path.
 */
export const MOCK_PROVIDER_CONSENT_VERSION = CURRENT_CONSENT_VERSION;
