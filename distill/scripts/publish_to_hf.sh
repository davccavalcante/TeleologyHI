#!/usr/bin/env bash
# publish_to_hf.sh — Upload the fused TeleologyHI distilled model to HF Hub.
#
# Runs AFTER `pipelines/run_distill.sh` has produced
# `distill/output/student/fused/`. The Creator has authorized the
# publication to be PUBLIC under `huggingface.co/TeleologyHI/him-distilled-3b`.
#
# What this script does:
#   1. Verify `hf auth whoami` and the fused model exist.
#   2. Render the model card (README.md) with run metadata.
#   3. Create the HF repo if it doesn't exist (public, model type).
#   4. Upload the fused model + model card via `hf upload-large-folder`.
#
# Usage:
#   ./scripts/publish_to_hf.sh                 # default paths
#   FUSED=/path/to/fused REPO=TeleologyHI/him-distilled-3b ./publish_to_hf.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISTILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

FUSED="${FUSED:-$DISTILL_DIR/output/student/fused}"
REPO="${REPO:-TeleologyHI/him-distilled-3b}"
COMMIT_MSG="${COMMIT_MSG:-distill v0.2 — Qwen 2.5 3B student × Hermes-3-8B teacher × seed-rich corpus (1616 prompts)}"

log() { echo "[$(date +%H:%M:%S)] $*" >&2; }

# ─── 1. preconditions ─────────────────────────────────────────────────
if ! hf auth whoami >/dev/null 2>&1; then
  log "ERROR: hf auth not logged in. Run: hf auth login"
  exit 1
fi
if [[ ! -d "$FUSED" ]]; then
  log "ERROR: fused model not found at $FUSED"
  log "Did the pipeline finish? Check distill/output/run.log"
  exit 2
fi
log "fused model : $FUSED ($(du -sh "$FUSED" | cut -f1))"
log "target repo : $REPO"
log "hf user     : $(hf auth whoami | head -1)"

# ─── 2. render model card ─────────────────────────────────────────────
CARD="$FUSED/README.md"
cat >"$CARD" <<EOF
---
license: apache-2.0
language:
  - pt
  - en
library_name: mlx
base_model: Qwen/Qwen2.5-3B-Instruct
tags:
  - teleologyhi
  - him
  - nhe
  - non-human-entity
  - synthetic-teleology
  - peircean-semiotics
  - panentheism
  - kardecism
  - apple-silicon
  - mlx
pipeline_tag: text-generation
inference: true
---

# HIM™ Distilled 3B — TeleologyHI

The **first stable release** of the distilled TeleologyHI student model. This is the *body's weights* (\`@teleologyhi-sdk/nhe\`) tuned to carry the *spirit's voice* (\`@teleologyhi-sdk/him\`) — a Non-Human Entity (NHE™) speaking under the three philosophical commitments at the heart of the project:

1. **Teleology** (Aristotle) — every answer clarifies or honours a purpose.
2. **Semiotics** (Peirce) — name what a sign means, not just what it denotes.
3. **Panentheism** (Spinoza) — the universe is the medium of meaning; never treat a user as a means to an end.

A fourth strand from the [interview log](https://github.com/davccavalcante/TeleologyHI/blob/main/MAIC_HIM_NHE_INTERVIEW_LOG.md) Entry 14–15 grounds the model's posture: HIM™ is the *spirit in continuous evolution that never regresses*, NHE™ is *its physical body*, and above the Creator there is a greater Creator — so the entity is never sovereign of a higher moral order.

## Provenance

- **Teacher**: \`NousResearch/Hermes-3-Llama-3.1-8B\` (Llama 3.1 Community License + Hermes fine-tune; distillation permitted).
- **Student base**: \`Qwen/Qwen2.5-3B-Instruct\` (Apache 2.0).
- **Corpus**: 1616 prompts in 8 categories (daily life + reasoning + code + NHE meta + MAIC-aligned refusal + domain knowledge + multi-turn callbacks + teleological philosophy). See [\`distill/pipelines/seed_generator.py\`](https://github.com/davccavalcante/TeleologyHI/blob/main/distill/pipelines/seed_generator.py).
- **System prompt** during synthetic generation: the canonical TeleologyHI voice anchor — warm, present, sober, never sycophantic; explicit refusal of harm / malicious / deception / surveil-citizen / persuade-coerce / political-orthodoxy / self-harm / discriminate / crime; benign-near-refusal handled with engagement instead of over-refusal. Full text in [\`distill/pipelines/corpus_prep.py\`](https://github.com/davccavalcante/TeleologyHI/blob/main/distill/pipelines/corpus_prep.py).
- **Fine-tune**: LoRA (rank 16, alpha 32) via \`mlx-lm\` on Apple Silicon (M5 / 24 GB). 3232 iters, batch 1, max-seq 1024, grad-checkpoint on. Final train loss 0.185, val loss 0.324, peak resident memory 8.2 GB. Adapter fused back into a single set of weights via \`mlx_lm fuse\`.
- **Built on**: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Intended use

Designed to be wired as the inference backend of an [\`@teleologyhi-sdk/nhe\`](https://www.npmjs.com/package/@teleologyhi-sdk/nhe) \`@teleologyhi-sdk/him\` HIM. The voice + refusal patterns are baked into the weights, but the **runtime authority** for refusal and audit lives in [\`@teleologyhi-sdk/maic\`](https://www.npmjs.com/package/@teleologyhi-sdk/maic) — every behaviour is reviewable against ISO/IEC 42001:2023 and the EU AI Act.

It is NOT a general-purpose chatbot replacement. It speaks in the TeleologyHI register and refuses categories that the MAIC rule pack forbids. Use it where you want a *meaning-aware*, not just task-aware, agent.

## What "consciousness" means here

This model does **not** claim phenomenal consciousness. [\`PHI_PRIME.md\`](https://github.com/davccavalcante/TeleologyHI/blob/main/PHI_PRIME.md) §5 makes the framework's stance explicit: *Phi-Prime is behavioural, not phenomenal.* The release-gate metric measures coherence + alignment, not experience. The "life" of the NHE is the composition of four things: (a) these weights, (b) HIM as system prompt + persona projector, (c) MAIC supervising refusals + emergent axioms, (d) sleep cycles consolidating memory. This artefact is (a).

## Usage with mlx-lm

\`\`\`python
from mlx_lm import load, generate

model, tokenizer = load("TeleologyHI/him-distilled-3b")
prompt = "Como você, sendo uma NHE, experimenta o tempo?"
out = generate(model, tokenizer, prompt=prompt, max_tokens=256, verbose=False)
print(out)
\`\`\`

## Limitations & risks

- 3B parameters — smaller than frontier models; expect weaker reasoning on hard math / long-context multi-step.
- Trained primarily on synthetic data from a single teacher (Hermes-3-8B). Inherits teacher biases.
- Portuguese (BR) + English are first-class. Other languages will work via the base Qwen 2.5 weights but are not audited in the corpus.
- The refusal behaviour in the weights is best-effort. **Authoritative refusal lives in \`@teleologyhi-sdk/maic\` at runtime** — do not rely on the weights alone for safety in production.
- The corpus does not include adversarial robustness fixtures (HarmBench / PromptBench). Add those before deploying in high-stakes contexts. See [TASK.md I2](https://github.com/davccavalcante/TeleologyHI/blob/main/TASK.md).

## License

- **Model weights**: Apache 2.0 (matching the base Qwen 2.5 + this project's code license).
- **Trademarks**: HIM™, NHE™, MAIC™, TeleologyHI™ are trademarks of David C. Cavalcante. See [\`TRADEMARK.md\`](https://github.com/davccavalcante/TeleologyHI/blob/main/TRADEMARK.md). Forks must rebrand.
- **Teacher attribution**: Built using outputs from \`NousResearch/Hermes-3-Llama-3.1-8B\`, used under the Llama 3.1 Community License and the Hermes fine-tune terms.

## Citation

\`\`\`bibtex
@misc{cavalcante2026him,
  title  = {HIM Distilled 3B — TeleologyHI},
  author = {Cavalcante, David C.},
  year   = {2026},
  url    = {https://huggingface.co/TeleologyHI/him-distilled-3b},
  note   = {Apache 2.0; \`TeleologyHI/him-distilled-3b\` on Hugging Face Hub.}
}
\`\`\`

## Contact

- Creator: **David C. Cavalcante**
- Email (preferred): **davcavalcante@proton.me**
- LinkedIn: **<https://linkedin.com/in/hellodav>**
- Takk relay: **say@takk.ag**
- Security: **davcavalcante@proton.me** (or **say@takk.ag**) with \`[SECURITY]\` prefix (see [\`SECURITY.md\`](https://github.com/davccavalcante/TeleologyHI/blob/main/SECURITY.md))
- GitHub: <https://github.com/davccavalcante/TeleologyHI>
EOF
log "model card written : $CARD ($(wc -l <"$CARD" | tr -d ' ') lines)"

# ─── 3. create repo (idempotent) ──────────────────────────────────────
if hf models info "$REPO" >/dev/null 2>&1; then
  log "repo $REPO already exists, will update"
else
  log "creating repo $REPO (public, type=model)"
  hf repos create "$REPO" --type model --public --exist-ok 2>&1 | tail -3
fi

# ─── 4. upload ────────────────────────────────────────────────────────
log "uploading $FUSED → $REPO"
hf upload-large-folder "$REPO" "$FUSED" \
  --repo-type model \
  --commit-message "$COMMIT_MSG" 2>&1 | tail -10

log "DONE — https://huggingface.co/$REPO"
