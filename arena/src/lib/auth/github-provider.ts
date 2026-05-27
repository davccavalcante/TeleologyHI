/**
 * `GitHubAuthProvider` — concrete OAuth provider for GitHub.
 *
 * Implements the standard Authorization Code Grant (RFC 6749 §4.1):
 *
 *   1. `beginSignIn(state)` builds the GitHub authorize URL with our
 *      `client_id`, the requested scopes, the callback URL, and the state
 *      token. The user is redirected there by the `/api/auth/login`
 *      endpoint.
 *   2. The user signs in on GitHub and grants the OAuth App access to
 *      their account. GitHub redirects to our callback URL with `?code=...
 *      &state=...`.
 *   3. `completeSignIn` verifies the state, exchanges the code for an
 *      access token via `POST https://github.com/login/oauth/access_token`,
 *      then fetches the user via `GET https://api.github.com/user`,
 *      builds a `UserIdentity`, persists it, and returns the cookie value.
 *
 * Required env vars:
 *
 *   - `GITHUB_CLIENT_ID`      — public client id of the OAuth App
 *   - `GITHUB_CLIENT_SECRET`  — secret, NEVER logged, ONLY read from env
 *   - `ARENA_BASE_URL`        — used to build the callback URL
 *
 * Scopes requested: `read:user` only. We never request `repo`, `gist`, or
 * any write scope. The arena needs the GitHub user id + login + name only.
 */
import {
  AuthProvider,
  SignInResult,
  UserIdentity,
} from "./types";
import { findByProvider, mintUserId, saveUser } from "./store";

const PROVIDER_KIND = "github" as const;
const SCOPES = "read:user";
const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";

function env(name: "GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET" | "ARENA_BASE_URL"): string {
  const v = process.env[name];
  if (!v) throw new Error(`GitHubAuthProvider: ${name} is required in .env.local`);
  return v;
}

function callbackUrl(): string {
  const base = env("ARENA_BASE_URL").replace(/\/$/, "");
  return `${base}/api/auth/callback/github`;
}

/**
 * Shape returned by `GET https://api.github.com/user`. We only consume the
 * three fields below; ignoring the rest keeps the surface minimal.
 */
interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
}

export class GitHubAuthProvider implements AuthProvider {
  readonly kind = PROVIDER_KIND;

  async beginSignIn(state: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: env("GITHUB_CLIENT_ID"),
      redirect_uri: callbackUrl(),
      scope: SCOPES,
      state,
      allow_signup: "true",
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async completeSignIn(input: {
    code: string;
    state: string;
    expectedState: string;
  }): Promise<SignInResult> {
    if (input.state !== input.expectedState) {
      throw new Error("GitHubAuthProvider: state mismatch (possible CSRF)");
    }
    const accessToken = await exchangeCodeForToken(input.code);
    const ghUser = await fetchGitHubUser(accessToken);

    const providerUserId = String(ghUser.id);
    const displayName = ghUser.name ?? ghUser.login;
    const now = new Date().toISOString();

    const existing = await findByProvider(PROVIDER_KIND, providerUserId);
    const identity: UserIdentity = existing
      ? { ...existing, displayName, lastSeenAt: now }
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

async function exchangeCodeForToken(code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: env("GITHUB_CLIENT_ID"),
    client_secret: env("GITHUB_CLIENT_SECRET"),
    code,
    redirect_uri: callbackUrl(),
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(
      `GitHubAuthProvider: token exchange failed (HTTP ${res.status})`,
    );
  }
  const json = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (json.error || !json.access_token) {
    throw new Error(
      `GitHubAuthProvider: token exchange error: ${
        json.error_description ?? json.error ?? "no access_token in response"
      }`,
    );
  }
  return json.access_token;
}

async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch(USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "TeleologyHI-Arena",
    },
  });
  if (!res.ok) {
    throw new Error(
      `GitHubAuthProvider: user fetch failed (HTTP ${res.status})`,
    );
  }
  const json = (await res.json()) as Partial<GitHubUser>;
  if (typeof json.id !== "number" || !json.login) {
    throw new Error("GitHubAuthProvider: user response missing id or login");
  }
  return {
    id: json.id,
    login: json.login,
    name: json.name ?? null,
  };
}
