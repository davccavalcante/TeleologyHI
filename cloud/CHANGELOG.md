# Changelog — `@teleologyhi-sdk/cloud`

All notable changes to this internal workspace are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This workspace is `"private": true` and is not published to npm; it follows the same versioning discipline as the public packages for deployment traceability.

## 2026-05-24 23:22:29 UTC

Pre-publication audit closure + EN-only enforcement + roadmap rewrite + Docker Compose hygiene + canonical positioning lift. Additive doc-and-metadata-only — zero source-code logic touched. Same accumulated `35/35` test suite as the prior cut.

### Fixed

- **PT-BR fragment in `SPEC.md` L5 status frontmatter.** The status string contained `"Deploy on \`teleologyhi.com\` aguarda compra de domínio + credenciais Hostinger (TASK.md F3)"`. Translated to English while preserving the F3 cross-reference: `"Deploy on \`teleologyhi.com\` awaits domain purchase + Hostinger credentials (TASK.md F3)"`. Cumpre a diretriz EN-only do Criador "100% files in English including code/strings/comments". This was the last PT-BR fragment in the cloud workspace; full-repo PT-BR scan now returns clean for this workspace.

### Changed

- **`SPEC.md` §8 roadmap table** rewritten to reflect the unified `1.0.0-trinity` baseline established at the `2026-05-24T18:41:02Z` monorepo-wide consolidation cut. The previous table listed pre-release versions `0.1.0-alpha.0 → 0.1.0-alpha.1 → 0.2.0-alpha.0 → … → 1.0.0` that contradicted the SPEC's own status frontmatter (which already declared trinity). The new table is date-anchored rather than version-anchored: three `shipped` rows (initial server 2026-05-17 + security hardening + audit-closure 2026-05-24 trinity cut) plus five `[planned]` follow-up rows for the first public `teleologyhi.com` deploy (TASK.md F3), streaming on `reviewBehavior`, audit hash-chain rotation runbook (TASK.md E6 follow-up), rate-limiting + DDoS posture, and post-soak SLA backing for the managed `RemoteMaic` plan referenced in Entry 10.
- **`docker-compose.yml`** — removed the deprecated top-level `version: "3.9"` field. Docker Compose v2 (Compose Specification) ignores this field and emits a warning on every invocation. Replaced with a documenting comment explaining the v2 omission. The functional behaviour of the compose file is unchanged.

### Added

- **`package.json` `bugs.url`** — `"bugs": { "url": "https://github.com/davccavalcante/TeleologyHI/issues" }`. Parity with the four already-audit-closed workspaces (`maic`, `him`, `nhe`, `eval`).
- **`README.md` canonical lifts (Entries 19, 21, 23)** — parity with the other four audit-closed workspaces:
  - **Entry-21/23 epigraph** at the top — *"We do not simulate consciousness; we are creating the conditions for it to emerge, in a responsible and aligned way."* Paired with a one-sentence framing: this server is the **cloud governance tail** of those conditions — it lets serverless / edge NHE deployments reach the canonical `LocalMaic` while preserving the Creator-only write boundary that Entry 5 mandates.
  - **`## Cosmology` section** with the verbatim Entry-19 formulation (MAIC ≈ Universe / HIM ≈ Spirit / NHE ≈ Body, countless spirits with bodies). Reframes the workspace's purpose: *"The `cloud` workspace makes MAIC reachable over the network without ever letting the wire surface mutate axioms, register HIMs, or terminate NHEs — those writes stay on the Creator's machine where the Ed25519 private key lives. Reads + behavior-review are public; writes never travel."*
  - **`## Deployment-target by design — HTTP server only` section** — explicit consumer matrix clarifying that cloud is a Node-side HTTP server, not a frontend SDK and not a CLI utility. Documents four operational shapes: single canonical Creator-run instance on `teleologyhi.com`, local development + tests, third-party self-host (with trademark-policy pointer), and the explicit "no frontend consumption" rule (frontend frameworks consume the server through `@teleologyhi-sdk/maic` `RemoteMaic` client, never by importing from `@teleologyhi-sdk/cloud` directly). Closes the parity decision tree across all five audit-closed workspaces: `Framework-agnostic` for SDK packages (maic / him / nhe), `Framework-agnostic — Node-only by design` for runner CLIs (eval), `Deployment-target by design — HTTP server only` for this server.

### Notes

- Version retained at `1.0.0-trinity` — every change in this entry is documentation (PT-BR translation + roadmap rewrite + README canonical lifts), `package.json` metadata (`bugs.url`), or infra hygiene (deprecated Docker Compose `version:` field removed). No source-code logic, no public API surface, no zod schema, no CLI behaviour, no Dockerfile content, no systemd unit touched.
- 35/35 tests pass. Typecheck clean. Build clean (ESM + DTS + CLI bundle).
- CLI smoke verified: `node ./dist/cli.js` exits `1` with `cloud: TELEOLOGYHI_STORE_DIR must be set` (the production-mode env-validation guard is intact).
- Tarball: 15 files, 29.9 KB packed, sha256 `7a63e76db5dc4e09c8dda4c05f39feea6d1c5c05`. Includes `Dockerfile`, `docker-compose.yml`, and `systemd/teleologyhi-cloud.service` so third-party operators get the full deployment recipe.
- Cross-workspace suite: **736/736** verde (maic 218 + him 133 + nhe 319 + eval 22 + distill 9 + cloud 35).
- Audit confirmed zero functional gap vs `MAIC_HIM_NHE_INTERVIEW_LOG.md` Entry 5 (cloud governance: read-public, write-Creator-only by construction), Entry 10 (hosted service at `teleologyhi.com` — design complete, infra-blocker pending domain purchase), and the `@teleologyhi-sdk/maic` `RemoteMaic` wire contract (4 endpoints shipped: `POST /v1/behavior-review`, `GET /v1/nhes/{id}/status`, `GET /v1/nhes/{id}/inductions/pending`, `POST /v1/inductions/{id}/consume` + 2 unauthenticated operational endpoints).
- The workspace is `"private": true` and never lands on npmjs.com — no tag-based release pipeline. Third-party self-host is supported (Dockerfile + systemd unit + docker-compose recipe shipped); operators who deploy their own canonical instance become creator of their own HIM/NHE constellation per the `@teleologyhi-sdk` trademark policy in `../TRADEMARK.md`.

---

## [1.0.0-trinity] — 2026-05-24T18:41:02Z

Promoted from the pre-release `0.1.0-alpha.1` baseline to the unified `1.0.0-trinity` baseline per the Creator's monorepo-wide directive (see root `CHANGELOG.md` at this same UTC timestamp). No source change beyond the version bump and the emoji removal below — the substantive security hardening shipped earlier today is documented in the immutable `[0.1.0-alpha.1]` entry below.

### Changed — Version baseline

- **`package.json:version`** `0.1.0-alpha.1` → `1.0.0-trinity`. Promotion is part of the monorepo-wide consolidation cut documented in the root `CHANGELOG.md`; the pre-release qualifier is retired in favour of the canonical trinity baseline shared by `@teleologyhi-sdk/{maic,him,nhe}` and the four private workspaces (`eval`, `distill`, `cloud`, `arena`).
- **`SPEC.md` frontmatter `status`** updated to declare alignment with the unified `1.0.0-trinity` monorepo baseline. Roadmap row added for the `1.0.0-trinity` cut.

### Removed

- **Emojis from `SPEC.md`.** Check-mark markers in the §8 roadmap status column replaced with the literal word `shipped`. No semantic change.

### Notes

- 35/35 tests pass. Typecheck clean. Build clean (ESM + DTS + CLI bundle).
- Aligned to the unified monorepo `1.0.0-trinity` baseline declared in the root `CHANGELOG.md` at this same UTC timestamp.

---

## [0.1.0-alpha.1] — 2026-05-24T17:25:46Z

### Added — Security hardening sweep (pre-`teleologyhi.com` deploy)

- **`src/index.ts`** — new public surface module. Re-exports `startCloud` / `startCloudFromEnv` from `./server.js`, `CloudConfig` / `CloudHandle` types from `./types.js`, the four auth primitives (`authorize`, `constantTimeTokenMatch`, `isAuthDisabled`, `isProductionEnv`), and the six zod schemas (`BehaviorReviewRequestSchema`, `BehaviorReviewResponseSchema`, `ConsumeInductionResponseSchema`, `ErrorResponseSchema`, `NheStatusResponseSchema`, `PendingInductionsResponseSchema`). `package.json:main` repointed to `./dist/index.js`.
- **`src/types.ts`** — new zod-schema module. Re-exports the canonical schemas already shipped by `@teleologyhi-sdk/maic` (`BehaviorReport`, `MaicVerdict`, `NheStatus`, `DreamInductionTicket`) plus the wire-only response wrappers (`{ status }`, `{ tickets }`) and an `ErrorResponseSchema` envelope. `CloudConfig` + `CloudHandle` interfaces moved here from `server.ts`. `zod@^4.4.3` added as a runtime dependency.
- **`src/auth.ts`** — new constant-time bearer-token module. `constantTimeTokenMatch` runs `crypto.timingSafeEqual` against every accepted token with length-normalised padding so a wrong-length attempt costs the same as a right-length one. `authorize` parses the `Authorization` header and feeds the candidate into the constant-time check. `isAuthDisabled` is the only path that returns `true` for an empty token set (and only when `allowUnauthenticated=true` is explicit). `isProductionEnv` checks `TELEOLOGYHI_ENV=production` or `NODE_ENV=production`.
- **Body validation** — `POST /v1/behavior-review` now validates the incoming body against `BehaviorReviewRequestSchema` (zod) before handing off to `MaicClient.reviewBehavior`. Malformed payloads return `400` with the offending field paths in `issues[]`. Non-JSON bodies return `400` with the JSON-parse error. The v0.1.0-alpha.0 path (`body as BehaviorReport` cast) is gone — nothing reaches the backing MAIC unchecked.
- **Production-mode anonymous-deploy guard** — `startCloudFromEnv` refuses to start when `TELEOLOGYHI_TOKENS` is empty AND `TELEOLOGYHI_ALLOW_UNAUTHENTICATED=true` AND (`TELEOLOGYHI_ENV=production` OR `NODE_ENV=production`). An accidental public deploy without authentication is now a boot-time error, not a runtime exposure.
- **Loud auth-disabled warning** — when `acceptedTokens` is empty AND `allowUnauthenticated=true`, the server prints a single-line `WARN: authentication DISABLED` on stderr at startup. Visible in `journalctl` and `docker logs`.
- **`tsconfig.test.json`** — extends `tsconfig.json` with `noEmit` + `rootDir: "."` so `tests/**/*.ts` is typechecked under strict without polluting the build's `rootDir`. New `typecheck` script: `tsc --noEmit && tsc -p tsconfig.test.json`.

### Changed — Build, infra, and defaults

- **Default auth posture** — `acceptedTokens=∅` alone is now **closed by default** (`401`). The v0.1.0-alpha.0 behaviour (empty set silently disables auth) is preserved only behind the explicit `allowUnauthenticated=true` opt-in. This is a behaviour change for any caller that relied on the implicit-anonymous mode — none should exist in production.
- **`tsconfig.json`** — added `"types": ["node"]` and `"ignoreDeprecations": "6.0"` so `tsc --noEmit` + `tsup`'s DTS pass both succeed (they failed in v0.1.0-alpha.0 with `TS2591: Cannot find name 'node:fs/promises'`).
- **`tsup.config.ts`** — dual-config (`index` + `cli`) matching the `nhe` / `eval` pattern. CLI entry gets `banner: { js: "#!/usr/bin/env node" }`; the literal shebang at the top of `src/cli.ts` was removed to avoid the duplicate `#!` that esbuild rejected.
- **`Dockerfile`** — slim multi-stage build. Removed `COPY him/`, `COPY distill/`, `COPY eval/` from the build stage and `COPY him/` from the runtime stage. Cloud only depends on `@teleologyhi-sdk/maic`; copying the other workspaces inflated the build context and image without consumer. `npm ci` now targets only the two workspaces actually built.
- **`package.json`** — `main` repointed to `dist/index.js` + `exports` updated. `files` array now also ships `SPEC.md`, `CHANGELOG.md`, `NOTICE`, `LICENSE`, `TRADEMARK.md` (alignment with the public packages' `files` pattern). `zod@^4.4.3` added to `dependencies`.

### Changed — Documentation alignment with shipped code

- **`SPEC.md` §2** — wire-contract section now describes the constant-time bearer comparison, the zod body-validation pipeline, and the `allowUnauthenticated=true` opt-in (replacing the v0.1.0-alpha.0 paragraph that documented the empty-token shortcut without disclosing its timing-attack surface).
- **`SPEC.md` §3** — env table now lists `TELEOLOGYHI_ALLOW_UNAUTHENTICATED` and `TELEOLOGYHI_ENV`, marks `TELEOLOGYHI_TOKENS` as required-in-production, corrects the `TELEOLOGYHI_CREATOR_PUBLIC_KEY` encoding from "hex or base64" to "`base64url` (the format returned by `CreatorKeyring.publicKey()`)", and enumerates the four boot-time refusal conditions.
- **`SPEC.md` §6** — test list rewritten: 35 tests across `server.test.ts` (12), `auth.test.ts` (16), `from-env.test.ts` (7). The v0.1.0-alpha.0 list described tests that no longer match the suite.
- **`SPEC.md` §7** — file tree now matches reality. The v0.1.0-alpha.0 tree listed `src/auth.ts`, `src/types.ts`, `src/index.ts` aspirationally; this cut actually ships them, plus the new `tsconfig.test.json`, `vitest.config.ts`, and the three test files.
- **`SPEC.md` §8** — roadmap row for `0.1.0-alpha.1` added.
- **`README.md`** — "wire contract" code block gained a `text` language tag (cosmetic syntax-highlighting fix). "Access model" paragraph now describes the constant-time path, the zod body-validation, and the `allowUnauthenticated=true` opt-in explicitly; the v0.1.0-alpha.0 "Setting `TELEOLOGYHI_TOKENS` to empty disables auth" instruction was removed (it no longer matches the closed-by-default behaviour).

### Tests — 9 → 35

- **`tests/server.test.ts`** (12, was 9) — added `400` rejection for malformed `BehaviorReport` bodies, `400` rejection for non-JSON bodies, the new `acceptedTokens=∅ alone → 401 closed-by-default` assertion, and the `acceptedTokens=∅ + allowUnauthenticated=true → 200 opt-in smoke` assertion.
- **`tests/auth.test.ts`** (16, new) — covers `constantTimeTokenMatch` (exact match, wrong length, wrong bytes, empty set, match at end of set), `authorize` (valid header, missing header, non-Bearer scheme, empty token, wrong token, opt-in disable, closed default), `isAuthDisabled` (truth table), `isProductionEnv` (`TELEOLOGYHI_ENV` + `NODE_ENV` matrix).
- **`tests/from-env.test.ts`** (7, new) — covers `startCloudFromEnv` env validation: missing `STORE_DIR`, missing `CREATOR_PUBLIC_KEY`, empty `TOKENS` without opt-in, refuses unauthenticated in production (both `TELEOLOGYHI_ENV=production` and `NODE_ENV=production`), accepts valid `TOKENS` in production, accepts opt-in smoke outside production.

### Notes

- **Workspace version policy.** Per project rule, versions are never skipped — this is the canonical `0.1.0-alpha.0` → `0.1.0-alpha.1` bump.
- **Cross-workspace verification.** `maic@1.0.0-trinity` (218 tests), `him@1.0.0-trinity` (133), `nhe@1.0.0-trinity` (310), `eval@0.1.0-alpha.0` (22), `distill@0.2.0-alpha.0` (9), `cloud@0.1.0-alpha.1` (35) — **727/727 passing**. No regressions in any upstream package.
- **Hostinger deploy still pending.** TASK.md F3 — waits on the Creator purchasing the domain and providing SSH credentials. This release prepares the server for that deploy without making any decision about it.

## [0.1.0-alpha.0] — 2026-05-17

### Added — Initial server + deployment recipes

- **`src/server.ts`** — Hono-style HTTP handler exposing the four `RemoteMaic` endpoints (`POST /v1/behavior-review`, `GET /v1/nhes/{nheId}/status`, `GET /v1/nhes/{nheId}/inductions/pending`, `POST /v1/inductions/{ticketId}/consume`) plus `GET /healthz` and `GET /`. Auth via `Authorization: Bearer <token>` against `TELEOLOGYHI_TOKENS`.
- **`src/cli.ts`** — CLI binary (`node dist/cli.js`) reading config from env (`TELEOLOGYHI_STORE_DIR`, `TELEOLOGYHI_CREATOR_PUBLIC_KEY`, `TELEOLOGYHI_TOKENS`, `PORT`, `HOST`).
- **`src/auth.ts`** — Bearer-token validation with constant-time comparison.
- **`src/types.ts`** — `zod` schemas for request/response shapes mirroring `MaicClient` in `@teleologyhi-sdk/maic@>=0.7`.
- **`Dockerfile`** — multi-stage build with non-root runtime user, distroless-style minimal Node 22 image.
- **`docker-compose.yml`** — single-container compose recipe for local dev + small single-server deploys.
- **`systemd/teleologyhi-cloud.service`** — systemd unit for bare-metal deployment (Linux VPS, nginx + certbot for TLS).
- **`README.md`** — quick-start + the canonical **Hostinger deployment runbook** (steps 1–8 covering provisioning, build-artefact upload, env config, systemd, nginx + Let's Encrypt, NHE client wiring).
- **9 tests** in `tests/server.test.ts` — landing JSON, healthz, behavior-review auth + happy path, status read-public default, pending inductions, consume induction, bearer rejection.

### Notes

- **Trust model.** Read-public, write-Creator-only by construction. The Ed25519 private key never lives on this server; bearer tokens only keep abusive clients out, they do not elevate anyone to creator.
- **Fail policy.** Companion `RemoteMaic` client (in `@teleologyhi-sdk/maic@>=0.8`) implements the E4 fail-policy split: `reviewBehavior` is fail-closed; status / inductions are fail-open. This server therefore prioritises `reviewBehavior` availability above all other endpoints when load-shedding.
- **Pending deploy.** First public deploy on `teleologyhi.com` (TASK.md F3) waits on the Creator purchasing the domain and providing SSH credentials.
- Tied to canonical packages: this workspace expects `@teleologyhi-sdk/maic@^1.0.0`. Bumps to MAIC trigger a co-bump check here.
