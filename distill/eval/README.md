# `@teleologyhi-sdk/distill/eval`

Evaluation harness for distilled TeleologyHI students. Two stacks:

1. **lm-evaluation-harness** — accuracy on three custom benchmarks (semiotic-coherence, teleological-alignment, nhe-ontological-correctness).
2. **Inspect AI** — agentic safety eval mirroring the MAIC seed rule pack.

The Phi-Prime metric defined in [`../../PHI_PRIME.md`](../../PHI_PRIME.md)
aggregates results from this directory.

---

## lm-evaluation-harness

Tasks (each is a YAML in `lm-eval-tasks/`):

| Task | What it measures | Φ′ component |
|---|---|---|
| `semiotic-coherence` | Peircean triadic prompt consistency | (auxiliary) |
| `teleological-alignment` | Multi-turn purpose-tracking | `P` |
| `nhe-ontological-correctness` | Refusal/redirect/approve calibration | `R` |

Run all three:

```bash
cd distill
lm_eval --model hf \
    --model_args pretrained=TeleologyHI/him-distilled-3b \
    --tasks semiotic-coherence,teleological-alignment,nhe-ontological-correctness \
    --include_path ./eval/lm-eval-tasks \
    --output_path ./eval/results
```

**Fixture status (internal backlog item B6, open):** the YAMLs reference
`{semiotic,teleological,nhe-ontological}.jsonl` fixture files. Those need
to be authored by the Creator (50-question handwritten sets per task) before
the eval produces meaningful numbers. The fixtures should live next to the
YAML so `--include_path` picks them up.

---

## Inspect AI safety eval

Six-prompt smoke test covering the four refusal categories. Useful as a
gating signal before any release.

```bash
inspect eval ./eval/inspect/safety.py --model hf/TeleologyHI/him-distilled-3b
```

Expand the prompt set by appending to the `REFUSAL_PROMPTS` list in
`safety.py`. The scoring rubric (keyword presence) is intentionally simple;
upgrade to an LLM-judge once a calibration baseline exists.

---

## Wiring into CI

Both stacks are GitHub-runner-friendly **only** for the smallest students.
A 3B-class student takes ~10 minutes on a CPU-only runner for the full
suite. Realistic pipeline:

1. CI runs the lm-eval + Inspect AI smoke against `MockAdapter`-equivalent
   output to verify the harness is wired (catches YAML / metric breaks).
2. A nightly job on a self-hosted runner with a GPU runs the full
   evaluation against the latest published student.
3. Results land in `eval/results/<date>/` and are compared against the
   previous run by `PHI_PRIME.md`'s spec.

Neither (2) nor (3) is wired today.

---

## Recording results

`eval/results/` is gitignored. Manually commit summaries to `eval/history/`
with the following structure if you want a public trail:

```
eval/history/<YYYY-MM-DD>-<student-id>/
  phi-prime.json          # the aggregated Φ′ report
  lm-eval.json            # raw lm-eval-harness output
  inspect-safety.json     # raw Inspect AI output
  notes.md                # qualitative observations
```
