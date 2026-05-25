#!/usr/bin/env bash
# run_distill.sh — One-shot orchestrator for "leave it running overnight".
#
# What it does (in order):
#   1. create .venv if missing, install requirements.txt
#   2. verify Hugging Face login (must be done interactively first time)
#   3. corpus_prep.py  — Hermes-3 teacher generates ideal responses
#   4. train_mlx.py    — LoRA fine-tune Qwen/Qwen2.5-3B-Instruct (default)
#
# Wall-time on an M5 / 24 GB (observed for the v0.2 cut against seed-rich.jsonl):
#   step 1: ~5 min (first run) / instant (cached)
#   step 2: ~2 min one-time interactive (`hf auth login`)
#   step 3: ~20 h for 1616 prompts (default seed-rich.jsonl + Hermes-3-8B teacher)
#   step 4: ~3 h for 2 epochs LoRA fine-tune (rank=16, batch=1, max-seq=1024,
#           grad-checkpoint — required to fit Metal unified memory on M5/24GB)
#   total : ~23-24 hours (first run); ~3 h on re-runs that reuse the cached
#           synthetic corpus via `run_train_only.sh`
#
# Usage:
#   cd distill/pipelines
#   chmod +x run_distill.sh
#   ./run_distill.sh                  # foreground, see progress live
#   nohup ./run_distill.sh > run.log 2>&1 &    # background, tail run.log
#
# Knobs (env vars, all optional):
#   SEED_JSONL       seed prompts file              (default fixtures/seed.jsonl)
#   MAX_SAMPLES      cap on synthetic generations   (default 50)
#   TEACHER          Hugging Face teacher id        (default NousResearch/Hermes-3-Llama-3.1-8B)
#   STUDENT          Hugging Face student id        (default Qwen/Qwen2.5-3B-Instruct)
#   EPOCHS           training passes                (default 2)
#   BATCH_SIZE       per-step batch                 (default 1; M5/24GB ceiling
#                                                    per CHANGELOG L37. Override
#                                                    to 4/8 only if you have a
#                                                    CUDA box with >24 GB VRAM)
#   OUTPUT_DIR       where everything lands         (default ../output)
#
# Exit codes:
#   0 — success, model fused at $OUTPUT_DIR/student/fused
#   2 — seed file missing
#   3 — Python venv setup failed
#   4 — hf auth not logged in
#   5 — corpus_prep failed
#   6 — train_mlx failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SEED_JSONL="${SEED_JSONL:-fixtures/seed-rich.jsonl}"
MAX_SAMPLES="${MAX_SAMPLES:-1700}"
TEACHER="${TEACHER:-NousResearch/Hermes-3-Llama-3.1-8B}"
STUDENT="${STUDENT:-Qwen/Qwen2.5-3B-Instruct}"
EPOCHS="${EPOCHS:-2}"
BATCH_SIZE="${BATCH_SIZE:-1}"
OUTPUT_DIR="${OUTPUT_DIR:-../output}"

mkdir -p "$OUTPUT_DIR"
SYNTHETIC="$OUTPUT_DIR/synthetic-train.jsonl"
STUDENT_OUT="$OUTPUT_DIR/student"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$OUTPUT_DIR/run.log" >&2; }

# ─── 0. preconditions ────────────────────────────────────────────────
if [[ ! -f "$SEED_JSONL" ]]; then
  log "ERROR: seed file not found: $SEED_JSONL"
  exit 2
fi
log "seed   : $SEED_JSONL ($(wc -l <"$SEED_JSONL" | tr -d ' ') lines)"
log "teacher: $TEACHER"
log "student: $STUDENT"
log "output : $OUTPUT_DIR"
log "samples: $MAX_SAMPLES, epochs: $EPOCHS, batch: $BATCH_SIZE"

# ─── 1. python venv + deps ───────────────────────────────────────────
if [[ ! -d .venv ]]; then
  log "creating .venv"
  python3 -m venv .venv || { log "venv create failed"; exit 3; }
fi
# shellcheck disable=SC1091
source .venv/bin/activate
if ! pip show distilabel >/dev/null 2>&1; then
  log "installing requirements.txt (one-time, ~5 min)"
  pip install --upgrade pip >>"$OUTPUT_DIR/run.log" 2>&1
  pip install -r requirements.txt >>"$OUTPUT_DIR/run.log" 2>&1 || { log "pip install failed"; exit 3; }
fi

# ─── 2. hugging face login check ─────────────────────────────────────
if ! hf auth whoami >/dev/null 2>&1; then
  log "ERROR: hf auth not logged in."
  log "Run this once interactively: hf auth login"
  log "Then re-run this script."
  exit 4
fi
log "hf user: $(hf auth whoami)"

# ─── 3. corpus_prep — teacher generates ideal responses ──────────────
log "STAGE 1/2: corpus_prep with $TEACHER (~30-60 min)"
python corpus_prep.py \
  --input "$SEED_JSONL" \
  --output "$SYNTHETIC" \
  --teacher "$TEACHER" \
  --max-samples "$MAX_SAMPLES" \
  --max-tokens 384 \
  --include-original 2>&1 | tee -a "$OUTPUT_DIR/run.log"
rc=${PIPESTATUS[0]}
if [[ "$rc" -ne 0 ]]; then
  log "corpus_prep failed (rc=$rc)"
  exit 5
fi
log "synthetic corpus: $SYNTHETIC ($(wc -l <"$SYNTHETIC" | tr -d ' ') rows)"

# ─── 4. train_mlx — LoRA fine-tune the student ───────────────────────
log "STAGE 2/2: train_mlx LoRA on $STUDENT (~1-2 hours)"
python train_mlx.py \
  --train "$SYNTHETIC" \
  --out "$STUDENT_OUT" \
  --student "$STUDENT" \
  --epochs "$EPOCHS" \
  --batch-size "$BATCH_SIZE" 2>&1 | tee -a "$OUTPUT_DIR/run.log"
rc=${PIPESTATUS[0]}
if [[ "$rc" -ne 0 ]]; then
  log "train_mlx failed (rc=$rc)"
  exit 6
fi

log "DONE"
log "adapter: $STUDENT_OUT/adapter"
log "fused  : $STUDENT_OUT/fused"
log "to test locally:"
log "  python -c \"from mlx_lm import load, generate; m,t=load('$STUDENT_OUT/fused'); print(generate(m,t,prompt='Define teleology.',max_tokens=128))\""
