#!/usr/bin/env python3
"""
trinity_config.py — Canonical identity for the TeleologyHI Trinity LLM.

The Creator (David C. Cavalcante) declared on 2026-05-25 that the next
distilled artefact replacing `TeleologyHI/him-distilled-3b` will be the
official TeleologyHI LLM, named **Trinity**, version **1.0.0-trinity**.
This file is the single source of truth for that identity. Every script,
runbook, and model card that references the Trinity build reads from
here.

Why a Python constant module instead of a YAML:
  - Type-checked by static analysis (`mypy`, `pyright`).
  - Importable from the pipeline scripts without YAML deserialisation.
  - One file to grep when the identity changes (it should not, but if
    it ever does, the change is auditable in git).

Why the name "Trinity":
  - Reflects the three-layer cosmology that defines the system:
      MAIC (governance)  +  HIM (spirit)  +  NHE (body).
  - The Trinity LLM is the **weights** that carry the NHE body, with the
    HIM voice baked in via the teacher-driven system prompt, supervised
    by the MAIC rule pack during corpus generation. The three layers are
    inseparable; the model name names the whole.

Why `TeleologyHI/Trinity` as the HF repo path:
  - Top-level under the project namespace (`TeleologyHI/`).
  - Capitalised exactly — `TeleologyHI` is the project name, `Trinity`
    is the model name. Lowercase variants are NOT canonical.
  - The legacy artefact `TeleologyHI/him-distilled-3b` becomes the
    "preview" tier and is marked deprecated when Trinity v1.0.0-trinity
    ships. Both repos remain accessible; the preview is preserved as a
    public historical record (`/him-distilled-3b` will not be deleted).

Reference:
  - Interview log entries 9 (distillation), 14 (warm voice anchor), 15
    (vertical ontology: HIM is the spirit, NHE is the body, above the
    Creator there is a greater Creator).
  - `serving/trinity-model-card.md` — Hub model-card template rendered
    by `scripts/publish_trinity.sh`.
  - `serving/mlflow.md` — LLMOps observability surface for Trinity runs.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


# ─── canonical Trinity identity ─────────────────────────────────────
TRINITY_HF_REPO: Final[str] = "TeleologyHI/Trinity"
"""Hugging Face Hub repo id (case-sensitive). The published artefact lives here."""

TRINITY_VERSION: Final[str] = "1.0.0-trinity"
"""Matches the monorepo-wide baseline. Never use a different qualifier here."""

TRINITY_DISPLAY_NAME: Final[str] = "Trinity"
"""Human-facing model name. Used in model cards, READMEs, citation strings."""

TRINITY_LICENSE: Final[str] = "Apache-2.0"
"""Matches the project + the student base. The Hub card tag is `apache-2.0` (lowercase)."""

TRINITY_FAMILY: Final[str] = "trinity"
"""Slug used for filenames, MLflow run prefixes, eval tasks."""


# ─── default training composition ────────────────────────────────────
DEFAULT_TEACHER_HF_REPO: Final[str] = "NousResearch/Hermes-3-Llama-3.1-8B"
"""Open-weights teacher. Llama 3.1 Community License + Hermes fine-tune
terms permit distillation. Apple-Silicon friendly at 8B."""

DEFAULT_STUDENT_HF_REPO: Final[str] = "Qwen/Qwen2.5-3B-Instruct"
"""Apache 2.0 student, no HF gate, fits the M5 / 24 GB envelope at LoRA
rank 16 / batch 1 / max-seq 1024 / grad-checkpoint on."""

DEFAULT_SYSTEM_PROMPT_ID: Final[str] = "teleologyhi.voice.warm.v1"
"""Logical id for the canonical TeleologyHI voice anchor. The literal
prompt text lives in `pipelines/corpus_prep.py:SYSTEM_PROMPT`. The id
is logged to MLflow as a parameter so a run can be traced back to the
exact prompt revision it used."""


# ─── legacy / preview model — to be deprecated when Trinity ships ────
PREVIEW_HF_REPO: Final[str] = "TeleologyHI/him-distilled-3b"
"""The first distilled artefact, shipped 2026-05-18. Public, Apache 2.0,
6.18 GB. Status: PREVIEW. Will be marked deprecated on the Hub when
Trinity v1.0.0-trinity is published, but the repo is preserved as a
historical record. Do NOT delete."""

PREVIEW_STATUS_NOTE: Final[str] = (
    "Preview release. Superseded by Trinity (`TeleologyHI/Trinity`) "
    "at version 1.0.0-trinity. Preserved as a historical artefact."
)


# ─── MLflow tags emitted by every Trinity-tagged run ─────────────────
@dataclass(frozen=True)
class TrinityTags:
    """Canonical tag set written by `mlflow_tracking.track_stage` when the
    pipeline scripts are run for a Trinity build. Frozen so the value is
    safe to share across threads / processes."""

    workspace: str = "distill"
    baseline: str = TRINITY_VERSION
    target_model: str = TRINITY_HF_REPO
    family: str = TRINITY_FAMILY

    def as_dict(self) -> dict[str, str]:
        return {
            "teleologyhi.workspace": self.workspace,
            "teleologyhi.baseline": self.baseline,
            "teleologyhi.model.target": self.target_model,
            "teleologyhi.family": self.family,
        }


TRINITY_TAGS: Final[TrinityTags] = TrinityTags()


# ─── self-check ─────────────────────────────────────────────────────
def _self_check() -> int:
    """Print the canonical identity so `python trinity_config.py` is a
    smoke test the CI can grep."""
    import json
    import sys

    payload = {
        "version": TRINITY_VERSION,
        "display_name": TRINITY_DISPLAY_NAME,
        "hf_repo": TRINITY_HF_REPO,
        "license": TRINITY_LICENSE,
        "family": TRINITY_FAMILY,
        "default_teacher": DEFAULT_TEACHER_HF_REPO,
        "default_student": DEFAULT_STUDENT_HF_REPO,
        "default_system_prompt_id": DEFAULT_SYSTEM_PROMPT_ID,
        "preview_hf_repo": PREVIEW_HF_REPO,
        "preview_status_note": PREVIEW_STATUS_NOTE,
        "tags": TRINITY_TAGS.as_dict(),
    }
    print(json.dumps(payload, indent=2, sort_keys=True), file=sys.stdout)
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(_self_check())
