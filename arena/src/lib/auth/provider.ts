/**
 * Auth provider selector.
 *
 * Selection rule:
 *
 *   - If `GITHUB_CLIENT_ID` AND `GITHUB_CLIENT_SECRET` are present in env,
 *     use `GitHubAuthProvider` (the production-shape provider).
 *   - Otherwise fall back to `MockAuthProvider` (dev-only stub) and log a
 *     once-per-process warning so the developer knows OAuth is not wired.
 *
 * The arena never instantiates a provider directly. All callers (the four
 * `/api/auth/*` route handlers) import `currentAuthProvider()` from this
 * module and depend on the `AuthProvider` interface.
 */
import { AuthProvider } from "./types";
import { mockAuthProvider } from "./mock-provider";
import { GitHubAuthProvider } from "./github-provider";

let cached: AuthProvider | undefined;
let warnedMockFallback = false;

export function currentAuthProvider(): AuthProvider {
  if (cached) return cached;
  const hasGitHub =
    !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET;
  if (hasGitHub) {
    cached = new GitHubAuthProvider();
    return cached;
  }
  // Silenced by E27-G directive: no output on the request lifecycle. The
  // mock-vs-github decision is observable through the redirect URL produced
  // by `GET /api/auth/login` (mock provider returns a local URL; github
  // returns `github.com/login/oauth/authorize?...`).
  warnedMockFallback = true;
  cached = mockAuthProvider;
  return cached;
}

/**
 * Test helper: reset the cached provider. Intended for use in tests that
 * mutate env vars between cases. Not called in production code.
 */
export function _resetAuthProviderCache(): void {
  cached = undefined;
  warnedMockFallback = false;
}
