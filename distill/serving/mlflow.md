# MLflow runbook — TeleologyHI Trinity LLMOps

> **Why MLflow?** The Creator's directive (Entry 14+): every Trinity training
> run must be observable end-to-end and reproducible by any third party who
> clones the monorepo. MLflow is the open-source canonical choice — Apache
> 2.0, language-agnostic, multi-backend (local SQLite + S3/GCS/Azure for
> remote), and ships first-class flavors for `transformers`, `pytorch`, and
> `mlx`. The license posture matches the project (Apache 2.0 throughout).

This runbook covers the **Apple Silicon local-first** path (the Creator's M5
/ 24 GB) and the **remote registry** path (S3 / GCS / Azure / Postgres) for
when promotion to Production needs an off-laptop store.

---

## 1. What MLflow tracks here

Three concerns, one tool:

1. **Tracking** — parameters, metrics, artefacts per pipeline stage.
   - `corpus_prep` stage: teacher id, system-prompt SHA, input dataset SHA,
     samples/second, total wall time, output corpus SHA.
   - `train_mlx` stage: student id, LoRA rank/alpha/scale, learning rate,
     batch size, max seq length, iters, streaming `train_loss` and
     `val_loss` per logged iteration, final fused model path, optional
     HF push exit code.
2. **Model registry** — once a Trinity candidate clears the eval gate
   (`@teleologyhi-sdk/eval` Φ′), it is registered as
   `teleologyhi-trinity` with version + stage (`None` → `Staging` →
   `Production` → `Archived`). The promotion path is governed; see §6 below.
3. **Lineage** — every registered model carries the input dataset SHA,
   teacher id, student id, and the run id that produced it. Reproducibility
   means a third party can re-derive the artefact from the lineage record.

The wrapper module is [`pipelines/mlflow_tracking.py`](../pipelines/mlflow_tracking.py).
It is **opt-in** — set `TELEOLOGYHI_MLFLOW=1` to activate. When disabled,
every `track_stage(...)` call is a no-op and the pipeline behaves exactly
as it did before MLflow was added.

---

## 2. Local-first: SQLite + filesystem

The default backend. Zero infrastructure, all artefacts live under
`distill/mlruns/` (already in `.gitignore`).

```bash
cd distill/pipelines

# 1. Install the dependency (already in requirements.txt)
pip install -r requirements.txt

# 2. Enable tracking for the current shell
export TELEOLOGYHI_MLFLOW=1

# 3. Run the pipeline — both stages now log
python corpus_prep.py --input ../output/export/interactions.distilabel.jsonl \
                      --output ../output/synthetic-train.jsonl \
                      --max-samples 500

python train_mlx.py --train ../output/synthetic-train.jsonl \
                    --out ../output/student \
                    --epochs 2

# 4. Browse the runs locally
mlflow ui --backend-store-uri file:./mlruns --port 5000
# → open http://127.0.0.1:5000
```

Smoke-test the wrapper without running a real pipeline:

```bash
TELEOLOGYHI_MLFLOW=1 python pipelines/mlflow_tracking.py
# → prints the configured tracking URI + experiment name + a synthetic run
```

---

## 3. Remote backend (recommended for shared registry)

Once more than one operator (or one operator + CI) needs to see runs, push
the tracking server off-laptop. MLflow supports three production-grade
backend pairings:

| Backend store | Artefact store | Use when |
|---|---|---|
| Postgres / MySQL | S3 (or compatible: R2, MinIO) | Cloud-native, multi-user |
| Postgres / MySQL | GCS | GCP-native deployment |
| Postgres / MySQL | Azure Blob | Azure-native deployment |

Configuration is environment-driven. The pipeline scripts honour these
without code changes:

```bash
# Backend store (run metadata, parameters, metrics, tags)
export MLFLOW_TRACKING_URI="postgresql://user:pass@host:5432/mlflow"

# Artefact store (corpora, model weights, prompt templates)
export MLFLOW_ARTIFACT_LOCATION="s3://teleologyhi-mlflow/artifacts"
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."

# Optional: override the experiment name
export MLFLOW_EXPERIMENT_NAME="teleologyhi-trinity-distillation"

# Optional: override the run name
export MLFLOW_RUN_NAME="trinity-corpus_prep-$(date -u +%Y%m%d-%H%M%S)"

# Enable tracking
export TELEOLOGYHI_MLFLOW=1

# Run the pipeline normally
./run_distill.sh
```

The MLflow tracking server itself is a single command (run on the host
that owns the Postgres + S3):

```bash
mlflow server \
  --backend-store-uri postgresql://user:pass@host:5432/mlflow \
  --default-artifact-root s3://teleologyhi-mlflow/artifacts \
  --host 0.0.0.0 \
  --port 5000
```

Behind a reverse proxy + auth (Caddy / nginx + basic auth + TLS) in any
production deployment — the open-source `mlflow server` ships no auth by
default.

---

## 4. Canonical tags

Every run started via `track_stage(stage_name, ...)` carries the four
canonical tags so the LLMOps surface can slice runs cleanly:

| Tag | Value | Purpose |
|---|---|---|
| `teleologyhi.workspace` | `distill` | distinguishes from future `cloud`/`arena` MLflow runs |
| `teleologyhi.stage` | `corpus_prep`, `train_mlx`, `eval`, `register`, ... | filter the parent run by phase |
| `teleologyhi.baseline` | `1.0.0-trinity` | aligns with the monorepo-wide version baseline |
| `teleologyhi.model.target` | `TeleologyHI/Trinity` | the Hugging Face repo the run is destined to publish into |

Stage-specific tags pile on:

- `teleologyhi.teacher` — the teacher HF id (corpus_prep only)
- `teleologyhi.student` — the student HF id (train_mlx only)
- `teleologyhi.outcome` — `succeeded` | `failed` (set by the wrapper)
- `teleologyhi.error` — exception class name on failure

---

## 5. Eval gate integration

The `@teleologyhi-sdk/eval` Φ′ harness produces a single JSON scorecard.
The promotion path is:

1. `train_mlx` finishes → fused model lands under `distill/output/student/fused/`.
2. Operator runs `eval` against the fused model.
3. Operator logs the scorecard back to the parent MLflow run as an
   artefact named `eval/phi-prime.json`.
4. If `phi_prime.value >= release_threshold`, the model is registered.

The registration call (manual today; CI in a future cut):

```python
import mlflow
from mlflow.tracking import MlflowClient

mlflow.set_tracking_uri("file:./mlruns")
client = MlflowClient()

# Register a new version under the canonical model name
result = mlflow.register_model(
    model_uri="runs:/<RUN_ID>/fused-model",
    name="teleologyhi-trinity",
    tags={
        "phi_prime": "0.86",
        "teacher": "NousResearch/Hermes-3-Llama-3.1-8B",
        "student": "Qwen/Qwen2.5-3B-Instruct",
    },
)

# Optionally transition the version to Staging right away
client.transition_model_version_stage(
    name="teleologyhi-trinity",
    version=result.version,
    stage="Staging",
)
```

---

## 6. Promotion gates (governed)

The Creator owns the promotion gate. The four-stage MLflow lifecycle maps
cleanly onto the project's release discipline:

| MLflow stage | Project meaning | Required evidence |
|---|---|---|
| `None` (just registered) | Candidate Trinity build | `phi_prime >= release_threshold` + scorecard logged |
| `Staging` | Available for arena duels + internal smoke | Two consecutive successful runs at the same phi_prime tier |
| `Production` | The canonical `TeleologyHI/Trinity` HF artefact | Creator sign-off + arena win-rate trend + deprecation date for previous Production |
| `Archived` | Replaced by a newer version | Always Archive the previous Production when a new one takes its slot — never delete |

Run promotion against the model registry, not against the artefact store
— the artefacts stay where they are; only the stage label moves. This is
how the Creator preserves the full lineage record across the lifetime of
Trinity.

---

## 7. Disabling MLflow

If `TELEOLOGYHI_MLFLOW` is unset (or any value other than `"1"`), the
wrapper short-circuits before importing `mlflow` at all. The pipeline runs
identically to its pre-MLflow behaviour — there is no implicit dependency.

This is intentional: a third party who clones the monorepo can run the
full distillation pipeline without ever installing MLflow or knowing what
it is. The observability is opt-in, by Creator design.
