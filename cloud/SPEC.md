---
name: "@teleologyhi-sdk/cloud"
description: "Technical specification for the HTTP server that fronts the `RemoteMaic` wire contract. Internal workspace. Run by the Creator to host the canonical MAIC instance that serverless / edge NHE deployments point at. Read-public, write-Creator-only by construction: the Ed25519 private key never lives on this server."
license: "Code under Apache License 2.0 (see ./LICENSE). Names — MAIC™, HIM™, NHE™, TeleologyHI™, Takk™ — are trademarks of David C. Cavalcante and are NOT covered by Apache 2.0. See ./TRADEMARK.md."
status: "v1.0.0-trinity — server + Dockerfile (slim, maic+cloud only) + docker-compose + systemd unit + Hostinger runbook shipped. Security hardening: zod body validation, `crypto.timingSafeEqual` bearer-token compare, production-mode anonymous-deploy guard. 35 tests across server/auth/from-env. Deploy on `teleologyhi.com` awaits domain purchase + Hostinger credentials (tracked in the internal backlog). Aligned to the unified `1.0.0-trinity` monorepo baseline alongside `@teleologyhi-sdk/{maic,him,nhe}`, `eval`, `distill`, `arena`."
target_npm: "(not published — internal workspace)"
target_github: "github.com/davccavalcante/TeleologyHI (subdir: cloud/)"
---

# `@teleologyhi-sdk/cloud` — Technical Specification

> Positioning from `MAIC_HIM_NHE_INTERVIEW_LOG.md` Entry 5 (translated from PT-BR):
> _"MAIC, operating in the cloud, will not allow the regression of any HIM or NHE. (...) The end user will never have access to another person's spirit."_

This workspace is the operational tail of the `RemoteMaic` wire contract introduced in `@teleologyhi-sdk/maic@>=0.7`. It exposes the **four endpoints** an NHE needs in serverless / edge contexts where running a full `LocalMaic` with disk-backed audit chain is impractical.

---

## 1. Trust model

**Read-public, write-Creator-only.** The server only fronts the four read / verdict endpoints below; every write operation on the underlying `LocalMaic` (axiom mint, HIM register, proposal ratification, lifecycle transitions, dream induction) requires an Ed25519 signature with the Creator's private key, and that key **never** lives on this server.

The Creator drives writes from their local machine against the same `storeDir` (or against a separate canonical clone). Bearer tokens on this server only exist to keep abusive clients out — they do **not** elevate anyone to creator. This is tracked as the canonical-deploy axis of the internal backlog.

---

## 2. Wire contract

```
POST /v1/behavior-review                       — submit a BehaviorReport, get a MaicVerdict back
GET  /v1/nhes/{nheId}/status                   — current NheStatus (active / deprecated / terminated)
GET  /v1/nhes/{nheId}/inductions/pending       — pending DreamInductionTicket[] for this NHE
POST /v1/inductions/{ticketId}/consume         — consume an induction ticket (returns the ticket)

GET  /healthz                                  — liveness (no auth)
GET  /                                         — landing JSON (no auth)
```

All authenticated endpoints require `Authorization: Bearer <token>` where `<token>` is one of the comma-separated values in the `TELEOLOGYHI_TOKENS` env var. **Empty `TELEOLOGYHI_TOKENS` alone is a startup error** — to run without authentication (local smoke tests only) set `TELEOLOGYHI_ALLOW_UNAUTHENTICATED=true` explicitly. The production safety guard refuses that combination when `TELEOLOGYHI_ENV` or `NODE_ENV` is `production`.

Bearer-token comparison runs through `crypto.timingSafeEqual` with length-normalised padding (see `src/auth.ts`) so a wrong-length attempt costs the same as a right-length one — the v0.1 `Set.has(token)` shortcut was timing-attack vulnerable.

Every authenticated request body is validated against the canonical zod schema re-exported from `@teleologyhi-sdk/maic` (see `src/types.ts`). A malformed `POST /v1/behavior-review` returns `400` with the offending field paths in `issues`; nothing ever reaches the backing `MaicClient` unchecked. The wire shapes match the `MaicClient` interface exported by `@teleologyhi-sdk/maic` — any deviation between server and client is a bug.

---

## 3. Configuration

| Env var | Required | Description |
|---|---|---|
| `TELEOLOGYHI_STORE_DIR` | yes | Filesystem path to the MAIC storeDir |
| `TELEOLOGYHI_CREATOR_PUBLIC_KEY` | yes | Ed25519 public key (`base64url` — the format returned by `CreatorKeyring.publicKey()`) of the Creator pinned to this server |
| `TELEOLOGYHI_TOKENS` | yes (in production) | Comma-separated bearer tokens authorised to call write/verdict endpoints |
| `TELEOLOGYHI_ALLOW_UNAUTHENTICATED` | no (default `false`) | Set to `true` to run without authentication. **Refused at startup when `TELEOLOGYHI_ENV=production` or `NODE_ENV=production`.** Intended for local smoke tests only. |
| `TELEOLOGYHI_ENV` | no | Set to `production` to enable the production safety guard (forces `TELEOLOGYHI_TOKENS` non-empty). |
| `PORT` | no (default 8787) | TCP port |
| `HOST` | no (default 0.0.0.0) | Bind address |

The server refuses to start when any of the following is true:
- `TELEOLOGYHI_STORE_DIR` is missing.
- `TELEOLOGYHI_CREATOR_PUBLIC_KEY` is missing or not a valid Ed25519 public key.
- `TELEOLOGYHI_TOKENS` is empty AND `TELEOLOGYHI_ALLOW_UNAUTHENTICATED` is not `true`.
- `TELEOLOGYHI_ALLOW_UNAUTHENTICATED=true` is set together with `TELEOLOGYHI_ENV=production` or `NODE_ENV=production`.

---

## 4. Fail policy

The companion client (`RemoteMaic` in `@teleologyhi-sdk/maic@>=0.8`) implements a fail-policy split per E4 (`maic/SPEC.md` §11):

- `reviewBehavior` — **fail-closed**. The client throws when this server is unreachable. The NHE then refuses the interaction. This is the only safe default for compliance review.
- `getNheStatus` / `listPendingInductions` / `consumeInduction` — **fail-open**. The client returns sane defaults (`"active"`, `[]`, synthetic-pending) when this server is unreachable. The local NHE proceeds without governance for that round; the next successful round re-syncs.

This server SHOULD therefore prioritise availability of `reviewBehavior` above all other endpoints when load-shedding.

---

## 5. Deploy targets

The repo ships three deployment recipes:

1. **`docker-compose.yml`** — local development + small single-server deploys. `docker compose up -d`.
2. **`Dockerfile`** — for any container runtime (Hostinger VPS, AWS ECS, Cloudflare Containers, fly.io, Railway).
3. **`systemd/teleologyhi-cloud.service`** — bare-metal deployment on a Linux VPS. Pair with nginx + certbot for TLS. The current Creator-targeted runbook is **Hostinger VPS** (see [`README.md`](./README.md) §"Hostinger deployment runbook").

The canonical deploy target is **`teleologyhi.com`** (tracked in the internal backlog). Deploy is pending the Creator purchasing the domain + providing SSH credentials.

---

## 6. Tests

35 tests across three files:

**`tests/server.test.ts` (12 tests)** — wire contract + server behaviour:
1. `GET /` returns landing JSON without auth.
2. `GET /healthz` returns `{ok: true}` without auth.
3. Requests without bearer token are rejected `401`.
4. Requests with a wrong bearer token are rejected `401`.
5. `GET /v1/nhes/{id}/status` returns `"active"` for an unknown NHE via `RemoteMaic`.
6. `GET /v1/nhes/{id}/inductions/pending` returns `[]` for an NHE without pending tickets.
7. `POST /v1/behavior-review` accepts a valid `BehaviorReport` and returns a `MaicVerdict`.
8. Unknown routes return `404`.
9. Malformed `BehaviorReport` body returns `400` with `issues[]` (zod rejection).
10. Non-JSON body returns `400`.
11. `acceptedTokens=∅` WITHOUT `allowUnauthenticated=true` is **closed by default** (returns `401`).
12. `acceptedTokens=∅` PLUS `allowUnauthenticated=true` enables the opt-in smoke path.

**`tests/auth.test.ts` (16 tests)** — `constantTimeTokenMatch`, `authorize`, `isAuthDisabled`, `isProductionEnv`:
exact match, wrong-length rejection, wrong-bytes rejection, non-Bearer scheme rejection, empty-token rejection, opt-in unauthenticated, production-env detection across `TELEOLOGYHI_ENV` + `NODE_ENV`.

**`tests/from-env.test.ts` (7 tests)** — `startCloudFromEnv` env validation + production guard:
missing `STORE_DIR`, missing `CREATOR_PUBLIC_KEY`, empty `TOKENS` without opt-in, refuses unauthenticated in production (both env vars), accepts valid `TOKENS` in production, accepts opt-in smoke outside production.

Run:

```bash
npm test --workspace @teleologyhi-sdk/cloud
```

---

## 7. Files

```
cloud/
├── README.md                       quick start + Hostinger runbook
├── SPEC.md                         this file
├── CHANGELOG.md                    release notes (Keep-a-Changelog)
├── NOTICE                          attribution
├── LICENSE                         Apache 2.0 (full text)
├── TRADEMARK.md                    trademark notice (redirects to ../TRADEMARK.md)
├── Dockerfile                      container recipe (multi-stage, slim — maic + cloud only)
├── docker-compose.yml              local stack
├── systemd/
│   └── teleologyhi-cloud.service   bare-metal Linux VPS unit
├── package.json                    private workspace metadata
├── tsconfig.json                   TypeScript strict (build)
├── tsconfig.test.json              TypeScript strict (tests typecheck only)
├── tsup.config.ts                  build (ESM + dts; CLI banner)
├── vitest.config.ts                vitest runner config
├── src/
│   ├── index.ts                    public surface (re-exports)
│   ├── server.ts                   `node:http` handler — wire contract
│   ├── cli.ts                      CLI binary (dist/cli.js)
│   ├── auth.ts                     bearer-token auth (constant-time)
│   └── types.ts                    zod schemas for request/response
└── tests/
    ├── server.test.ts              12 tests
    ├── auth.test.ts                16 tests
    └── from-env.test.ts            7 tests
```

---

## 8. Roadmap

The workspace was promoted to the unified `1.0.0-trinity` baseline alongside `@teleologyhi-sdk/{maic,him,nhe}`, `distill`, `eval`, `arena` per the monorepo-wide consolidation cut at `2026-05-24T18:41:02Z` (root `CHANGELOG.md`). The pre-release `0.1.0-alpha.*` rows that previously occupied this table are preserved in `cloud/CHANGELOG.md` as the immutable `[0.1.0-alpha.0]` + `[0.1.0-alpha.1]` historical entries. The follow-ups below carry forward at the trinity baseline.

| Date / Window | Status | Scope |
|---|---|---|
| **2026-05-17** | shipped | `[0.1.0-alpha.0]` initial server + Dockerfile + docker-compose + systemd unit + Hostinger runbook + 9 tests |
| **2026-05-24** | shipped | `[0.1.0-alpha.1]` security hardening — zod body validation + `crypto.timingSafeEqual` bearer compare + production-mode anonymous-deploy guard + slim Dockerfile (maic+cloud only) + 35 tests (was 9) across server / auth / from-env |
| **2026-05-24** | shipped | `[1.0.0-trinity]` audit closure — version baseline promotion + EN-only enforcement (SPEC frontmatter PT-BR fragment translated) + roadmap rewrite + `docker-compose.yml` deprecated `version` field removed + `package.json` `bugs.url` + README canonical positioning lifts (Entry 19 cosmology + Entry 21+23 differentiation phrase + deployment-target framing) |
| **`[follow-up]` first public deploy on `teleologyhi.com`** | `[planned]` | Hostinger VPS provisioning + nginx + Let's Encrypt TLS once the Creator purchases the domain and provides SSH credentials. Runbook documented in `README.md` §"Hostinger deployment runbook" steps 1-8. |
| **`[follow-up]` streaming on `reviewBehavior`** | `[planned]` | High-volume callers benefit from chunked verdict emission; current endpoint is request/response. Wait for real-world demand before adding. |
| **`[follow-up]` audit hash-chain rotation runbook** | `[planned]` | Operational procedure for rotating `audit/log.ndjson` past the 10k-event ceiling without breaking the SHA-256 chain. |
| **`[follow-up]` rate limiting + DDoS posture** | `[planned]` | nginx-level rate limits are documented in the Hostinger runbook; an application-level token-bucket per bearer token would complement them for fine-grained abuse control. |
| **`[follow-up]` SLA backing for `teleologyhi.com`** | `[planned]` | After the first public deploy soaks for >30 days, publish an explicit SLA (uptime + p95 latency + RTO) so enterprise consumers can subscribe to the managed `RemoteMaic` plan referenced in Entry 10. |

---

## 9. Cross-references

- [`@teleologyhi-sdk/maic`](../maic/SPEC.md) §RemoteMaic — client side of this wire contract
- [`MAIC_HIM_NHE_INTERVIEW_LOG.md`](../MAIC_HIM_NHE_INTERVIEW_LOG.md) Entry 5 — Creator's framing of cloud governance
- Open backlog item — Hostinger deploy (tracked in the internal backlog).
- [`PRIVACY.md`](../PRIVACY.md) — data-handling posture (this server inherits operator policy)
- [`SECURITY.md`](../SECURITY.md) — vulnerability disclosure (this server is in scope)
