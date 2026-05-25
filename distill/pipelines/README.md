# `@teleologyhi-sdk/distill/pipelines`

Python side of the distillation pipeline. Apple Silicon native via
[mlx-lm](https://github.com/ml-explore/mlx-lm). A CUDA path is documented in
[`../serving/teacher-vllm.md`](../serving/teacher-vllm.md) for when you outgrow
a laptop.

The TypeScript producer (`@teleologyhi-sdk/distill` exporter) writes JSONL.
This directory **consumes** that JSONL and produces a fine-tuned model.

---

## End-to-end on a 24GB M-series Mac

```bash
# 0. one-time setup
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
hf auth login           # for downloading teacher + uploading the result (install: `brew install hf`)

# 1. export your NHE's artefacts to JSONL (run from the monorepo root)
cd ..
node -e "
  import('@teleologyhi-sdk/distill').then(async ({ DistillationExporter }) => {
    const exporter = new DistillationExporter('./teleologyhi-store');
    const r = await exporter.export({
      outDir: './distill/output/export',
      formats: ['distilabel', 'mlx-lm'],
    });
    console.log(r);
  });
"

# 2. generate the synthetic training corpus with Hermes-3 as teacher
cd pipelines
python corpus_prep.py \
    --input ../output/export/interactions.distilabel.jsonl \
    --teacher NousResearch/Hermes-3-Llama-3.1-8B \
    --output ../output/synthetic-train.jsonl \
    --max-samples 500

# 3. LoRA fine-tune a 3B student on the synthetic corpus
python train_mlx.py \
    --train ../output/synthetic-train.jsonl \
    --student Qwen/Qwen2.5-3B-Instruct \
    --out ../output/student \
    --epochs 2

# 4. (optional) push to Hugging Face Hub as the artefact
python train_mlx.py \
    --train ../output/synthetic-train.jsonl \
    --student Qwen/Qwen2.5-3B-Instruct \
    --out ../output/student \
    --epochs 2 \
    --hf-push TeleologyHI/him-distilled-3b
```

Wall times on an M5 / 24GB / macOS 26:

| Step | Wall time | Resident RAM |
|---|---|---|
| Hermes-3-8B load | ~30 s | ~16 GB |
| `corpus_prep.py` 500 rows | 30-60 min | ~17 GB |
| Qwen2.5-3B-Instruct load | ~10 s | ~5 GB |
| `train_mlx.py` 2 epochs / 1k rows | 1-2 h | ~9 GB |
| Fuse + save | ~30 s | — |

---

## Why MLX, not Torchtune

[Torchtune](https://github.com/meta-pytorch/torchtune) is the canonical KD
toolkit but is CUDA-first; running it on Apple Silicon falls back to CPU
which is impractical for anything above a 1B model. MLX is Apple's native
ML framework and saturates the M-series GPU via Metal Performance Shaders.

If you have a CUDA box, the equivalent flow lives in
[`../serving/teacher-vllm.md`](../serving/teacher-vllm.md) — host the teacher
on vLLM, sample logits, drive a Torchtune KD recipe. We do not check that
recipe into this repo until it's been validated against a real run.

---

## Choosing a teacher

The Creator's "Grok-like, more human" preference maps to **Hermes 3 /
Hermes 4** from Nous Research — open-weights models tuned explicitly for
that personality. Default in `corpus_prep.py` is `Hermes-3-Llama-3.1-8B`.

Alternatives, in descending preference for the TeleologyHI use case:

| Model | Params | ToS friendly? | Notes |
|---|---|---|---|
| `NousResearch/Hermes-3-Llama-3.1-8B` | 8B | Apache 2.0 weights | Default. Grok-shaped personality. |
| `NousResearch/DeepHermes-3-Llama-3-8B-Preview` | 8B | Apache 2.0 | Same lineage, more reflective tone. |
| `meta-llama/Llama-3.3-70B-Instruct` | 70B | Llama Community | Requires CUDA — won't fit on M5. |
| `Qwen/Qwen2.5-7B-Instruct` | 7B | Apache 2.0 | Strong multilingual; less personable. |
| `deepseek-ai/DeepSeek-R1-Distill-Llama-8B` | 8B | MIT | Reasoning-heavy. Use when training a high-stakes student. |

**Do not** use OpenAI/Anthropic outputs as a teacher for distillation; their
TOS forbids using outputs to train a competitor model. Stick to the table
above.

---

## Choosing a student

Pick the smallest model that meets your quality bar.

| Model | Params | Licence | Trainable on M5 24GB? |
|---|---|---|---|
| `Qwen/Qwen2.5-3B-Instruct` | 3B | Apache 2.0, no gate | **Yes (default)** — used in v0.2 cut |
| `Qwen/Qwen2.5-1.5B-Instruct` | 1.5B | Apache 2.0, no gate | Yes, faster |
| `meta-llama/Llama-3.2-1B-Instruct` | 1B | Llama 3.2 Community (gated on HF) | Yes, fast |
| `meta-llama/Llama-3.2-3B-Instruct` | 3B | Llama 3.2 Community (gated on HF) | Yes; needs licence click in HF UI |
| `Qwen/Qwen2.5-7B-Instruct` | 7B | Apache 2.0, no gate | Yes with `--quant 4bit --batch-size 1` |
| `NousResearch/Hermes-3-Llama-3.1-8B` | 8B | Llama 3.1 Community + Hermes terms | Yes with `--quant 4bit --batch-size 1` |

For a browser-deployable artefact (see `../scripts/to-onnx.py`) pick a 1B-3B
student — the resulting ONNX bundle is ~600 MB-2 GB which a user can load
via [Transformers.js](https://github.com/huggingface/transformers.js)
without crashing the tab.

---

## Cost / risk notes

- Synthetic data from a Llama-licensed teacher (Hermes-3) is OK for both
  research and commercial students.
- Always include the teacher's id in `metadata.teacher` (corpus_prep does
  this) — auditors want lineage.
- Never check `output/` into git (it's gitignored). Each run is reproducible
  from the inputs + the seed in the trainer.
