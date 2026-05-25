# Serving the teacher in the cloud (vLLM)

When you outgrow a laptop — typically when you want a 70B-class teacher or
when you need true logit-level distillation — host the teacher on
[vLLM](https://github.com/vllm-project/vllm). vLLM is the production-grade
serving stack used by most academic KD recipes (DistillKit, Torchtune, etc).

This doc covers the **TeleologyHI-defaults** setup, not vLLM operations in
general. For vLLM tuning details, see the upstream docs.

---

## TL;DR: docker-compose for DeepSeek-R1 70B

```bash
docker compose -f docker-compose.teacher.yml up -d
curl http://localhost:8000/v1/models  # health check
```

Hardware floor for the default config:
- 2× A100 80GB **or** 1× H100 80GB **or** 4× L40S 48GB
- 200 GB free disk (weights + KV cache)
- 100+ GB system RAM

Cheaper alternatives (drop in `docker-compose.teacher.yml`):
- `meta-llama/Llama-3.3-70B-Instruct` — 1× H100 80GB
- `NousResearch/Hermes-4-405B` — needs 8× H100 (rarely worth it; prefer
  Hermes-3-8B locally for our use case)
- `Qwen/Qwen2.5-72B-Instruct` — 2× A100 80GB

---

## Quick spec

```yaml
# docker-compose.teacher.yml (committed adjacent)
services:
  teacher:
    image: vllm/vllm-openai:v0.6.3
    runtime: nvidia
    ipc: host
    environment:
      - HUGGING_FACE_HUB_TOKEN=${HF_TOKEN}
    command: >
      --model deepseek-ai/DeepSeek-R1
      --tensor-parallel-size 2
      --max-model-len 8192
      --gpu-memory-utilization 0.92
      --enable-prefix-caching
      --port 8000
    ports:
      - "8000:8000"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 2
              capabilities: [gpu]
```

---

## Wiring to the pipeline

`corpus_prep.py` currently uses `mlx-lm` (local). To swap to vLLM you have
two options:

**Option A — minimal change**: skip `corpus_prep.py` and use Distilabel's
`vLLM` integration directly. Distilabel will treat the vLLM endpoint as a
standard OpenAI-compatible backend.

```python
from distilabel.llms import vLLM
from distilabel.steps.tasks import TextGeneration

llm = vLLM(
    model="deepseek-ai/DeepSeek-R1",
    base_url="http://teacher-host:8000/v1",
    api_key="not-used",
    extra_kwargs={"max_model_len": 8192},
)
task = TextGeneration(llm=llm)
# ... drive the pipeline as in Distilabel docs
```

**Option B — local proxy**: run `mlx_lm.server` on the laptop pointed at a
tunnel to the remote vLLM. This keeps `corpus_prep.py` unchanged. Useful if
you want to develop on the laptop and only burn GPU time on the actual run.

---

## Logit-level distillation

vLLM + a Torchtune KD recipe is the right path when:
- the student is large enough that data distillation alone leaves quality
  on the table (typically >= 7B), or
- you want to match the teacher's *next-token distribution*, not just its
  preferred outputs.

The recipe lives in the Torchtune repo
(`recipes/configs/llama3_2/3B_distill_kd_single_device.yaml`). Adapt the
teacher to your vLLM endpoint and the student to your chosen base; the
TeleologyHI synthetic corpus produced by `corpus_prep.py --include-original`
plugs in unchanged as the training dataset.

We do not check a copy of that recipe into this repo until it's been
validated against a real run — the parameters are infra-specific.

---

## Why DeepSeek-R1 is the default

The Creator's research dossier flagged it as the highest-quality
open-weights reasoning teacher with no TOS encumbrance for training a
competitor model. Llama-3.3-70B is the safety net if you want to stay in
the Llama family for licensing simplicity.

Both are MUCH stronger than the Apple-Silicon-friendly Hermes-3-8B. The
trade-off is one of compute envelope: laptop vs cloud GPU.
