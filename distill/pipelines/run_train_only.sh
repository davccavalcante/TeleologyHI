#!/usr/bin/env bash
# run_train_only.sh — Resume STAGE 2/2 (LoRA fine-tune) using the
# existing synthetic-train.jsonl produced by a previous corpus_prep run.
#
# This exists because corpus_prep is the slow phase (~20+ hours on M5)
# and we don't want to redo it if STAGE 2/2 has to be re-run for any
# reason (CLI changes, OOM, etc.).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

OUTPUT_DIR="${OUTPUT_DIR:-../output}"
SYNTHETIC="${SYNTHETIC:-$OUTPUT_DIR/synthetic-train.jsonl}"
STUDENT="${STUDENT:-Qwen/Qwen2.5-3B-Instruct}"
EPOCHS="${EPOCHS:-2}"
BATCH_SIZE="${BATCH_SIZE:-1}"
STUDENT_OUT="$OUTPUT_DIR/student"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$OUTPUT_DIR/run.log" >&2; }

if [[ ! -f "$SYNTHETIC" ]]; then
  log "ERROR: synthetic corpus not found: $SYNTHETIC"
  log "Run pipelines/run_distill.sh first to produce it."
  exit 2
fi
log "resuming STAGE 2/2 — synthetic=$SYNTHETIC ($(wc -l <"$SYNTHETIC" | tr -d ' ') rows)"
log "student=$STUDENT  epochs=$EPOCHS  batch=$BATCH_SIZE"

# shellcheck disable=SC1091
source .venv/bin/activate

python train_mlx.py \
  --train "$SYNTHETIC" \
  --out "$STUDENT_OUT" \
  --student "$STUDENT" \
  --epochs "$EPOCHS" \
  --batch-size "$BATCH_SIZE" 2>&1 | tee -a "$OUTPUT_DIR/run.log"

rc=${PIPESTATUS[0]}
if [[ "$rc" -ne 0 ]]; then
  log "train_mlx failed (rc=$rc)"
  exit "$rc"
fi

log "DONE — adapter: $STUDENT_OUT/adapter, fused: $STUDENT_OUT/fused"
