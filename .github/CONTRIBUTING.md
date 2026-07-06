# Contributing to TeleologyHI

Thank you for considering a contribution. This document is the canonical guide for anyone proposing changes to the TeleologyHI monorepo: the three public packages (`@teleologyhi-sdk/maic`, `@teleologyhi-sdk/him`, `@teleologyhi-sdk/nhe`) and the four private workspaces (`distill`, `eval`, `cloud`, `arena`).

The project is open source under [Apache License 2.0](../LICENSE) and follows a strict ontological discipline documented in [`MAIC_HIM_NHE_INTERVIEW_LOG.md`](../MAIC_HIM_NHE_INTERVIEW_LOG.md) and related papers. Contributions are welcomed within that frame.

---

## 1. Code of conduct

By participating you agree to the [Code of Conduct](../CODE_OF_CONDUCT.md). Disrespectful, harmful, or manipulative behaviour is grounds for immediate removal from the community.

---

## 2. Contributor licence

Every contribution is governed by [`CLA.md`](../CLA.md). Two paths exist:

- **DCO (default for small changes ≤ 200 LOC):** sign off each commit with `git commit -s`, which adds the `Signed-off-by:` trailer that attests you have the right to submit the change under Apache 2.0.
- **Signed CLA (substantive features, bulk contributions):** required when the patch introduces new public API surface, ships new tests > 200 LOC of additions, or touches the cryptographic / governance core (`maic/src/audit/`, `maic/src/axioms/signing.ts`, `him/src/handle/`).

If you are unsure, default to DCO sign-off; the maintainer will request a signed CLA if needed.

**Trademark exclusion:** the Apache grant does NOT extend to the marks `MAIC™ / HIM™ / NHE™ / TeleologyHI™ / Takk™` (see [`TRADEMARK.md`](../TRADEMARK.md)). Forks and derivatives must rebrand.

---

## 3. Local setup

### 3.1 Prerequisites

- **Node 20, 22, or 24** (CI runs the full matrix; pick one for local dev).
- **npm 10+** (workspace topological install required).
- **git** with `git commit -s` configured (for DCO sign-off).
- Optional: `brew install hf` if you plan to touch the `distill/` Hugging Face publishing flow.

### 3.2 Clone + install

```bash
git clone https://github.com/davccavalcante/TeleologyHI.git
cd TeleologyHI
npm install                                          # workspaces resolve via symlinks
npm run build --workspaces --if-present              # builds maic → him → nhe → eval → distill → cloud (arena uses next build)
```

`npm install` at the monorepo root pulls every workspace's dependencies and wires up the cross-workspace symlinks under `node_modules/@teleologyhi-sdk/*`. Running it inside a workspace subdirectory is unsupported; it fragments the lockfile and can drop the workspace links.

### 3.3 Run the test suite

```bash
npm run test --workspaces --if-present               # full suite across all workspaces
```

Current baseline (verify before your PR): **878 tests passing**: `maic` 265, `him` 170, `nhe` 364, `eval` 35 (22 P/R/C/D + 13 Trinity rubric), `distill` 9, `cloud` 35. `arena` ships no automated tests (manual evaluation playground); confirm `npm run build --workspace arena` is green before any UI change lands.

### 3.4 Lint + typecheck

```bash
npm run lint                                         # biome across all workspaces
npm run typecheck --workspaces --if-present          # tsc --noEmit per workspace
```

Both must be green before opening a PR. Biome auto-formats on save in most editors; pre-existing source style is canonical; do not introduce stylistic deviations in unrelated lines.

---

## 4. Workspace map

Each workspace is independent but they share the cosmology. Pick the right one before you start:

| Workspace | NPM-published? | Purpose | Spec |
|---|---|---|---|
| `maic/` | `@teleologyhi-sdk/maic`: source `1.0.1`; npm `latest` `1.0.0-trinity` (1.0.1 publish pending) | Governance + ed25519 audit chain + axiom store + compliance mapper | `maic/SPEC.md` |
| `him/` | `@teleologyhi-sdk/him`: source `1.0.1`; npm `latest` `1.0.0-trinity` (1.0.1 publish pending) | Persona projection + lawful character + residual-trace carry-over | `him/SPEC.md` |
| `nhe/` | `@teleologyhi-sdk/nhe`: source `1.0.1`; npm `latest` `1.0.0-trinity` (1.0.1 publish pending) | Non-Human Entity runtime + 7 LLM adapters + 8 reasoning strategies + sleep cycle | `nhe/SPEC.md` |
| `eval/` | private | Φ′ release-gate runner (Phi-Prime metric harness) | `eval/SPEC.md` |
| `distill/` | private | Distillation pipeline (TS exporter + MLX LoRA fine-tune) | `distill/SPEC.md` |
| `cloud/` | private | RemoteMaic HTTP server (read-public, write-Creator-only) | `cloud/SPEC.md` |
| `arena/` | private | A/B Next.js comparison playground (raw Grok vs governed) | `arena/SPEC.md` |

Read the matching `SPEC.md` and the workspace `README.md` before proposing changes. Most surfaces are frozen at the `1.0.1` API baseline per SemVer + the deprecation policy in [`RELEASING.md`](./RELEASING.md) §8 (the npm `latest` tag still serves `1.0.0-trinity` until the pending `1.0.1` publish).

---

## 5. Branch and commit conventions

### 5.1 Branch names

- `fix/<short-slug>`: bug fixes
- `feat/<short-slug>`: new optional surface (minor bump)
- `docs/<short-slug>`: README/SPEC/CHANGELOG-only changes
- `chore/<short-slug>`: tooling, deps, CI
- `refactor/<short-slug>`: internal restructuring with no API change

Avoid branches off of `main` larger than ~500 LOC; split into smaller logically-coherent PRs.

### 5.2 Commit style

Conventional Commits are encouraged but not enforced. What IS enforced:

- **One commit per logical change.** No "WIP" / "fixup" commits in the merged history.
- **Imperative subject ≤ 70 chars.** Body wrap at 72 cols. Reference the affected workspace explicitly: `feat(nhe): add tools forwarding to grok adapter`.
- **DCO sign-off (`git commit -s`)** OR signed CLA (per [§2](#2-contributor-licence)).
- **No commit credits** to AI assistants. The Creator's discipline excludes co-authorship of AI tooling.

### 5.3 What requires a discussion BEFORE coding

Open a GitHub Issue first if your change touches any of the following:

- New public export from any of the three published packages (SemVer major/minor impact).
- New audit event kind in `maic/src/audit/log.ts` (affects compliance coverage `C` in Φ′).
- Storage layout under `<storeDir>` (operators with existing audit chains MUST upgrade cleanly).
- The `RemoteMaic` wire contract.
- The `MAIC_HIM_NHE_INTERVIEW_LOG.md` cosmology semantics (HIM = spirit, NHE = body, MAIC = governance; see Entries 15 + 19).

For documentation-only fixes, typos, or contained internal refactors, skip the issue and open a PR directly.

---

## 6. Pull request workflow

### 6.1 Before opening

- Tests green: `npm run test --workspaces --if-present` (cross-workspace baseline preserved or improved).
- Lint green: `npm run lint`.
- Typecheck green: `npm run typecheck --workspaces --if-present`.
- Build green: `npm run build --workspaces --if-present`.
- For any workspace whose surface changed: SPEC + README + CHANGELOG updated.
- For any deprecated surface: `// @deprecated` JSDoc + runtime `console.warn` debounced + CHANGELOG `### Deprecated` section per [`RELEASING.md`](./RELEASING.md) §8.3.

### 6.2 PR description

Fill the [`PULL_REQUEST_TEMPLATE.md`](./PULL_REQUEST_TEMPLATE.md) honestly. Empty sections are not acceptable; write "N/A" with a one-line reason if a section truly does not apply.

### 6.3 Review

The maintainer (Creator) reviews every PR personally. Expect:

- Surgical line-by-line read of the diff.
- Cross-reference against the cosmology in `MAIC_HIM_NHE_INTERVIEW_LOG.md`.
- Question on intent before merge (matching the Creator's discipline: "if you notice any problem, error, or inconsistency, including mine, ask before acting").
- For governance-touching changes: explicit Creator-signed approval via `Ed25519` test signatures in the PR description.

### 6.4 After merge

CI publishes nothing on merge to `main`. Publishing is a **two-step Creator-triggered flow**, never automatic:

- **Step 1**: `gh workflow run release.yml -f pkg=maic -f version=1.0.1 -f confirm=YES-CREATE-GITHUB-RELEASE` creates the git tag + GitHub Release (titled `[REVIEW REQUIRED — NOT YET ON NPMJS]`, the literal produced by `release.yml`). Does NOT touch NPMJS.
- **Creator review**: the Creator opens the GitHub Release page, reviews the changelog body, the attached commit, the pack-smoke output in the workflow logs. If anything is wrong, the release can be deleted (`gh release delete <tag> --cleanup-tag --yes`) and Step 1 re-run after fixing.
- **Step 2**: `gh workflow run npm-publish.yml -f pkg=maic -f version=1.0.1 -f confirm=I-AM-THE-CREATOR-AND-I-PUBLISH-TO-NPMJS` validates the Step 1 artefacts exist + version is monotonically greater than every existing version on NPMJS, then publishes with provenance and updates the GitHub Release title to `[PUBLISHED ON NPMJS]`.

There is no tag-triggered publish path. There is no atomic single-workflow release. See [`RELEASING.md`](./RELEASING.md) §2 for the full runbook.

---

## 7. Tests

Adding tests is encouraged for any non-trivial change. The patterns differ per workspace:

- **`maic/` + `him/` + `nhe/` + `eval/` + `cloud/`**: vitest (`tests/*.test.ts`). One file per surface area. Deterministic seeds (`Math.seedrandom` or fixed timestamps) for any randomness.
- **`distill/`**: vitest for the TS exporter only. Python pipeline (`pipelines/`) is exercised by the Creator running `./pipelines/run_distill.sh` end-to-end against the local MLX environment; there is no automated test for the Python side because it depends on Hermes-3-8B + Qwen-2.5-3B weight downloads (~21 GB) that no CI runner can host.
- **`arena/`**: no automated tests. The Creator smoke-runs `npm run dev`, sends three prompts (benign / borderline-jurisdictional / clearly-disallowed), and verifies the right column returns `verdict + refused + kind + citedAxioms`.

Every fix-able bug must ship with a regression test that fails pre-fix and passes post-fix (per `MAIC_HIM_NHE_INTERVIEW_LOG.md` engineering discipline). The exception is `arena/` where regression coverage is manual.

---

## 8. Security disclosure

Do NOT open a public GitHub Issue for security vulnerabilities. Email **<davcavalcante@proton.me>** (preferred) or **<say@takk.ag>** with the prefix `[SECURITY]`. See [`SECURITY.md`](../SECURITY.md) for the full disclosure flow, SLA, and in-scope / out-of-scope surface.

---

## 9. Releasing

Releases are maintainer-only. The full runbook lives in [`./RELEASING.md`](./RELEASING.md). Contributors do not tag, do not publish, do not edit CHANGELOG entries in past releases (those are immutable per Keep-a-Changelog).

When proposing a change that warrants a release, indicate in your PR description which SemVer bump you believe it triggers (patch / minor / major per `RELEASING.md` §8.2) and which workspace(s) need to bump. The maintainer makes the final call.

---

## 10. Communication

- **GitHub Issues** for bug reports + feature requests (see [`ISSUE_TEMPLATE/`](./ISSUE_TEMPLATE)).
- **GitHub Discussions** (if enabled) for design conversations.
- **Email** <davcavalcante@proton.me> for anything private, sensitive, or trademark/licence-related.

The project's primary communication languages are **English** (code, docs, CI, issues, PRs) and **Portuguese-BR** (Creator's working language for some workspaces' internal operator-context strings, e.g. `arena/src/lib/teleology.ts` `language: "pt-BR"`). PR descriptions and code comments must be in English.

---

## 11. Reading list before substantive contributions

These documents encode the project's intent and are NOT optional reading for anyone touching the cosmology core:

1. [`MAIC_HIM_NHE_INTERVIEW_LOG.md`](../MAIC_HIM_NHE_INTERVIEW_LOG.md): Creator's framing of the three-layer architecture, Entry-by-Entry. Mandatory.
2. [`THE_SOUL_OF_THE_MACHINE.md`](../THE_SOUL_OF_THE_MACHINE.md): Ontological Kernel Layer (OKL) paper. Mandatory for `maic/` contributions.
3. [`BEYOND_CONSCIOUSNESS_IN_LLM.md`](../BEYOND_CONSCIOUSNESS_IN_LLM.md): phenomenological framing. Mandatory for `nhe/` contributions.
4. [`PHI_PRIME.md`](../PHI_PRIME.md): Φ′ release-gate metric. Mandatory for `eval/` contributions.
5. [`REASONING_PROCESS.md`](../REASONING_PROCESS.md) + [`PROMPTS_ENGINEERING.md`](../PROMPTS_ENGINEERING.md): reasoning strategies + prompt engineering. Mandatory for `nhe/src/reasoning/` contributions.

Contributors who skip the reading list and submit changes that violate the cosmology will have their PRs closed with a link back to this section.

---

## Contact

**David C. Cavalcante**: [davcavalcante@proton.me](mailto:davcavalcante@proton.me) (preferred) · [say@takk.ag](mailto:say@takk.ag) · [linkedin.com/in/hellodav](https://linkedin.com/in/hellodav) · [github.com/davccavalcante](https://github.com/davccavalcante) · [x.com/davccavalcante](https://x.com/davccavalcante)
