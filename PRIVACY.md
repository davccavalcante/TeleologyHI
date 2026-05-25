# Privacy Notice — TeleologyHI

This notice describes what data the TeleologyHI runtime collects when an
operator deploys `@teleologyhi-sdk/maic`, `@teleologyhi-sdk/him`, and
`@teleologyhi-sdk/nhe` in their own infrastructure. It is **the
operator's responsibility** to surface a privacy notice to their own
end users — the TeleologyHI runtime ships with no central data
collection.

Last updated: **2026-05-16**.

---

## 1. What TeleologyHI is, and isn't

TeleologyHI is a set of npm packages an operator installs and runs in
their own environment. The Creator (David C. Cavalcante) does not host
any service, does not see user prompts, does not see audit logs, and
does not collect telemetry. There is **no TeleologyHI cloud** at the
time of this writing — the future `teleologyhi.com` infrastructure
(internal backlog item F3) will be subject to its own separate privacy notice when it
launches.

---

## 2. Data the runtime processes (operator-side)

When an operator runs the runtime, the following data flows through it
and is **stored in the operator's `storeDir`**:

### 2.1 User prompts (`<storeDir>/interactions/<ulid>.json`)

Persisted to disk by `Nhe.respond` (D-N4).
Each interaction record contains:

```json
{
  "at": "2026-05-16T10:00:00.000Z",
  "userPrompt": "<the user's input verbatim>",
  "responseText": "<the assistant's reply verbatim>",
  "refused": false
}
```

**Implication:** if the user typed personally identifying information
(PII) into the prompt, it is on disk. Operators handling regulated data
SHOULD: (a) hash or redact the `userPrompt` field before persistence by
wrapping `recordInteraction` with a redaction layer, or (b) configure
`recentInteractionsBufferSize: 0` to disable persistence entirely (the
NHE will still function but will not "remember" across restarts).

### 2.2 Behavior reports (`<storeDir>/audit/log.ndjson`)

Every `Nhe.respond` call appends a `behavior-review` audit event with
the prompt + MAIC verdict + cited axioms. The hash chain forbids
in-place edits — see `E3` retention policy in
the internal decisions document for the lifecycle (5-year default for behavior
events).

**Implication:** the same redaction options apply. The
`evaluateRetention` helper in `@teleologyhi-sdk/maic` classifies
events whose age exceeds the policy as candidates for cold-storage.

### 2.3 Sleep YAMLs (`<storeDir>/in-dreams/sleep/*.yaml`)

Each sleep cycle persists a YAML record containing the N1 fragments
(distilled from recent interactions) and the REM narratives. Fragments
inherit whatever was in the original prompts.

### 2.4 Temporal-lobe memories (`<storeDir>/in-dreams/brain/temporal-lobe-*.md`)

Consolidated dreams that pass the `lasting-identity` /
`temporary-emotion` thresholds are written here. The
`traumatic-knowledge` class (D-N2) is
persisted but **excluded from default recall** to avoid surfacing
distressing content in normal interaction.

### 2.5 HIM records (`<storeDir>/hims/<himId>/`)

Birth signature + axiom snapshot + body history. Contains no user PII
unless the operator stuffed it into the `himId` or `notes` field.

### 2.6 LLM provider traffic

When the NHE calls an `LlmAdapter` (Anthropic, Gemini, Ollama, DeepSeek,
Mistral, Grok), the prompt + system text traverses **the provider's**
infrastructure. The TeleologyHI runtime never sees that traffic except
as the response. **Each provider has its own data-handling policy** —
the operator must read and comply with it independently:

| Provider | Data-handling policy |
|---|---|
| Anthropic | <https://www.anthropic.com/legal> |
| Google (Gemini) | <https://ai.google.dev/terms> |
| Mistral | <https://mistral.ai/terms/> |
| DeepSeek | <https://www.deepseek.com/en-US/privacy> |
| xAI (Grok) | <https://x.ai/legal> |
| Ollama (local) | No traffic leaves the host. |

---

## 3. Data the runtime does NOT collect

- **No telemetry to David C. Cavalcante.** The runtime makes zero
  outbound network calls to the Creator's infrastructure.
- **No analytics.** No usage statistics, no error reporting, no
  fingerprinting.
- **No third-party SDK that phones home.** The npm dependencies are
  inspectable in [`package.json`](./package.json) of each workspace.
  Audit them with `npm ls --all`.

---

## 4. GDPR + LGPD posture

Operators in scope of **GDPR** (EU residents' data) or **LGPD**
(Brazilian residents' data) — see the `LawfulCharacterProfile` for
`eu` and `br` in `@teleologyhi-sdk/him` for the framework-aware refusal
configuration — must treat the per-`storeDir` data as **personal data
under their control**. The runtime supports the operator's compliance
posture by:

- **Minimisation**: only `userPrompt`, `responseText`, and `refused`
  are persisted in the interaction record. No browser fingerprint, no
  IP, no device id.
- **Right to erasure (GDPR Art. 17 / LGPD Art. 18 IV)**: operators
  delete the relevant `<storeDir>/interactions/<ulid>.json` files. The
  hash chain in `audit/log.ndjson` is **append-only** by design — to
  honour an erasure request that intersects the audit log, the operator
  rotates the chain (a planned operation; see internal backlog item E3 follow-up) and
  retains the integrity anchor.
- **Portability (GDPR Art. 20)**: the JSON / YAML / NDJSON storage
  layout is portable by construction.
- **Lawful basis logging**: the operator's `LawfulCharacterProfile`
  citation is recorded in every `behavior-review` audit event under
  `data.jurisdiction`.

The runtime does NOT, on its own, make the operator GDPR/LGPD
compliant. It provides primitives that an operator can use to build
compliance.

---

## 5. Security disclosure

See [`SECURITY.md`](./SECURITY.md) for vulnerability reports and the
threat model. The Creator can be reached at **davcavalcante@proton.me**
(preferred) or **say@takk.ag** (Takk relay).

---

## 6. Children

The TeleologyHI runtime has **no safeguards against use with children
under 13** out of the box. Operators planning a child-facing deployment
must layer COPPA/GDPR-K-specific safeguards (age gates, parental
consent flows, restricted refusal pipelines) on top of the runtime
themselves.

---

## 7. Changes to this notice

This file is versioned in git alongside the code. Material changes will
be announced in `CHANGELOG.md` of the affected package(s) and in the
next release notes on GitHub.

---

## 8. Contact

- General (Creator): **davcavalcante@proton.me**
- LinkedIn: **<https://linkedin.com/in/hellodav>**
- Takk relay: **say@takk.ag**
- Security: **davcavalcante@proton.me** (or **say@takk.ag**) with `[SECURITY]` prefix (see [`SECURITY.md`](./SECURITY.md))
- Trademark: see [`TRADEMARK.md`](./TRADEMARK.md)
