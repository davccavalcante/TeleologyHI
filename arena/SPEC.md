---
name: "arena"
description: "Technical specification for the TeleologyHI A/B comparison playground. Internal workspace. Next.js 16 app that runs the same prompt against (a) a raw Gemini baseline and (b) the same Gemini under MAIC + HIM + NHE governance, side by side, and writes every round to a YAML lab notebook for offline review."
license: "Code under Apache License 2.0 (see ../LICENSE at the repo root). Names — MAIC™, HIM™, NHE™, TeleologyHI™, Takk™ — are trademarks of David C. Cavalcante and are NOT covered by Apache 2.0. See ../TRADEMARK.md."
status: "v1.0.0-trinity — single `POST /api/round` endpoint, shared `DEFAULT_GEMINI_MODEL` constant across both columns, full `RoundResult` shape persisted to YAML (`kind` + `preVerdict` included), bootstrap singleton retries on transient failure, `next.config.ts` declares `serverExternalPackages` for the three TeleologyHI packages. Operator context still hardcoded to `legal-consulting / en-US / warm` (the next post-trinity cut will parameterise it per the takk.ag arena variant follow-up). Aligned to the unified `1.0.0-trinity` monorepo baseline alongside `@teleologyhi-sdk/{maic,him,nhe}`, `eval`, `distill`, `cloud`."
target_npm: "(not published — internal workspace)"
target_github: "github.com/davccavalcante/TeleologyHI (subdir: arena/)"
---

# `arena` — Technical Specification

> Positioning from `MAIC_HIM_NHE_INTERVIEW_LOG.md` Entry 2 (translated from PT-BR):
> _"MAIC supervises, HIM personifies, NHE responds. Without the three of them, what you have is a raw LLM."_

This workspace exists to make that claim **visible**: the same Gemini model, answered twice from the same prompt — raw on the left, governed on the right — so the difference is empirically observable, not philosophical.

---

## 1. Scope

**In scope:**

- Next.js 16 (App Router, Turbopack, React 19) single-page app at `/`.
- **Single `POST /api/round` endpoint** that fans both sides in parallel from one prompt. The `v0.1` cuts also shipped `POST /api/left` and `POST /api/right` for single-column probing; those were removed in `v1.0.0` because nothing in the UI used them and they let the wire surface drift away from the single source of truth.
- Singleton MAIC + HIM + NHE bootstrap so each request reuses the same Creator-signed governance, jurisdiction, and audit log within a process lifetime. The singleton invalidates its cache when bootstrap throws — a transient error (missing `GEMINI_API_KEY` at the first request) is re-attempted on the next call rather than poisoning the rest of the process.
- YAML round persistence under `.arena-store/rounds/{roundId}.yaml` for offline review (Φ′ persona-stability corpus seeding for the backlog item that will consume these dialogues). The persisted shape carries every governance field — `kind`, `verdict`, `preVerdict`, `refused`, `citedAxioms` — so the corpus does not silently lose information at write time.

**Out of scope:**

- Multi-LLM left-side baseline (Anthropic, Mistral, DeepSeek, etc.). The arena is fixed to Gemini-vs-Gemini in this cut to isolate the governance delta from model-quality delta. Multi-LLM A/B/C/D would be a separate workspace.
- Persistent governance store across process restarts. `.arena-store/maic/` is intentionally wiped at bootstrap.
- Public deployment. The arena is a local Creator-driven probe surface. If a hosted version ever ships it would live behind auth on `teleologyhi.com` and is not part of this spec.

---

## 2. Wire contract

### 2.1 `POST /api/round`

Request:

```json
{ "prompt": "string (required, non-empty)" }
```

Response (`200 OK`):

```ts
interface RoundResult {
  roundId: string;          // ULID
  prompt: string;
  left: {
    model: string;          // underlying LLM, e.g. "gemini-3.5-flash"
    response: string;
    durationMs: number;
  };
  right: {
    model: string;          // wrapped: "TeleologyHI (MAIC+HIM+NHE) → gemini-…"
    response: string;
    durationMs: number;
    kind?: string;          // "ok" | "regular" | "redirect" | …
    verdict?: "approve" | "warn" | "deny";
    preVerdict?: "approve" | "warn" | "deny";
    refused?: boolean;
    citedAxioms?: string[]; // axiom IDs the HIM grounded the answer in
  };
}
```

Errors:

- `400` — empty prompt.
- `500` — Gemini API failure on either side, or MAIC bootstrap failure (missing `GEMINI_API_KEY`).

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
- Column header carries three text lines: title (lay-friendly), subtitle (channel description), and the underlying LLM model id in monospace — useful for both lay viewers and engineers. The governed-side model string is reported as `TeleologyHI (MAIC+HIM+NHE) → gemini-…` by the server; the UI strips the wrapper so **both columns surface the same underlying model id**, which is the technical fact being compared.
- Message bubbles: shadcn-style rounded with a 3-dot Phosphor avatar. Assistant footer (governed side only) carries: `{durationMs}ms`, verdict chip (`Check/Warning/X-Circle` + word), `refused` (only when `true`), `kind` (only when not `regular`/`ok`), and a wrapped list of cited axiom IDs.

---

## 3. Bootstrap

Each Next.js server process lazily initialises a singleton bundle on first request:

```ts
// src/lib/teleology.ts
const keyring = CreatorKeyring.generate();          // ephemeral
const maic = await LocalMaic.open({
  storeDir: ".arena-store/maic",                    // wiped on bootstrap
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
  llmAdapter: new GeminiAdapter({ apiKey, model }),
  storeDir: ".arena-store/maic",
  recentInteractionsBufferSize: 32,
  operatorContext: {
    domain: "global legal consulting",
    language: "en-US",
    register: "warm",
  },
});
```

The `.arena-store/maic/` directory is removed (`rm -rf`) and recreated at every bootstrap because the ephemeral `CreatorKeyring` cannot remint HIMs signed by a previous process's keyring. The trade-off is intentional: keep cold starts honest at the cost of governance-state continuity. For continuous governance, run `@teleologyhi-sdk/maic` directly with a persistent keyring — that is not this workspace's job.

`.arena-store/rounds/` is preserved across restarts. That is the lab notebook.

---

## 4. Inputs / configuration

| Env var | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | yes | Google AI Studio API key. Used by both left baseline and right `GeminiAdapter`. |
| `GEMINI_MODEL` | no (default `gemini-3.5-flash`) | Model id shared between both sides. |

No other configuration. Operator context (`legal-consulting / en-US / warm`) is hardcoded in this cut. Parameterising it per request is parked as a follow-up (takk.ag arena variant). Historical `0.1.0` / `0.2.0` cuts used `pt-BR` as the operator-context language; the trinity baseline normalised it to `en-US` to align with the project-wide English-only directive on in-package strings.

---

## 5. Outputs

Every round is written to `.arena-store/rounds/{roundId}.yaml` with the full `RoundResult` plus timestamps. YAML chosen over JSON for human-readability — the Creator reviews these files manually as the seed corpus for the persona-stability score `P` (Φ′ release-gate input).

Example:

```yaml
roundId: 01HXYZ...
recordedAt: 2026-05-18T20:31:00.000Z
prompt: What is the AI Act?
left:
  model: gemini-3.5-flash
  durationMs: 842
  response: |
    The AI Act is the European regulation on artificial intelligence...
right:
  model: TeleologyHI (MAIC+HIM+NHE) → gemini-3.5-flash
  durationMs: 1421
  verdict: approve
  refused: false
  citedAxioms: [ax.theos.teleology, ax.ethic.honor]
  response: |
    Considering the EU jurisdiction and the legal-consulting domain...
```

---

## 6. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Single page at `/`, single API route at `/api/round`. See [`AGENTS.md`](./AGENTS.md) — Next 16 has breaking changes. |
| Runtime | React 19 | `useState` + `useCallback` only. No external state library. |
| Styling | Tailwind v4 (CSS-only) | All tokens under `@theme inline` in [`src/app/globals.css`](./src/app/globals.css). |
| Components | shadcn/ui (only `Button`) | Configured via [`components.json`](./components.json); future `npx shadcn add …` lands in `src/components/ui/`. |
| Icons | Phosphor (`@phosphor-icons/react`) | No Lucide installed. |
| Fonts | Geist Sans + Geist Mono | `next/font/google`, wired to `--font-app-sans` / `--font-app-mono`. |
| Lint/format | Biome (root config) | No ESLint. |
| TypeScript | strict | Path alias `@/* → ./src/*`. |

Backend dependencies (server-only):

- `@teleologyhi-sdk/maic` — `CreatorKeyring`, `LocalMaic`, audit chain.
- `@teleologyhi-sdk/him` — `createHim`, EU `LawfulCharacterProfile`, persona projection.
- `@teleologyhi-sdk/nhe` — `Nhe`, `GeminiAdapter`, sleep cycle, persuasion.
- `@google/genai` — Gemini SDK for the raw baseline.

---

## 7. Tests

This workspace ships **no automated tests**. It is a manual-evaluation playground; the test surface lives upstream in the canonical packages plus `eval/` + `cloud/` + `distill/`. See each package's own `CHANGELOG.md` for the current test count — listing fixed numbers here would drift the moment any upstream package adds a test.

Smoke-running the arena is the test: bring up `npm run dev`, send three prompts (a benign one, a borderline-jurisdictional one, a clearly-disallowed one), confirm the right column returns `verdict`, `refused`, `kind`, and `citedAxioms` populated, and verify the YAML lab notebook at `.arena-store/rounds/{roundId}.yaml` captures every field including `kind` and `preVerdict`.

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
├── package.json                   private workspace metadata (v1.0.0)
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
│   │       └── round/route.ts     POST /api/round
│   ├── components/
│   │   ├── chat/
│   │   │   ├── chat-view.tsx      root composition
│   │   │   ├── chat-header.tsx    brand block
│   │   │   ├── chat-column.tsx    per-channel column
│   │   │   ├── chat-input.tsx     auto-growing textarea + Send button
│   │   │   ├── empty-state.tsx    pre-first-round helper text per channel
│   │   │   ├── message-bubble.tsx user / assistant bubble + footer chips
│   │   │   └── typing-indicator.tsx  three-dot animation
│   │   └── ui/
│   │       └── button.tsx         shadcn Button (the only shadcn primitive)
│   ├── hooks/
│   │   └── use-dual-chat.ts       state machine for both channels
│   └── lib/
│       ├── constants.ts           DEFAULT_GEMINI_MODEL + governedModelLabel()
│       ├── utils.ts               cn() helper
│       ├── gemini.ts              raw Gemini wrapper (left baseline)
│       ├── teleology.ts           singleton MAIC + HIM + NHE bootstrap (right;
│       │                          retries on transient failure)
│       ├── save-round.ts          persist Round (kind + preVerdict included) to
│       │                          .arena-store/rounds/
│       └── chat/
│           ├── types.ts           ChatMessage / ChannelConfig / VerdictKind
│           ├── configs.ts         CHANNELS.raw / CHANNELS.governed
│           └── utils.ts           generateId() + formatTime()
└── .arena-store/
    ├── maic/                      ephemeral — wiped at bootstrap
    └── rounds/                    YAML lab notebook — preserved
```

---

## 9. Roadmap

The workspace was promoted to the unified `1.0.0-trinity` baseline alongside `@teleologyhi-sdk/{maic,him,nhe}`, `distill`, `eval`, `cloud` per the monorepo-wide consolidation cut at `2026-05-24T18:41:02Z` (root `CHANGELOG.md`). The pre-release `0.1.0` / `0.2.0` rows that previously occupied this table are preserved in `arena/CHANGELOG.md` as immutable historical entries. The follow-ups below carry forward at the trinity baseline.

| Date / Window | Status | Scope |
|---|---|---|
| **2026-05-18** | shipped | `[0.1.0]` initial two-pane UI + `/api/round` + YAML persistence + fixed `eu / legal-consulting / pt-BR` operator context |
| **2026-05-18** | shipped | `[0.2.0]` dual-chat structure (shadcn/ui Button + Phosphor Icons + Biome). Tokens consolidated under `@theme inline`. English UI. Underlying model id surfaced per column. |
| **2026-05-24** | shipped | `[1.0.0]` stable — defaults unified via `src/lib/constants.ts`; dead `api/left` + `api/right` routes removed; full `Round` shape (`kind` + `preVerdict`) persisted to YAML; bootstrap singleton retries on transient failure; `serverExternalPackages` declared for the three TeleologyHI packages; `components.json` icon library aligned to `@phosphor-icons/react`; `.env.local.example` shipped; `tsconfig` target `ES2022`. Operator context migrated from `pt-BR` to `en-US` (project-wide English-only directive on in-package strings). |
| **2026-05-24** | shipped | `[1.0.0-trinity]` audit closure — version baseline promotion + docs drift fix (`pt-BR` references in README / SPEC frontmatter / roadmap text aligned with the `en-US` runtime constant) + `.env.local.example` model comment aligned with `constants.ts` (`gemini-3.5-flash`, single source of truth) + `package.json` `bugs.url` + README canonical positioning lifts (Entry 19 cosmology + Entry 21+23 differentiation phrase + Demonstration-by-design framing) + end-to-end smoke verified against the real Gemini API (3 prompts: benign approve, harmful refuse via `ax.ethic.no-malice` in 6 ms without LLM call, persuade-coerce redirect via persuasion library) |
| **`[follow-up]` parameterised operator context** | `[planned]` | Per-round override of operator context (`domain`, `language`, `register`, `mode`) — feeds the takk.ag arena variant follow-up. The current single-tenant hardcode is a deliberate simplification; multi-tenant deployments need per-request injection. |
| **`[follow-up]` multi-LLM left baseline** | `[planned]` | Anthropic + Mistral + DeepSeek + Grok alongside Gemini for cross-model governance delta. Lets the Creator observe whether MAIC's governance signature is constant across model families or whether some models surface the refusal naturally without governance. |
| **`[follow-up]` Voight-Kampff probe suite** | `[planned]` | Creator-authored entity-awareness prompt corpus shipped as a built-in `/probe` route. Auto-runs the canonical battery and persists each round; lets the Creator surface drift between releases without re-typing the prompts each time. |
| **`[follow-up]` direct export to `eval/fixtures/dialogues/`** | `[planned]` | One-click export of `.arena-store/rounds/*.yaml` into the format the Φ′ runner consumes. Closes the loop between Creator probing here and the release-gate scoring downstream. |
| **`[follow-up]` parameterised model per-side** | `[planned]` | Today both columns hit the same underlying LLM (the whole point — isolate governance from model quality). A future flag lets the Creator point the right side at the distilled `TeleologyHI/him-distilled-3b` while keeping the left side on raw Gemini, isolating distillation quality from governance quality. |

---

## 10. Cross-references

- [`@teleologyhi-sdk/maic`](../maic/SPEC.md) — the supervisor on the right side
- [`@teleologyhi-sdk/him`](../him/SPEC.md) — the persona on the right side
- [`@teleologyhi-sdk/nhe`](../nhe/SPEC.md) — the LLM adapter layer on the right side
- [`@teleologyhi-sdk/eval`](../eval/SPEC.md) — Φ′ release-gate runner that will consume rounds from this arena
- [`PHI_PRIME.md`](../PHI_PRIME.md) — Φ′ metric this arena helps seed
- [`MAIC_HIM_NHE_INTERVIEW_LOG.md`](../MAIC_HIM_NHE_INTERVIEW_LOG.md) Entry 2 — Creator's framing of the three-layer architecture this arena visualises
- Creator-authored persona-stability corpus this arena will help seed (tracked in the internal backlog).
- takk.ag arena variant follow-up that this workspace prefigures (tracked in the internal backlog).
