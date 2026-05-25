<!--
Thank you for the PR. Please fill EVERY section honestly. Empty sections are
not acceptable — write "N/A" with a one-line reason if a section truly does
not apply. The maintainer reads every PR line-by-line; complete context is
faster for everyone than back-and-forth questions.

Read .github/CONTRIBUTING.md before opening this PR if you haven't yet.
-->

## Summary

<!-- One paragraph: what does this PR do and why? Avoid restating the diff;
state the *intent*. -->

## Affected workspaces

<!-- Tick every workspace touched. -->

- [ ] `maic/` (@teleologyhi-sdk/maic)
- [ ] `him/` (@teleologyhi-sdk/him)
- [ ] `nhe/` (@teleologyhi-sdk/nhe)
- [ ] `eval/` (@teleologyhi-sdk/eval — private)
- [ ] `distill/` (private)
- [ ] `cloud/` (@teleologyhi-sdk/cloud — private)
- [ ] `arena/` (private)
- [ ] `.github/` (CI/CD + meta)
- [ ] root docs (README, SPEC, TASK, etc.)

## What changed per workspace

<!-- For each affected workspace, summarise the change in 1–3 bullets. Include
the file paths and one-line rationale. -->

### `<workspace>/`

- `<file>` — <change + rationale>

## SemVer impact

<!-- Per RELEASING.md §8.2. Tick the highest applicable level per workspace. -->

- [ ] No published-package impact (private workspace or docs-only)
- [ ] Patch — bug fix, internal refactor, dependency patch
- [ ] Minor — new export, new optional field, new audit-event kind (mapped under compliance)
- [ ] Major — renaming/removing an export, changing a function signature, changing storage layout, breaking the RemoteMaic wire contract, removing a CLI flag, removing an MCP tool

If Major: include a `MIGRATING.md` update in the affected workspace and explain the migration path in the description below.

## Test plan

<!-- Demonstrate the change works. Cover both "what now passes that did not
before" and "what continues to pass that should". -->

### Cross-workspace test status

<!-- Run `npm run test --workspaces --if-present` and report the per-workspace
counts. Baseline before this PR is 749 passing; report any delta and explain. -->

- `maic`: <X> / <Y> passing
- `him`: <X> / <Y> passing
- `nhe`: <X> / <Y> passing
- `eval`: <X> / <Y> passing
- `distill`: <X> / <Y> passing
- `cloud`: <X> / <Y> passing
- `arena`: build status (`npm run build --workspace arena`)

### New tests

<!-- For any fix-able bug or new optional surface, list the regression test(s)
added. Tests must fail pre-fix and pass post-fix per CONTRIBUTING §7. -->

- `<workspace>/tests/<file>.test.ts` — `<test name>`: <what it asserts>

## Documentation

<!-- Tick every doc updated. -->

- [ ] `<workspace>/README.md`
- [ ] `<workspace>/SPEC.md`
- [ ] `<workspace>/CHANGELOG.md` (new section — DO NOT edit historical entries)
- [ ] Root `README.md` / `SYSTEM_OVERVIEW.md`
- [ ] `.github/RELEASING.md` (if release flow changed)
- [ ] N/A — docs-only PR / internal refactor / no public surface change

## Backlog cross-reference

<!-- If this PR closes or advances a tracked backlog item, name the ID(s) where applicable. -->

Closes backlog item <ID, e.g. D-N9, F3>.
Advances backlog item <ID>.

## Cosmology + interview-log invariants

<!-- Confirm the PR respects the cosmology. Untick + explain only if the PR
intentionally proposes evolving an invariant (and link the discussion issue). -->

- [ ] Reviewed [`MAIC_HIM_NHE_INTERVIEW_LOG.md`](../MAIC_HIM_NHE_INTERVIEW_LOG.md) Entries relevant to the affected surface.
- [ ] HIM remains the spirit (continuous evolution, never regresses — Entry 15).
- [ ] NHE remains the body (the physical/computational instantiation — Entry 15).
- [ ] MAIC remains the governance (read-public, write-Creator-only — Entry 5).
- [ ] Ed25519 invariants intact (no write API bypasses Creator signature).
- [ ] No new persuasion technique leaks into a user-facing output (axiom + behavior-review pipeline still gates).

## Licence + contributor agreement

- [ ] DCO sign-off on every commit (`git commit -s`), OR signed CLA on file (per [`CLA.md`](../CLA.md) + [`CONTRIBUTING.md`](./CONTRIBUTING.md) §2).
- [ ] No commit credits to AI assistants (Creator discipline — see CONTRIBUTING §5.2).
- [ ] If the PR introduces new third-party deps: licences compatible with Apache 2.0 verified.
- [ ] If the PR uses trademark surface (`MAIC™ / HIM™ / NHE™ / TeleologyHI™ / Takk™`): consistent with [`TRADEMARK.md`](../TRADEMARK.md).

## Anything else

<!-- Screenshots, design rationale, follow-up PR plans, anything the
maintainer should know. -->
