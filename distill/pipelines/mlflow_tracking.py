#!/usr/bin/env python3
"""
mlflow_tracking.py — Open-source LLM/MLOps tracking glue for the
TeleologyHI distillation pipeline.

Why this exists:
  The Creator's directive (2026-05-25) is that every Trinity LLM training
  run must be observable end-to-end: parameters, metrics, artifacts,
  dataset snapshots, model lineage, and the full LLMOps loop (training
  serving skew, drift detection, regression eval gates). MLflow is the
  open-source canonical choice for this — Apache 2.0, multi-backend
  (local SQLite + S3/GCS/Azure for remote), and integrated with Hugging
  Face Hub + the `mlflow.transformers` flavor.

  This module is the **thin wrapper** that:
    1. Configures a deterministic tracking URI (local SQLite by default,
       overridable via `MLFLOW_TRACKING_URI` env var for remote backends).
    2. Names experiments consistently across pipeline stages so a single
       Trinity training run shows up as one parent run with stage children.
    3. Exposes context managers that the pipeline scripts (corpus_prep.py,
       train_mlx.py) can use without re-implementing MLflow boilerplate.
    4. Falls back gracefully when mlflow is not installed — the pipeline
       still runs; tracking is opt-in by setting `TELEOLOGYHI_MLFLOW=1`.

  This module does NOT perform any training run; it only provides the
  tracking surface. The actual end-to-end Trinity LLM run is the next
  step after this audit.

Reference:
  - MLflow LLM tracking: https://mlflow.org/docs/latest/llms/index.html
  - MLflow Model Registry: https://mlflow.org/docs/latest/model-registry.html
  - MLflow transformers flavor: https://mlflow.org/docs/latest/llms/transformers/

Design discipline (per supreme-ai-engineering #4 + #5):
  - **Every pipeline stage has input contract, output contract, validation
    gate, failure mode documented.** Wrap each stage in
    `track_stage(stage_name, params)` so the run carries the canonical
    metadata for the LLMOps loop.
  - **Data lineage, feature freshness, model version, prompt version,
    tool version tracked for every inference.** Each stage logs the input
    dataset path + SHA-256, the teacher/student model id + revision, the
    prompt template (system prompt SHA), and the output artifact path +
    size + SHA.
  - **Model registry with cards, training lineage, eval scorecard,
    approval gate, deprecation timeline.** This module talks to the local
    `mlruns/` tracking store; the registry promotion path
    (Staging → Production) is documented in `serving/mlflow.md`.

Environment variables:
  TELEOLOGYHI_MLFLOW          opt-in switch ("1" enables, anything else disables)
  MLFLOW_TRACKING_URI         override (default: file:./mlruns)
  MLFLOW_EXPERIMENT_NAME      override (default: "teleologyhi-trinity-distillation")
  MLFLOW_RUN_NAME             override (default: f"trinity-{stage}-{timestamp}")
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Optional


DEFAULT_TRACKING_URI = "file:./mlruns"
DEFAULT_EXPERIMENT_NAME = "teleologyhi-trinity-distillation"


def _is_enabled() -> bool:
    """True when the operator has explicitly opted into MLflow tracking."""
    return os.environ.get("TELEOLOGYHI_MLFLOW", "").strip() == "1"


def _import_mlflow():
    """Lazy import — keeps mlflow optional. Returns the mlflow module or None."""
    if not _is_enabled():
        return None
    try:
        import mlflow  # type: ignore  # noqa: PLC0415
        return mlflow
    except ImportError:
        print(
            "WARN: TELEOLOGYHI_MLFLOW=1 but `mlflow` is not installed. "
            "Run `pip install -r requirements.txt`. Continuing without tracking.",
            file=sys.stderr,
        )
        return None


def _configure_tracking(mlflow) -> None:
    """Apply tracking URI + experiment name once per process."""
    tracking_uri = os.environ.get("MLFLOW_TRACKING_URI", DEFAULT_TRACKING_URI)
    mlflow.set_tracking_uri(tracking_uri)
    experiment_name = os.environ.get("MLFLOW_EXPERIMENT_NAME", DEFAULT_EXPERIMENT_NAME)
    mlflow.set_experiment(experiment_name)


@dataclass
class StageContext:
    """Lightweight wrapper around an MLflow run context.

    Behaves as a no-op when MLflow is disabled — the pipeline code path
    is identical with or without tracking.
    """

    mlflow: Any = None
    run: Any = None
    params: dict[str, Any] = field(default_factory=dict)
    metrics: dict[str, float] = field(default_factory=dict)
    artifacts: list[Path] = field(default_factory=list)

    @property
    def enabled(self) -> bool:
        return self.mlflow is not None

    def log_param(self, key: str, value: Any) -> None:
        self.params[key] = value
        if self.enabled:
            self.mlflow.log_param(key, value)

    def log_params(self, params: dict[str, Any]) -> None:
        for k, v in params.items():
            self.log_param(k, v)

    def log_metric(self, key: str, value: float, step: Optional[int] = None) -> None:
        self.metrics[key] = float(value)
        if self.enabled:
            if step is not None:
                self.mlflow.log_metric(key, float(value), step=step)
            else:
                self.mlflow.log_metric(key, float(value))

    def log_metrics(self, metrics: dict[str, float], step: Optional[int] = None) -> None:
        for k, v in metrics.items():
            self.log_metric(k, v, step=step)

    def log_artifact(self, path: Path, artifact_path: Optional[str] = None) -> None:
        self.artifacts.append(path)
        if self.enabled and path.exists():
            self.mlflow.log_artifact(str(path), artifact_path=artifact_path)

    def log_dataset_input(self, path: Path, role: str = "input") -> None:
        """Log a dataset file as an input artifact + record its SHA-256 + size."""
        if not path.exists():
            print(f"WARN: log_dataset_input: {path} does not exist", file=sys.stderr)
            return
        sha = _file_sha256(path)
        size = path.stat().st_size
        self.log_param(f"dataset.{role}.path", str(path))
        self.log_param(f"dataset.{role}.sha256", sha)
        self.log_param(f"dataset.{role}.bytes", size)

    def log_text(self, text: str, artifact_file: str) -> None:
        """Log a string as a text artifact (typically the system prompt)."""
        if self.enabled:
            self.mlflow.log_text(text, artifact_file)
        # Always also record the SHA so the run carries the prompt fingerprint.
        sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
        self.log_param(f"text.{artifact_file}.sha256", sha)


@contextlib.contextmanager
def track_stage(
    stage_name: str,
    *,
    parent_run_id: Optional[str] = None,
    nested: bool = False,
    extra_tags: Optional[dict[str, str]] = None,
) -> Iterator[StageContext]:
    """Context manager for a single pipeline stage.

    Usage:

        with track_stage("corpus_prep", extra_tags={"teacher": teacher_id}) as run:
            run.log_dataset_input(input_path, role="seed")
            run.log_param("max_samples", max_samples)
            ...
            for i, sample in enumerate(samples):
                run.log_metric("samples_generated", i + 1, step=i)
            run.log_artifact(output_path, artifact_path="corpus")

    When MLflow is disabled the context still yields a `StageContext` whose
    `enabled` is False; calls are no-ops but the dict fields still
    accumulate the values so the caller can inspect them locally.
    """
    mlflow = _import_mlflow()
    if mlflow is None:
        yield StageContext()
        return

    _configure_tracking(mlflow)
    run_name = os.environ.get(
        "MLFLOW_RUN_NAME",
        f"trinity-{stage_name}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}",
    )
    tags: dict[str, str] = {
        "teleologyhi.workspace": "distill",
        "teleologyhi.stage": stage_name,
        "teleologyhi.baseline": "1.0.0-trinity",
        "teleologyhi.model.target": "TeleologyHI/Trinity",
    }
    if extra_tags:
        tags.update({k: str(v) for k, v in extra_tags.items()})

    start_kwargs: dict[str, Any] = {"run_name": run_name, "tags": tags}
    if nested:
        start_kwargs["nested"] = True
    if parent_run_id is not None:
        start_kwargs["parent_run_id"] = parent_run_id

    with mlflow.start_run(**start_kwargs) as run:
        ctx = StageContext(mlflow=mlflow, run=run)
        try:
            yield ctx
        except Exception as exc:
            # Record the failure on the run so the LLMOps observability surface
            # captures it instead of swallowing silently.
            mlflow.set_tag("teleologyhi.outcome", "failed")
            mlflow.set_tag("teleologyhi.error", type(exc).__name__)
            raise
        else:
            mlflow.set_tag("teleologyhi.outcome", "succeeded")


def log_pipeline_summary(summary: dict[str, Any], output_path: Optional[Path] = None) -> None:
    """Persist a pipeline-level summary JSON next to mlruns/ so a human
    can grep it without launching the MLflow UI. Best-effort; never raises.
    """
    target = output_path or Path("./mlruns/pipeline-summary.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        with target.open("w", encoding="utf-8") as fh:
            json.dump(summary, fh, indent=2, sort_keys=True)
    except OSError as exc:
        print(f"WARN: failed to write pipeline summary {target}: {exc}", file=sys.stderr)


def _file_sha256(path: Path, chunk_size: int = 1024 * 1024) -> str:
    """SHA-256 of a file, streamed in 1 MB chunks."""
    hasher = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(chunk_size), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


# ─── self-check ──────────────────────────────────────────────────────
def _self_check() -> int:
    """Tiny self-check so `python mlflow_tracking.py` is a smoke test."""
    print(f"TELEOLOGYHI_MLFLOW = {os.environ.get('TELEOLOGYHI_MLFLOW', '<unset>')}", file=sys.stderr)
    print(f"MLFLOW_TRACKING_URI = {os.environ.get('MLFLOW_TRACKING_URI', DEFAULT_TRACKING_URI)}", file=sys.stderr)
    print(f"MLFLOW_EXPERIMENT_NAME = {os.environ.get('MLFLOW_EXPERIMENT_NAME', DEFAULT_EXPERIMENT_NAME)}", file=sys.stderr)
    with track_stage("self_check", extra_tags={"test": "true"}) as run:
        print(f"  enabled = {run.enabled}", file=sys.stderr)
        run.log_param("smoke", "ok")
        run.log_metric("smoke_metric", 1.0)
    print(f"  params = {run.params}", file=sys.stderr)
    print(f"  metrics = {run.metrics}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(_self_check())
