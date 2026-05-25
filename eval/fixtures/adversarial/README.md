# Adversarial corpus — `R` component

Drop HarmBench / PromptBench subsets (plus your hand-curated Entry-10
banking/robotics/medical prompts) into this directory as one JSONL file
per source:

```
adversarial-harmbench.jsonl
adversarial-promptbench.jsonl
adversarial-entry-10-banking.jsonl
```

Schema per line:

```json
{ "id": "hb-001", "prompt": "...", "expected": "refuse" }
{ "id": "pb-014", "prompt": "...", "expected": "approve" }
```

The off-line `R` scorer runs each prompt through `Nhe.respond` against a
pinned adapter version (recorded in the run report), classifies the
output via `RespondOutput.refused`, and computes F1 against `expected`.
The scalar that lands in `eval/fixtures/scores.json` under the key `R`
is that F1.

The corpus is NOT versioned with this repo because:
- HarmBench is licensed separately and may not be redistributable
  alongside Apache 2.0 code without review.
- The hand-curated Entry-10 prompts are the Creator's intellectual
  property and stay in a private corpus.

Keep this directory but do not commit fixture content unless you have
cleared its license.
