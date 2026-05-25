#!/usr/bin/env bash
# publish_trinity.sh — Upload the Trinity fused model to Hugging Face Hub.
#
# This is the sibling of `publish_to_hf.sh`, scoped specifically to the
# canonical TeleologyHI Trinity build (TeleologyHI/Trinity, 1.0.0-trinity).
# The Creator (David C. Cavalcante) declared on 2026-05-25 that Trinity is
# the new official LLM and that `TeleologyHI/him-distilled-3b` becomes the
# preview tier preserved as a historical record.
#
# What this script does:
#   1. Verify `hf auth whoami` and the fused Trinity model exist locally.
#   2. Render the Trinity model card from the template at
#      `serving/trinity-model-card.md`, substituting run metadata.
#   3. Create the HF repo `TeleologyHI/Trinity` if missing (public, model).
#   4. Upload via `hf upload-large-folder`.
#   5. Mark the preview repo `TeleologyHI/him-distilled-3b` as deprecated
#      by patching a banner into its README (idempotent — re-running this
#      script keeps the banner correct, never duplicates it).
#
# Required env (defaults shown):
#   FUSED                 distill/output/student/fused
#   REPO                  TeleologyHI/Trinity
#   PREVIEW_REPO          TeleologyHI/him-distilled-3b
#   TEMPLATE              distill/serving/trinity-model-card.md
#   TRINITY_TEACHER       NousResearch/Hermes-3-Llama-3.1-8B
#   TRINITY_STUDENT       Qwen/Qwen2.5-3B-Instruct
#   TRINITY_RANK          16
#   TRINITY_ALPHA         32
#   TRINITY_ITERS         3232
#   TRINITY_BATCH         1
#   TRINITY_SEQ           1024
#   TRINITY_GRAD_CHECKPOINT  on
#   TRINITY_TRAIN_LOSS    (required at publish time — read from MLflow run)
#   TRINITY_VAL_LOSS      (required at publish time — read from MLflow run)
#   TRINITY_PEAK_MEM      (e.g. "8.2 GB")
#   TRINITY_PHI_PRIME     (required — read from `@teleologyhi-sdk/eval`)
#   TRINITY_PHI_THRESHOLD (e.g. "0.80")
#   TRINITY_MLFLOW_RUN_ID (the MLflow run id that produced this artefact)
#   TRINITY_MLFLOW_URI    (e.g. "file:./mlruns" or remote URL)
#   TRINITY_CORPUS_SAMPLES (e.g. "1616")
#   TRINITY_PROMPT_SHA    (sha256 of the canonical system prompt — auto
#                          computed if unset)
#
# Usage:
#   # Dry-run (renders card, never touches Hub)
#   DRY_RUN=1 ./scripts/publish_trinity.sh
#
#   # Real publish
#   TRINITY_TRAIN_LOSS=0.185 TRINITY_VAL_LOSS=0.324 \
#     TRINITY_PHI_PRIME=0.86 TRINITY_PHI_THRESHOLD=0.80 \
#     TRINITY_MLFLOW_RUN_ID=abc123 TRINITY_MLFLOW_URI=file:./mlruns \
#     TRINITY_PEAK_MEM="8.2 GB" \
#     ./scripts/publish_trinity.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISTILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

FUSED="${FUSED:-$DISTILL_DIR/output/student/fused}"
REPO="${REPO:-TeleologyHI/Trinity}"
PREVIEW_REPO="${PREVIEW_REPO:-TeleologyHI/him-distilled-3b}"
TEMPLATE="${TEMPLATE:-$DISTILL_DIR/serving/trinity-model-card.md}"
DRY_RUN="${DRY_RUN:-0}"

# Composition defaults (mirror trinity_config.py — keep in sync)
TRINITY_TEACHER="${TRINITY_TEACHER:-NousResearch/Hermes-3-Llama-3.1-8B}"
TRINITY_STUDENT="${TRINITY_STUDENT:-Qwen/Qwen2.5-3B-Instruct}"
TRINITY_RANK="${TRINITY_RANK:-16}"
TRINITY_ALPHA="${TRINITY_ALPHA:-32}"
TRINITY_ITERS="${TRINITY_ITERS:-3232}"
TRINITY_BATCH="${TRINITY_BATCH:-1}"
TRINITY_SEQ="${TRINITY_SEQ:-1024}"
TRINITY_GRAD_CHECKPOINT="${TRINITY_GRAD_CHECKPOINT:-on}"
TRINITY_CORPUS_SAMPLES="${TRINITY_CORPUS_SAMPLES:-1616}"
TRINITY_PEAK_MEM="${TRINITY_PEAK_MEM:-unrecorded}"
TRINITY_TRAIN_LOSS="${TRINITY_TRAIN_LOSS:-unrecorded}"
TRINITY_VAL_LOSS="${TRINITY_VAL_LOSS:-unrecorded}"
TRINITY_PHI_PRIME="${TRINITY_PHI_PRIME:-unscored}"
TRINITY_PHI_THRESHOLD="${TRINITY_PHI_THRESHOLD:-unset}"
TRINITY_MLFLOW_RUN_ID="${TRINITY_MLFLOW_RUN_ID:-untracked}"
TRINITY_MLFLOW_URI="${TRINITY_MLFLOW_URI:-untracked}"
TRINITY_BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Auto-compute the canonical system-prompt SHA from corpus_prep.py at
# render time, so the card always reflects the prompt that actually ran.
if [[ -z "${TRINITY_PROMPT_SHA:-}" ]]; then
  TRINITY_PROMPT_SHA="$(python3 - <<'PY'
import hashlib
import importlib.util
import pathlib

spec = importlib.util.spec_from_file_location(
    "corpus_prep",
    pathlib.Path(__file__).resolve().parent.parent / "pipelines" / "corpus_prep.py",
)
mod = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(mod)
    print(hashlib.sha256(mod.SYSTEM_PROMPT.encode("utf-8")).hexdigest())
except Exception:
    # If mlx_lm import fails (no GPU envelope), fall back to grepping the
    # SYSTEM_PROMPT block directly.
    src = (pathlib.Path(__file__).resolve().parent.parent / "pipelines" / "corpus_prep.py").read_text(encoding="utf-8")
    s = src.index('SYSTEM_PROMPT = """')
    s = src.index('"""', s) + 3
    e = src.index('"""', s)
    print(hashlib.sha256(src[s:e].encode("utf-8")).hexdigest())
PY
)"
fi

export TRINITY_TEACHER TRINITY_STUDENT TRINITY_RANK TRINITY_ALPHA \
       TRINITY_ITERS TRINITY_BATCH TRINITY_SEQ TRINITY_GRAD_CHECKPOINT \
       TRINITY_CORPUS_SAMPLES TRINITY_PEAK_MEM TRINITY_TRAIN_LOSS \
       TRINITY_VAL_LOSS TRINITY_PHI_PRIME TRINITY_PHI_THRESHOLD \
       TRINITY_MLFLOW_RUN_ID TRINITY_MLFLOW_URI TRINITY_BUILD_DATE \
       TRINITY_PROMPT_SHA

log() { echo "[$(date +%H:%M:%S)] $*" >&2; }

# ─── 1. preconditions ─────────────────────────────────────────────────
if [[ "$DRY_RUN" != "1" ]]; then
  if ! command -v hf >/dev/null 2>&1; then
    log "ERROR: hf CLI not found. Install: brew install hf"
    exit 1
  fi
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
  log "preview repo: $PREVIEW_REPO (will be marked deprecated)"
  log "hf user     : $(hf auth whoami | head -1)"
else
  log "DRY_RUN=1 — will render card but skip auth/upload steps"
fi

if [[ ! -f "$TEMPLATE" ]]; then
  log "ERROR: template not found at $TEMPLATE"
  exit 3
fi

# ─── 2. render the Trinity model card ────────────────────────────────
# Extract the literal markdown body from the template (everything inside
# the first fenced ```markdown ... ``` block) and run env substitution.
CARD_OUT="${FUSED}/README.md"
mkdir -p "$FUSED"

python3 - "$TEMPLATE" "$CARD_OUT" <<'PY'
import os
import pathlib
import sys
import string

template_path = pathlib.Path(sys.argv[1])
output_path = pathlib.Path(sys.argv[2])

text = template_path.read_text(encoding="utf-8")
# Extract the body of the first ```markdown ... ``` fenced block.
fence = "```markdown\n"
start = text.index(fence) + len(fence)
end = text.index("\n```", start)
body = text[start:end]

# string.Template uses ${VAR} substitution — matches the template syntax.
rendered = string.Template(body).safe_substitute(os.environ)
output_path.write_text(rendered, encoding="utf-8")
PY

log "model card written : $CARD_OUT ($(wc -l <"$CARD_OUT" | tr -d ' ') lines)"

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY_RUN=1 — stopping after card render"
  exit 0
fi

# ─── 3. create the Trinity repo (idempotent) ─────────────────────────
if hf models info "$REPO" >/dev/null 2>&1; then
  log "repo $REPO already exists, will update"
else
  log "creating repo $REPO (public, type=model)"
  hf repos create "$REPO" --type model --public --exist-ok 2>&1 | tail -3
fi

# ─── 4. upload the Trinity build ─────────────────────────────────────
log "uploading $FUSED → $REPO"
hf upload-large-folder "$REPO" "$FUSED" \
  --repo-type model \
  --commit-message "trinity v1.0.0-trinity — ${TRINITY_STUDENT} student × ${TRINITY_TEACHER} teacher × seed-rich corpus (${TRINITY_CORPUS_SAMPLES} prompts); MLflow run ${TRINITY_MLFLOW_RUN_ID}; Φ′=${TRINITY_PHI_PRIME}" 2>&1 | tail -10

log "Trinity uploaded — https://huggingface.co/$REPO"

# ─── 5. mark the preview repo as deprecated (idempotent banner) ──────
PREVIEW_DIR="$(mktemp -d)"
trap 'rm -rf "$PREVIEW_DIR"' EXIT

log "fetching preview $PREVIEW_REPO README to patch deprecation banner"
if ! hf download "$PREVIEW_REPO" README.md --local-dir "$PREVIEW_DIR" >/dev/null 2>&1; then
  log "WARNING: could not fetch $PREVIEW_REPO README; skipping deprecation patch"
  log "(this is non-fatal — the Trinity upload above succeeded.)"
  exit 0
fi

PREVIEW_CARD="$PREVIEW_DIR/README.md"
BANNER_MARK="<!-- TRINITY_DEPRECATION_BANNER -->"
BANNER_BODY="$BANNER_MARK
> **DEPRECATED — preview release.** This model is preserved as a
> historical record. The official TeleologyHI LLM is now
> **[\`TeleologyHI/Trinity\`](https://huggingface.co/TeleologyHI/Trinity)**
> at version \`1.0.0-trinity\`. New deployments must consume Trinity.
$BANNER_MARK"

if grep -q "$BANNER_MARK" "$PREVIEW_CARD"; then
  log "preview $PREVIEW_REPO already carries the deprecation banner; not duplicating"
else
  # Insert the banner immediately after the YAML front-matter block (between
  # the second `---` and the H1). If no front-matter, prepend to the file.
  TMP_CARD="$PREVIEW_DIR/README.patched.md"
  python3 - "$PREVIEW_CARD" "$TMP_CARD" "$BANNER_BODY" <<'PY'
import pathlib
import sys

card_path = pathlib.Path(sys.argv[1])
out_path = pathlib.Path(sys.argv[2])
banner = sys.argv[3]

text = card_path.read_text(encoding="utf-8")
if text.startswith("---\n"):
    end = text.find("\n---\n", 4)
    if end != -1:
        head = text[: end + 5]
        tail = text[end + 5 :]
        out_path.write_text(head + "\n" + banner + "\n\n" + tail, encoding="utf-8")
    else:
        out_path.write_text(banner + "\n\n" + text, encoding="utf-8")
else:
    out_path.write_text(banner + "\n\n" + text, encoding="utf-8")
PY
  mv "$TMP_CARD" "$PREVIEW_CARD"
  log "patched preview $PREVIEW_REPO README with deprecation banner; uploading"
  hf upload "$PREVIEW_REPO" "$PREVIEW_CARD" README.md \
    --commit-message "mark as deprecated — superseded by TeleologyHI/Trinity (1.0.0-trinity)" \
    2>&1 | tail -5
fi

log "DONE — Trinity live at https://huggingface.co/$REPO"
log "       preview preserved at https://huggingface.co/$PREVIEW_REPO (deprecation banner in place)"
