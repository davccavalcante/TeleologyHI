#!/usr/bin/env python3
"""
to-onnx.py — Convert a fine-tuned Hugging Face checkpoint to ONNX for
deployment via Transformers.js (browser + Node).

Pipeline (B7):

  1. Pull the fused student from local path or HF Hub.
  2. Convert to ONNX with quantization (int8 by default — best size/quality
     trade for browser inference).
  3. Write a `package/` directory shaped for Transformers.js:
       package/
         tokenizer.json
         tokenizer_config.json
         special_tokens_map.json
         config.json
         onnx/
           model_quantized.onnx
           decoder_model_quantized.onnx (if encoder-decoder)
  4. Optionally publish to HF Hub as the canonical artefact.

Usage:

    python to-onnx.py \\
        --model ../output/student/fused \\
        --out ../output/student/onnx \\
        --quant int8 \\
        --hf-push teleologyhi/him-distilled-3b-onnx

The resulting directory is what `@huggingface/transformers` (Transformers.js)
expects when invoked with `pipeline("text-generation", "teleologyhi/...")`.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model",
        required=True,
        help="Path or HF id of the fused student model.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        required=True,
        help="Output directory for the Transformers.js package.",
    )
    parser.add_argument(
        "--quant",
        choices=["none", "int8", "fp16"],
        default="int8",
        help="Quantization mode for ONNX export.",
    )
    parser.add_argument(
        "--task",
        default="text-generation",
        help="Optimum task tag (text-generation for decoder-only LLMs).",
    )
    parser.add_argument(
        "--hf-push",
        default=None,
        help="If set, upload the resulting package to this HF Hub repo id.",
    )
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    # 1. Convert to ONNX via Optimum's CLI. The `optimum` package is part of
    # the standard HF stack; install via `pip install optimum[onnxruntime]`.
    cmd = [
        "optimum-cli",
        "export",
        "onnx",
        "--task",
        args.task,
        "--model",
        args.model,
    ]
    if args.quant == "int8":
        cmd += ["--quantize", "avx2"]  # ONNX Runtime int8 quant scheme
    elif args.quant == "fp16":
        cmd += ["--dtype", "fp16"]
    cmd += [str(args.out)]

    if not shutil.which("optimum-cli"):
        print(
            "ERROR: optimum-cli not found. Install with: pip install 'optimum[onnxruntime]'",
            file=sys.stderr,
        )
        return 2

    print(">>", " ".join(cmd), file=sys.stderr)
    rc = subprocess.call(cmd)
    if rc != 0:
        return rc

    # 2. Optionally publish to HF Hub.
    if args.hf_push:
        if not shutil.which("hf"):
            print(
                "ERROR: `hf` not found. Install: brew install hf  (or `pip install huggingface_hub`)",
                file=sys.stderr,
            )
            return 3
        if not os.environ.get("HF_TOKEN"):
            print(
                "WARNING: HF_TOKEN not set; relying on cached `hf auth login`.",
                file=sys.stderr,
            )
        push_cmd = ["hf", "upload", args.hf_push, str(args.out)]
        print(">>", " ".join(push_cmd), file=sys.stderr)
        rc = subprocess.call(push_cmd)
        if rc != 0:
            return rc

    print(f"DONE — ONNX package at {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
