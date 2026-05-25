# Releasing TeleologyHI

This document is the runbook for publishing `@teleologyhi-sdk/maic`, `@teleologyhi-sdk/him`, and `@teleologyhi-sdk/nhe` to **npm** and **GitHub**. Most of it is one-time setup. Routine releases collapse to "bump version, tag, push".

The **intended first published cut** is **`1.0.0-trinity`** for all three packages — this is the working example throughout the document. As of writing this runbook, the GitHub repository is initialised and the workflows below are validated end-to-end against the local workspaces, but the first `git push` and the first tag-driven `npm publish` are pending the Creator's explicit go-ahead. Once the first push lands, this section will be updated to "**The current published cut is `1.0.0-trinity`**".

Action IDs in brackets reference the project's internal backlog.

---

## 1. One-time prerequisites (Creator's actions)

These require credentials and cannot be performed from inside this repository.

### 1.1 Provision the npm scope

```bash
# In a browser, logged into the npm account that owns @teleologyhi-sdk:
#   https://www.npmjs.com/org/create
#   - Org name: teleologyhi-sdk
#   - Privacy: public
# Then verify locally:
npm whoami
npm org ls teleologyhi-sdk
```

### 1.2 Initialize git and push to GitHub

```bash
cd /path/to/TeleologyHI
git init -b main
git add .
git commit -m "Initial commit: MAIC + HIM + NHE trinity cut"

# Create the empty repo on GitHub first.
git remote add origin https://github.com/davccavalcante/TeleologyHI.git
git push -u origin main
```

### 1.3 Add the `NPM_TOKEN` secret to GitHub

The granular automation token has been issued on npm:
- Name: `teleologyhi-sdk-ci` (year-less so the convention survives rotation; track the active issuance date in the npm UI rather than in the token name)
- Scope: `@teleologyhi-sdk`
- Permissions: read and write
- Bypass two-factor authentication: enabled
- Expiration: 90 days from issuance — rotate before expiry

In the GitHub repo settings:
- Settings → Secrets and variables → Actions → New repository secret
- Name: `NPM_TOKEN`
- Value: the token issued at https://www.npmjs.com/settings/davcavalcante/tokens

Rotation flow when the token expires:
1. Issue a new token on npm with the same name, scope, and permissions.
2. Update the `NPM_TOKEN` GitHub secret with the new value.
3. Re-run any failed publish workflow.

### 1.4 Enable branch protection

Settings → Branches → Add branch protection rule for `main`:
- Require pull request before merging (1 approving review, dismiss stale reviews).
- Require status checks to pass: select `test (Node 20)`, `test (Node 22)`, `test (Node 24)`, and `lint / biome`.
- Require linear history.
- Require conversation resolution.
- Do not allow force pushes; do not allow deletions.

---

## 2. Routine release flow

The release pipeline is **two manual workflows** in sequence. There is no tag-triggered publish path and no atomic single-workflow release. The two-step separation is the Creator's binding directive (2026-05-25 revised): the GitHub-side artefact (tag + Release page) must be reviewable BEFORE any artefact propagates to the NPMJS registry, because once a package version is on npm it cannot be unpublished after the 72-hour window closes.

```
   ┌─────────────────────────────────────────────────────────────┐
   │  Step 1: release.yml  (Creator-triggered, GitHub only)      │
   │    confirm   = YES-CREATE-GITHUB-RELEASE                    │
   │    creates   : git tag <pkg>-v<version>                     │
   │                GitHub Release titled                        │
   │                "[REVIEW REQUIRED — NOT YET ON NPMJS] ..."   │
   │    no NPMJS publish                                         │
   └─────────────────────────────────────────────────────────────┘
                              │
                  Creator reviews the GitHub Release
                  (changelog body, tag, attached commit,
                  pack-smoke output in workflow logs)
                              │
   ┌─────────────────────────────────────────────────────────────┐
   │  Step 2: npm-publish.yml  (Creator-triggered after review)  │
   │    confirm   = I-AM-THE-CREATOR-AND-I-PUBLISH-TO-NPMJS      │
   │    validates : Step 1 tag + release exist                   │
   │                version matches <pkg>/package.json           │
   │                version is monotonically greater than every  │
   │                  existing version on NPMJS                  │
   │    publishes : npm publish --provenance                     │
   │    updates   : GitHub Release title → "[PUBLISHED ON NPMJS]"│
   └─────────────────────────────────────────────────────────────┘
```

### 2.1 Decide what to release

Pick a single package per release. Cross-package releases (e.g., MAIC + HIM in lockstep) ship as separate Step-1 + Step-2 pairs in dependency order: `maic → him → nhe`.

### 2.2 Bump and document

```bash
# Example: releasing @teleologyhi-sdk/maic@1.0.1

# 1. Bump the package version
cd maic
npm version 1.0.1 --no-git-tag-version
cd ..

# 2. Update CHANGELOG.md — prepend a new section for the version
$EDITOR maic/CHANGELOG.md

# 3. Commit + push to main (open PR if branch-protected)
git add maic/package.json maic/CHANGELOG.md
git commit -m "chore(maic): release 1.0.1"
git push
```

### 2.3 Run Step 1 — create the GitHub Release

The Creator triggers `release.yml` manually. The `confirm` input must be exactly `YES-CREATE-GITHUB-RELEASE`. This workflow does NOT touch NPMJS.

```bash
# CLI form (preferred for reproducibility)
gh workflow run release.yml \
  -f pkg=maic \
  -f version=1.0.1 \
  -f confirm=YES-CREATE-GITHUB-RELEASE
```

Equivalent UI flow: **Actions → release → Run workflow**, fill the three required inputs.

The workflow will, in order:
1. Refuse if `confirm` is not exactly `YES-CREATE-GITHUB-RELEASE`.
2. Verify the input version matches `<pkg>/package.json`.
3. Verify the git tag `<pkg>-v<version>` does not yet exist (no overwrites).
4. Verify `<pkg>/CHANGELOG.md` mentions this version.
5. Run full build + typecheck + cross-workspace test suite.
6. `npm pack --workspace @teleologyhi-sdk/<pkg> --dry-run` as a sanity check.
7. Create + push the git tag `<pkg>-v<version>`.
8. Create the GitHub Release with title prefixed `[REVIEW REQUIRED — NOT YET ON NPMJS]` and body extracted from `<pkg>/CHANGELOG.md` plus a status banner.

On success: the Creator visits the GitHub Release page, reviews the body, the attached commit, the `npm pack --dry-run` output in the workflow logs, and the test results. If anything is wrong, the Release can be deleted (with `gh release delete <tag> --cleanup-tag --yes`) and Step 1 re-run after fixing the inputs.

### 2.4 Run Step 2 — publish to NPMJS

After reviewing the GitHub Release from Step 1 and confirming everything is correct, the Creator triggers `npm-publish.yml`. The `confirm` input must be exactly `I-AM-THE-CREATOR-AND-I-PUBLISH-TO-NPMJS`.

```bash
# CLI form
gh workflow run npm-publish.yml \
  -f pkg=maic \
  -f version=1.0.1 \
  -f confirm=I-AM-THE-CREATOR-AND-I-PUBLISH-TO-NPMJS

# Optional explicit dist-tag (auto-routed when omitted)
gh workflow run npm-publish.yml \
  -f pkg=maic \
  -f version=1.0.0-trinity \
  -f dist_tag=trinity \
  -f confirm=I-AM-THE-CREATOR-AND-I-PUBLISH-TO-NPMJS
```

The workflow will, in order:
1. Refuse if `confirm` is not exactly `I-AM-THE-CREATOR-AND-I-PUBLISH-TO-NPMJS`.
2. Verify the git tag `<pkg>-v<version>` exists locally + on origin (Step 1 must have run).
3. Verify the GitHub Release `<pkg>-v<version>` exists.
4. Verify the input version matches `<pkg>/package.json`.
5. Verify the version is monotonically greater than every version on the registry (per-package, using `semver`). First-ever publishes skip this check.
6. Run full build + typecheck + cross-workspace test suite (re-built fresh, not reusing Step 1 artefacts).
7. `npm pack --workspace @teleologyhi-sdk/<pkg> --dry-run` as a final sanity check.
8. `npm publish --workspace @teleologyhi-sdk/<pkg> --access public --tag <dist_tag> --provenance`.
9. Update the GitHub Release title from `[REVIEW REQUIRED — NOT YET ON NPMJS]` to `[PUBLISHED ON NPMJS]` and prepend a published-state banner to the body.
10. Verify the published version is live on the npm registry (with retry, accounting for CDN propagation delay).

Dist-tag auto-routing: any prerelease qualifier routes to the matching channel — `*-alpha.*` → `alpha`, `*-beta.*` → `beta`, `*-rc.*` → `rc`, `*-trinity*` → `trinity`. A clean `X.Y.Z` without qualifier routes to `latest`.

### 2.4 Verify the release

```bash
# Cache may take ~1 min to update; the workflow itself retries.
npm view @teleologyhi-sdk/maic versions
npm view @teleologyhi-sdk/maic dist-tags
# Try installing into a temporary directory
mkdir /tmp/verify && cd /tmp/verify
npm init -y
npm install @teleologyhi-sdk/maic
```

The corresponding GitHub Release appears at https://github.com/davccavalcante/TeleologyHI/releases.

### 2.5 Version progression discipline

The Creator's binding rule (2026-05-25): no version skipping, no backwards versions, no deprecations.

- **Initial cut**: `@teleologyhi-sdk/{maic,him,nhe}@1.0.0-trinity` (prerelease qualifier `-trinity` routes to dist-tag `trinity`).
- **Patches within the trinity baseline**: `1.0.1`, `1.0.2`, ... (clean semver, route to `latest`).
- **Future trinity-baseline minors**: `1.1.0`, `1.2.0`, ... (additive feature releases).
- **Future major prereleases**: `2.0.0-trinity` (next trinity-marked major), then `2.0.1`, `2.0.2`, etc.

The monotonicity validation in `release.yml` enforces this: every version on the registry must be strictly less than the new version. Skipping (e.g., `1.0.0-trinity → 2.0.0` without going through `1.0.1, 1.1.0`) is permitted by semver but the Creator's discipline (documented in §8) prefers the contiguous progression for traceability.

The `distill`, `eval`, `cloud`, and `arena` workspaces are marked `"private": true` and stay inside the monorepo. See [§5](#5-other-workspaces-and-the-distilled-model-artefact).

---

## 3. Promoting a prerelease to `latest`

If a release is published under a non-`latest` dist-tag (for example `trinity`) and you later want it to become the default `npm install` result, use the manual `dist-tag` workflow:

```bash
gh workflow run dist-tag.yml \
  -f pkg=maic \
  -f version=1.0.0-trinity \
  -f dist_tag=latest
```

The workflow verifies the version exists on the registry, runs `npm dist-tag add`, and prints the resulting dist-tag table. No new artefact is published; only the dist-tag pointer moves.

The local equivalent (run by an authorised Creator):

```bash
npm dist-tag add @teleologyhi-sdk/maic@1.0.0-trinity latest
```

---

## 4. Emergency: unpublish or deprecate

npm allows unpublish only within 72 hours of publish for non-trivial usage. For older packages, use deprecation:

```bash
npm deprecate @teleologyhi-sdk/maic@1.0.0-trinity "Replaced by 1.0.1 — fixes audit-chain bug."
```

---

## 5. Other workspaces and the distilled model artefact

The npm publish flow above covers the three public packages (`maic`, `him`, `nhe`). The other four workspaces in the monorepo (`distill`, `eval`, `cloud`, `arena`) are all marked `"private": true` and are not consumed via `npm install` from the registry. Each has its own release surface, documented per workspace below.

### 5.1 Distillation pipeline — `distill/` (Hugging Face Hub)

The `distill/` workspace is `"private": true` and is **never published to npm**. It is the Creator's pipeline for producing a fine-tuned language model derived from a running TeleologyHI deployment. Only the model artefact (weights) is ever published — and it goes to **Hugging Face Hub**, not npm. The release tooling is **manual via the `hf` CLI** (installed locally with `brew install hf`); there is no GitHub Action for this path because Hugging Face's authentication model and the size of the artefact (≥6 GB) make local control preferable.

The flow:

1. Run the pipeline locally (see `distill/README.md` §"Run distillation in one shot").
2. Once the fused model is satisfactory, follow `distill/scripts/publish-artifact.md` to push to Hugging Face under `TeleologyHI/him-distilled-3b` (the intended first cut) via `./distill/scripts/publish_to_hf.sh`.
3. Record the release in `distill/CHANGELOG.md` with the eval scores (Φ′ + lm-eval + Inspect AI safety).
4. Optionally cut a monorepo-level tag like `distill-model-v1.0.0-trinity` for traceability — note this tag does NOT trigger any npm workflow (`publish.yml` deliberately only matches `maic-v*`, `him-v*`, `nhe-v*`).

Anyone (third parties) can clone the monorepo, run their own pipeline against their own NHE deployment, and publish their own fine-tuned model — but they must rebrand it. `TeleologyHI`, `MAIC`, `HIM`, `NHE`, and `Takk` are trademarks of David C. Cavalcante (see [`TRADEMARK.md`](../TRADEMARK.md)) and cannot be used for a third-party model.

### 5.2 RemoteMaic HTTP server — `cloud/` (Hostinger VPS, deploy `[planned]`)

The `cloud/` workspace ships the `RemoteMaic` HTTP server (`@teleologyhi-sdk/cloud@1.0.0-trinity`) and is `"private": true`. There is no npm publish flow planned for the immediate future — the Creator runs the canonical instance at `teleologyhi.com` (Hostinger VPS, Debian 12) per the runbook in `cloud/README.md` §"Hostinger deployment runbook". The runbook is bare-metal `systemd` + `nginx` + `certbot`; the workspace also ships `Dockerfile` + `docker-compose.yml` for operators who prefer container deployment.

Deploy on `teleologyhi.com` is tracked as an open backlog item — pending the Creator purchasing the domain and providing SSH credentials. A scaffold workflow lives at `.github/workflows/arena-deploy.yml` (placeholder — non-executable until SSH credentials land in repo secrets); the analogous `cloud-deploy.yml` will be added at deploy time.

### 5.3 A/B comparison playground — `arena/` (Debian 12 deploy `[planned]`)

The `arena/` workspace (`arena@1.0.0-trinity`) is a Next.js 16 evaluation playground and is `"private": true`. Today it runs locally via `npm run dev`. A hosted variant on `teleologyhi.com` is the Creator's chosen deploy target — the same Debian 12 VPS that hosts the cloud server. The scaffold workflow at `.github/workflows/arena-deploy.yml` defines the deploy contract (workflow_dispatch, build + rsync + restart) but is non-executable until SSH credentials are configured as repo secrets. Any future arena CI workflow lives adjacent to the existing release workflow but does NOT touch the npm registry.

### 5.4 Φ′ release-gate runner — `eval/` (internal, no publish)

The `eval/` workspace (`@teleologyhi-sdk/eval@1.0.0-trinity`) is `"private": true` and exists solely as the internal runtime for the Φ′ release gate. It is consumed via npm workspaces inside the monorepo (see `eval/README.md` §"Quick start"). Two runners ship: `runPhiPrime` (the original P/R/C/D scalar harness) and `runPhiPrimeTrinity` (the six-dimensional Trinity rubric harness, Creator-authored 2026-05-25). There is no NPMJS publish flow planned — the runner is a tool the Creator + CI workflows invoke locally, not a library third parties depend on. When the Φ′ gate is wired into `release.yml` as a blocking check (currently `[planned]`), the workflow will invoke the runner directly from `node eval/dist/cli.js`.

---

## 6. Operational notes

- **Provenance** is enabled (`--provenance`). Consumers can verify a release was built from the linked GitHub commit via `npm view <pkg> provenance` (npm ≥ 9.5).
- **Stability after `1.0`**: from the trinity cut onward every package follows strict SemVer + the deprecation policy in [§8](#8-stability-policy-from-100).
- **Workspaces internal deps**: sibling packages pin the exact `1.0.0-trinity` of their upstream (e.g. `him/package.json` pins `@teleologyhi-sdk/maic: "1.0.0-trinity"`). On a fresh `npm install`, npm workspaces resolve to local sources via the `node_modules/@teleologyhi-sdk/*` symlinks.
- **MCP SDK** and **@anthropic-ai/sdk** are real third-party deps. Dependabot opens weekly PRs every Monday at 09:00 Europe/Madrid; review and merge before tagging the next cut.
- **Provenance + private repos**: `id-token: write` is set in `publish.yml`. The GitHub repo must be public for the npm provenance attestation page to render publicly; private repos still get the attestation, just gated.
- **Operator infrastructure**: the recommended OS for Creator-operated infrastructure (e.g. the Hostinger VPS hosting `teleologyhi.com`) is **Debian 12**. GitHub-hosted runners use `ubuntu-latest` because Debian is not offered as a hosted runner image; switching to Debian would require self-hosted runners.

---

## 7. Quick reference

| Action | Command |
|---|---|
| Run all tests locally | `npm run test --workspaces --if-present` |
| Build everything | `npm run build --workspaces --if-present` |
| Typecheck | `npm run typecheck --workspaces --if-present` |
| Pack smoke (no publish) | `npm pack --workspace @teleologyhi-sdk/<pkg> --dry-run` |
| Manual publish (DO NOT use; let `npm-publish.yml` do it) | `npm publish --workspace @teleologyhi-sdk/<pkg> --access public --tag latest` |
| **Step 1** — create GitHub Release | `gh workflow run release.yml -f pkg=<pkg> -f version=<semver> -f confirm=YES-CREATE-GITHUB-RELEASE` |
| **Step 2** — publish to NPMJS (after Step 1 review) | `gh workflow run npm-publish.yml -f pkg=<pkg> -f version=<semver> -f confirm=I-AM-THE-CREATOR-AND-I-PUBLISH-TO-NPMJS` |
| Promote a published version to `latest` | `gh workflow run dist-tag.yml -f pkg=<pkg> -f version=<semver> -f dist_tag=latest` |
| Run housekeeping (delete failed runs + stale PRs) | `gh workflow run housekeeping.yml -f confirm=YES-CLEAN-PUBLIC-VISIBLE-ERRORS` |
| **Rollback** — delete a bad GitHub Release + its tag (before Step 2) | `gh workflow run rollback.yml -f operation=delete-github-release-with-tag -f target=<pkg>-v<semver> -f confirm=YES-DELETE-RELEASE-AND-TAG -f reason="<short reason>"` |
| **Rollback** — delete an orphan tag (no release attached) | `gh workflow run rollback.yml -f operation=delete-tag-only -f target=<pkg>-v<semver> -f confirm=YES-DELETE-TAG-ONLY -f reason="<short reason>"` |
| **Rollback** — revert a commit in main via PR (no force-push) | `gh workflow run rollback.yml -f operation=revert-commit-via-pr -f target=<commit-sha> -f confirm=YES-CREATE-REVERT-PR -f reason="<short reason>"` |

---

## 8. Stability policy (from `1.0.0-trinity` onward)

Every package follows strict [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) starting at `1.0.0-trinity`. This section is the binding contract between TeleologyHI maintainers and consumers.

### 8.1 What counts as the public API

For every package (`@teleologyhi-sdk/maic`, `@teleologyhi-sdk/him`, `@teleologyhi-sdk/nhe`):

- Every name **exported from the package entry point** (`./dist/index.{js,cjs,d.ts}`).
- Every type, interface, class shape, function signature, and discriminated-union variant reachable from those exports.
- The **wire contract** of `RemoteMaic` (HTTP endpoints, request/response JSON shapes, auth headers).
- The **on-disk storage layout** under `<storeDir>` (file paths, JSON/NDJSON/YAML schemas) — operators with existing audit chains MUST be able to upgrade without rewriting their data.
- The **CLI** flags and subcommands of `npx @teleologyhi-sdk/nhe`.
- The **MCP tools** exposed by NHE (tool names and schemas).

Not part of the public API: anything inside `src/` that is not re-exported from `index.ts`, the format of debug logs, and the contents of audit-event `data` fields whose key is not in the documented type definitions.

### 8.2 SemVer rules in practice

| Change kind | Bump |
|---|---|
| Bug fix, internal refactor, dependency patch | **patch** (`1.0.0-trinity` → `1.0.1`) |
| New export, new optional field, new audit-event kind that is mapped under compliance | **minor** (`1.0.0-trinity` → `1.1.0`) |
| Renaming/removing an export, changing a function signature, changing storage layout, breaking the `RemoteMaic` wire contract, removing a CLI flag, removing an MCP tool | **major** (`1.0.0-trinity` → `2.0.0`) |

### 8.3 Deprecation policy

Removing or breaking a public API is permitted **only** after a deprecation cycle:

1. **Announce** the deprecation in a **minor** release of the current major:
   - Add a `// @deprecated <message>` JSDoc tag on the export so TypeScript surfaces a strike-through in editor tooltips.
   - Emit a runtime `console.warn` the first time the deprecated path is hit per process (debouncing handled by the package).
   - Add a `### Deprecated` subsection in the CHANGELOG entry, naming the replacement.
2. **Continue shipping** the deprecated API for **at least one further minor** release of the same major. Consumers MUST have a non-deprecated path available the entire time.
3. **Remove** the deprecated API only in the next **major** release. The CHANGELOG for the major must include a `### Removed` subsection listing every removal with a migration recipe.

Two minors of soak time between deprecation and removal is the floor; longer is welcomed for high-impact APIs.

### 8.4 Migration guides

Every major release ships a `MIGRATING.md` in the package root summarising:
- Every removed export and its replacement.
- Every signature change (before → after, ideally with a `codemod` if possible).
- Every storage-layout change and the upgrade procedure.

Operators can read `MIGRATING.md` and complete the upgrade without consulting source-level diffs.

### 8.5 Security exceptions

When a security advisory requires an immediate breaking change (e.g. removing a function that bypasses signature verification, tightening a default that was permissive), the change ships in the next **patch** release across **all supported majors** and is documented in the CHANGELOG as `### Security`. See [`SECURITY.md`](../SECURITY.md) for the disclosure flow. These exceptions do NOT skip CHANGELOG entries.

### 8.6 Prerelease channels

Prerelease qualifiers — `*-trinity`, `*-alpha.N`, `*-beta.N`, `*-rc.N` — are published under the matching dist-tag (`trinity`, `alpha`, `beta`, `rc`) and never to `latest` automatically. Consumers must opt in with `@trinity` / `@alpha` / `@beta` / `@rc`. Promotion to `latest` is done explicitly via the manual `dist-tag` workflow (§3).

### 8.7 Trademark and license invariants

These never change inside a single major:
- Code license stays Apache 2.0.
- `TRADEMARK.md` policy applies regardless of version.
- The `NOTICE` file is preserved verbatim in the tarball.

---

## 9. Rollback boundaries

This section documents the boundaries of what can be rolled back at each stage of the release flow. The Creator's binding rule (2026-05-25): "no NPMJS publishes with errors that would require deprecation". The rollback surface is intentionally rich BEFORE Step 2 (NPMJS publish) and intentionally narrow AFTER.

### 9.1 Stage 1 — Before Step 1 (release.yml) runs

Nothing has been created yet. Standard local rollback applies: `git reset --hard`, force-push to a branch other than `main` (branch protection prevents force-push to `main`), open a fresh PR with the correct content. No special workflow needed.

### 9.2 Stage 2 — After Step 1 runs, before Step 2 (npm-publish.yml) runs

The git tag and GitHub Release exist. NPMJS has NOT been touched. **This is the safest moment to roll back.** The `rollback.yml` workflow covers the destructive recovery paths:

| Symptom | Operation | Command |
|---|---|---|
| Release notes have a typo; commit + CHANGELOG fix; want to re-run Step 1 | `delete-github-release-with-tag` | `gh workflow run rollback.yml -f operation=delete-github-release-with-tag -f target=<pkg>-v<version> -f confirm=YES-DELETE-RELEASE-AND-TAG -f reason="<short reason>"` |
| The release should not have been created at all (wrong package, wrong version) | `delete-github-release-with-tag` | (same as above) |
| A tag was created without a matching release (rare; should not happen via release.yml) | `delete-tag-only` | `gh workflow run rollback.yml -f operation=delete-tag-only -f target=<pkg>-v<version> -f confirm=YES-DELETE-TAG-ONLY -f reason="<short reason>"` |

After `rollback.yml` cleans up, the Creator can edit the offending CHANGELOG/package.json/source content, commit + push, and re-run Step 1 with the same version (or a new version if the original is now poisoned).

### 9.3 Stage 3 — After Step 2 (npm-publish.yml) runs, within 72 hours

The package version is on the NPMJS registry. NPMJS allows `npm unpublish` only within 72 hours of publish AND only when the version has not been depended on by other packages. **Unpublish is strongly discouraged** — it is a footgun that breaks downstream consumers and signals instability.

Recommended recovery paths in this window, in order of preference:

1. **Publish a patch fix.** Increment the version (e.g. `1.0.1` → `1.0.2`) with the corrected code, run Step 1 → Step 2 for the patch. Consumers who upgrade get the fix; the broken version stays on the registry as a historical record but is not the `latest`.
2. **Re-route dist-tag away from the broken version.** Use `dist-tag.yml` to point `latest` (or the relevant channel) at a known-good earlier version while the patch is prepared:
   ```bash
   gh workflow run dist-tag.yml -f pkg=<pkg> -f version=<known-good-version> -f dist_tag=latest
   ```
3. **`npm unpublish` (emergency only).** Only used when (a) the broken version contains a real security vulnerability AND (b) <72 h have passed AND (c) the version has had no observable downstream installs. There is no workflow for this — it must be run by the Creator manually with `npm unpublish @teleologyhi-sdk/<pkg>@<version>` and accompanied by a SECURITY advisory entry in the next patch CHANGELOG.

### 9.4 Stage 4 — After Step 2 runs, more than 72 hours later

`npm unpublish` is no longer permitted. The only remaining tools are:

1. **`npm deprecate`** — the deprecated mark surfaces a warning in consumer terminals. This is what the Creator's discipline ("no deprecations") aims to AVOID — the two-step release flow exists precisely to make this stage unreachable in practice.
2. **`dist-tag.yml`** — re-route `latest` away from the broken version so new installs do not pick it up by default. The version remains visible in `npm view <pkg> versions` but is no longer the default install target.
3. **Publish a patch.** Same as Stage 3 path 1; the patch supersedes the broken version for new installs even if old installs persist.

### 9.5 Commit history rollback (any stage)

The `rollback.yml` workflow's `revert-commit-via-pr` operation creates a PR whose contents are the inverse of an offending commit. Merging that PR via the normal review flow reverts the change without rewriting history (no force-push to `main`).

```bash
gh workflow run rollback.yml \
  -f operation=revert-commit-via-pr \
  -f target=<commit-sha> \
  -f confirm=YES-CREATE-REVERT-PR \
  -f reason="<short reason for the revert>"
```

The workflow detects merge commits and reverts against parent 1 automatically. Force-pushing to `main` to rewrite history is NEVER done by `rollback.yml` because branch protection forbids it and because rewriting public history breaks downstream clones.

### 9.6 What `rollback.yml` does NOT do

- **Touch the NPMJS registry.** All NPMJS rollback paths are manual (per §9.3 + §9.4). The workflow stays GitHub-side.
- **Force-push the `main` branch.** Branch protection forbids it; `revert-commit-via-pr` is the safe alternative.
- **Delete commits from feature branches.** Use `git push --delete origin <branch>` from a local terminal.
- **Delete workflow runs.** That is `housekeeping.yml`'s responsibility.

### 9.7 Summary of the rollback budget per stage

| Stage | Tags / Releases | Commits in main | NPMJS publish |
|---|---|---|---|
| Before Step 1 | n/a (nothing created) | local `git reset --hard` + force-push to branch | n/a |
| After Step 1, before Step 2 | `rollback.yml` deletes both | `revert-commit-via-pr` | n/a |
| After Step 2, < 72 h | `rollback.yml` deletes both | `revert-commit-via-pr` | publish patch (preferred) / `dist-tag.yml` re-route / emergency `npm unpublish` |
| After Step 2, > 72 h | `rollback.yml` deletes both (but NPMJS already has the version) | `revert-commit-via-pr` | publish patch / `dist-tag.yml` re-route / `npm deprecate` (last resort) |
