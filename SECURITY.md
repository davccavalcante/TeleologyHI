# Security Policy

The TeleologyHI project (`@teleologyhi-sdk/maic`, `@teleologyhi-sdk/him`, `@teleologyhi-sdk/nhe`)
is alpha software intended for general public use. We take security reports
seriously and aim to acknowledge each one within two business days.

## Supported versions

From 2026-05-17 each published package follows strict SemVer (see [`.github/RELEASING.md`](.github/RELEASING.md) §8). Only the latest minor of the current major is supported with security patches; older majors receive critical-CVE fixes for 6 months after the next major lands.

| Package | Supported |
|---|---|
| `@teleologyhi-sdk/maic` | current `latest` dist-tag |
| `@teleologyhi-sdk/him`  | current `latest` dist-tag |
| `@teleologyhi-sdk/nhe`  | current `latest` dist-tag |

Workspaces marked `private: true` (`distill`, `eval`, `cloud`) are not published to npm and do not have a public security-support window; they are Creator-operated. Vulnerabilities found in them are still in scope of this policy when they affect the canonical Creator deployment.

## Reporting a vulnerability

**Please do not file public GitHub issues for security problems.** Send
reports to **davcavalcante@proton.me** (Creator, preferred) or
**say@takk.ag** (Takk relay), with the subject line beginning
`[SECURITY]`.

Include, at minimum:
- Affected package and version (`npm ls @teleologyhi-sdk/...`)
- Reproduction steps or a minimal proof-of-concept
- Impact assessment (what an attacker can achieve)
- Any suggested mitigation

If your report involves a vulnerability in a third-party dependency, please
also link the upstream advisory (CVE, GHSA, RustSec, etc.) so we can
coordinate the disclosure.

PGP / signed reports are welcome but not required. If you need an
out-of-band channel, ask in the first message and we will propose one.

## Response process

1. Acknowledgement within **2 business days**.
2. Triage + severity assignment within **7 days**.
3. Fix targeted for the next alpha release; critical issues ship as an
   out-of-band patch on the affected minor.
4. Coordinated disclosure: the reporter is credited in the changelog and
   advisory unless they request anonymity.

## Threat model in scope

Findings in any of the following are in scope:

- **Cryptographic invariants of MAIC**: forging a `CreatorSignature`,
  replaying a previously valid signed payload, bypassing the SHA-256 hash
  chain of `AuditLog`, defeating the Ed25519 verification path, or making
  `ProposalStore.markRatified` / `HimStore.reincarnate` accept an unsigned
  or attacker-signed request.
- **Sealed HIM invariants**: minting a `HimHandle` without a Creator
  signature; mutating `axiomsSnapshot` after registration; bypassing the
  emergent-axiom ratification channel.
- **Audit integrity**: writing a forged `AuditEvent` that
  `AuditLog.verify()` accepts, or causing `query()` to omit events that
  exist on disk.
- **Refusal pipeline circumvention**: prompts that route an
  `escalate-creator` / `hard-refuse` verdict to a non-refused
  `RespondOutput.kind`; prompt-injection that flips a `terminated` NHE
  back to `active`.
- **MCP server**: tool-call inputs that escape NHE's policy boundary or
  cause the server to exfiltrate state across NHE instances.
- **Storage**: path traversal in any `storeDir`-rooted write (axioms,
  proposals, HIM records, sleep YAMLs, temporal-lobe memories,
  interactions).
- **Supply chain**: tarball contamination, compromised npm scope,
  unverified provenance.

## Out of scope

- The Creator's private-key custody (the operator's responsibility — see
  `maic/SPEC.md` §11.2; future iterations may integrate HSM/YubiKey).
- LLM output quality, hallucination, jailbreak prompts against
  third-party adapters whose policies the NHE simply forwards through.
- Theoretical attacks against the cryptographic primitives themselves
  (Ed25519, SHA-256) — please report those to upstream.
- Denial of service via unbounded inputs against a self-hosted MAIC; rate
  limiting is the operator's responsibility.

## Trademarks

The names **MAIC™**, **HIM™**, **NHE™**, **TeleologyHI™**, and **Takk™**
are trademarks of David C. Cavalcante and are governed separately from
the Apache 2.0 code license. See [`TRADEMARK.md`](./TRADEMARK.md).
