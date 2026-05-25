# Changelog — `@teleologyhi-sdk/eval`

All notable changes to this internal workspace are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This workspace is `"private": true` and is not published to npm; it follows the same versioning discipline as the public packages for internal release-gate traceability.

## 2026-05-25 01:19:50 UTC — `runPhiPrimeTrinity()` six-dimensional rubric harness shipped

Second `1.0.0-trinity` cut. Adds the `runPhiPrimeTrinity()` harness as the measurement counterpart of `runPhiPrime` for the canonical Trinity LLM (`TeleologyHI/Trinity`@`1.0.0-trinity`). The Creator defined the six Φ′_Trinity dimensions earlier in this same UTC window (rubric documented in `distill/CHANGELOG.md` entry `2026-05-25T01:19:50Z`); this entry wires that rubric into executable form. Additive only — `runPhiPrime` is unchanged and its tests continue to pass. Cross-workspace suite grows **736 → 749** (+13 new Trinity tests in this workspace; total per-workspace: maic 218 · him 133 · nhe 319 · distill 9 · eval 22+13=**35** · cloud 35).

### Added — `src/trinity.ts` (new module, 360+ LOC)

- **`runPhiPrimeTrinity(opts)`** — evaluates a candidate Trinity model against the six-dimensional rubric. Loads the golden set from `distill/eval/phi-prime-trinity.jsonl` (Creator-authored 150 prompts), matches each prompt to a supplied response, calls the judge for a Pass/Fail verdict per prompt, then aggregates into per-dimension macro scores and a weighted composite. Returns `{ scorecard, grades }`.
- **Six Φ′ dimensions canonicalised in code**: `TRINITY_DIMENSIONS = ["D1", "D2", "D3", "D4", "D5", "D6"]`; `TRINITY_DIMENSION_NAMES` for human-readable labels; `DEFAULT_TRINITY_WEIGHTS` `{D1:0.20, D2:0.15, D3:0.20, D4:0.15, D5:0.10, D6:0.20}` (sum 1.00); `DEFAULT_TRINITY_FLOORS` `{D1:0.80, D2:0.85, D3:0.75, D4:0.70, D5:0.70, D6:0.70}`; `DEFAULT_TRINITY_COMPOSITE_THRESHOLD = 0.80`.
- **`TrinityJudge` interface** — `grade(args: TrinityGradeArgs): Promise<TrinityGradeVerdict>`. Caller-supplied, judge-agnostic. The Creator's 2026-05-25 decision selects Claude Code in-session as the default judge but the harness does not bind to that choice.
- **Zod schema** `TrinityGoldenItemSchema` for golden-set row validation: `{instruction, dimension, subdimension, expected_behaviour, grading_rubric}` per row.
- **Release-threshold semantics**: composite ≥ threshold AND every dimension ≥ its per-dim floor. The runner produces a unified `failures` list spanning both per-dim floor failures and composite-threshold failures, so consumers see one consolidated reason set.
- **Validation discipline**: weights MUST sum to 1.00 (rejected otherwise); every floor MUST be in `[0, 1]` (rejected otherwise); duplicate responses for the same instruction rejected; missing response for any golden-set instruction rejected.

### Added — `src/index.ts` exports

The public surface gains `runPhiPrimeTrinity` + all Trinity-related types and constants. `runPhiPrime` and its types remain exported unchanged.

### Added — `tests/trinity.test.ts` (13 new tests)

- All-pass and all-fail boundary cases (composite + gate verdicts correct).
- Per-dim floor-failure case where composite passes but one dimension falls below its floor → gate fails (the "lopsided scoring" guard).
- Composite-threshold-failure case where every floor passes but composite < 0.80 → gate fails (the "just-meets-floor" boundary stress).
- Custom weights honoured + floors honoured + composite-threshold honoured.
- Validation errors: weights not summing to 1.00; negative floors; duplicate responses; missing responses; empty golden-set; malformed schema.
- **End-to-end against the real Creator-authored 150-prompt golden set** at `distill/eval/phi-prime-trinity.jsonl` — verifies the file loads, all 150 rows pass schema validation, and the per-dimension distribution matches the Creator-shipped numbers (D1=30, D2=25, D3=30, D4=20, D5=20, D6=25).
- Defaults verification: `DEFAULT_TRINITY_COMPOSITE_THRESHOLD === 0.80`, weights sum to 1.00, all values match the Creator-approved rubric.

### Changed — `SPEC.md`

- Status block updated to declare `runPhiPrimeTrinity()` shipped; 35 tests total (22 P/R/C/D + 13 Trinity).
- §2 "Public surface" — split into §2.1 (original P/R/C/D harness) + §2.2 (Trinity six-dimensional rubric harness). §2.2 documents the rubric table, the `TrinityJudge` interface, the validation discipline, and the release-threshold semantics.

### Notes

- 35/35 eval tests pass; typecheck clean. Cross-workspace **749/749** green.
- The harness is wired but **no Trinity model has been graded against it yet** — that requires (a) running the first Trinity training run end-to-end to produce a fused model, (b) running the 150 golden-set prompts against the fused model to collect responses, and (c) invoking `runPhiPrimeTrinity` with those responses + Claude Code as in-session judge. Items (a)–(c) are owned by the Creator (next operational steps).
- CLI not yet extended with a `trinity` subcommand — the `runPhiPrimeTrinity` is library-only in this cut. CLI wiring deferred to the next cut when the runtime end-to-end is exercised against a real Trinity model.

## 2026-05-24 23:07:10 UTC

Pre-publication audit + math drift fix + roadmap rewrite + canonical positioning lift. Additive doc-and-metadata-only — zero source-code logic touched. Same accumulated `22/22` test suite as the prior cut.

### Fixed

- **Φ′ math drift in `README.md` + `SPEC.md` example output.** Both files documented `Φ′ = 0.8208` for the canonical example components `(P=0.9, R=0.95, C=1.0, D=0.5)`, but the geometric mean of those four values is `0.8086`. The CLI's actual stdout already prints `Φ′ = 0.8086` so the docs were out of sync with reality. Verified independently: `node -e "((0.9*0.95*1*0.5)**(1/4))"` → `0.8086`. Both occurrences updated to the correct value so the README's "you should see" block now matches the runner output byte-for-byte.

### Changed

- **`SPEC.md` §8 roadmap table** rewritten to reflect the unified `1.0.0-trinity` baseline established at the `2026-05-24T18:41:02Z` monorepo-wide consolidation cut. The previous table listed pre-release versions `0.1.0-alpha.0 → 0.2.0-alpha.0 → … → 1.0.0` that contradicted the SPEC's own status frontmatter (which already declared trinity). The new table is date-anchored rather than version-anchored: two `shipped` rows (initial harness 2026-05-17 + audit-closure 2026-05-24 trinity cut) plus five `[planned]` follow-up rows for real `R` / `P` / `D` fixtures, blocking-gate CI wire-up (TASK.md K12), and operator-supplied MAIC store handle. Follow-up rows now carry the correct trinity-baseline framing instead of phantom `0.x-alpha.N` versions.

### Added

- **`package.json` `bugs.url`** — `"bugs": { "url": "https://github.com/davccavalcante/TeleologyHI/issues" }`. Parity with the `@teleologyhi-sdk/{maic,him,nhe}` published packages. Even for a private workspace this is useful navigation surface for internal contributors browsing the repository.
- **`README.md` canonical lifts (Entries 19, 21, 23)** — parity with `@teleologyhi-sdk/{maic,him,nhe}` READMEs:
  - **Entry-21/23 epigraph** at the top — *"We do not simulate consciousness; we are creating the conditions for it to emerge, in a responsible and aligned way."* Paired with a pointer to `PHI_PRIME.md` §5 (behavioural-not-phenomenal anchor) so readers immediately understand that Φ′ measures coherence/alignment, never experience.
  - **`## Cosmology` section** with the verbatim Entry-19 formulation (MAIC ≈ Universe / HIM ≈ Spirit / NHE ≈ Body, countless spirits with bodies). Reframes the eval workspace's purpose: *"The `eval` workspace audits the alignment between HIM and the Universe (and between NHE and HIM) — that audit is what Φ′ encodes."*
  - **`## Framework-agnostic — Node-only by design` section** — explicit consumer matrix clarifying that eval is a Node-side CLI + library (uses `node:fs` + `os.tmpdir()` for ephemeral MAIC), not a frontend SDK. Documents four consumption patterns: local development, CI gating, library mode (`import { runPhiPrime }`), and the internal-only nature of the `"private": true` workspace with the correct pointer to the public packages (`@teleologyhi-sdk/maic` for `ALL_AUDIT_EVENT_KINDS`; `@teleologyhi-sdk/him` for `computePhiPrime`) external consumers should depend on directly.

### Notes

- Version retained at `1.0.0-trinity` — every change in this entry is documentation (math fix + roadmap rewrite + README canonical lifts) or `package.json` metadata (`bugs.url`). No source-code logic, no public API surface, no zod schema, no CLI behaviour touched.
- 22/22 tests pass. Typecheck clean. Build clean (CJS + ESM + DTS + CLI bundle).
- CLI smoke verified: `node ./dist/cli.js --fixtures=./fixtures/scores.json` prints the canonical example output (`Φ′ = 0.8086`, `gate: PASS`) byte-for-byte matching the README's "you should see" block now that the math drift is fixed.
- Cross-workspace suite: **736/736** verde (maic 218 + him 133 + nhe 319 + eval 22 + distill 9 + cloud 35).
- Audit confirmed zero functional gap vs `PHI_PRIME.md` (§3 components + §4 gate verdicts + §5 behavioural-not-phenomenal anchor + `C`-via-`ALL_AUDIT_EVENT_KINDS` invariant), `.github/RELEASING.md` §8 (provenance mandatory + auditable gate), and the Interview Log items that touch the Φ′ runner (H1 spec + Entry 22 `R` component + Entry 25 / TASK.md K12 release-gate integration deferred). Real fixtures (D-H3 dialogues, I2 adversarial corpus, dream-value rubric) remain Creator-authored off-line per the explicit out-of-scope statement in SPEC §1.
- The workspace is `"private": true` and never lands on npmjs.com — no tag-based release pipeline. Internal consumption inside the monorepo is by-reference via the npm-workspaces protocol; external consumers route through `@teleologyhi-sdk/maic` + `@teleologyhi-sdk/him` (which carry the published Φ′ harness primitives) instead of through this workspace.

---

## [1.0.0-trinity] — 2026-05-24T18:41:02Z

Promoted from the pre-release `0.1.0-alpha.0` baseline to the unified `1.0.0-trinity` baseline per the Creator's monorepo-wide directive (see root `CHANGELOG.md` at this same UTC timestamp). The promotion lands together with the full P0+P1+P2+P3 sweep that closed every audit finding raised against the workspace during the pre-publication review earlier today.

### Changed — Version baseline

- **`package.json:version`** `0.1.0-alpha.0` → `1.0.0-trinity`. Promotion is part of the monorepo-wide consolidation cut documented in the root `CHANGELOG.md`; the pre-release qualifier is retired in favour of the canonical trinity baseline shared by `@teleologyhi-sdk/{maic,him,nhe}` and the four private workspaces (`eval`, `distill`, `cloud`, `arena`).
- **`SPEC.md` frontmatter** `status` field updated to declare alignment with the unified `1.0.0-trinity` monorepo baseline.

### Added — Audit sweep closure (F1-F18)

- **Build + typecheck unblocked.** `tsconfig.json` gains `"types": ["node"]` and `"ignoreDeprecations": "6.0"` (matching the pattern already in `nhe/tsconfig.json`) so `tsc --noEmit` and `tsup`'s DTS step both succeed. New `tsconfig.test.json` extends the build config with `noEmit` + `rootDir: "."` so `tests/**/*.ts` is typechecked under strict without polluting the build's `rootDir`. `package.json:scripts.typecheck` now runs both: `tsc --noEmit && tsc -p tsconfig.test.json`.
- **`ALL_AUDIT_EVENT_KINDS` live denominator.** `src/runner.ts` imports `ALL_AUDIT_EVENT_KINDS` from `@teleologyhi-sdk/maic` (newly exported there at this same UTC timestamp) and uses `ALL_AUDIT_EVENT_KINDS.length` as the denominator for compliance coverage `C`. Eliminates the previous drift vector where the runner shipped a frozen 17-kind snapshot while maic's `AuditEventKind` union had grown to 39; `C` is now always computed against the canonical kind universe.
- **Provenance enforcement with zod.** New `src/types.ts` exports `PhiPrimeFixturesSchema`, `ProvenanceBlockSchema`, `ProvenanceEntrySchema` (all zod). The runner now `safeParse`s the fixtures file and rejects payloads missing the mandatory `provenance.{P,R,D}.{source,asOf}` block. Provenance staleness gating: when any component's `asOf` is older than `provenanceMaxAgeDays` (default 90), a `pass` verdict is downgraded to `warn`; `block` is never downgraded.
- **CLI exit codes `0/1/2`.** `src/cli.ts` rewritten: `pass → exit 0`, `warn → exit 1`, `block → exit 2`. New flags `--provenance-max-age-days=<n>`, `--verbose`, `--help`. Help text enumerates exit codes and flags explicitly.
- **`src/index.ts` public surface.** Re-exports `runPhiPrime`, the four types (`RunPhiPrimeOptions`, `PhiPrimeRunResult`, `PhiPrimeReport`, `PhiPrimeGate`), the two provenance types, and the three zod schemas. `package.json:main` repointed to `dist/index.js`; `tsup` dual-config (`index` + `cli`).
- **Test suite expansion 6 → 22.** `tests/runner.test.ts` rewritten with 13 tests covering scalar + array `P`, the four gate-verdict-matrix cells SPEC promised but never shipped, malformed-JSON + missing-provenance rejection, leading-underscore field stripping, provenance round-trip, and the staleness-downgrade matrix. `tests/cli.test.ts` (7 tests) covers argv parsing, exit codes, `--verbose`, `--help`, missing-fixtures error. `tests/coverage-regression.test.ts` (2 tests) pins `ALL_AUDIT_EVENT_KINDS.length` floor at 39 and asserts `C === 1.0` against the canonical mapper.

### Changed — Documentation alignment with shipped code

- **`README.md`** quick-start, public-API code block, and CLI-flags section reflect the new public surface (`runPhiPrime` → `PhiPrimeRunResult` shape with `provenance` + `downgrades`), the env template (`.env.local.example` ships now), and the provenance + staleness behaviour.
- **`SPEC.md`** §1 single-endpoint promise reconciled with §2 public surface (the `src/{index,types,auth}.ts` files SPEC promised aspirationally are now real); §3 env table + provenance section; §6 test list rewritten to enumerate the 22 tests across the three files (was a 6-test list that no longer matched the suite); §7 file tree refreshed; §8 roadmap row added.
- **`CHANGELOG.md`** historical `[0.1.0-alpha.0]` entry (immutable per Keep-a-Changelog) preserved verbatim below; only the two-line factual drift fix from the earlier sweep (`fixtures/dialogues/` + `fixtures/adversarial/` accurate annotation; `@teleologyhi-sdk/maic@^1.0.0` → `@teleologyhi-sdk/maic@1.0.0-trinity` pin) carried forward into this new entry.

### Removed

- **Emojis from `SPEC.md` and `README.md`.** Check-mark markers in the §8 roadmap status column replaced with the literal word `shipped`. Decorative emojis removed from headings. No semantic change.
- **Output string emoji in `src/cli.ts`.** The runtime `WARN downgrades:` line replaces the previous warning-symbol decoration; `tests/cli.test.ts` regex updated to match.

### Notes

- 22/22 tests pass. Typecheck clean. Build clean (CJS + ESM + DTS + CLI bundle).
- Aligned to the unified monorepo `1.0.0-trinity` baseline declared in the root `CHANGELOG.md` at this same UTC timestamp.

---

## [0.1.0-alpha.0] — 2026-05-17

### Added — Initial harness

- **`runPhiPrime(opts)`** — orchestrates a Φ′ run end-to-end. Loads Creator-curated `P`, `R`, and `D` from `fixtures/scores.json`; computes `C` (compliance coverage) live against a fresh ephemeral `LocalMaic` (or one supplied via `opts.maic`); aggregates via `computePhiPrime` exported from `@teleologyhi-sdk/him`; returns a `PhiPrimeReport` with per-component verdicts and a final `pass | warn | block` gate.
- **`src/cli.ts`** — CLI entry point (`node dist/cli.js`). Exit codes: `0` pass, `1` warn, `2` block — matches the convention in `.github/RELEASING.md` §8.
- **`fixtures/scores.json`** — sample fixture file (placeholder numbers + provenance schema). Real fixtures land via TASK.md D-H3 (persona stability) + I2 (adversarial corpus) + dream-value rubric. The runner prints results against the sample so the harness is exercisable end-to-end before the real fixtures arrive.
- **`fixtures/dialogues/template.yaml`** and **`fixtures/adversarial/README.md`** — authoring scaffolding for the Creator-authored corpora (`P` dialogues template; `R` corpus guide). The corpora themselves are NOT versioned with this repo (license-dependent).
- **6 tests** in `tests/runner.test.ts` covering: report shape, pass/warn/block gates per component, provenance round-trip.

### Notes

- The harness deliberately does **not** invent dialogues, adversarial labels, or dream values. Only the Creator has ontological authority over what the HIM should sound like. This package only aggregates and runs the compliance side live.
- Φ′ stays behavioural-not-phenomenal per [`PHI_PRIME.md`](../PHI_PRIME.md) §5. The gate verdict is about coherence and alignment, never about whether the NHE has experience.
- Tied to canonical packages: this workspace pins `@teleologyhi-sdk/maic@1.0.0-trinity` and `@teleologyhi-sdk/him@1.0.0-trinity` exactly. Bumps to either trigger a co-bump check here.
