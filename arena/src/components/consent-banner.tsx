"use client";

/**
 * ConsentBanner — the GDPR-strict consent surface gating the arena.
 *
 * Per `MAIC_HIM_NHE_INTERVIEW_LOG.md` Entry 26 §9.6, the arena starts in
 * the hard-privacy stage where each user sees only their own HIM/NHE.
 * Consent is captured BEFORE the first turn (the Creator's explicit
 * preference): the user must accept the consent policy before any prompt
 * is sent to the LLM or any audit event is written that mentions them.
 *
 * UI contract:
 *
 *   - When `user` is null AND `auth_error` is in the URL: show a small
 *     error band with the reason.
 *   - When `user` is null: show the "Sign in with the configured provider"
 *     button that redirects to `/api/auth/login`.
 *   - When `user` is set but `user.consent` is null: show the consent
 *     banner with policy summary and the Accept button.
 *   - When `user.consent` is set: the banner unmounts and the children
 *     are rendered (the actual arena UI).
 *
 * The component is intentionally minimal in this first cut. Styling is
 * inline so it works regardless of the surrounding layout. A future cut
 * may extract it into a shadcn dialog.
 */
import { useEffect, useState } from "react";
import type { ConsentRecord, UserIdentity } from "@/lib/auth/types";

interface MeResponse {
  user: UserIdentity | null;
}

const CONSENT_LABEL =
  "I understand that the arena sends my prompts to the underlying Grok model on both columns, persists my interactions under my own user id for offline review, and applies MAIC governance to the right column. I keep the right to revoke this consent by signing out at any time.";

export function ConsentBanner({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserIdentity | null | undefined>(undefined);
  const [authError, setAuthError] = useState<string | null>(null);
  const [acceptingConsent, setAcceptingConsent] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    setAuthError(url.searchParams.get("auth_error"));
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => r.json() as Promise<MeResponse>)
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <FullScreen text="Loading..." />;
  }

  if (user === null) {
    return (
      <SignInGate authError={authError} />
    );
  }

  if (!user.consent) {
    return (
      <ConsentGate
        user={user}
        accepting={acceptingConsent}
        onAccept={async () => {
          setAcceptingConsent(true);
          try {
            const res = await fetch("/api/auth/consent", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ label: CONSENT_LABEL }),
            });
            if (!res.ok) throw new Error("consent_failed");
            const json = (await res.json()) as { consent: ConsentRecord };
            setUser({ ...user, consent: json.consent });
          } catch {
            // Surface a brief error then re-enable the button.
            setAcceptingConsent(false);
          }
        }}
      />
    );
  }

  return <>{children}</>;
}

function FullScreen({ text }: { text: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#666",
        background: "#fff",
      }}
    >
      {text}
    </div>
  );
}

function SignInGate({ authError }: { authError: string | null }) {
  return (
    <FullScreen
      text={
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>
            TeleologyHI Arena
          </h1>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
            Sign in to begin. The arena runs the same prompt against raw
            Grok and Grok under MAIC + HIM + NHE governance, side by side,
            and saves every round under your account for offline review.
          </p>
          {authError && (
            <p
              style={{
                fontSize: 12,
                color: "#a00",
                background: "#fee",
                padding: "8px 12px",
                borderRadius: 4,
                marginBottom: 20,
              }}
            >
              Please try signing in again.
            </p>
          )}
          <a
            href="/api/auth/login"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "#24292f",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Sign in
          </a>
        </div>
      }
    />
  );
}

function ConsentGate({
  user,
  accepting,
  onAccept,
}: {
  user: UserIdentity;
  accepting: boolean;
  onAccept: () => void;
}) {
  return (
    <FullScreen
      text={
        <div style={{ textAlign: "center", maxWidth: 560 }}>
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>
            Welcome, {user.displayName}
          </h1>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
            Before the first turn, please review the consent policy below.
            The arena does not process any prompt of yours until you
            accept.
          </p>
          <p
            style={{
              fontSize: 13,
              color: "#333",
              background: "#f6f6f6",
              padding: "12px 16px",
              borderRadius: 6,
              marginBottom: 20,
              textAlign: "left",
            }}
          >
            {CONSENT_LABEL}
          </p>
          <button
            type="button"
            onClick={onAccept}
            disabled={accepting}
            style={{
              padding: "10px 20px",
              background: accepting ? "#999" : "#0a7",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              cursor: accepting ? "default" : "pointer",
            }}
          >
            {accepting ? "Recording..." : "I accept"}
          </button>
        </div>
      }
    />
  );
}
