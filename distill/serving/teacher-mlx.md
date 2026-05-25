# Serving the teacher locally on Apple Silicon (mlx-lm)

The default flow in [`../pipelines/corpus_prep.py`](../pipelines/corpus_prep.py)
loads the teacher in-process via `mlx_lm.load`. That works fine for one-off
batches up to a few thousand rows. For longer runs or for serving multiple
trainers/eval jobs against the same teacher, run it as a local HTTP server.

---

## One-shot in-process (default)

`corpus_prep.py` already does this. Nothing to configure.

```bash
python corpus_prep.py \
    --input ../output/export/interactions.distilabel.jsonl \
    --teacher NousResearch/Hermes-3-Llama-3.1-8B \
    --output ../output/synthetic-train.jsonl
```

---

## Local HTTP server (`mlx-lm.server`)

`mlx-lm` ships an OpenAI-compatible HTTP server. Useful when you want to
share a single loaded teacher across `corpus_prep.py`, ad-hoc REPL probes,
and the NHE's `DeepSeekAdapter` (which speaks OpenAI Chat Completions).

```bash
python -m mlx_lm.server \
    --model NousResearch/Hermes-3-Llama-3.1-8B \
    --host 127.0.0.1 \
    --port 8765
```

Then point the NHE at it via the DeepSeek adapter (the API shape is the same):

```ts
import { DeepSeekAdapter } from "@teleologyhi-sdk/nhe";

const teacher = new DeepSeekAdapter({
  apiKey: "not-used-locally",  // mlx_lm.server doesn't require auth
  baseUrl: "http://127.0.0.1:8765/v1",
  model: "NousResearch/Hermes-3-Llama-3.1-8B",
});
```

This lets you A/B the local Hermes-3 against a cloud DeepSeek-R1 without
changing your application code.

---

## Memory + thermal envelope (M5 / 24GB)

| Model | Resident | Inference t/s | Notes |
|---|---|---|---|
| Hermes-3-Llama-3.1-8B (bf16) | ~16 GB | ~10 t/s | Default. Fits with 8 GB headroom. |
| Hermes-3-Llama-3.1-8B (4-bit) | ~5 GB | ~25 t/s | Smaller; some quality loss. |
| DeepSeek-R1-Distill-Llama-8B (bf16) | ~16 GB | ~9 t/s | Stronger reasoning. |
| Llama-3.2-3B-Instruct (bf16) | ~6 GB | ~30 t/s | Too small for teacher work; great as student. |

Thermal throttling kicks in after ~15 min of sustained inference on a
fanless M-series. If you're doing long batch runs, set `--max-tokens` low
and let the corpus_prep script log progress so you can pause / resume.

---

## Troubleshooting

**`MallocStackLogging: out of memory`** — drop to 4-bit (`--quant 4bit`) or
use a smaller teacher. Activity Monitor's "Memory Pressure" graph turns
yellow at ~22 GB on a 24 GB box; that's the practical ceiling.

**`SSL: CERTIFICATE_VERIFY_FAILED` during HF download** — this is a stock
Python-on-macOS issue. Run `/Applications/Python\ 3.X/Install\ Certificates.command`
once.

**Generation looks repetitive** — the default temperature is 0. Pass
`--temp 0.7 --top-p 0.95` in mlx_lm.server for friendlier output.
