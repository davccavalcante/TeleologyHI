#!/usr/bin/env python3
"""
train_mlx.py — LoRA fine-tune a student model on the TeleologyHI synthetic
training corpus, Apple Silicon native via mlx-lm.

Pipeline (B5, M-series friendly variant):

  1. Load a student model (default: Qwen2.5-3B-Instruct — 3B parameters,
     Apache 2.0 + no HF gate; trainable on 24GB M5 with batch=1 +
     grad-checkpoint + seq=1024).
  2. Build a LoRA adapter (rank 16, alpha 32 by default — solid baseline).
  3. Train against the chat-format JSONL emitted by `corpus_prep.py`.
  4. Save the adapter weights and the fused model under `--out`.
  5. Optionally upload to Hugging Face Hub (`--hf-push <repo-id>`).

For larger students (Hermes-3-8B as student is also viable on M5 with 4-bit
quant + smaller batch), pass `--student NousResearch/Hermes-3-Llama-3.1-8B
--quant 4bit --batch-size 1`.

Pure logit-level KD on M-series is non-trivial today — mlx-lm exposes LoRA
+ SFT but not logit distillation at the time of this writing. The pragmatic
path implemented here is *data distillation*: the teacher's outputs already
became the supervision signal during `corpus_prep.py`, so a vanilla SFT on
that corpus transfers the teacher's behaviour without requiring access to
its logits. For pure logit-KD use the CUDA path documented in
../serving/teacher-vllm.md + a Torchtune recipe (out-of-scope here).

Usage:

    python train_mlx.py \\
        --train ../output/synthetic-train.jsonl \\
        --student Qwen/Qwen2.5-3B-Instruct \\
        --out ../output/student \\
        --epochs 2

Apple-Silicon notes (M5 / 24GB):
  - 3B student + LoRA: ~6 GB resident; 1-2 hours for 1k samples.
  - 8B student + 4-bit + LoRA: ~9 GB resident; 4-6 hours for 1k samples.
  - The mlx-lm trainer streams data; no need to load the whole corpus.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

# LLMOps tracking — opt-in via TELEOLOGYHI_MLFLOW=1 (see mlflow_tracking.py
# header for the rationale). No-op when disabled.
from mlflow_tracking import track_stage  # noqa: E402

DEFAULT_STUDENT = "Qwen/Qwen2.5-3B-Instruct"

# Loss-line pattern emitted by `mlx_lm lora` during training:
#   "Iter  20: Train loss 1.234, Learning Rate 1.000e-05, ..."
#   "Iter 200: Val loss 0.987, Val took ..."
_LOSS_LINE = re.compile(
    r"Iter\s+(\d+):\s+(Train|Val)\s+loss\s+([0-9]*\.?[0-9]+)",
    re.IGNORECASE,
)


def _prepare_data_dir(train_jsonl: Path, out: Path, valid_fraction: float = 0.05) -> Path:
    """mlx_lm.lora expects a directory containing `train.jsonl` AND
    `valid.jsonl` (the trainer rejects training without a validation
    set). We materialise both under `out/data/` by splitting the source
    corpus, default 95/5. Deterministic — last N lines become valid."""
    data_dir = out / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    src_lines = train_jsonl.read_text(encoding="utf-8").splitlines()
    src_lines = [ln for ln in src_lines if ln.strip()]
    n_total = len(src_lines)
    n_valid = max(1, int(n_total * valid_fraction))
    n_train = n_total - n_valid
    train_path = data_dir / "train.jsonl"
    valid_path = data_dir / "valid.jsonl"
    train_path.write_text("\n".join(src_lines[:n_train]) + "\n", encoding="utf-8")
    valid_path.write_text("\n".join(src_lines[n_train:]) + "\n", encoding="utf-8")
    print(
        f"prepared data: {n_train} train / {n_valid} valid rows in {data_dir}",
        file=sys.stderr,
    )
    return data_dir


def _write_lora_config(out: Path, rank: int, alpha: int) -> Path:
    """mlx-lm >=0.21 moved --lora-rank/--lora-alpha out of the CLI into
    a YAML config consumed via `-c`. The YAML keys match CONFIG_DEFAULTS:
    `rank`, `scale` (= alpha/rank), `dropout`."""
    cfg = out / "lora-config.yaml"
    cfg.write_text(
        "lora_parameters:\n"
        f"  rank: {rank}\n"
        f"  scale: {alpha / rank:.4f}\n"
        "  dropout: 0.0\n",
        encoding="utf-8",
    )
    return cfg


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--train",
        type=Path,
        required=True,
        help="Chat-format training JSONL (from corpus_prep.py).",
    )
    parser.add_argument(
        "--out",
        type=Path,
        required=True,
        help="Output directory for the LoRA adapter + fused model.",
    )
    parser.add_argument(
        "--student",
        type=str,
        default=DEFAULT_STUDENT,
        help="Hugging Face id of the student model.",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=2,
        help="Number of full passes over the training corpus.",
    )
    parser.add_argument(
        "--rank",
        type=int,
        default=16,
        help="LoRA rank (8 = aggressive, 32 = conservative).",
    )
    parser.add_argument(
        "--alpha",
        type=int,
        default=32,
        help="LoRA alpha (usually 2× rank).",
    )
    parser.add_argument(
        "--lr",
        type=float,
        default=1e-5,
        help="Learning rate.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1,
        help="Per-step batch size. M5/24GB needs batch=1 + grad-checkpoint for 3B at seq 1024.",
    )
    parser.add_argument(
        "--max-seq-length",
        type=int,
        default=1024,
        help="Token cap per sample. Lower = less GPU memory; longer responses get truncated.",
    )
    parser.add_argument(
        "--grad-checkpoint",
        action="store_true",
        default=True,
        help="Trade compute for memory by recomputing activations. Required on M5/24GB for 3B.",
    )
    parser.add_argument(
        "--quant",
        type=str,
        choices=["none", "4bit", "8bit"],
        default="none",
        help="Pre-load quantization for the student.",
    )
    parser.add_argument(
        "--hf-push",
        type=str,
        default=None,
        help="If set, upload the fused model to this Hugging Face Hub repo id.",
    )
    args = parser.parse_args()

    if not args.train.exists():
        print(f"ERROR: training file not found: {args.train}", file=sys.stderr)
        return 2

    args.out.mkdir(parents=True, exist_ok=True)
    adapter_dir = args.out / "adapter"
    adapter_dir.mkdir(parents=True, exist_ok=True)
    fused_dir = args.out / "fused"

    # mlx-lm >=0.21 prefers `python -m mlx_lm lora` (subcommand form). The
    # `python -m mlx_lm.lora` entry point is deprecated. LoRA rank + alpha
    # were also moved out of the CLI into a YAML config consumed via `-c`.
    data_dir = _prepare_data_dir(args.train, args.out)
    cfg_path = _write_lora_config(args.out, args.rank, args.alpha)
    iters = _iters_for(args.epochs, args.train, args.batch_size)

    cmd = [
        sys.executable,
        "-m",
        "mlx_lm",
        "lora",
        "--model",
        args.student,
        "--train",
        "--data",
        str(data_dir),
        "--adapter-path",
        str(adapter_dir),
        "--batch-size",
        str(args.batch_size),
        "--num-layers",
        "16",
        "--learning-rate",
        f"{args.lr:g}",
        "--iters",
        str(iters),
        "--steps-per-report",
        "20",
        "--steps-per-eval",
        "200",
        "--max-seq-length",
        str(args.max_seq_length),
        "-c",
        str(cfg_path),
    ]
    if args.grad_checkpoint:
        cmd += ["--grad-checkpoint"]
    if args.quant != "none":
        cmd += ["--quant-bits", "4" if args.quant == "4bit" else "8"]

    # Whole training + fuse + push runs under a single MLflow stage so the
    # LLMOps surface captures hyperparameters, streaming train/val loss
    # per logged iteration, the LoRA config artefact, and the final adapter
    # location. No-op when TELEOLOGYHI_MLFLOW is unset.
    with track_stage(
        "train_mlx",
        extra_tags={
            "teleologyhi.student": args.student,
            "teleologyhi.target.model": "TeleologyHI/Trinity",
        },
    ) as tracker:
        tracker.log_params({
            "student": args.student,
            "epochs": args.epochs,
            "iters": iters,
            "rank": args.rank,
            "alpha": args.alpha,
            "scale": float(args.alpha) / float(args.rank),
            "lr": args.lr,
            "batch_size": args.batch_size,
            "max_seq_length": args.max_seq_length,
            "grad_checkpoint": bool(args.grad_checkpoint),
            "quant": args.quant,
        })
        tracker.log_dataset_input(args.train, role="train")
        tracker.log_artifact(cfg_path, artifact_path="config")
        tracker.log_param("num_layers", 16)
        tracker.log_param("steps_per_report", 20)
        tracker.log_param("steps_per_eval", 200)

        print(">>", " ".join(cmd), file=sys.stderr)
        train_start = time.time()
        rc = _stream_subprocess(cmd, tracker)
        train_wall = time.time() - train_start
        tracker.log_metric("train_wall_seconds", float(train_wall))
        tracker.log_metric("train_exit_code", float(rc))
        if rc != 0:
            return rc

        # Fuse the adapter into a portable model directory.
        fused_dir.mkdir(parents=True, exist_ok=True)
        fuse_cmd = [
            sys.executable,
            "-m",
            "mlx_lm",
            "fuse",
            "--model",
            args.student,
            "--adapter-path",
            str(adapter_dir),
            "--save-path",
            str(fused_dir),
        ]
        print(">>", " ".join(fuse_cmd), file=sys.stderr)
        fuse_start = time.time()
        rc = subprocess.call(fuse_cmd)
        tracker.log_metric("fuse_wall_seconds", float(time.time() - fuse_start))
        tracker.log_metric("fuse_exit_code", float(rc))
        if rc != 0:
            return rc

        tracker.log_param("adapter_path", str(adapter_dir))
        tracker.log_param("fused_path", str(fused_dir))

        if args.hf_push:
            if not os.environ.get("HF_TOKEN"):
                print(
                    "WARNING: HF_TOKEN not set; the upload will use cached login (`hf auth login`).",
                    file=sys.stderr,
                )
            push_cmd = [
                "hf",
                "upload",
                args.hf_push,
                str(fused_dir),
            ]
            if not shutil.which("hf"):
                print(
                    "ERROR: `hf` not found; install via `brew install hf` or `pip install huggingface_hub`.",
                    file=sys.stderr,
                )
                return 3
            print(">>", " ".join(push_cmd), file=sys.stderr)
            push_start = time.time()
            rc = subprocess.call(push_cmd)
            tracker.log_metric("hf_push_wall_seconds", float(time.time() - push_start))
            tracker.log_metric("hf_push_exit_code", float(rc))
            tracker.log_param("hf_push_repo", args.hf_push)
            if rc != 0:
                return rc
            print(f"pushed fused model to {args.hf_push}", file=sys.stderr)

    print(f"DONE — adapter at {adapter_dir}, fused at {fused_dir}", file=sys.stderr)
    return 0


def _stream_subprocess(cmd: list[str], tracker) -> int:
    """Run `cmd`, mirror its stderr to ours, and parse `mlx_lm lora` loss
    lines into MLflow metrics (`train_loss`, `val_loss`) indexed by iter.
    Returns the process exit code."""
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    assert proc.stdout is not None  # noqa: S101 (bufsize=1 line buffering)
    for line in proc.stdout:
        sys.stderr.write(line)
        match = _LOSS_LINE.search(line)
        if match:
            it = int(match.group(1))
            kind = match.group(2).lower()
            value = float(match.group(3))
            tracker.log_metric(f"{kind}_loss", value, step=it)
    return proc.wait()


def _iters_for(epochs: int, train: Path, batch_size: int) -> int:
    """Convert `--epochs` to mlx_lm's `--iters` flag.
    iters = ceil(n_samples * epochs / batch_size)."""
    n = sum(1 for _ in train.open("r", encoding="utf-8"))
    return max(50, (n * max(epochs, 1) + batch_size - 1) // max(batch_size, 1))


if __name__ == "__main__":
    sys.exit(main())
