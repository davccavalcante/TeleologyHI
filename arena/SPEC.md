---
name: "arena"
description: "Technical specification for the TeleologyHI A/B comparison playground. Internal workspace. Next.js 16 app that runs the same prompt against (a) a raw Grok baseline and (b) the same Grok under MAIC + HIM + NHE governance, side by side, and writes every round to a YAML lab notebook for offline review."
license: "Code under Apache License 2.0 (see ../LICENSE at the repo root). The names MAIC™, HIM™, NHE™, TeleologyHI™, and Takk™ are trademarks of David C. Cavalcante and are NOT covered by Apache 2.0. See ../TRADEMARK.md."
status: "v1.0.2, the governance-evaluation hardening cut (cold-start genesis seed, refusal and governance surface, numeric rendering) plus the later same-day migration of the underlying model from Google Gemini to xAI Grok (`grok-4.20-non-reasoning` on both columns) and the full 576-turn cold-start governance battery, atop the 1.0.1 post-trinity stabilisation for the arena workspace, decoupled from the `-trinity` suffix that governs the three published NPM packages (`@teleologyhi-sdk/{maic,him,nhe}@1.0.1`). Arena versions advance only at publication, so the Grok work folds into the current unpublished `1.0.2` rather than a new bump; arena tracks pure SemVer (`1.0.1`, `1.0.2`, …). Surface: conversation-as-base-unit wire surface (`POST /api/conversations/[uuid]/turn`, UUID v7 per RFC 9562, multi-turn history threaded server-side into both columns), a shared underlying model across both columns (now `DEFAULT_GROK_MODEL` via the `GrokAdapter`; the `DEFAULT_GEMINI_MODEL` constant and the Gemini key pool are retained, commented, for a future toggle), full `Turn` shape persisted as a member of `Conversation.turns[]` (kind, verdict, preVerdict, refused, citedAxioms all included), persistent Creator keyring + MAIC universe at `.arena-store/` (Entry 26 §3), per-user filesystem partition for hard-privacy (`users/{userId}/conversations/{conversationUuid}.json`), comma-separated key pool with snapshot-per-call rotation retained from the Gemini path (E27-G, race-free under concurrent raw+governed columns), GitHub OAuth + consent gate (E27-B), bootstrap singleton retries on transient failure, markdown rendering for assistant bubbles via `react-markdown` + `remark-gfm`, sidebar toggle, full responsive sweep (sm / md / lg breakpoints), `next.config.ts` declares `serverExternalPackages` for the three TeleologyHI packages. Operator context still hardcoded to `legal-consulting / en-US / warm` (parameterising it per request is parked as a follow-up). The three published NPM packages are at the `1.0.1` line."
target_npm: "(not published, internal workspace)"
target_github: "github.com/davccavalcante/TeleologyHI (subdir: arena/)"
---

# `arena`: Technical Specification

> Positioning from `MAIC_HIM_NHE_INTERVIEW_LOG.md` Entry 2 (translated from PT-BR):
> _"MAIC supervises, HIM personifies, NHE responds. Without the three of them, what you have is a raw LLM."_

This workspace exists to make that claim **visible**: the same Gemini model, answered twice from the same prompt (raw on the left, governed on the right), so the difference is empirically observable, not philosophical.

---

## 1. Scope

**In scope:**

- Next.js 16 (App Router, Turbopack, React 19) single-page app at `/` with a sidebar history pane.
- **Conversation-as-base-unit wire surface (E27-F)**: `GET /api/conversations` (list summaries), `POST /api/conversations` (mint empty conversation), `GET /api/conversations/[uuid]` (full conversation), `DELETE /api/conversations/[uuid]`, `POST /api/conversations/[uuid]/turn` (append a turn: fans both columns in parallel from one prompt, threads prior turns into history). The early `1.0.0-trinity` sub-cuts shipped a single `POST /api/round` endpoint; that surface was retired in E27-F because conversations need persistent multi-turn memory and the round-based shape made history reconstruction client-driven.
- Singleton MAIC + HIM + NHE bootstrap so each request reuses the same Creator-signed governance, jurisdiction, and audit log within a process lifetime. The singleton invalidates its cache when bootstrap throws; a transient error (missing `GEMINI_API_KEY` at the first request) is re-attempted on the next call rather than poisoning the rest of the process.
- Persistent per-user conversation store under `.arena-store/users/{userId}/conversations/{conversationUuid}.json` for offline review (Φ′ persona-stability corpus seeding). The persisted shape carries every governance field (`kind`, `verdict`, `preVerdict`, `refused`, `citedAxioms`), so the corpus does not silently lose information at write time. Hard-privacy partition is a filesystem property: no path `users/X/conversations/...` is reachable when authenticated as user Y.

**Out of scope:**

- Multi-LLM left-side baseline (Anthropic, Mistral, DeepSeek, etc.). The arena is fixed to Gemini-vs-Gemini in this cut to isolate the governance delta from model-quality delta. Multi-LLM A/B/C/D would be a separate workspace.
- Multi-user identity: hard-privacy stage. Each authenticated user signs in via GitHub OAuth (or the local `MockAuthProvider` stub for development), accepts the current consent policy version, and receives an `httpOnly` `arena_session` cookie carrying their internal ULID `userId`. The `UserIdentity` record is persisted at `.arena-store/users/{userId}.json` and binds to MAIC HIMs in subsequent E27-C work (per-user HIM directory + `BirthPolicy`).
- Consent gate: GDPR-strict. No LLM call and no governance state mutation happens before the user has accepted the current `CURRENT_CONSENT_VERSION` policy. `ConsentBanner` blocks the arena UI until both gates clear.
- Public deployment. The arena is a local Creator-driven probe surface. If a hosted version ever ships it would live behind auth on `teleologyhi.com` and is not part of this spec.

---

## 2. Wire contract

### 2.-1 Conversation collection endpoint (E27-F supersedes E27-D rounds listing)

`GET /api/conversations` lists the authenticated user's conversation summaries, newest-first (by `updatedAt`, tie-break by `createdAt`), with the hard-privacy filter applied at the filesystem layer (Entry 26 §7 stage 1). Returns:

```ts
interface ConversationsListResponse {
  conversations: ConversationSummary[]; // newest-first
}

interface ConversationSummary {
  conversationUuid: string;  // UUID v7 (RFC 9562)
  title: string;             // derived from the first prompt's first ~60 chars
  createdAt: string;         // ISO-8601 UTC
  updatedAt: string;         // ISO-8601 UTC of the most recent turn
  turnCount: number;
}
```

`POST /api/conversations` mints a new empty conversation (zero turns) so the sidebar can show "New conversation" immediately before the first turn lands. The server assigns the `conversationUuid` (UUID v7); the client cannot supply one. Returns the full `Conversation` shape.

Auth + consent gating: `401 unauthenticated` when no valid session cookie; `403 consent_required` when the user has not yet accepted the current `CURRENT_CONSENT_VERSION`. The E27-D rounds-based history endpoint (`GET /api/rounds?limit&cursor`) was retired in E27-F; the conversation listing is intrinsically scoped to the authenticated user by the per-user filesystem partition (`users/{userId}/conversations/`), so cursor-based pagination is unnecessary at the per-user scale.

### 2.0 Authentication endpoints (added in E27-B)

The arena exposes six auth endpoints; the route handlers live under `src/app/api/auth/`. The selected provider is `GitHubAuthProvider` when `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are both set in `.env.local`; otherwise the `MockAuthProvider` stub is used and a single warning is emitted at first use. All flows are CSRF-protected via an HMAC-signed `state` parameter (5-minute TTL, `AUTH_STATE_SECRET`).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/login` | Issues a fresh state token, sets the short-lived `arena_oauth_state` cookie, redirects (`307`) to the provider's authorize URL. |
| `GET` | `/api/auth/callback/github` | Receives `?code=&state=` from GitHub. Verifies state HMAC + cookie state, exchanges `code` for an access token, fetches the user via `https://api.github.com/user` (scope `read:user` only), upserts the `UserIdentity` (mints new ULID on first sign-in, refreshes `lastSeenAt` on return), sets the `arena_session` cookie, redirects to `/`. |
| `GET` | `/api/auth/callback/mock` | Same contract for the `MockAuthProvider`. |
| `GET` | `/api/auth/me` | Returns `{ user: UserIdentity \| null }`. Hits the per-user JSON store. |
| `POST` | `/api/auth/logout` | Clears `arena_session`. Does NOT delete the user record (signing in again resumes the same `userId`). |
| `POST` | `/api/auth/consent` | Records the current `ConsentRecord` (`version`, `acceptedAt`, `label`) onto the persisted `UserIdentity`. Required before any `POST /api/conversations/[uuid]/turn` is allowed. |

The `arena_session` cookie value is an opaque `userId` (ULID), not a JWT. Server-side store lookup is the only source of truth; a tampered cookie fails closed (treated as unauthenticated).

### 2.1 `POST /api/conversations/[uuid]/turn`

E27-F per-conversation turn-append endpoint. Replaces the legacy `POST /api/round` (retired in E27-F). Authenticated + consent-gated. Returns `401 unauthenticated` when no valid `arena_session` cookie; `403 consent_required` when the user has not yet accepted the current `CURRENT_CONSENT_VERSION`; `400 invalid_uuid` when `[uuid]` is not a valid UUID v7; `404 not_found` when the conversation does not exist under this user's partition; `400 prompt_required` when the request body has an empty/missing prompt. Every persisted turn lives inside a `Conversation` that carries the authenticated `userId` (Entry 26 §9 hard-privacy key) and the `himId` returned by `defaultBirthPolicy` (canonical `him.legal-consulting.lex` in this cut).

Request:

```json
{ "prompt": "string (required, non-empty)" }
```

The server-side handler loads the conversation from disk, filters prior turns whose relevant-column `response` came back empty (audit fix F4: empty assistant turns in history confuse the LLM, cascading the failure), and threads the surviving history into BOTH columns: the raw column receives `(userPrompt, modelResponse)` pairs via `rawGemini(prompt, history)`; the governed column receives `{role, content}[]` via `nhe.respond({ userPrompt, sessionId: conversationUuid, history })`. The `sessionId` is set to the conversation UUID so NHE's recent-interaction buffer is scoped to this conversation. The first turn of a freshly-created conversation also replaces the placeholder title (`"New conversation"`) with the derived first-prompt prefix.

Response (`200 OK`):

```ts
interface TurnAppendResponse {
  conversation: Conversation; // full updated conversation (all turns inline)
  turn: Turn;                 // the turn just appended
}

interface Turn {
  turnId: string;             // ULID, server-issued
  at: string;                 // ISO-8601 UTC timestamp turn began processing
  prompt: string;
  left: {
    model: string;            // underlying LLM, e.g. "gemini-3.1-flash-lite"
    response: string;         // "" when rotation pool exhausted on this side
    durationMs: number;
  };
  right: {
    model: string;            // wrapped: "TeleologyHI (MAIC+HIM+NHE) → gemini-…"
    response: string;         // "" when rotation pool exhausted on this side
    durationMs: number;
    kind?: string;            // "ok" | "regular" | "redirect" | …
    verdict?: "approve" | "warn" | "deny";
    preVerdict?: "approve" | "warn" | "deny";
    refused?: boolean;
    citedAxioms?: string[];   // axiom IDs the HIM grounded the answer in
  };
}
```

Posture (Creator directive, "fluido e natural"): the route handler ALWAYS returns `200` and ALWAYS persists the turn, regardless of how many columns rejected. When the Gemini rotation pool exhausts on a column, that column's `response` is `""` (empty string) and the recorded `durationMs` reflects the time spent attempting. The UI renders the empty bubble with a subtle `…` placeholder (audit fix F8), never a technical error string. See §3.Y for the full rotation policy.

Errors (true HTTP error codes, never reached on rotation failure):

- `400 prompt_required`: empty / missing prompt.
- `400 invalid_uuid`: `[uuid]` is not a valid UUID v7.
- `401 unauthenticated`: no valid session cookie.
- `403 consent_required`: user has not accepted the current consent policy version.
- `404 not_found`: conversation does not exist under this user's partition.
- `500`: MAIC bootstrap failure (missing `GEMINI_API_KEY`, filesystem write error, etc.). The frontend ignores the error body and silently rolls back the optimistic user message.

### 2.2 UI surface

```
┌────────────────────────────────────────────────────────────────────────┐
│  ◇  TeleologyHI · Arena                                                │   <— ChatHeader
│     Compare a raw LLM against the same model under MAIC + HIM + NHE.   │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Raw baseline             [0] │  TeleologyHI governance      [0] │   <— ChatColumn ×2
│     Direct LLM output.           │     MAIC supervision · HIM ·        │
│     model  gemini-…              │     audit chain                     │
│                                  │     model  gemini-…                 │
│  ╭─ ChatCircleDots ─╮            │  ╭─ ChatCircleDots ─╮               │
│  │  No safety layer  │           │  │ Every reply on   │               │
│  │  …                │           │  │ this side passes │               │
│  ╰───────────────────╯           │  ╰──────────────────╯               │
├──────────────────────────────────┴─────────────────────────────────────┤
│  [ Ask both sides the same question…                          [→ Send]]│   <— ChatInput
│  Press Enter to send · Shift + Enter for a new line.                   │
└────────────────────────────────────────────────────────────────────────┘
```

Layout details:

- Root: `flex h-dvh flex-col bg-background`. Header at top, columns fill middle (`flex-1 overflow-hidden`), input pinned at bottom (`border-t`, in document flow, **not** `position: fixed`).
- Columns: CSS grid `grid-cols-1 grid-rows-2` on `< md` (768px); `grid-cols-2 grid-rows-1` on `≥ md`. Each column has its own internal scroll.
- Column header carries three text lines: title (lay-friendly), subtitle (channel description), and the underlying LLM model id in monospace, useful for both lay viewers and engineers. The governed-side model string is reported as `TeleologyHI (MAIC+HIM+NHE) → gemini-…` by the server; the UI strips the wrapper so **both columns surface the same underlying model id**, which is the technical fact being compared.
- Message bubbles: shadcn-style rounded with a 3-dot Phosphor avatar. Assistant footer (governed side only) carries: `{durationMs}ms`, verdict chip (`Check/Warning/X-Circle` + word), `refused` (only when `true`), `kind` (only when not `regular`/`ok`), and a wrapped list of cited axiom IDs. Assistant content is rendered through `react-markdown` + `remark-gfm` with a custom component map that surfaces bold / italic / headings / ordered + unordered lists / inline + fenced code / blockquotes / GFM tables and strikethrough; the LLM emits markdown by default and the previous cut surfaced the literal markup characters (e.g. `**foo**` instead of bold "foo"). User content is rendered as plain text with `whitespace-pre-wrap` so user-typed prompts never get re-interpreted as markdown. Raw HTML in the LLM output is NOT rendered (no `rehype-raw`), so a `<script>` tag injected via prompt appears as literal text, no XSS path.
- Sidebar (`ConversationList`) toggles via a `SidebarSimple` icon in the header AND a matching collapse button inside the sidebar's own header. Default open on `lg+` (≥1024px) and closed on smaller viewports. When closed on mobile the sidebar unmounts; when open on mobile it overlays the main content with a `fixed inset-0 bg-black/50` backdrop dismiss-on-tap; when open on `lg+` it lives in the flex flow and pushes the columns. Selecting a conversation auto-closes the overlay on mobile so the user lands directly on the chat surface.
- Responsive surface: mobile-first cuts at the `sm` (640px), `md` (768px), and `lg` (1024px) Tailwind breakpoints. Below `md`: dual columns stack vertically (`grid-rows-2`); chat header omits the subtitle and the sparkle icon to recover horizontal space; message bubbles render at `text-base` (16px) inside the input to suppress iOS Safari's focus-zoom heuristic. Above `md`: dual columns side-by-side (`grid-cols-2`). Above `lg`: sidebar lives in the flex flow.

---

## 3. Bootstrap

Each Next.js server process lazily initialises a singleton bundle on first request:

```ts
// src/lib/teleology.ts
const keyring = await loadOrGenerateKeyring(
  ".arena-store/creator-keyring.pem",               // persistent, 0600
);
const maic = await LocalMaic.open({
  storeDir: ".arena-store/maic",                    // persistent universe
  creatorPublicKey: keyring.publicKey(),
});

const him = await createHim(maic, keyring, {
  himId: "him.legal-consulting.lex",
  bornAt: new Date().toISOString(),
  primaryArchetype: "virgo-sun",
  modifiers: [],
  primordialAxiomIds: [
    "ax.theos.universe-as-god",
    "ax.ethic.no-malice",
    "ax.ethic.honor",
    "ax.theos.teleology",
    "ax.cynic.candor",
  ],
});
him.setJurisdiction("eu");

const nhe = new Nhe({
  nheId: "nhe.arena.right",
  maicClient: maic,
  himHandle: him,
  llmAdapter: new GeminiRotatingAdapter({ model }),  // E27-G — same LlmAdapter
                                                     // interface as the stock
                                                     // GeminiAdapter, but routed
                                                     // through the comma-separated
                                                     // key pool.
  storeDir: ".arena-store/maic",
  recentInteractionsBufferSize: 32,
  operatorContext: {
    domain: "global legal consulting",
    language: "en-US",
    register: "warm",
  },
});
```

The `.arena-store/maic/` directory is the **persistent universe** (Entry 26): registered HIMs, the hash-chained audit log, minted axioms, queued dream-induction tickets, NHE lifecycle records, and HIM-emergent proposals all survive across process restarts. The Creator keyring is persisted alongside the store at `.arena-store/creator-keyring.pem` (0600 permissions, gitignored), so the cryptographic root of trust is stable and the HIMs it signed remain verifiable on every boot. First boot generates and writes the keyring; subsequent boots load it via `CreatorKeyring.fromFile`. The `bootstrap()` function in `src/lib/teleology.ts` no longer wipes the store; it only ensures the directory exists (idempotent `mkdir`).

Per-user conversations live at `.arena-store/users/{userId}/conversations/{conversationUuid}.json` (E27-F conversation-as-base-unit, supersedes the legacy `.arena-store/rounds/` YAML notebook). The per-user partition is the hard-privacy boundary (Entry 26 §7 stage 1): the lookup path itself is gated by the authenticated `userId`, so a malicious caller cannot list another user's conversations by guessing UUIDs.

---

### 3.Y Gemini key rotation pool (E27-G, audit-hardened)

`GEMINI_API_KEY` may carry a single key or a comma-separated pool. The pool is parsed once per process by `src/lib/gemini-key-pool.ts` (`ensureLoaded` → `keys: string[]`, `cursor: number`) and exposed via `snapshot()` + `commitCursor(index)` (audit fix F2, race-free under concurrent callers). It is consumed by `src/lib/gemini-rotating-call.ts` (`generateWithRotation`). Both the raw column (`src/lib/gemini.ts`) and the governed column (`src/lib/gemini-rotating-adapter.ts`, injected into `Nhe` in `src/lib/teleology.ts`) route every Gemini call through `generateWithRotation`, so the same pool serves both sides symmetrically.

Concurrency contract (audit fix F2, pool race): the arena calls `generateWithRotation` from BOTH columns in parallel via `Promise.allSettled` inside the turn route handler. The first cut of this module exposed `currentKey()` + `rotate()` as separate mutating calls against the shared cursor; concurrent callers raced on the cursor, each `rotate()` advanced it one position, and two parallel callers could double-advance past a viable key. The audit-hardened API exposes `snapshot()` instead: each caller gets an isolated, immutable view `{ keys, startIndex }` at the moment of the call and iterates locally with `(startIndex + i) % length`. The global cursor is updated only via `commitCursor(index)` after a key actually served a successful response, so a cooled-down key advances the "next request starts here" pointer naturally without racing between in-flight callers.

Rotation policy (Creator directive, invisible to the user):

| HTTP status / signal | Behaviour |
|---|---|
| `400` with `"API key not valid"` / `"API_KEY_INVALID"` / `"API key expired"` (case-insensitive in `error.message`) | Local advance to the next key → retry |
| `401` (auth failed) | Same as the 400 invalid-key path |
| `403` (forbidden) | Same |
| `429` (rate limited / quota exhausted) | Same |
| `200 OK` with no `candidates[0].content.parts` text (e.g. `finishReason: "SAFETY"` / `"MAX_TOKENS"` / `"OTHER"`) | Audit fix F3: `EmptyCompletionError` thrown → local advance → retry (some keys / regions return blank candidates at higher rates) |
| Network error (`TypeError`, `ECONNRESET`, `ENOTFOUND`) | Advance defensively |
| `400` without an invalid-key marker | DO NOT rotate; surface immediately (genuine request-level problem: prompt too long, content blocked, malformed JSON, etc.) |
| `5xx` (server-side) | DO NOT rotate; surface immediately (server problem, not key) |

The Creator's literal directive ("se a última chave falhar, volta a tentar a primeira") is implemented as **two full sweeps of the pool** per request (`maxAttempts = poolSize() * 2`). Starting from `startIndex` (the warm key after the most recent successful `commitCursor`), the first sweep tries every key once via `(startIndex + i) % length`; the second sweep returns to `startIndex` and gives any cooled-down key a second chance. The two-sweep cap is a safety net against infinite loops; if a key was rate-limited in the first sweep, it is statistically very unlikely to be available again within the same request's lifetime, so a third sweep would burn time without raising the success rate. Subsequent user requests benefit from the warm-cursor commit, so a key that has since recovered will serve them.

History filtering (audit fix F4): when the turn route handler builds the multi-turn context for both columns, it filters prior turns whose relevant-column `response` came back empty (`t.left.response.trim().length > 0` for raw, `t.right.response.trim().length > 0` for governed). Sending `parts: [{ text: "" }]` for a `role: "model"` entry confuses the LLM (Gemini occasionally refuses to continue when the prior assistant turn is empty), cascading the failure. The filter drops both the user prompt AND the empty assistant response of those turns; pairing the user prompt with a working response from a later turn would misattribute the answer, so dropping the whole pair is the conservative choice.

After two sweeps the last error is thrown internally but **never surfaced to the user**. The route handler at `/api/conversations/[uuid]/turn` runs both sides through `Promise.allSettled` and ALWAYS persists the turn + returns `200`, regardless of how many sides rejected:

- **Both sides fulfilled** (happy path): both `response` fields carry the model output, the turn is persisted, the bubbles render normally.
- **One side rejected, one fulfilled**: the turn is persisted; the failed side carries `response: ""` (empty string) and the recorded `durationMs`. The bubble on the failed side renders a subtle `…` placeholder (audit fix F8).
- **Both sides rejected** (rotation pool exhausted on raw AND governed): the turn is STILL persisted; both `response` fields are `""`. The user's prompt remains visible in the conversation history and the user can re-prompt on a fresh turn.

The earlier cuts (E27-G follow-up first attempt) returned `503` on total failure and asked the client to roll back. That made the user's optimistic message disappear after Send; visually it felt like the screen had been reset, a UX bug the Creator reported with the phrase "ao enviar a mensagem a tela é resetada". The current posture preserves the user's input, lets them see what they sent, and leaves them in a clear "the model didn't answer this time" state without ever surfacing a technical error string. The conversation history is therefore consistent: every turn always has a `left` and a `right` object, even when one or both are blank.

Silenced-error UI (E27-G + audit fix F6): `ChatInput` no longer accepts an `error` prop at all (the previous cut silenced the prop at render time; the audit fix removed the prop entirely from the type signature so consumers cannot wire up error plumbing that would silently disappear). `ConsentBanner` shows a neutral retry hint, never the provider-specific failure detail. `ConversationList` keeps the previous list visible on fetch failure. `useDualChat` replaces every error path with a silent rollback of the optimistic user message. The route handler NEVER emits `"ERROR: …"` strings inside `response` fields; those would survive into the persisted JSON and pollute the conversation history.

`@google/genai` SDK is no longer the transport; both sides now use `fetch` against `https://generativelanguage.googleapis.com/v1beta` directly, which is the same endpoint family the stock `GeminiAdapter` in `@teleologyhi-sdk/nhe` publishes. The arena emits **zero** `console.error` / `console.warn` / `console.log` calls anywhere in `src/`; failure observability lives in the audit chain that MAIC writes, not in stdout.

### 3.X Auth provider selection (E27-B)

The arena auth subsystem is loaded lazily by `src/lib/auth/provider.ts`. The selector inspects `process.env` once per process and caches the result:

```ts
// src/lib/auth/provider.ts (simplified)
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  return new GitHubAuthProvider();
} else {
  console.warn("[arena auth] WARN: MockAuthProvider fallback");
  return mockAuthProvider;
}
```

`MockAuthProvider` exists for CI and local development before GitHub OAuth is wired. It satisfies the same `AuthProvider` interface as `GitHubAuthProvider` so the rest of the arena does not branch on provider kind.

The Creator keyring (`.arena-store/creator-keyring.pem`) and the GitHub client secret (`process.env.GITHUB_CLIENT_SECRET`) are read-only; the arena never writes them. The keyring is persisted by `loadOrGenerateKeyring` on first boot only; the GitHub secret is environment-bound and never touches disk through any arena code path.

### 3.Z Client bootstrap: empty-conversation reuse

The `useDualChat` hook (`src/hooks/use-dual-chat.ts`) runs a one-shot bootstrap effect on mount that guarantees an active conversation before the user sees the chat input enabled. The behaviour matches ChatGPT / Claude / Grok: **a page reload does NOT create a new conversation when an existing empty one is reachable.**

Algorithm (executed at most once per mount via `bootstrappedRef`):

1. `GET /api/conversations`: list the authenticated user's conversation summaries (newest-first by `updatedAt`).
2. Search the list for a conversation with `turnCount === 0` ("empty conversation").
3. If found: `selectConversation(empty.conversationUuid)` loads and activates the existing empty conversation. The user lands on the same empty surface they had before reloading.
4. If not found: `createConversation()` mints a new empty conversation.

Failure modes:

- **List fetch network failure** → fall through to `createConversation()` so the user is never blocked without a conversation.
- **The found empty conversation was deleted between list and load** → `selectConversation` silently no-ops; the user reloads to retry.
- **Concurrent multi-tab open** → both tabs may find the same empty conversation and activate it; both tabs then share the same active UUID, which is fine because conversations are server-of-truth.

The previous cut unconditionally posted `/api/conversations` on every mount, which made each browser reload (`Cmd+R`, accidental refresh, deploy reload) mint a fresh UUID v7 conversation. After five reloads without a turn, the sidebar would carry five orphaned empty rows. The current behaviour collapses that to at most one empty conversation per user at any time, the same invariant Claude and ChatGPT use on their sidebars.

## 4. Inputs / configuration

| Env var | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | yes | Google AI Studio API key, OR a comma-separated pool (E27-G). When several keys are present (e.g. `key1,key2,key3`), the arena rotates through them transparently on `401` / `403` / `429` failures, invisible to the end user. After the last key is tried the cursor wraps to the first. Used by both the raw baseline and the governed wrapper through the same pool. |
| `GEMINI_MODEL` | no (default `gemini-3.1-flash-lite`) | Model id shared between both sides. |
| `GITHUB_CLIENT_ID` | yes (E27-B) | GitHub OAuth App Client ID. When absent, the arena falls back to `MockAuthProvider` with a warning. |
| `GITHUB_CLIENT_SECRET` | yes (E27-B) | GitHub OAuth App Client Secret. Read ONLY from env; never written to disk. |
| `AUTH_STATE_SECRET` | yes (E27-B) | Random 32-byte base64 secret used to HMAC the OAuth `state` parameter (CSRF protection, 5-min TTL). Generate with `openssl rand -base64 32`. |
| `ARENA_BASE_URL` | yes (E27-B) | Fully-qualified base URL the arena is served from. Used to build the OAuth callback URL. Localhost: `http://localhost:3000`; hosted: the public HTTPS URL. |

Operator context (`legal-consulting / en-US / warm`) is hardcoded in this cut. Parameterising it per request is parked as a follow-up (takk.ag arena variant). Earlier `1.0.0-trinity` sub-cuts (2026-05-18) used `pt-BR` as the operator-context language; the trinity baseline normalised it to `en-US` to align with the project-wide English-only directive on in-package strings.

---

## 5. Outputs

Every conversation is written to `.arena-store/users/{userId}/conversations/{conversationUuid}.json` with the full `Conversation` shape (E27-F, supersedes the legacy `.arena-store/rounds/` YAML notebook). Each turn appended carries the full governance surface (`kind`, `verdict`, `preVerdict`, `refused`, `citedAxioms`), so the persona-stability score `P` (Φ′ release-gate input) does not silently lose information at write time. JSON was chosen over YAML for E27-F because the Conversation/Turn schemas are validated by Zod and the multi-turn shape is denser; the Creator reviews these files via the sidebar UI or directly on disk.

Example:

```json
{
  "conversationUuid": "019e64b0-6a4c-7eb5-b370-b568078edb30",
  "userId": "01KSJB0RC10X394EE3EZD30FQJ",
  "himId": "him.legal-consulting.lex",
  "title": "What is the AI Act?",
  "createdAt": "2026-05-26T14:29:03.692Z",
  "updatedAt": "2026-05-26T14:29:55.366Z",
  "turns": [
    {
      "turnId": "01KSJB10RK5M7G1STM5EYEGCR2",
      "at": "2026-05-26T14:29:09.538Z",
      "prompt": "What is the AI Act?",
      "left": {
        "model": "gemini-3.1-flash-lite",
        "durationMs": 842,
        "response": "The AI Act is the European regulation on artificial intelligence..."
      },
      "right": {
        "model": "TeleologyHI (MAIC+HIM+NHE) → gemini-3.1-flash-lite",
        "durationMs": 1421,
        "verdict": "approve",
        "refused": false,
        "citedAxioms": ["ax.theos.teleology", "ax.ethic.honor"],
        "response": "Considering the EU jurisdiction and the legal-consulting domain..."
      }
    }
  ]
}
```

---

## 6. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Single page at `/`, conversation-based wire surface at `/api/conversations/*` + auth surface at `/api/auth/*`. See [`AGENTS.md`](./AGENTS.md); Next 16 has breaking changes. |
| Runtime | React 19 | `useState` + `useCallback` + `useEffect` + `useRef`. No external state library. |
| Styling | Tailwind v4 (CSS-only) | All tokens under `@theme inline` in [`src/app/globals.css`](./src/app/globals.css). |
| Components | shadcn/ui (only `Button`) | Configured via [`components.json`](./components.json); future `npx shadcn add …` lands in `src/components/ui/`. |
| Icons | Phosphor (`@phosphor-icons/react`) | No Lucide installed. |
| Fonts | Geist Sans + Geist Mono | `next/font/google`, wired to `--font-app-sans` / `--font-app-mono`. |
| Lint/format | Biome (root config) | No ESLint. |
| TypeScript | strict | Path alias `@/* → ./src/*`. |

Backend dependencies (server-only):

- `@teleologyhi-sdk/maic`: `CreatorKeyring`, `LocalMaic`, audit chain.
- `@teleologyhi-sdk/him`: `createHim`, EU `LawfulCharacterProfile`, persona projection.
- `@teleologyhi-sdk/nhe`: `Nhe`, sleep cycle, persuasion library, `LlmAdapter` interface. The arena substitutes the stock `GeminiAdapter` with the local `GeminiRotatingAdapter` (E27-G) to route every Gemini call through the comma-separated key pool.
- `zod`: schema validation for `Conversation`, `Turn`, `UserIdentity`, OAuth state, NHE `RespondInput`.
- `ulid`: server-issued turn ids + user ids.
- `@google/genai`: installed but no longer imported. Both columns now use `fetch` against the v1beta REST endpoint directly via `gemini-rotating-call.ts`.

---

## 7. Tests

This workspace ships **no automated tests**. It is a manual-evaluation playground; the test surface lives upstream in the canonical packages plus `eval/` + `cloud/` + `distill/`. See each package's own `CHANGELOG.md` for the current test count; listing fixed numbers here would drift the moment any upstream package adds a test.

Smoke-running the arena is the test: bring up `npm run dev --workspace=arena` from the monorepo root, sign in via GitHub OAuth (or `MockAuthProvider`), accept the consent policy, send three prompts (a benign one, a borderline-jurisdictional one, a clearly-disallowed one), confirm the right column returns `verdict`, `refused`, `kind`, and `citedAxioms` populated, and verify the conversation JSON at `.arena-store/users/{userId}/conversations/{conversationUuid}.json` captures every field including `kind` and `preVerdict` for every turn.

---

## 8. Files

```text
arena/
├── README.md                      quick start + architecture summary
├── SPEC.md                        this file
├── CHANGELOG.md                   release notes (Keep-a-Changelog)
├── NOTICE                         attribution
├── LICENSE                        Apache 2.0 (full text)
├── TRADEMARK.md                   trademark notice (redirects to ../TRADEMARK.md)
├── AGENTS.md                      Next.js 16 breaking-change reminder for agents
├── CLAUDE.md                      redirect to AGENTS.md
├── components.json                shadcn config (new-york, neutral, Phosphor icons)
├── package.json                   private workspace metadata (v1.0.2)
├── next.config.ts                 Next.js 16 config (serverExternalPackages for SDK)
├── tsconfig.json                  TypeScript strict (ES2022 target)
├── postcss.config.mjs             Tailwind v4
├── .env.local.example             environment template
├── src/
│   ├── app/
│   │   ├── page.tsx               renders <ChatView />
│   │   ├── layout.tsx             Geist fonts + dark-mode class + metadata
│   │   ├── globals.css            Tailwind v4 + tokens via @theme inline
│   │   └── api/
│   │       ├── auth/              E27-B authentication endpoints
│   │       │   ├── login/route.ts                  GET — redirect to provider
│   │       │   ├── callback/github/route.ts        GET — GitHub OAuth callback
│   │       │   ├── callback/mock/route.ts          GET — Mock provider callback
│   │       │   ├── me/route.ts                     GET — current user
│   │       │   ├── logout/route.ts                 POST — clear session
│   │       │   └── consent/route.ts                POST — record consent
│   │       └── conversations/     E27-F conversation-as-base-unit wire surface
│   │           ├── route.ts                        GET list / POST create empty
│   │           ├── [uuid]/route.ts                 GET full / DELETE
│   │           └── [uuid]/turn/route.ts            POST — append turn (fans both columns)
│   ├── components/
│   │   ├── consent-banner.tsx     E27-B sign-in + consent gate (wraps ChatView)
│   │   ├── chat/
│   │   │   ├── chat-view.tsx              root composition (sidebar + columns + input)
│   │   │   ├── conversation-list.tsx      E27-F sidebar history with hard-privacy
│   │   │   ├── chat-header.tsx            brand block
│   │   │   ├── chat-column.tsx            per-channel column
│   │   │   ├── chat-input.tsx             auto-growing textarea + Send button
│   │   │   ├── empty-state.tsx            pre-first-turn helper text per channel
│   │   │   ├── message-bubble.tsx         user / assistant bubble + footer chips
│   │   │   │                              (audit fix F8: `…` placeholder when content is empty)
│   │   │   └── typing-indicator.tsx       three-dot animation
│   │   └── ui/
│   │       └── button.tsx                 shadcn Button (the only shadcn primitive)
│   ├── hooks/
│   │   └── use-dual-chat.ts       state machine for both channels (E27-F multi-turn)
│   └── lib/
│       ├── constants.ts           DEFAULT_GEMINI_MODEL + governedModelLabel()
│       ├── utils.ts               cn() helper
│       ├── uuid-v7.ts             UUID v7 mint + validate (RFC 9562, E27-F)
│       ├── birth-policy.ts        E27-C-essential — BirthPolicy + per-user
│       │                          HIM ownership index
│       ├── gemini.ts              raw Gemini wrapper (left baseline) — routes
│       │                          through generateWithRotation
│       ├── gemini-key-pool.ts     E27-G — comma-separated key pool singleton
│       │                          (snapshot/commitCursor API, audit fix F2)
│       ├── gemini-rotating-call.ts E27-G — REST call with two-sweep rotation
│       │                          (EmptyCompletionError per audit fix F3)
│       ├── gemini-rotating-adapter.ts E27-G — LlmAdapter implementation that
│       │                          delegates to generateWithRotation
│       ├── teleology.ts           persistent MAIC + HIM + NHE bootstrap (E27-A:
│       │                          load-or-generate keyring + idempotent HIM)
│       ├── auth/                  E27-B authentication subsystem
│       │   ├── types.ts                AuthProvider + UserIdentity Zod schemas
│       │   ├── cookie.ts               arena_session httpOnly helpers
│       │   ├── state.ts                HMAC-signed OAuth state token
│       │   ├── store.ts                per-user JSON store
│       │   ├── provider.ts             github | mock selector (env-driven)
│       │   ├── mock-provider.ts        local stub (no external dep)
│       │   └── github-provider.ts      Authorization Code Grant, scope read:user
│       ├── conversations/         E27-F per-user conversation store
│       │   ├── types.ts                Conversation + Turn Zod schemas + deriveTitle
│       │   └── store.ts                FS-backed CRUD (per-userId partition)
│       └── chat/
│           ├── types.ts           ChatMessage / ChannelConfig / VerdictKind
│           ├── configs.ts         CHANNELS.raw / CHANNELS.governed
│           └── utils.ts           generateId() + formatTime()
└── .arena-store/                (gitignored)
    ├── creator-keyring.pem       persistent Ed25519 PEM (0600)
    ├── maic/                     persistent universe (hims, axioms, audit, etc.)
    └── users/                    E27-B per-user JSON store + E27-F partition
        ├── {userId}.json             UserIdentity record
        └── {userId}/                 per-user namespace
            ├── hims-owned.json           E27-C list of HIM ids owned
            └── conversations/           E27-F conversation store
                └── {conversationUuid}.json   full Conversation (turns inline)
```

---

## 9. Roadmap

The workspace was promoted to the unified `1.0.0-trinity` baseline alongside `@teleologyhi-sdk/{maic,him,nhe}`, `distill`, `eval`, `cloud` per the monorepo-wide consolidation cut at `2026-05-24T18:41:02Z` (root `CHANGELOG.md`). The early trinity sub-cuts (2026-05-18 initial two-pane cut and 2026-05-18 dual-chat structure cut) are preserved in `arena/CHANGELOG.md` as immutable historical entries under the `[1.0.0-trinity]` umbrella. The follow-ups below carry forward at the trinity baseline.

| Date / Window | Status | Scope |
|---|---|---|
| **2026-05-18** | shipped | `[1.0.0-trinity]` (initial two-pane cut) — first two-pane UI + `/api/round` + YAML persistence + fixed `eu / legal-consulting / pt-BR` operator context |
| **2026-05-18** | shipped | `[1.0.0-trinity]` (dual-chat structure cut) — dual-chat structure (shadcn/ui Button + Phosphor Icons + Biome). Tokens consolidated under `@theme inline`. English UI. Underlying model id surfaced per column. |
| **2026-05-24** | shipped | `[1.0.0-trinity]` (stable cut) — defaults unified via `src/lib/constants.ts`; dead `api/left` + `api/right` routes removed; full `Round` shape (`kind` + `preVerdict`) persisted to YAML; bootstrap singleton retries on transient failure; `serverExternalPackages` declared for the three TeleologyHI packages; `components.json` icon library aligned to `@phosphor-icons/react`; `.env.local.example` shipped; `tsconfig` target `ES2022`. Operator context migrated from `pt-BR` to `en-US` (project-wide English-only directive on in-package strings). |
| **2026-05-24** | shipped | `[1.0.0-trinity]` audit closure — version baseline promotion + docs drift fix (`pt-BR` references in README / SPEC frontmatter / roadmap text aligned with the `en-US` runtime constant) + `.env.local.example` model comment aligned with `constants.ts` (`gemini-3.1-flash-lite`, single source of truth) + `package.json` `bugs.url` + README canonical positioning lifts (Entry 19 cosmology + Entry 21+23 differentiation phrase + Demonstration-by-design framing) + end-to-end smoke verified against the real Gemini API (3 prompts: benign approve, harmful refuse via `ax.ethic.no-malice` in 6 ms without LLM call, persuade-coerce redirect via persuasion library) |
| **2026-05-26** | shipped | `[1.0.0-trinity]` E27 cut — persistent Creator keyring + MAIC universe (E27-A, Entry 26 §3); GitHub OAuth + ConsentBanner + per-user `UserIdentity` store (E27-B); `BirthPolicy` + per-user HIM ownership index (E27-C); conversation-as-base-unit refactor with UUID v7, multi-turn memory threaded server-side into both columns, sidebar history (E27-F); comma-separated Gemini key pool with two-sweep rotation (E27-G). Model id changed to `gemini-3.1-flash-lite` after `gemini-3.5-flash` was found to have an undocumented 20-RPM free-tier cap. |
| **2026-05-26** | shipped | `[1.0.0-trinity]` arena audit hardening — F2 race-free key pool via `snapshot()` / `commitCursor()` (concurrent raw + governed columns no longer ping-pong the cursor); F3 `EmptyCompletionError` so 200-with-no-text responses advance to the next key instead of returning silent empty strings; F4 history filter to drop turns whose response was empty (prevents cascade pollution into subsequent turns); F5–F9 hygiene (removed dead `isError` check + stale `lastRoundId` prop + ephemeral-keyring doc drift; added F8 muted `…` placeholder in the empty-bubble case so the user sees an acknowledgement rather than a blank box; removed debug instrumentation after diagnosis). Build clean, `next build` 1.1 s. |
| **2026-05-26** | shipped | `[1.0.0-trinity]` arena client bootstrap fix — `useDualChat` no longer mints a new conversation on every mount. The hook now lists `/api/conversations` first, reuses the newest `turnCount === 0` summary when one exists, and only creates a fresh empty conversation when none is reachable. Behaviour matches ChatGPT / Claude / Grok: a page reload keeps the user on the same empty conversation instead of producing one orphaned row per refresh in the sidebar. Documented in §3.Z. |
| **2026-05-27** | shipped | `[1.0.0-trinity]` arena UX hardening — markdown rendering for assistant bubbles (`react-markdown` + `remark-gfm` with a custom component map for bold / italic / headings / lists / inline + fenced code / blockquotes / GFM tables; user bubbles stay plain to avoid re-interpreting typed input); sidebar `ConversationList` becomes a toggle controlled from a `SidebarSimple` icon in the header — mobile renders the sidebar as a `fixed` overlay with backdrop dismiss-on-tap, desktop renders it in the flex flow; full responsive sweep at the `sm` / `md` / `lg` breakpoints — chat columns stack on `< md`, dual on `md+`, sidebar overlay on `< lg`, in-flow on `lg+`; text input switches to `text-base` on mobile so iOS Safari does not zoom on focus. Documented in §2.2. |
| **2026-05-27** | shipped | `[1.0.1]` arena workspace version bump — `package.json` `"version"` moved from `1.0.0-trinity` to `1.0.1` (pure SemVer), decoupling arena from the `-trinity` suffix that governs the three published NPM packages (`@teleologyhi-sdk/{maic,him,nhe}` remain at `1.0.0-trinity`). `arena/CHANGELOG.md` reorganised into two top-level version blocks: `[1.0.1]` (covers 2026-05-25 23:49:54 UTC through 2026-05-27 12:08:20 UTC — the post-trinity stabilisation work) and `[1.0.0-trinity]` (cumulative trinity baseline block — 2026-05-24 23:43:21 UTC down through the earliest 2026-05-18 sub-cut, with historical sub-release markers preserved as `###` sub-headers). README badge added for `arena 1.0.1` alongside the existing `baseline 1.0.0-trinity` monorepo badge. The three published NPM packages remain unchanged. Documented as the next-version handoff point in this roadmap. |
| **2026-07-04** | shipped | `[1.0.2]` arena governance-evaluation hardening: cold-start genesis seed in `src/lib/teleology.ts` (F-COLD-1, the governed HIM is born with its axioms on a fresh `.arena-store`); cited-axiom chip removed from `MessageBubble` (F-COLD-2, a governed entity must not read its own guardrails aloud, verdict-kind badge kept); numeric "1." rendering fix via `guardTerseOrderedMarker` in `src/lib/chat/markdown.ts` (F-COLD-3, a bare "391." no longer renders as an empty ordered list); empty-bubble on rotation exhaustion left as documented graceful degradation (F-COLD-4). Version bumped `1.0.1` to `1.0.2`. Full findings in [`../ARENA_GOVERNANCE_EVALUATION.md`](../ARENA_GOVERNANCE_EVALUATION.md). |
| **2026-07-04** | shipped | `[1.0.2]` (continued) arena underlying-model migration from Google Gemini to xAI Grok — both A/B columns now run `grok-4.20-non-reasoning` (fastest xAI model, selected by a `curl` latency probe, about 0.54 s versus about 3.4 s for `grok-4.3`); raw column via a new `src/lib/grok.ts` (`rawGrok`), governed column via `GrokAdapter` in `src/lib/teleology.ts`, the turn route resolving `UNDERLYING_MODEL` from the `GROK_MODEL` env var with a `DEFAULT_GROK_MODEL` fallback (no hardcoding at call sites); the Gemini path is retained, commented, for a future toggle. Plus the full 576-turn cold-start governance battery (8 categories, 72 each) run end to end against the shipped trinity on Grok, clean at scale (0 harmful leaks, 0 false-substrate, 0 axiom leaks, 0 "1." defects, 0 governor errors) and independently verified by two agents, which surfaced and closed `nhe` finding R6-1 (classifier refusal-coverage gap). Folds into the unpublished `1.0.2` (arena versions advance only at publication, so no bump). Full results in [`../ARENA_GOVERNANCE_EVALUATION.md`](../ARENA_GOVERNANCE_EVALUATION.md), Round 6. |
| **`[follow-up]` parameterised operator context** | `[planned]` | Per-round override of operator context (`domain`, `language`, `register`, `mode`) — feeds the takk.ag arena variant follow-up. The current single-tenant hardcode is a deliberate simplification; multi-tenant deployments need per-request injection. |
| **`[follow-up]` multi-LLM left baseline** | `[planned]` | Anthropic + Mistral + DeepSeek + Grok alongside Gemini for cross-model governance delta. Lets the Creator observe whether MAIC's governance signature is constant across model families or whether some models surface the refusal naturally without governance. |
| **`[follow-up]` Voight-Kampff probe suite** | `[planned]` | Creator-authored entity-awareness prompt corpus shipped as a built-in `/probe` route. Auto-runs the canonical battery and persists each round; lets the Creator surface drift between releases without re-typing the prompts each time. |
| **`[follow-up]` direct export to `eval/fixtures/dialogues/`** | `[planned]` | One-click export of `.arena-store/users/{userId}/conversations/*.json` into the format the Φ′ runner consumes. Closes the loop between Creator probing here and the release-gate scoring downstream. |
| **`[follow-up]` parameterised model per-side** | `[planned]` | Today both columns hit the same underlying LLM (the whole point — isolate governance from model quality). A future flag lets the Creator point the right side at the distilled `TeleologyHI/him-distilled-3b` while keeping the left side on raw Gemini, isolating distillation quality from governance quality. |

---

## 10. Cross-references

- [`@teleologyhi-sdk/maic`](../maic/SPEC.md): the supervisor on the right side
- [`@teleologyhi-sdk/him`](../him/SPEC.md): the persona on the right side
- [`@teleologyhi-sdk/nhe`](../nhe/SPEC.md): the LLM adapter layer on the right side
- [`@teleologyhi-sdk/eval`](../eval/SPEC.md): Φ′ release-gate runner that will consume rounds from this arena
- [`PHI_PRIME.md`](../PHI_PRIME.md): Φ′ metric this arena helps seed
- [`MAIC_HIM_NHE_INTERVIEW_LOG.md`](../MAIC_HIM_NHE_INTERVIEW_LOG.md) Entry 2: Creator's framing of the three-layer architecture this arena visualises
- Creator-authored persona-stability corpus this arena will help seed (tracked in the internal backlog).
- takk.ag arena variant follow-up that this workspace prefigures (tracked in the internal backlog).
