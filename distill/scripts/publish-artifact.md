# Publishing the distilled artefact

End-to-end runbook for shipping a distilled student model under the
`TeleologyHI/` namespace on Hugging Face Hub. Assumes you have completed
the pipeline in [`../pipelines/README.md`](../pipelines/README.md) and
the fused model lives at `../output/student/fused/`.

The canonical publisher in this workspace is
[`./publish_to_hf.sh`](./publish_to_hf.sh) — it renders the model card,
creates the HF repo if missing, and uploads the fused folder via
`hf upload-large-folder`. This document explains the surface around the
script and what an operator needs to know.

---

## What you're publishing

Up to two repositories on Hugging Face Hub per release:

| Repo | Format | Consumer |
|---|---|---|
| `TeleologyHI/him-distilled-<size>` | Safetensors (HF native) | Python / vLLM / mlx-lm |
| `TeleologyHI/him-distilled-<size>-onnx` | ONNX (Transformers.js shape) | Browser / Node Transformers.js |

`<size>` follows the student's parameter count: `1b`, `3b`, `7b`, `8b`.
The current LIVE artefact is
[`TeleologyHI/him-distilled-3b`](https://huggingface.co/TeleologyHI/him-distilled-3b)
(Apache 2.0, public, 6.18 GB, Qwen 2.5 3B base × Hermes-3-8B teacher).

The ONNX sibling is not shipped at v0.2; it lands in `0.3.0-alpha.0`
once the conversion via [`./to-onnx.py`](./to-onnx.py) has been
validated end-to-end against Transformers.js.

---

## 1. Run the publisher

```bash
# from distill/scripts/
./publish_to_hf.sh
```

That script will:

1. Verify `hf auth whoami` (must run `hf auth login` once interactively first).
2. Verify the fused model exists at `../output/student/fused/`.
3. Render the canonical model card into `../output/student/fused/README.md`
   (the card content is embedded in the script — see
   [`./publish_to_hf.sh:45-142`](./publish_to_hf.sh)).
4. Create the HF repo if it does not exist (public, model type).
5. Upload the fused folder via `hf upload-large-folder`.

Overrides:

```bash
FUSED=/path/to/fused REPO=TeleologyHI/him-distilled-3b ./publish_to_hf.sh
```

---

## 2. Convert + push the ONNX variant (when ready)

After the safetensors release is on the Hub:

```bash
python ./to-onnx.py \
    --model ../output/student/fused \
    --out  ../output/student/onnx \
    --quant int8 \
    --hf-push TeleologyHI/him-distilled-3b-onnx
```

`int8` quantisation keeps the ONNX bundle around ~700 MB for a 3B model —
small enough to load in a browser without crashing on most consumer
hardware. For more aggressive size, try `fp16` and accept lower quality.

---

## 3. Smoke test from a clean machine

Before announcing, verify both repos load and respond correctly from a
machine with no local cache:

```bash
# Python smoke
python -c "
from mlx_lm import load, generate
m, t = load('TeleologyHI/him-distilled-3b')
print(generate(m, t, prompt='Define teleology.', max_tokens=128))
"

# Browser smoke (Node via Transformers.js, once the ONNX sibling is live)
node -e "
import('@huggingface/transformers').then(async ({ pipeline }) => {
  const gen = await pipeline('text-generation', 'TeleologyHI/him-distilled-3b-onnx');
  const out = await gen('Define teleology.', { max_new_tokens: 128 });
  console.log(out);
});
"
```

---

## 4. Wire into `@teleologyhi-sdk/nhe` as an adapter (future)

Once the artefact is published, the path forward is a Transformers.js
adapter (and/or a Python MLX adapter via child_process) in
`@teleologyhi-sdk/nhe` so `nhe chat` can run the distilled student
in-browser with zero server hop. This is the internal backlog (items D-N9 + D-N10) — not
in scope for the publish itself.

---

## 5. Notes on git tags

`@teleologyhi-sdk/distill` is `"private": true` and is **not** wired
into `.github/workflows/publish.yml` (the workspace was removed from
the tag pattern + case statement in the `0.1.0-alpha.1` cut — see
[`../CHANGELOG.md`](../CHANGELOG.md) `[0.1.0-alpha.1]`). The artefact
publish lifecycle lives entirely in this workspace's
`publish_to_hf.sh`; do **not** create `distill-v*` git tags — they have
no consumer.

A regular monorepo commit + push (after `publish_to_hf.sh` succeeds)
captures the documentation + script changes that accompany the release.
The new HF revision itself is committed by `hf upload-large-folder`
into the Hub repository's git history.
