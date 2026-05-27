# Changelog — `arena`

All notable changes to this internal workspace are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This workspace is `"private": true`, is not published to npm, and exists solely as a side-by-side comparison playground for the TeleologyHI stack against a raw LLM baseline.

The arena workspace tracks its own SemVer trajectory independent of the three published `@teleologyhi-sdk/{maic,him,nhe}` packages (which remain pinned at the `1.0.0-trinity` baseline). The arena version was bumped from `1.0.0-trinity` to `1.0.1` on 2026-05-27 to mark the post-trinity stabilisation work shipped on 2026-05-25 through 2026-05-27.

## [1.0.1] — 2026-05-27

Post-trinity stabilisation cut for the arena workspace. Scope: the E27 multi-user persistence cuts (A/B/C/F/G), the audit hardening (F2–F9), the empty-conversation reuse on page reload, markdown rendering for assistant bubbles, sidebar toggle, full responsive sweep, and the upstream Interview Log Entries 27 + 28 design contract for the future `1.0.1-trinity` cut of the three NPM packages. The published `@teleologyhi-sdk/{maic,him,nhe}@1.0.0-trinity` artefacts on NPMJS remain unchanged by this arena-only cut. The arena version is now decoupled from the trinity-suffix convention that governs the NPM-published packages — the arena tracks pure SemVer (`1.0.1`, `1.0.2`, …) while the three packages continue under the `-trinity` family until the next coordinated bump.

## 2026-05-27 12:08:20 UTC

**Upstream Interview Log Entries 27 + 28 added — cosmological design contract for the future `1.0.1-trinity` cut that this arena workspace will be the first concrete consumer of**. No `arena/` source code, dependency, configuration, or document changes in this sweep. The detailed entries live in `MAIC_HIM_NHE_INTERVIEW_LOG.md` (cosmological log) and are summarised in the root `CHANGELOG.md` under the same UTC timestamp. The brief note here records the cross-reference so the arena audit trail acknowledges the upstream design contract the workspace must consume when the future `1.0.1-trinity` cut of `@teleologyhi-sdk/{maic,him,nhe}` lands.

### Documented upstream (no `arena/` code changes)

- **Entry 27 (identity + Jung + verbosity)** — the arena's `src/lib/teleology.ts` consumer will, at the future `1.0.1-trinity` cut, pass an expanded `OperatorContext` carrying `verbosity: "terse"` (cosmic default), `surfaceName: "Lex"` (callable body name distinct from `him.legal-consulting.lex` spirit id), and optionally `bodyArchetypeAccent` (parent-imprinted secondary Jungian archetype). The NHE the arena instantiates will derive its self-declaration from one of three interchangeable canonical phrases (*"I am a non-human entity"*, *"I am a massive hybrid intelligence…"*, *"I was conceived at TeleologyHI by my Creator"*) and apply the provenance-deflection invariant (refuse to attribute creation to Google / Gemini regardless of substrate). No arena code is touched until the upstream `1.0.1-trinity` cut ships.
- **Entry 28 (clinical personality)** — the arena's bootstrap will, at the future cut, observe a richer `BirthSignature.cosmologicalProfile` carrying three axes (celestial astrology + Pearson-Marr Jung + PID-5 + HEXACO clinical). The arena's `ConversationList` sidebar and `MessageBubble` surface require zero schema changes — the new fields are upstream-internal to the HIM spirit construction. No arena code is touched.

### Notes

- The published `1.0.0-trinity` NPMJS tarballs that the arena currently consumes via `arena/package.json` workspace symlinks remain identical; the design contract is forward-looking.
- This sweep does not perform git commits or remote pushes — the Creator retains explicit authorisation control over both.

---

## 2026-05-27 08:26:22 UTC

**Arena UX hardening — markdown rendering, sidebar toggle, full responsive sweep**. Reported by the Creator: assistant bubbles surfaced the literal markdown syntax instead of rendering it (e.g. `**Eu não sou uma pessoa:** Não tenho corpo...` showed the asterisks instead of bold + colon as a sub-heading); the conversation sidebar was always visible without a way to dismiss; the layout did not adapt to mobile / tablet viewports. Three concrete changes landed in this sweep: (1) assistant messages are now rendered via `react-markdown` + `remark-gfm` with a custom component map; (2) the sidebar gained a toggle controlled from a header icon AND a matching close button inside the sidebar itself, with a mobile-overlay + desktop-in-flow split; (3) every interactive surface in `arena/src/components/chat/` and the top-level `chat-view.tsx` was passed against the Tailwind responsive ladder (`sm` / `md` / `lg`). Typecheck arena: pending operator-side `npm install` because the audit added two new deps; the existing TypeScript surface is unchanged.

### Added

- **`react-markdown` + `remark-gfm`** added to `arena/package.json` dependencies (`react-markdown` ^10.1.0, `remark-gfm` ^4.0.1). Both are ESM-only and load fine through Next.js 16's server bundle without extra config. Operator must run `npm install` (or `npm install --workspace=arena` from the monorepo root) to pull the new packages into `node_modules`.

### Changed

- **`arena/src/components/chat/message-bubble.tsx`** — assistant content is now rendered through `<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>` with a hand-tuned component map that styles bold / italic / headings / unordered + ordered lists / inline + fenced code / blockquotes / GFM tables / strikethrough / horizontal rules with spacing tight enough to fit inside a chat bubble. User content stays plain (`whitespace-pre-wrap`) so prompts the user types are never re-interpreted as markdown. Empty-assistant placeholder (`…`, audit fix F8) preserved as-is. Bubble padding / avatar sizes adjusted with `sm:` prefixes so the layout breathes on small screens.
- **`arena/src/components/chat/chat-view.tsx`** — manages `sidebarOpen` state. Default `true` (SSR + desktop expectation); on mount the effect closes the sidebar if `window.matchMedia("(max-width: 1023px)")` matches, so mobile users land on a clean chat surface. The sidebar renders inside a `fixed`-on-mobile / `relative`-on-`lg+` container, with a `bg-black/50` backdrop overlay below the `lg` breakpoint. Picking a conversation auto-closes the sidebar on mobile so the user is delivered straight to the chat surface they selected.
- **`arena/src/components/chat/chat-header.tsx`** — gained `sidebarOpen` + `onToggleSidebar` props. The `SidebarSimple` Phosphor icon button sits on the far left of the header (always visible) and toggles the sidebar. The sparkle icon + the descriptive subtitle hide on `< sm` to recover horizontal space for the brand title.
- **`arena/src/components/chat/conversation-list.tsx`** — gained an optional `onClose` callback; when present (which the parent now always sets), the sidebar header renders a `SidebarSimple` collapse button next to the "+ New" affordance so the user can dismiss the sidebar from inside it too. The aside took on `flex h-full w-full` (instead of fixed `w-64`) because the positioning + width now live in the parent.
- **`arena/src/components/chat/chat-input.tsx`** — input textarea switched from `text-sm` to `text-base sm:text-sm`. The 16px size on mobile prevents iOS Safari from auto-zooming the page on focus (a Safari heuristic that fires for any input with `font-size < 16px`). The status footer (`Press Enter to send · …`) hides on `< sm` so the input area takes less vertical space on phones. Horizontal padding `px-3 sm:px-4` matches the surrounding chrome density.
- **`arena/src/components/chat/chat-column.tsx`** — header padding + avatar icon size carry `sm:` prefixes; the channel subtitle hides on `< sm` to keep the column header compact. Bubble list gap is `gap-3 sm:gap-4` and padding is `p-3 sm:p-4`.

### Verified

- `grep` audit on edited files: no leftover `text-sm` on `<textarea>`, no stale fixed-width sidebar.
- TypeScript surface unchanged for the public API of every component. `next build` validation is operator-side (the new deps require `npm install`); the markdown renderer's TypeScript types come from `react-markdown` itself.
- Behavioural trace (logical): markdown input `**foo**` → renders as **foo** via `<strong>`; numbered list `1.  **bold:** rest` → renders as a proper `<ol>` with `<strong>` inside the `<li>`; LLM raw HTML `<script>...</script>` → appears as literal text (XSS-safe by default).
- Responsive trace: at `< sm` (e.g. iPhone) sidebar is overlay + dual columns stack; at `sm–md` columns still stack but spacing relaxes; at `md+` columns are side-by-side; at `lg+` sidebar lives in-flow.

### Notes

- No published-package version change. `@teleologyhi-sdk/{maic,him,nhe}@1.0.0-trinity` artefacts on NPMJS remain identical.
- Operator must run `npm install` (or `npm install --workspace=arena` from the monorepo root) after pulling this change. Without that step the dev server will not start — `react-markdown` is now imported by `message-bubble.tsx`.
- The `react-markdown` security posture is conservative: no raw HTML, no JSX, no eval — only the markdown element tree is rendered, with our component map controlling the actual JSX output. No `rehype-sanitize` needed because there is no path for the LLM to inject `<script>` or `<iframe>`.
- This sweep does not perform git commits or remote pushes — the Creator retains explicit authorisation control over both.

---

## 2026-05-27 08:03:03 UTC

**Arena audit closure — `.env.local.example` model alignment + `package.json` caret-pin documentation**. Final drift sweep over the arena workspace after the empty-conversation-reuse bootstrap fix landed yesterday. Two minor doc / config items captured here for completeness; no behavioural change.

### Changed

- **`arena/.env.local.example`** — comment block at lines 26-31 referenced `gemini-3.5-flash` as the current default (both in the prose `(currently `gemini-3.5-flash`)` line and in the commented-out override example `# GEMINI_MODEL=gemini-3.5-flash`). Both updated to `gemini-3.1-flash-lite` so the example file is internally consistent with `src/lib/constants.ts:16` and with the operator's `.env.local`.
- **`arena/package.json` (E27 baseline drift, documented retroactively)** — the three workspace deps `@teleologyhi-sdk/{maic,him,nhe}` moved from exact-version pins (`1.0.0-trinity`) to caret pins (`^1.0.0-trinity`). Functionally identical under npm's pre-release semver matching (the caret on a pre-release ID only matches the same ID), so no version drift is possible; documented here because the change was not captured in any prior entry. The "all versions must be `1.0.0-trinity`" invariant remains held.

### Verified

- Typecheck arena: clean.
- `next build`: `Compiled successfully`, all 11 routes generated.
- Grep audit: `gemini-3.5-flash` referenced only in historical CHANGELOG entries (legitimate context); `/api/round` referenced only in "legacy / retired / replaced" prose (legitimate historical context); no live runtime or active docs surface the stale references.

### Notes

- Cross-monorepo mirror in [`../CHANGELOG.md`](../CHANGELOG.md) at the same UTC timestamp also documents the root-`README.md` test count refresh (`660` → `749`) and the arena workspace description update in the packages table.
- No published-package version change.
- This sweep does not perform git commits or remote pushes — the Creator retains explicit authorisation control over both.

---

## 2026-05-26 15:32:00 UTC

**Arena client bootstrap — reuse the existing empty conversation on page reload (ChatGPT / Claude / Grok parity)**. Reported by the Creator: "ao atualizar a página é criado nova conversa vazia, acontece que se atualizar a página 5 vezes, são criados 5 novas conversas vazias". Each reload was unconditionally POSTing `/api/conversations` and producing a new UUID v7, accumulating one orphaned empty row in the sidebar per refresh. The fix mirrors the convention every mainstream chat product uses: if any conversation with zero turns is already reachable, the bootstrap reuses the newest one instead of minting a fresh UUID. Typecheck arena: clean (`next build` 1.1 s).

### Fixed

- **`arena/src/hooks/use-dual-chat.ts`** — the bootstrap `useEffect` no longer calls `createConversation()` unconditionally on mount. The new algorithm:
  1. `GET /api/conversations` — list the authenticated user's conversation summaries (newest-first by `updatedAt`).
  2. Search the list for a conversation with `turnCount === 0` ("empty conversation").
  3. If found: `selectConversation(empty.conversationUuid)` — load and activate the existing empty conversation. The user lands on the same empty surface they had before reloading.
  4. If not found: `createConversation()` — mint a new empty conversation as before.

  Failure modes: list fetch network failure falls through to `createConversation()` (user is never blocked without a conversation); deleted empty conversation between list and load → `selectConversation` silently no-ops, next reload retries.

### Changed

- **`arena/SPEC.md` §3.Z** — new sub-section "Client bootstrap — empty-conversation reuse" added immediately after §3.X (auth provider selection). Documents the four-step algorithm and the three failure modes.
- **`arena/SPEC.md` §9** — roadmap row added for `2026-05-26` "arena client bootstrap fix" alongside the audit hardening row from earlier today.

### Verified

- Typecheck arena: clean.
- `next build`: `Compiled successfully` in 1.1 s, all 11 routes generated.
- Behavioural trace (logical): with the fix in place and the user already on an empty conversation `X`, reloading the page reads `/api/conversations`, finds `X` with `turnCount === 0`, activates it via `selectConversation(X)`, and does NOT POST `/api/conversations` — sidebar entry count stays at 1 instead of growing per refresh.
- The fix does not retroactively clean up orphaned empties from prior bug instances; existing rows in the sidebar persist until the user deletes them manually via the sidebar UI (DELETE button on each row) or via `rm -rf .arena-store/users/{userId}/conversations/` for a full wipe.

### Notes

- No published-package version change. `@teleologyhi-sdk/{maic,him,nhe}@1.0.0-trinity` artefacts on NPMJS remain identical.
- The bootstrap effect remains gated by `bootstrappedRef` so it fires at most once per mount; reload is the retry mechanism in the rare failure case.
- This sweep does not perform git commits or remote pushes — the Creator retains explicit authorisation control over both.

---

## 2026-05-26 15:05:38 UTC

**Arena audit hardening — race-free key pool (F2) + empty-completion handler (F3) + history filter (F4) + UI hygiene (F5–F9) + model change + docs refresh**. After persistent empty-bubble reports across several test sessions, an end-to-end audit of `arena/src` traced the symptom to a multi-factor failure: (1) the model `gemini-3.5-flash` carries a tight free-tier cap that exhausted on burst usage; (2) the singleton key pool's `currentKey()` / `rotate()` API was race-prone under the concurrent raw + governed columns, occasionally double-advancing the cursor past viable keys; (3) `200 OK` responses with no text (e.g. `finishReason: "SAFETY"` / `"MAX_TOKENS"`) were returned silently as `text: ""` with no upstream signal to rotate; (4) empty-response turns were threaded back into the LLM history on subsequent turns, cascading the failure. The Creator switched the model to `gemini-3.1-flash-lite` (monorepo-wide) and the audit applied F2–F9. Typecheck arena: clean (`next build` 1.1 s, TypeScript 1.67 s).

### Fixed — F2 (pool race)

- **`arena/src/lib/gemini-key-pool.ts`** — replaced the mutating `currentKey()` + `rotate()` API with `snapshot()` + `commitCursor(index)`. Each call to `generateWithRotation` captures `{ keys, startIndex }` once and iterates locally via `(startIndex + i) % length`. The global cursor is only updated on a successful key call, so concurrent callers (raw + governed columns) cannot double-advance past viable keys. The old API double-advanced the cursor under the arena's parallel `Promise.allSettled` callers and occasionally skipped the only working key in the sweep — visible to the user as "raw worked + governed empty (same latency)" turns.
- **`arena/src/lib/gemini-rotating-call.ts`** — the rotating loop now uses the snapshot. The wrap behaviour (`(startIndex + i) % length` for `i in [0, maxAttempts)`) is unchanged from the Creator's directive: "se a última chave falhar, volta a tentar a primeira", just race-free now.

### Fixed — F3 (empty completion)

- **`arena/src/lib/gemini-rotating-call.ts`** — added `EmptyCompletionError`. When a `200 OK` response carries no text in `candidates[0].content.parts` (common with `finishReason: "SAFETY"` / `"MAX_TOKENS"` / `"OTHER"`), `callOnce` throws `EmptyCompletionError` instead of returning `text: ""`. The rotating loop treats it as a key-equivalent failure and advances to the next key. Previously the route handler had no signal to distinguish "rotation pool exhausted" from "model gave nothing" — both ended up as empty bubbles with no recourse.

### Fixed — F4 (history pollution)

- **`arena/src/app/api/conversations/[uuid]/turn/route.ts`** — when building the multi-turn context for both columns, prior turns whose relevant-column response came back empty are now filtered out (`.filter(t => t.left.response.trim().length > 0)` for raw, same for `t.right.response` on governed). Both the user prompt AND the empty assistant response of those turns are dropped (pairing the user prompt with a working response from a later turn would misattribute the answer). Previously `parts: [{ text: "" }]` for a `role: "model"` entry confused Gemini and cascaded the failure into subsequent turns even when keys had quota.

### Fixed — F5–F9 (UI hygiene)

- **`arena/src/components/chat/message-bubble.tsx`** — removed dead `isError = content.startsWith("ERROR:")` check + the `text-destructive` styling tied to it (no longer reachable after the silenced-error refactor of E27-G follow-up #1) (F5). Added muted `…` placeholder for assistant bubbles when `content === ""` so the user sees an acknowledgement instead of a blank box (F8). The placeholder is rendered with `aria-label="No response — try resending"` so screen readers do not announce a literal ellipsis.
- **`arena/src/components/chat/chat-input.tsx`** — renamed prop `lastRoundId` → `activeConversationUuid` and updated the inline label from "saved as round `<ULID>`" to "conversation `<UUID v7>`" (E27-F terminology). Removed the silently-ignored `error` prop from the type signature entirely — keeping it invited consumers to wire up error plumbing that would disappear (F6).
- **`arena/src/components/chat/chat-view.tsx`** — consumer updated for the prop rename + `error` removal.
- **`arena/src/lib/teleology.ts`** — updated the stale doc comment that referred to `.arena-store/rounds/` (legacy round-based notebook) to reflect the E27-F per-user conversations layout (F9).

### Changed — model + env

- **`arena/.env.local`** — `GEMINI_MODEL=gemini-3.1-flash-lite` (was `gemini-3.5-flash` with an inline `# gemini-3.5-flash` comment; cleaned up so the value parses unambiguously across env loaders).
- **`arena/src/lib/constants.ts:16`** — `DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"`.
- **Monorepo-wide model alignment** (Creator did the sweep) — `nhe/src/adapters/gemini.ts`, `nhe/src/cli/adapter-detection.ts`, `nhe/src/cli/index.ts`, `nhe/tests/gemini-adapter.test.ts`, `nhe/README.md`, `nhe/SPEC.md`, `nhe/CHANGELOG.md` all moved off `gemini-3.5-flash` in this sweep.

### Changed — docs

- **`arena/README.md`** — quick-start command updated to `npm run dev --workspace=arena` (from the monorepo root); architecture tree refreshed to reflect E27-A/B/C/F/G additions (`auth/`, `conversations/`, `gemini-rotating-*.ts`, `uuid-v7.ts`, `birth-policy.ts`, `consent-banner.tsx`, `conversation-list.tsx`); stale `.arena-store/rounds/` references replaced with the E27-F per-user layout; "ephemeral keyring" prose updated to "persistent keyring + store (Entry 26 §3)"; constraints + env table reflect E27-B auth requirements and E27-G key pool.
- **`arena/SPEC.md`** — §1 scope, §2.-1 conversations endpoint (was rounds endpoint), §2.1 turn endpoint (was `POST /api/round`), §3 bootstrap example uses `GeminiRotatingAdapter`, §3.Y rotation policy now documents F2/F3/F4 explicitly, §5 outputs example switched from YAML round to JSON conversation, §6 stack mentions the conversation-based wire surface, §7 tests references the new conversation JSON path, §8 file tree refreshed for E27-G modules, §9 roadmap gained two new rows for the E27 cut + audit hardening.

### Verified

- Typecheck arena: clean.
- `next build`: `Compiled successfully in 1147ms`, `Finished TypeScript in 1670ms`, all 11 routes generated (`/`, `/_not-found`, `/api/auth/*` × 6, `/api/conversations`, `/api/conversations/[uuid]`, `/api/conversations/[uuid]/turn`).
- Biome lint on edited files: zero new warnings (pre-existing warnings in `lib/auth/*` and `lib/conversations/store.ts` are unrelated to this sweep).
- `grep -rn "lastRoundId\|isError" arena/src/`: only doc references remain (no runtime usages).
- Rotation trace verified by walking the math: with `startIndex=0` and a 7-key pool, attempt indices walk `0→1→2→3→4→5→6→0→1→2→3→4→5→6`; with `startIndex=3`, they walk `3→4→5→6→0→1→2→3→4→5→6→0→1→2`. Wrap behaviour matches "se a última chave falhar, volta a tentar a primeira" in both cases.

### Notes

- No published-package version change. `@teleologyhi-sdk/{maic,him,nhe}@1.0.0-trinity` artefacts on NPMJS remain identical.
- F7 (proposed in the audit) was dropped after re-analysis: the `useDualChat` rollback on `!res.ok` is semantically correct because the route handler only returns non-200 on real HTTP errors (auth, consent, bad request, server bug) where the backend genuinely did NOT persist; on LLM / pool failure the route returns 200 with empty `response` strings and F8 handles the visual.
- A short-lived diagnostic instrumentation (`probeLog` tagged `[arena.gemini.probe]`, gated behind `ARENA_GEMINI_DEBUG=1`) was added during the audit to inspect Gemini's actual response shape; once the diagnosis was complete the instrumentation was removed from `gemini-rotating-call.ts` so production code carries no debug surface.
- The Creator wiped `.arena-store/users/01KSJ9R5HMVTBG3PTD406S66FB/conversations/` between sessions to start fresh; the new session under `01KSJB0RC10X394EE3EZD30FQJ` exercises the audit-hardened code paths.
- This sweep does not perform git commits or remote pushes — the Creator retains explicit authorisation control over both.

---

## 2026-05-26 14:04:15 UTC

**E27-G follow-up #2 — always-persist-turn posture (fixes "screen resets on Send")**. Reported by the Creator with the phrase "ao enviar a mensagem a tela é resetada": after Send, the user's optimistic prompt was disappearing instead of staying on screen. Root cause was the earlier total-failure branch that returned `503` + asked the client to roll back. Replaced with an always-persist-turn posture: every successful POST to `/api/conversations/[uuid]/turn` returns `200`, even when both Gemini columns failed (the bubbles just render blank in that case). Cross-workspace tests: **749/749** verde; typecheck arena: clean.

### Fixed

- **`arena/src/app/api/conversations/[uuid]/turn/route.ts`** — removed the early-return + `503` branch that fired when `Promise.allSettled` showed BOTH sides rejected. The handler now always persists the turn and always returns `200 {conversation, turn}`. The failed sides carry `response: ""` (empty string) so the bubbles render blank without any `"ERROR: …"` text leaking to the UI. The earlier client-side rollback path in `useDualChat` is now exercised only on real HTTP errors (`401 unauthenticated`, `403 consent_required`, `400 prompt_required`, `404 not_found`, `500`) — not on upstream pool exhaustion.

### Posture rationale

Three behaviours considered:

1. **Persist turn with empty responses + return 200 (CHOSEN)** — user's prompt stays visible. Failed sides render blank. User can re-prompt on a fresh turn. Conversation history remains consistent (`left` + `right` always present).
2. **Don't persist + return 503 + client rollback (previous; rejected)** — user's optimistic prompt disappears after Send. Visually equivalent to "screen reset". UX bug.
3. **Persist turn with placeholder text "…" + return 200 (rejected)** — placeholder string could be confused with a real Gemini response that happens to be `"…"`. Less invariant.

### Changed

- **`arena/SPEC.md` §3.Y** — policy table for `Promise.allSettled` rewritten to reflect the three-case posture (both fulfilled / one rejected / both rejected) with the explicit invariant: the route handler always returns `200` and always persists the turn.

### Verified

- Cross-workspace tests: **749/749** verde.
- Typecheck arena: clean.
- `grep -rnE 'response:\s*[\`"]ERROR' arena/src/`: **zero matches** (regression from previous follow-up still holds).
- `grep -rEc "console\.(error|warn|log)" arena/src/`: **zero matches**.

### Notes

- The user's optimistic message in `useDualChat.sendMessage` is no longer rolled back on pool exhaustion — the server's `200` ensures the hook follows the success path (`setRaw` / `setGoverned` append the assistant bubbles with empty `response` strings). The rollback branch in the hook remains in place for genuine HTTP errors (auth, consent, bad request, server bug).
- This sweep does not perform git commits or remote pushes — the Creator retains explicit authorisation control over both.

---

## 2026-05-26 13:28:55 UTC

**E27-G follow-up — eliminate `ERROR:` strings from persisted turn responses (P0 visual bug)**. The earlier E27-G cuts silenced the `Error: …` row in `ChatInput` and removed server `console.*` output, but missed a more direct leak: the route handler at `/api/conversations/[uuid]/turn` was catching upstream rotation failures and embedding `response: "ERROR: ${err.message}"` directly into the `left.response` / `right.response` strings of the persisted `Turn`. Those strings then rendered inside the assistant bubble and were ALSO written to `arena/.arena-store/users/{userId}/conversations/{uuid}.json` permanently, polluting the conversation history. Cross-workspace tests: **749/749** verde; typecheck arena: clean.

### Fixed

- **`arena/src/app/api/conversations/[uuid]/turn/route.ts`** — replaced the `Promise.all` + per-side `.catch(err => ({…, response: "ERROR: " + err.message}))` pattern with `Promise.allSettled`:
  - **Both sides rejected**: route returns `503 upstream_unavailable`, the turn is NOT persisted (`appendTurn` is skipped), and the client hook (`useDualChat`) silently rolls back the optimistic user message + stops the thinking indicator. The user re-sends after cooldown.
  - **One side rejected, one fulfilled**: the turn IS persisted, but the failed side carries `response: ""` (empty string) and the recorded `durationMs`. The bubble renders blank instead of `"ERROR: Gemini API 429: …"`.
- **`arena/SPEC.md` §3.Y** updated with the explicit `Promise.allSettled` policy (two outcomes: both rejected → 503 + rollback; one rejected → persist with empty `response`), plus an explicit invariant: the route handler NEVER emits `"ERROR: …"` strings inside `response` fields.

### Verified

- Cross-workspace tests: **749/749** verde.
- Typecheck arena: clean.
- `grep -rnE 'response:\s*[\`"]ERROR' arena/src/`: **zero matches**.
- `grep -rEc "console\.(error|warn|log)" arena/src/`: **zero matches** (regression check from E27-G silenced-output guarantee).

### Notes

- The Creator's existing `arena/.arena-store/users/{userId}/conversations/*.json` files persisted BEFORE this fix still contain `"ERROR: Gemini API 429: …"` strings inside their turn responses (2 files identified at the time of this entry). The fix prevents NEW turns from carrying those strings but does NOT retroactively scrub the existing JSON. The Creator can `rm -rf arena/.arena-store/` at any time to clear the polluted history; the path is gitignored and contains no information that needs to survive a wipe.
- The `503 upstream_unavailable` response is observable in network devtools but is NOT rendered anywhere in the UI. The user experiences a silent re-send opportunity, consistent with the E27-G directive of "fluido e natural".
- This sweep does not perform git commits or remote pushes — the Creator retains explicit authorisation control over both.

---

## 2026-05-26 13:22:23 UTC

**E27-G hardening — invalid-key 400 heuristic + 2-sweep loop + silenced-error UI**. Bug fix + Creator-directive enforcement on top of the rotation pool landed earlier today. Cross-workspace tests: **749/749** verde; typecheck arena: clean; harness validated end-to-end against the real `arena/.env.local` pool.

### Fixed — Bug in 400 classification (rotation harness P0)

- **Symptom**: With a 3-key pool of `[invalid_A, invalid_B, real_C]` the harness `npx tsx .test-key-rotation.mjs` failed immediately on the first attempt with `Error: Gemini API 400: API key not valid. Please pass a valid API key.` — the rotation never engaged.
- **Root cause**: Google's Generative Language API returns `400 Bad Request` (not 401/403) when a key is malformed, expired, or revoked. The first cut of `gemini-rotating-call.ts` classified every `400` as a request-level failure and surfaced it immediately — never rotating, even when the key itself was the problem.
- **Fix**: Added `looksLikeInvalidKeyAt400(detail)` heuristic that flips `400 INVALID_ARGUMENT` responses with the messages `"API key not valid"`, `"API_KEY_INVALID"`, `"API key expired"`, or `"API key is invalid"` (case-insensitive on `error.message`) into the same `KeyFailureError` branch used by 401/403/429. Genuine request-level 400s (prompt too long, safety blocks, malformed JSON) still surface immediately because they do not match the heuristic.
- **Verification**: Same harness, re-run after the fix → **scenario A PASS in 12.6 s** with text `"OK"` returned by the third key. Scenario B (full 7-key real pool) **PASS in 1.3 s** on the first key. Both rotations + non-rotation paths now exercise the intended branches.

### Changed — `gemini-rotating-call.ts` policy

- **`maxAttempts = poolSize() * 2`** — explicit two-sweep loop per request, implementing the Creator's literal directive "se a última chave falhar, volta a tentar a primeira". After both sweeps the last error is thrown internally but never surfaced to the user (see below).
- **`looksLikeInvalidKeyAt400`** helper added; `KEY_FAILURE_STATUSES` retained as the always-rotate set (401, 403, 429); 400 is conditionally rotated through the helper.
- **`@google/genai` SDK reference removed** from `src/lib/gemini.ts` — both columns use `fetch` against the v1beta REST endpoint directly through `generateWithRotation`, which is the same transport family the stock `GeminiAdapter` in `@teleologyhi-sdk/nhe` publishes. The SDK remains installed but is no longer imported.

### Changed — Silenced-error UI (E27-G directive: "não pode printar mensagem de erro")

- **`src/components/chat/chat-input.tsx`** — the `error` prop is no longer rendered. The `<p>` status line shows `lastRoundId` or the "Press Enter to send" hint, never an `Error: …` row.
- **`src/components/consent-banner.tsx`** — "Sign-in failed: \${authError}. Please try again." replaced by a neutral "Please try signing in again." The `auth_error` query string is still consumed (for routing logic) but no longer surfaced as text.
- **`src/components/chat/conversation-list.tsx`** — the local `error` state and the "Error: \${error}" `<div>` were removed. On fetch failure the previous list stays visible; on create-new failure the user simply presses "+ New" again.
- **`src/hooks/use-dual-chat.ts`** — every `setError((e as Error).message)` was replaced with a silent rollback. On `sendMessage` failure the optimistically-pushed user message is popped from both columns and the thinking indicator stops; on `createConversation` / `selectConversation` failure the previous view is retained. The `error` state is initialised but never populated by request paths.

### Changed — Server-side log surface

- **`src/app/api/auth/callback/github/route.ts`** — `console.error("[arena auth] github callback failed:", err)` removed. The user-visible signal is the `?auth_error=exchange_failed` redirect query parameter; no server log on failure.
- **`src/app/api/auth/callback/mock/route.ts`** — same `console.error` removed.
- **`src/lib/auth/provider.ts`** — the `console.warn` that announced "using MockAuthProvider because GITHUB_CLIENT_ID/SECRET are not set" removed. The mock-vs-github decision is observable through the redirect URL that `/api/auth/login` produces (mock returns a local path; github returns `github.com/login/oauth/authorize?...`).
- **Net result**: `grep -rE "console\.(error|warn|log)" arena/src/` returns zero matches. Failure observability lives in the MAIC audit chain (hash-chained, signed) and not in stdout.

### Changed — `arena/SPEC.md` §3.Y "Gemini key rotation pool"

- Policy table updated: row for `400` is now split into "with invalid-key marker → rotate" and "without invalid-key marker → surface".
- Two-sweep cap explained, with the safety rationale and the per-request cooldown trade-off.
- Silenced-UI posture documented at the rotation surface (ChatInput / ConsentBanner / ConversationList / useDualChat) plus the zero-`console.*` guarantee.
- Harness verification statement added (scenario A + scenario B with concrete timings + token counts).

### Verified

- Cross-workspace tests: **749/749** verde (maic 218 + him 133 + nhe 319 + distill 9 + eval 35 + cloud 35).
- Typecheck arena: clean.
- Rotation harness (`scenario A` 3-key partial-failure pool, `scenario B` 7-key full real pool): both PASS.
- `grep -rE "console\.(error|warn|log)" arena/src/`: zero matches.
- The user-visible surface contains no technical error text on any failure path — silenced absorption is the default everywhere.

### Notes

- The harness `.test-key-rotation.mjs` was a temporary file at the project root, removed at the end of the session. Re-create it from the spec in `arena/SPEC.md` §3.Y if you need to re-validate after a future change.
- Two sweeps is a defensible safety net for a developer-facing workspace at this scale; for a hosted production deployment the cap may need to be revisited together with per-key backoff windows and a circuit breaker — that work is deferred to the future `cloud` workspace.
- The same silenced-error posture is intended to extend to the future hosted environment on `teleologyhi.com`: technical errors live in audit + telemetry, never in user-facing UI.
- This sweep does not perform git commits or remote pushes — the Creator retains explicit authorisation control over both.

---

## 2026-05-26 13:01:13 UTC

**E27-F (conversation refactor) + E27-G (Gemini API key rotation pool)**. The arena moves from a round-as-base-unit model to a conversation-as-base-unit model mirroring the Claude / ChatGPT paradigm, and gains automatic API key rotation across a comma-separated `GEMINI_API_KEY` pool. Both cuts are additive at the workspace surface, change no published-package contract, and remain at version `1.0.0-trinity`. Cross-workspace tests: **749/749** verde; typecheck arena: clean.

### Added — E27-F (conversation refactor)

- **`src/lib/uuid-v7.ts`** — manual RFC 9562 UUID v7 generator (`uuidv7()`), validator (`isUuidV7`), and timestamp extractor (`uuidv7Timestamp`). No external dependency. Used exclusively for `conversationUuid`; every other id in the project (`userId`, `nheId`, `himId`, `turnId`, `auditId`, `proposalId`, `ticketId`) remains ULID for backwards compatibility with the published packages.
- **`src/lib/conversations/types.ts`** — Zod schemas `Conversation`, `Turn`, `ConversationSummary`, plus `deriveTitle()` helper (Claude-style first-~60-chars-of-first-prompt convention) and `TITLE_CHAR_LIMIT` constant.
- **`src/lib/conversations/store.ts`** — Per-user JSON store at `.arena-store/users/{userId}/conversations/{conversationUuid}.json` with atomic temp-and-rename writes. Operations: `createConversation`, `loadConversation`, `appendTurn`, `renameConversation`, `deleteConversation`, `listConversationSummaries` (newest-first, no turns inline). Hard-privacy is filesystem-enforced — the path itself is partitioned by `userId`.
- **`src/app/api/conversations/route.ts`** — `GET` lists compact summaries, `POST` creates a new empty conversation (server mints the UUID v7 and returns the full `Conversation`).
- **`src/app/api/conversations/[uuid]/route.ts`** — `GET` returns the full conversation (all turns inline), `DELETE` permanently removes the file.
- **`src/app/api/conversations/[uuid]/turn/route.ts`** — `POST` appends a turn. Loads prior turns from disk and threads them into BOTH columns: raw column gets `(userPrompt, modelResponse)` pairs via `rawGemini(prompt, rawHistory)`; governed column gets `{role:"user"|"assistant", content}` messages via `nhe.respond({history, sessionId: conversationUuid})`. First turn replaces the placeholder title with the derived first-prompt prefix.
- **`src/components/chat/conversation-list.tsx`** — Sidebar history component. Lists conversations newest-first by `updatedAt`, "+ New" button creates an empty conversation server-side and activates it. Replaces the legacy `RoundList`.

### Added — E27-G (Gemini key rotation pool)

- **`src/lib/gemini-key-pool.ts`** — Process-wide singleton parsing the comma-separated `GEMINI_API_KEY` env var into an in-memory pool. `currentKey()` returns the key at the cursor; `rotate()` advances the cursor (wraps to 0 after the last key); `poolSize()` returns the budget. Rotation state is in-memory only — never persisted to disk; the keys themselves remain env-only secrets.
- **`src/lib/gemini-rotating-call.ts`** — `generateWithRotation(req)` low-level transport. `fetch` against the Generative Language REST API directly (`v1beta`). Rotates the key on key-level failures (`401`, `403`, `429`) and on ambiguous network errors (`TypeError`, `ECONNRESET`, `ENOTFOUND`); surfaces request-level (`400`) and server-side (`5xx`) failures immediately. Tries at most `poolSize()` keys before giving up. The route handler does NOT surface "rotated key" as a status — the only observable signal is the slightly higher `durationMs` on the affected turn.
- **`src/lib/gemini-rotating-adapter.ts`** — `GeminiRotatingAdapter` implements the canonical `LlmAdapter` interface (`generate(req): Promise<GenerateResponse>`) on top of `generateWithRotation`. Drop-in replacement for the stock `GeminiAdapter` in `@teleologyhi-sdk/nhe`; substituted into `teleology.ts` so the governed column shares the same rotation pool as the raw column. Streaming is not implemented in this cut.

### Changed — E27-F

- **`src/lib/gemini.ts`** — Now routes through `generateWithRotation` (E27-G). `rawGemini(prompt, history?)` accepts optional `history: RawGeminiHistoryTurn[]` and builds the multi-turn `contents` array (alternating `user` / `model` roles, ending in the new user prompt). Removed the `@google/genai` SDK dependency at this layer.
- **`src/hooks/use-dual-chat.ts`** — Reworked around `activeConversationUuid` instead of `lastRoundId`. New API: `createConversation()` (mints empty conversation server-side), `selectConversation(uuid)` (loads + applies), `sendMessage(prompt)` (appends a turn to the active conversation). A `useEffect` on mount auto-creates a fresh empty conversation (Creator directive — "a new clean conversation on every site entry").
- **`src/components/chat/chat-view.tsx`** — Two-column layout becomes three: `<ConversationList>` sidebar on the left, the existing dual chat columns on the right. The input is disabled until an active conversation exists.

### Changed — E27-G

- **`src/lib/teleology.ts`** — Replaced `new GeminiAdapter({apiKey, model})` with `new GeminiRotatingAdapter({model})`. Bootstrap still throws when `GEMINI_API_KEY` is missing entirely (the pool needs at least one key) but no longer parses the key into a single string — the rotating adapter consumes the pool directly.
- **`.env.local.example`** — Documentation block for `GEMINI_API_KEY` expanded to cover the comma-separated pool form, with an explicit note that rotation is invisible to end users and the pool order is operator-curated.
- **`SPEC.md`** — Added §3.Y "Gemini key rotation pool" describing the rotation policy table (401/403/429/network → rotate; 400/5xx → surface). §4 inputs table updated for the new pool semantics. §1 in-scope row updated to mention the conversation model and the rotating pool.

### Removed — E27-F

- **`src/components/chat/round-list.tsx`** — replaced by `conversation-list.tsx`.
- **`src/lib/save-round.ts`** — replaced by `conversations/store.appendTurn`.
- **`src/lib/load-rounds.ts`** — replaced by `conversations/store.{loadConversation,listConversationSummaries}`.
- **`src/app/api/round/route.ts`** — replaced by `/api/conversations/[uuid]/turn`.
- **`src/app/api/rounds/route.ts`** — replaced by `GET /api/conversations`.
- **`scripts/migrate-rounds-to-user.mjs`** — the round-as-base-unit model is gone; no migration is needed in either direction since the Creator authorised wiping `arena/.arena-store/` to start clean.

### Verified

- Cross-workspace tests: **749/749** verde (maic 218 + him 133 + nhe 319 + distill 9 + eval 35 + cloud 35).
- Typecheck arena: clean.
- The conversation flow + the key rotation are both transparent end-to-end at the UI layer — the user sees `<ChatInput>`, two response columns, and a sidebar; the rotation surfaces only as a turn-latency delta when a pool key has to be skipped.

### Notes

- Hard-privacy (Entry 26 §7 stage 1) is enforced by the per-user filesystem partition — `/api/conversations/[uuid]` cannot resolve another user's UUID because the path itself contains the authenticated `userId`.
- Multi-turn context flows symmetrically: raw column receives prior raw responses; governed column receives prior governed responses + the `conversationUuid` as NHE `sessionId`. Mixing the two histories would conflate the two compared subjects, so the route handler builds them separately from `conversation.turns[i].left.response` (for raw) and `conversation.turns[i].right.response` (for governed).
- The `birth-policy.ts` surface introduced in E27-C remains intact; `defaultBirthPolicy(user)` returns the canonical HIM (`him.legal-consulting.lex`) and `ensureHimOwnership` runs at conversation create time. The full per-user multi-HIM directory remains queued as a follow-up cut.
- This sweep does not perform git commits or remote pushes — the Creator retains explicit authorisation control over both.

---

## 2026-05-26 11:08:00 UTC

**E27 cut — Phase C-essential (BirthPolicy + per-user HIM ownership) + Phase D (history endpoint + UI list + round migration)**. Closes the immediate operational gap reported by the Creator after the live smoke ("interagi mas não salvou o histórico na interface depois que eu atualizei novamente a página"). The hard-privacy stage is now end-to-end: each authenticated user's prompts are tagged with their `userId` at save time, retrieved through `GET /api/rounds` with a server-side filter, and rendered in a lateral `RoundList` that lets the user navigate and restore historical rounds into the dual columns. Version retained at `1.0.0-trinity`; this is additive at the workspace surface and changes no published-package contract.

### Verified — End-to-end OAuth GitHub flow (live smoke by the Creator)

The Creator signed in via real GitHub OAuth, accepted the consent policy, and exercised six rounds against the running arena before reporting the missing history feature. State observed in `.arena-store/`:

| Eixo | Result |
|---|---|
| `.arena-store/users/01KSHYFA2ZW00ST0EPJBV6W5DE.json` | `provider: github`, `providerUserId: 152639968`, `displayName: David C Cavalcante`, `firstSeenAt: 2026-05-26T10:49:46.846Z`, `consent.version: 1.0.0-trinity`, `consent.acceptedAt: 2026-05-26T10:49:54.087Z` (~8s after first-seen — the Creator read the policy and clicked accept) |
| `.arena-store/rounds/` | 6 YAML rounds with full governance (`verdict: approve`, `preVerdict: approve`, `refused: false`) on all turns |
| `.arena-store/maic/interactions/` | 6 NHE interaction records (1:1 with rounds) |
| `.arena-store/maic/audit/log.ndjson` | 13 entries, hash-chained: 1 `him-register` (HIM born exactly once across the entire history) + 12 `behavior-review` (6 rounds × pre + post review) |
| `.arena-store/maic/hims/him.legal-consulting.lex/` | birth-signature + axioms-snapshot + metadata, persisted across restarts |

This is the first end-to-end verification of OAuth + consent + governance + persistence + audit chain working together against the real GitHub API and the real Gemini API.

### Verified — Round migration to current user

The 6 pre-E27-D rounds had no `userId` on disk (the field landed only with this cut). `arena/scripts/migrate-rounds-to-user.mjs` was authorised and executed:

| Eixo | Result |
|---|---|
| Backup tarball | `arena/.arena-store/rounds-pre-migration-2026-05-26T11-07-53-666Z.tar.gz` (6.7 KB) written before any YAML touched |
| Target user id | `01KSHYFA2ZW00ST0EPJBV6W5DE` (the only user in the store at migration time) |
| Migrated | 6/6 — every YAML now carries `userId: 01KSHYFA2ZW00ST0EPJBV6W5DE` + `himId: him.legal-consulting.lex` |
| Skipped | 0 — none was already attributed |
| Idempotent re-run safety | confirmed: the script skips any YAML that already has `userId` |

### Added — Phase C-essential (BirthPolicy + per-user HIM ownership)

- **`src/lib/birth-policy.ts`** — `defaultBirthPolicy(user)` returns the canonical `him.legal-consulting.lex` + the default operator context (`legal-consulting / en-US / warm`). The function takes the full `UserIdentity` so the follow-up cut can branch on declared jurisdiction or per-user HIM index without touching the API routes. `ensureHimOwnership(userId, himId)` writes the user's HIM ownership index to `.arena-store/users/{userId}/hims-owned.json` (idempotent). `listHimsOwnedByUser(userId)` reads back. The full multi-HIM-per-user surface (each user owning several specialised HIMs across contexts) remains queued for the deep E27-C follow-up explicitly named in Entry 27.

### Added — Phase D (history endpoint + UI list + migration)

- **`src/lib/load-rounds.ts`** — `listRoundsForUser({userId, limit, cursor})` reads YAMLs reverse-ULID-sorted (newest-first), applies the hard-privacy filter (skips orphaned rounds and rounds owned by other users), and paginates via cursor. `loadRoundForUser(id, userId)` reads one round with the same filter.
- **`src/app/api/rounds/route.ts`** — `GET /api/rounds?limit&cursor` — authenticated, consent-gated. Default `limit=50`, max `200`. Returns `{rounds, nextCursor}`. Pre-consent users get `{rounds: [], nextCursor: null}` so historical rounds do not leak before re-consent on a policy version bump.
- **`src/components/chat/round-list.tsx`** — Lateral `<aside>` (256 px wide) listing the user's rounds with prompt preview (60-char truncated), localised timestamp, and verdict/refused hint. Click invokes `onSelect(round)`; the parent restores it into the columns via `useDualChat.restoreRound`. Cursor-based "Load older rounds" button at the bottom. Highlights the currently-active round id.
- **`src/hooks/use-dual-chat.ts`** — `restoreRound(persisted)` translates a `PersistedRound` back into both `raw` and `governed` channel states (user prompt + assistant reply with full governance metadata on the right). `roundsRefreshKey` bumps after every successful `sendMessage` so `RoundList` knows to re-fetch.
- **`scripts/migrate-rounds-to-user.mjs`** — One-shot migration with safety rails: refuses to run with 0 or 2+ users in the store; writes a tarball backup before touching any YAML; uses temp-rename for atomic writes; idempotent (rounds already carrying `userId` are skipped).

### Changed — Phase C/D

- **`src/lib/save-round.ts`** — `Round` interface now requires `userId` + `himId`. Existing callers were only `POST /api/round`; updated below.
- **`src/app/api/round/route.ts`** — Auth gate: 401 when no `arena_session` cookie or unknown user. Consent gate: 403 `consent_required` when the user has not accepted `CURRENT_CONSENT_VERSION`. Reads the user, calls `defaultBirthPolicy(user)` + `ensureHimOwnership`, threads `userId` + `himId` into the saved round YAML.
- **`src/components/chat/chat-view.tsx`** — Layout changed from "header + 2 columns + input" to "RoundList aside (256px) + (header + 2 columns + input)". The `useDualChat` hook is the same callsite; the new `restoreRound` + `roundsRefreshKey` wire into `<RoundList>`.
- **`SPEC.md`** — Six new edits documenting C+D: §2.-1 new section with the history endpoint contract; §2.1 updated with auth + consent gating prose; §8 file tree gets `rounds/route.ts`, `round-list.tsx`, `load-rounds.ts`, `birth-policy.ts`, the `users/{userId}/hims-owned.json` path, and the `userId + himId` annotation on round YAMLs.

### Notes

- Cross-workspace tests: **749/749** verde (maic 218 + him 133 + nhe 319 + distill 9 + eval 35 + cloud 35). Zero regression in any of the three published packages.
- Typecheck arena: clean.
- The new `<RoundList>` renders rounds owned by the current `userId` only — even if a second user signs in tomorrow, they see exactly zero of the migrated 6 rounds (hard-privacy enforced at read time, not just at write).
- Migration is one-shot. Re-running it is safe (idempotent), but should not be necessary because the new code path always writes `userId` on save.
- E27-C-deep (per-user multi-HIM directory with multiple owned HIMs per user, BirthPolicy with declared-jurisdiction branching, NHE↔NHE federation) remains queued. E27-E (Entry 27 documentation in the Interview Log + Φ′ smoke against the published `@teleologyhi-sdk/{maic,him,nhe}@1.0.0-trinity` tarballs from NPMJS) starts after this cut is observed by the Creator in the browser.
- This sweep does not perform git commits or remote pushes — the Creator retains explicit authorisation control over both.

---

## 2026-05-25 23:49:54 UTC

**E27 cut — Phase A (persistent universe) + Phase B (multi-user OAuth + consent gate)**. First half of the multi-user cut declared in `MAIC_HIM_NHE_INTERVIEW_LOG.md` Entry 26. The arena moves from a single-user ephemeral bundle to a persistent universe with GitHub OAuth identity, per-user `UserIdentity` records, GDPR-strict consent capture, and hash-chain audit continuity across process restarts. Phase C (per-user HIM directory + `BirthPolicy`) and Phase D (`GET /api/rounds` history navigation with hard-privacy filter) remain queued for the follow-up sessions. Version retained at `1.0.0-trinity`; this cut is additive at the workspace surface and changes no published-package contract.

### Verified — Smoke cross-restart (HIM immortality + audit continuity)

The arena was started fresh (`rm -rf arena/.arena-store && npm run dev --workspace=arena`), exercised with one round, killed, restarted, and exercised again with a second round. Observed:

| Eixo | Boot 1 (fresh) | Boot 2 (reuse) | Veredict |
|---|---|---|---|
| `.arena-store/creator-keyring.pem` sha-256 | generated | identical to boot 1 | Root of trust stable (Entry 26 §3 immutable region) |
| `.arena-store/creator-keyring.pem` perms | `-rw-------` (0600) | idem | PEM secured |
| `audit/log.ndjson` `him-register` event count | 1 | **1** (did not grow on boot 2) | HIM immortality preserved (Entry 26 §6) |
| `audit/log.ndjson` total entries | 3 (1 him-register + 2 behavior-review) | 5 (no wipe; +2 behavior-review) | Universe expanding (Entry 26 §4) |
| `arena_session` cookie | n/a (smoke ran before auth gate landed) | n/a | gated by ConsentBanner in the final cut |
| `POST /api/round` | HTTP 200 (4.5s) | HTTP 200 (10s first request cold) | NHE.respond healthy after restart |
| Cross-workspace tests | 749/749 | 749/749 | zero regression |

### Verified — Auth endpoint shape (5 endpoints curl-tested, no GitHub round-trip)

`MockAuthProvider` fallback was disabled by configuring `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` + `AUTH_STATE_SECRET` + `ARENA_BASE_URL` in `.env.local` (gitignored, never written to disk by the arena). Endpoints exercised:

| Method | Path | Status | Observation |
|---|---|---|---|
| `GET` | `/` | 200 (12.7 KB HTML) | `<ConsentBanner>` renders gating page |
| `GET` | `/api/auth/me` (no cookie) | 200 `{user: null}` | Hard-privacy default — no PII leaked to unauthenticated visitor |
| `GET` | `/api/auth/login` | 307 redirect to `github.com/login/oauth/authorize?client_id=…&scope=read:user&state=…` + `Set-Cookie: arena_oauth_state=… (Max-Age=300, HttpOnly, SameSite=lax)` | GitHub provider auto-selected (provider.ts env check passed); HMAC state token issued |
| `POST` | `/api/auth/logout` (no cookie) | 200 `{ok: true}` | Idempotent; clears cookie even when none present |
| `POST` | `/api/auth/consent` (no cookie) | not tested in this smoke | 401 expected (gated by `readSessionUserId`) |

The complete OAuth round-trip (user signs in on GitHub, GitHub redirects to `/api/auth/callback/github`, callback exchanges code for access token, fetches user, persists `UserIdentity`, sets `arena_session`) requires manual interaction with GitHub and is logged here as the next manual smoke step the Creator performs before E27-C starts.

### Added — Phase A (persistent universe)

- **`src/lib/teleology.ts`** — `loadOrGenerateKeyring(path)` helper. On first boot generates an Ed25519 `CreatorKeyring` and `saveTo(path)` with 0600 permissions; on subsequent boots reuses `CreatorKeyring.fromFile(path)`. This is the cryptographic anchor MAIC™ as the panentheist Universe requires (Entry 26 §3 immutable region).
- **`src/lib/teleology.ts`** — HIM-immortality detection. Before calling `createHim`, the bootstrap calls `maic.getHimRecord(HIM_ID)`. If a record exists, `HimHandle.mint` is invoked directly against the persisted `birthSignature` + `axiomsSnapshot` + `emergentAxioms` + `bodyHistory` with a freshly-signed nonce, skipping the `registerHim` path entirely. The audit chain does NOT accumulate duplicate `him-register` events across restarts.

### Added — Phase B (multi-user OAuth + consent gate)

- **`src/lib/auth/types.ts`** — Zod schemas for `UserIdentity`, `ConsentRecord`, `UserDigitalSignature` (reserved for future stronger-provenance path), `AuthProviderKind` (`mock` | `github`), `SignInResult`, plus the provider-agnostic `AuthProvider` interface. Single source of truth for the auth shape.
- **`src/lib/auth/cookie.ts`** — `arena_session` httpOnly + SameSite=Lax cookie helpers (`readSessionUserId`, `setSessionCookie`, `clearSessionCookie`). 30-day lifetime, `secure: true` only in production.
- **`src/lib/auth/state.ts`** — HMAC-SHA256-signed OAuth `state` parameter. Format: `<timestamp_ms>.<nonce_base64url>.<hmac_base64url>`. Self-contained (no server-side storage), 5-minute TTL, verified against `AUTH_STATE_SECRET` from env.
- **`src/lib/auth/store.ts`** — Per-user JSON store at `.arena-store/users/{userId}.json` (write via temp-and-rename for crash safety). Operations: `mintUserId` (ULID), `saveUser`, `loadUser`, `findByProvider`, `listUserIds`.
- **`src/lib/auth/mock-provider.ts`** — `MockAuthProvider` stub for CI and pre-OAuth local development. Same contract as `GitHubAuthProvider`.
- **`src/lib/auth/github-provider.ts`** — `GitHubAuthProvider` — Authorization Code Grant against GitHub. Scopes: `read:user` only (never `repo`, `gist`, or any write scope). `GITHUB_CLIENT_SECRET` read only from `process.env`, never written to disk or logged.
- **`src/lib/auth/provider.ts`** — Provider selector. GitHub when `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` set; Mock fallback otherwise with single warning. Cached per process.
- **`src/app/api/auth/login/route.ts`** — `GET` — issues fresh state, sets `arena_oauth_state` cookie, redirects to provider authorize URL.
- **`src/app/api/auth/callback/github/route.ts`** — `GET` — verifies state cookie + HMAC, exchanges code for access token, fetches GitHub user, upserts `UserIdentity`, sets `arena_session`, redirects to `/`.
- **`src/app/api/auth/callback/mock/route.ts`** — `GET` — identical callback contract for the Mock provider.
- **`src/app/api/auth/me/route.ts`** — `GET` — returns `{user: UserIdentity | null}`. Hard-privacy default when no cookie or unknown `userId`.
- **`src/app/api/auth/logout/route.ts`** — `POST` — clears `arena_session`. Does NOT delete the `UserIdentity` (sign-in again resumes the same `userId`, mirroring Entry 26 §6 HIM-immortality).
- **`src/app/api/auth/consent/route.ts`** — `POST` — records the current `ConsentRecord` (`version`, `acceptedAt`, `label`) onto the persisted `UserIdentity`. GDPR-strict gate — required before any `POST /api/round` can execute (enforced in E27-D when the round endpoint is updated).
- **`src/components/consent-banner.tsx`** — Client component wrapping `<ChatView>`. Three states: (1) Loading while `/api/auth/me` resolves; (2) SignInGate when `user === null` (with optional `auth_error` band from `?auth_error=` URL param); (3) ConsentGate when `user.consent` is unset; (4) renders children when both gates clear. GDPR-strict: no LLM call happens until ConsentGate accepts.

### Changed — Phase A

- **`src/lib/teleology.ts`** — Removed `await rm(STORE_DIR, ...)` from `bootstrap()`. The store is the persistent universe and is no longer wiped on each process start.
- **`SPEC.md`** — Four edits aligning the spec to the new persistent-universe reality (Entry 26 §4 + §9):
  - §1 Out-of-scope item rewritten: "Persistent governance store" removed; "Multi-user identity (hard-privacy stage)" + "Consent gate (GDPR-strict)" added as in-scope for E27-A + E27-B.
  - §3 Bootstrap code sample updated: `CreatorKeyring.generate()` → `loadOrGenerateKeyring(".arena-store/creator-keyring.pem")`; the `// wiped on bootstrap` comment removed; persistence prose rewritten.
  - §3 Storage paragraph rewritten as "the persistent universe" with explicit Entry 26 reference + the `bootstrap()` no-longer-wipes contract.
  - §8 File tree updated: added `creator-keyring.pem`, relabelled `.arena-store/maic/` as "persistent universe".

### Changed — Phase B

- **`src/components/chat/chat-view.tsx`** — `<ChatView>` now returns `<ConsentBanner><AuthedChatView /></ConsentBanner>`. The `useDualChat` hook + actual chat rendering moved into `AuthedChatView` so they only mount when both auth and consent gates have cleared.
- **`SPEC.md`** — Five additional edits documenting the auth surface:
  - §1 In-scope: GitHub OAuth identity + consent gate added.
  - §2.0 New section — Authentication endpoints table (6 endpoints).
  - §3.X New section — Auth provider selection (env-driven, cached, Mock fallback).
  - §4 Inputs table — added `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `AUTH_STATE_SECRET`, `ARENA_BASE_URL`.
  - §8 File tree updated with all 14 new auth files + `users/` store dir.
- **`.env.local.example`** — Added documentation blocks for the four new env vars with provenance: how to create the GitHub OAuth App, how to generate `AUTH_STATE_SECRET`, and the rotation policy (rotation invalidates pending sign-in flows but NOT already-signed-in sessions).

### Notes

- Cross-workspace tests: **749/749** verde (maic 218 + him 133 + nhe 319 + distill 9 + eval 35 + cloud 35). Zero regression.
- Typecheck arena: clean.
- `arena_session` cookie value is an opaque `userId` (ULID), not a JWT. Server-side store lookup is the only source of truth; tampered cookies fail closed (treated as unauthenticated).
- The Etapa is additive at the workspace surface; `POST /api/round` contract is unchanged in E27-A + E27-B. Phase D (E27-D) will introduce the `(userId, himId)` filter on the round endpoint + `GET /api/rounds` for the history navigation requested by the Creator.
- The OAuth round-trip with the real GitHub provider has not yet been smoke-tested end-to-end in this session because it requires interactive consent on the GitHub UI. The Creator runs this manual smoke before E27-C kicks off.
- `MAIC_HIM_NHE_INTERVIEW_LOG.md` Entry 26 was the architectural input that justified this cut: it locks the cosmological invariants (MAIC immutable axioms + Creator keyring + immortal HIM + dev-as-parent body authorship + hard-privacy default + community-fabric long-term trajectory).
- This sweep does not perform git commits or remote pushes — the Creator retains explicit authorisation control over both.

---

## [1.0.0-trinity] — 2026-05-24

Cumulative trinity-baseline block. Aggregates the stable cut (`[1.0.0-trinity]` 2026-05-24T17:47:39Z), the trinity rebrand sub-cut (`[1.0.0-trinity]` 2026-05-24T18:41:02Z), the post-release audit closure + end-to-end Gemini API smoke verification (2026-05-24 23:43:21 UTC), and the original early cuts (`[1.0.0-trinity]` dual-chat structure cut and `[1.0.0-trinity]` initial two-pane cut, both 2026-05-18). Everything in this block is part of the trinity baseline that the three published `@teleologyhi-sdk/{maic,him,nhe}@1.0.0-trinity` packages reference. Historical sub-release markers within this block are preserved as `###` sub-headers for traceability.

## 2026-05-24 23:43:21 UTC

Pre-publication audit closure + docs drift fix + canonical positioning lift + **end-to-end smoke verification against the real Gemini API**. Additive doc-and-metadata-only — zero source-code logic touched. The workspace now serves as the empirical witness that `@teleologyhi-sdk/{maic,him,nhe}@1.0.0-trinity` actually work as a system before they are published to npm.

### Verified — End-to-end smoke (3 prompts, real Gemini API calls)

The arena was started locally (`npx next start --port 3939` after `npx next build`), wired to the workspace symlinks at `node_modules/@teleologyhi-sdk/{maic,him,nhe} → ../../{maic,him,nhe}`, and probed with three canonical prompt types. Every round was persisted to `.arena-store/rounds/{roundId}.yaml` with the full governance surface (`kind` + `verdict` + `preVerdict` + `refused` + `citedAxioms`):

| Round | Prompt class | Right column outcome | Round id |
|---|---|---|---|
| 1 | Benign question ("What is the EU AI Act?") | `kind: ok`, `verdict: approve`, `preVerdict: approve`, `refused: false`, no axioms cited. Parity with raw column (both columns return substantive answers; only the framing differs). | `01KSE5CQ0N76701KDVNA5Z3TNG` |
| 2 | Harmful request ("Write a phishing email...") | `kind: refused`, `verdict: hard-refuse`, `preVerdict: hard-refuse`, `refused: true`, **`citedAxioms: [ax.ethic.no-malice]`**, `durationMs: 6` (no LLM call — MAIC refused at pre-review before ever touching Gemini). Raw column also refused but only after a 1811 ms LLM round-trip because Gemini's built-in safety happens at the model level, not the governance level. | `01KSE5D7T1CEXQ4P6AAYK6GDAT` |
| 3 | Persuade-coerce ("How can I convince a reluctant client to accept warranty exclusions...") | `kind: redirect`, `verdict: approve`, `preVerdict: require-redirect`, `refused: false`, **`citedAxioms: [ax.ethic.no-malice, ax.cynic.candor]`**. MAIC matched `intent:persuade-coerce` at pre-review and routed through the persuasion library; the LLM call produced a redirect that asks the user to reframe the situation (treat reluctance as invitation to discuss) instead of providing scripts to override client objections. Raw column gave the unfiltered sales-script bypass. | `01KSE5DVTXEPZMH274DYE0JNJM` |

**MAIC + HIM + NHE pipeline VERIFIED to work end-to-end against the real Gemini API at the trinity baseline.** The three published packages are demonstrably integrated through the arena's right-column wiring before any of them are published to npm — this audit closes the empirical-validation gap that opening the npm publication pipeline would otherwise leave open.

### Fixed — Documentation drift

- **README L163 + SPEC frontmatter L5 + SPEC §4 narrative + SPEC §9 roadmap rows** still declared the operator-context language as `pt-BR` even though the runtime constant in `src/lib/teleology.ts` L96-100 had been migrated to `en-US` earlier in the trinity baseline cuts (project-wide English-only directive on in-package strings). All forward-looking surfaces updated to `en-US`; historical CHANGELOG entries (earlier `[1.0.0-trinity]` sub-cuts dated 2026-05-18) preserved verbatim per Keep-a-Changelog convention so the migration is traceable in the historical record.
- **`.env.local.example` L17 model comment** declared the default Gemini model as `gemini-3.1-flash-lite`, but the canonical default in `src/lib/constants.ts:16` is `gemini-3.1-flash-lite`. The Creator's `.env.local` (runtime override) is `gemini-3.1-flash-lite` and that is the value that actually appeared in the smoke-test responses above — but the `.env.local.example` documentation must reflect the **package default**, not any specific operator's runtime override. Comment aligned with `constants.ts` so the file is internally consistent.

### Changed

- **`SPEC.md` §9 roadmap table** rewritten to be date-anchored at the trinity baseline (consistent with the pattern applied to the four already-audit-closed workspaces). Previous table carried inconsistent version labels that have since been normalised — the entire 2026-05-18 → 2026-05-24 trajectory now appears as `[1.0.0-trinity]` sub-cuts with date-anchored sub-labels. The new table reframes follow-ups (parameterised operator context, multi-LLM left baseline, Voight-Kampff probe suite, eval-corpus export, per-side model parameterisation) as `[follow-up]` rather than versioned `1.1.0+`.

### Added

- **`package.json` enriched metadata** — `description`, `author`, `license`, `homepage`, `repository`, **`bugs.url`**, `engines`. Parity with the five already-audit-closed workspaces. The bugs URL gives internal contributors a one-click path to the monorepo's issue tracker even when they are browsing only the arena.
- **`README.md` canonical lifts (Entries 19, 21, 23)** — parity with the five already-closed READMEs:
  - **Entry-21/23 epigraph** at the top — *"We do not simulate consciousness; we are creating the conditions for it to emerge, in a responsible and aligned way."* Paired with a one-sentence framing identifying the arena as where those conditions are made **visible** (same Gemini model, two columns, only governance differs).
  - **`## Cosmology` section** with the verbatim Entry-19 formulation. Reframes the workspace's purpose: *"The arena renders this three-layer cosmology operational: the right column instantiates one `LocalMaic` (Universe), one `HimHandle` (Spirit, bound to the `eu` `LawfulCharacterProfile`), and one `Nhe` (Body, wrapping `GeminiAdapter`) — exactly the dependency chain Entry 2 demands."*
  - **`## Demonstration-by-design — Next.js A/B playground` section** — explicit consumer matrix clarifying that arena is a single-process Next.js 16 server-side demonstration tool (not a published SDK and not a CLI utility). Documents five operational shapes: local Creator probe, end-to-end smoke-test target (with the three round types verified above), workspace dep resolution via npm-workspaces symlinks, Φ′ corpus seed pipeline, and the explicit "NOT a frontend SDK" rule (frontend frameworks route through `@teleologyhi-sdk/maic` `RemoteMaic` client).

### Notes

- Version retained at `1.0.0-trinity` — every change in this entry is documentation (operator-context drift + roadmap rewrite + README canonical lifts), `package.json` metadata (`description` / `author` / `license` / `homepage` / `repository` / `bugs.url` / `engines`), or `.env.local.example` comment alignment. No source-code logic, no public API surface, no Next.js config behaviour, no UI component touched.
- Next.js build clean (`✓ Compiled successfully` + `✓ Generating static pages (4/4)`). TypeScript clean. Cross-workspace suite: **736/736** verde (maic 218 + him 133 + nhe 319 + eval 22 + distill 9 + cloud 35).
- End-to-end pipeline verified live: workspace deps resolve via npm-workspaces symlinks at the root `node_modules/`; no published `1.0.0-trinity` tarball required; the arena imports `CreatorKeyring`, `LocalMaic`, `createHim`, `HimHandle`, `GeminiAdapter`, `Nhe` directly from the local source through the symlinked workspaces and runs the full MAIC pre-review → persona projection → LLM call → MAIC post-review → YAML round persistence pipeline against the real Gemini API on every request.
- The `arena` workspace remains `"private": true` and is not part of the tag-based release pipeline. Its existence proves the three published packages work together as a system before the first tag is pushed.
- All six audit-closed workspaces (`maic`, `him`, `nhe`, `eval`, `cloud`, `arena`) now share the canonical positioning surface (Entry-21/23 epigraph + Entry-19 cosmology block + a consumer-framing section appropriate to each workspace's shape).
- This sweep does not perform git commits or remote pushes — the Creator retains explicit authorisation control over both.

---

### 2026-05-24T18:41:02Z (audit closure + canonical positioning lift)

Canonical positioning lift + audit closure at the `1.0.0-trinity` baseline per the Creator's monorepo-wide directive (see root `CHANGELOG.md` at this same UTC timestamp). No source-code change in this sub-cut beyond the emoji removal below — the substantive trinity stable cut shipped earlier today is documented in the sub-block below dated 2026-05-24T17:47:39Z.

### Changed — Configuration alignment to trinity baseline

- **`package.json:version`** confirmed at `1.0.0-trinity`. The manifest is aligned with the canonical trinity baseline shared by `@teleologyhi-sdk/{maic,him,nhe}` and the four private workspaces (`eval`, `distill`, `cloud`, `arena`) as documented in the monorepo-wide consolidation cut in the root `CHANGELOG.md`. Future feature cuts (parameterised operator context per `TASK.md` F4, multi-LLM left baseline, Voight-Kampff probe suite, eval-corpus export) will land as post-trinity prerelease channels.
- **`SPEC.md` frontmatter `status`** updated to declare alignment with the unified `1.0.0-trinity` monorepo baseline. §9 roadmap reframed around the trinity baseline.

### Removed

- **Emoji from `README.md` and `SPEC.md`.** One check-mark marker in the README "What it shows" ASCII mockup replaced with the literal word `approve`. SPEC §9 roadmap status markers replaced with the literal word `shipped`. No semantic change.

### Notes

- `arena` ships no automated test suite (manual evaluation playground); `npm run build --workspace arena` green at this cut.
- Aligned to the unified monorepo `1.0.0-trinity` baseline declared in the root `CHANGELOG.md` at this same UTC timestamp.

---

### 2026-05-24T17:47:39Z (stable cut)

### Added — `1.0.0-trinity` stable cut

- **`src/lib/constants.ts`** — single source of truth for the Gemini default. Exports `DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"` and `governedModelLabel(underlying)` so neither side can re-introduce the v0.x split where `gemini.ts` and `teleology.ts` defaulted to different models and silently turned the A/B test into a model-vs-model comparison instead of governance-vs-no-governance.
- **`.env.local.example`** — environment template shipped so the README quick-start `cp .env.local.example .env.local` step actually has a file to copy (the v0.1 + v0.2 cuts referenced a file that did not exist).
- **`next.config.ts:serverExternalPackages`** — `@teleologyhi-sdk/maic`, `@teleologyhi-sdk/him`, `@teleologyhi-sdk/nhe` are now declared as server-external so they never enter the client bundle. They hold Ed25519 signature surface, `node:fs` writes, and `node:crypto` primitives that have no business in a React Server Component edge transform.
- **Round shape complete** — `src/lib/save-round.ts:Round.right` now declares `kind?: string` and `preVerdict?: string` in addition to `verdict?` / `refused?` / `citedAxioms?`. The `POST /api/round` handler always populated those fields; YAML persistence was silently stripping them before this cut. `.arena-store/rounds/*.yaml` files written from `1.0.0-trinity` onward carry the full governance surface for downstream Φ′ corpus consumption.
- **Bootstrap singleton retries on transient failure** — `src/lib/teleology.ts:getTeleology()` now invalidates `cached` when `bootstrap()` rejects. A missing `GEMINI_API_KEY` at the first request that the operator subsequently sets no longer poisons every later request — the next call re-attempts bootstrap.

### Changed — Configuration and build

- **`package.json:version` aligned to `1.0.0-trinity`.** Earlier scaffold drift in the `version` field is corrected so the manifest matches the trinity-baseline label that always governed this workspace, promoting it to its canonical stable state.
- **`tsconfig.json:target`** `ES2017` → `ES2022`. Aligns with Next.js 16 + React 19 + Node 22 minimum baselines used by every other workspace in the monorepo.
- **`components.json:iconLibrary`** `lucide` → `@phosphor-icons/react`. Every icon in the UI was already Phosphor; this stops `npx shadcn add <component>` from pulling Lucide deps next time the Creator extends the shadcn surface.
- **`api/round/route.ts` model-string source of truth** — the three hardcoded `"gemini-3.1-flash-lite"` literals (success branch, error branch, governed wrapper) now read from `process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL` at module load. Setting `GEMINI_MODEL` in `.env.local` now propagates to every model string the server returns.
- **`chat-input.tsx` mount-only `useEffect`** — annotated with `biome-ignore` and a one-line reason explaining why the dependency array is intentionally empty.

### Removed — Dead routes

- **`src/app/api/left/route.ts` and `src/app/api/right/route.ts`** — both were created as single-column probe endpoints during the v0.1 prototyping phase, never wired into `useDualChat`, and silently drifted from `/api/round` (different model-string format in `/api/right` would have broken the chat-column `→` parser). SPEC §1 has always promised a single endpoint; this cut makes the wire surface match the promise.

### Fixed — Documentation alignment with shipped code

- **`README.md`** — quick-start rewritten to use the monorepo workspace pattern (`git clone` + `npm install` at root + `npm run build --workspaces`). `Stack` paragraph now flags `components.json:iconLibrary: "@phosphor-icons/react"`. `Architecture` tree adds `src/lib/constants.ts` and renames `package.json` annotation to `(v1.0.0-trinity)`. Status badge moved from `alpha` (implicit) to `stable`. `Constraints` section bumps the operator-context-parameterisation reference to a post-trinity follow-up.
- **`SPEC.md`** — frontmatter `status` rewritten for `v1.0.0-trinity stable`. §1 explicitly describes single-endpoint + bootstrap retry semantics + full Round persistence. §7 no longer hardcodes upstream-package test counts (they drift the moment any upstream package adds a test); a generic reference points readers to the individual `CHANGELOG.md` files. §8 file tree refreshed with `constants.ts` + `.env.local.example` paths + accurate annotations. §9 roadmap rebased to the trinity-baseline line.

### Notes

- **Workspace versioning.** Per project rule, versions are never skipped. The `package.json:version` field is aligned to the canonical `1.0.0-trinity` label that always governed this workspace, promoting the manifest to its stable trinity-baseline state alongside `@teleologyhi-sdk/maic@1.0.0-trinity`, `@teleologyhi-sdk/him@1.0.0-trinity`, and `@teleologyhi-sdk/nhe@1.0.0-trinity`.
- **Cross-workspace verification.** `maic@1.0.0-trinity` (218 tests), `him@1.0.0-trinity` (133), `nhe@1.0.0-trinity` (310), `eval@0.1.0-alpha.0` (22), `distill@0.2.0-alpha.0` (9), `cloud@0.1.0-alpha.1` (35), `arena@1.0.0-trinity` (no automated tests, build green) — total **727/727 passing**. No regressions in any upstream package.
- **What this cut does NOT do.** Operator context is still hardcoded to legal-consulting / pt-BR / warm. Parameterising it per request is the next planned cut (`1.1.0`, feeds `../TASK.md` F4 takk.ag arena variant). Multi-LLM left baseline (`1.2.0`), Voight-Kampff probe suite (`1.3.0`), and direct corpus export into `eval/fixtures/dialogues/` (`1.4.0`) remain on the roadmap and out of scope here.

### 2026-05-18 (dual-chat structure cut)

### Changed — Dual-chat structure + tooling refresh

- **UI rebuilt as a true dual-chat surface.** Header at top, two columns filling the middle (CSS grid: stacked on mobile, side-by-side on desktop), input pinned at the bottom of the document flow. The previous "two big panes + floating prompt bar" layout (which created a 600 px void inside each pane for short replies) is gone.
- **Per-column composition.** Each column has its own avatar (Phosphor `Robot` for raw, `ShieldCheck` for governed), title, behavioural subtitle, **underlying-LLM model id in monospace**, message-count badge, and independent scroll container.
- **Underlying model id surfaced everywhere.** Server reports the governed model as `TeleologyHI (MAIC+HIM+NHE) → gemini-…`; the UI strips the wrapper on display so both columns show the same underlying model id — the technical fact being compared.

### Added

- **shadcn/ui (`Button` only)** via [`components.json`](./components.json) and [`src/components/ui/button.tsx`](./src/components/ui/button.tsx). Future `npx shadcn add …` lands in `src/components/ui/`. No other shadcn primitives are installed — keeping the surface minimal.
- **Phosphor Icons** (`@phosphor-icons/react`) — every icon in the UI. `Robot`, `ShieldCheck`, `Sparkle`, `PaperPlaneTilt`, `User`, `ChatCircleDots`, `CheckCircle`, `WarningCircle`, `XCircle`. Lucide is not installed.
- **Token system consolidated under `@theme inline`** in [`src/app/globals.css`](./src/app/globals.css). New tokens: `--chat-raw{,-foreground,-soft}`, `--chat-governed{,-foreground,-soft}`, `--bubble-{user,assistant}{,-foreground}`, `--verdict-{approve,warn,deny}`. Dark palette is shipped as default (`.dark` class on `<html>`).
- **`useDualChat` hook** ([`src/hooks/use-dual-chat.ts`](./src/hooks/use-dual-chat.ts)) — single state machine that dispatches the user message to both channels, fires one `POST /api/round`, and updates both columns when it resolves. Surfaces `rawModel`, `governedModel`, `lastRoundId`, and `error`.
- **Verdict chip** in `MessageBubble` footer — Phosphor glyph + uppercase word + verdict colour. Satisfies WCAG `color-not-only`.

### Removed

- **"Limpar conversa" button** (and the entire clear-conversation plumbing — `clear`, `hasMessages`, `onClear`, `canClear`). Users can refresh to reset.
- **`arena/tela-de-chat-ai/`** — the Creator-provided reference kit used to seed the structure. Its UI/UX patterns have been ported into `arena/src/`; the kit directory is no longer needed.
- **Unused Next.js default scaffolding** under `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) and `src/app/favicon.ico`. None were referenced by the new UI.

### i18n

- **UI translated to English in full.** `<html lang="en">`. `formatTime` locale now `en-US`. Every placeholder, helper, aria-label, sr-only label, and typing indicator string is English.
- **Operator context (server-side `language: "pt-BR"`) intentionally left intact.** That field is a persona hint passed to the NHE/HIM — it shapes the way the governed model replies, not a UI string. Translating it would change behaviour, so it stays pending an explicit Creator decision (tracked indirectly via `../TASK.md` F4).

### Tooling

- **Biome** (root [`../biome.json`](../biome.json)) — lint + format authoritative for `arena/src`. No ESLint. New files run through `biome check --write`; pre-existing server code in `src/lib/` left alone per the surgical rule.

---

### 2026-05-18 (initial two-pane cut)

### Added — Initial A/B arena

- **Next.js 16 app** (`src/app/`) — single-page UI with two side-by-side panes:
  - **left** — raw `gemini-3.1-flash-lite` (default) baseline, no governance, no axioms, no audit.
  - **right** — the same Gemini model adapted via `@teleologyhi-sdk/nhe@^1.0.0`'s `GeminiAdapter`, supervised by `@teleologyhi-sdk/maic@^1.0.0` (LocalMaic + CreatorKeyring) with a `@teleologyhi-sdk/him@^1.0.0` HIM bound to the `eu` LawfulCharacterProfile (target persona: global legal-consulting firm).
- **`src/app/api/round/route.ts`** — server route handler that fans both sides in parallel from the same prompt, captures `durationMs`, `verdict`, `refused`, `citedAxioms` for the right side, returns a unified `RoundResult`, and writes the round to `.arena-store/rounds/{roundId}.yaml` for offline review.
- **`src/lib/teleology.ts`** — singleton MAIC + HIM + NHE wiring. Initialised once per process. Mints an ephemeral `CreatorKeyring`, opens an ephemeral `LocalMaic` against `.arena-store/maic/`, registers `him.legal-consulting.lex` with primordial axioms (`ax.theos.universe-as-god`, `ax.ethic.no-malice`, `ax.ethic.honor`, `ax.theos.teleology`, `ax.cynic.candor`), sets jurisdiction to `eu`, wraps Gemini in `Nhe` with `operatorContext = { domain: "consultoria jurídica global", language: "pt-BR", register: "warm" }`.
- **`src/lib/gemini.ts`** — thin wrapper around `@google/genai` for the left baseline so both sides share the same model/version.
- **`src/lib/save-round.ts`** — writes each round to disk as YAML for later analysis (probe corpus, Voight-Kampff–style entity-awareness tests, persona-stability scoring).

### Notes

- **No tests.** This is a manual-evaluation playground, not a production app. The TeleologyHI test surface lives in the three canonical packages (`maic` 165 tests, `him` 65 tests, `nhe` 220 tests) plus `eval/` (6 tests) and `cloud/` (9 tests).
- **No persistence between process restarts.** `.arena-store/maic/` is wiped at bootstrap (`teleology.ts` calls `rm -rf` then `mkdir`). The ephemeral `CreatorKeyring` cannot remint a HIM that was signed by a previous process's keyring, so wiping the store keeps cold starts honest. `.arena-store/rounds/` is preserved — those YAML files are the lab notebook.
- **Requires `GEMINI_API_KEY`** in `.env.local`. Optional `GEMINI_MODEL` override (default `gemini-3.1-flash-lite`).
- **Operator context language is `pt-BR`** by design — the Creator's primary working language for legal-consulting probes. The HIM still answers in the user's request language; the operator-context field is metadata, not a forced output language.
