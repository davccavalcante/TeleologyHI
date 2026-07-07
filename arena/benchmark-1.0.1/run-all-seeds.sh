#!/usr/bin/env bash
#
# Reproduce the Trinity 1.0.1 governance benchmark seed runs.
#
# All five seeds run on the corrected Trinity 1.0.1 (nhe example-PII sanitizer),
# under identical corpus, scorers and package versions, differing only in the
# model's own non-determinism. The EVAL_BORN_AT pin fixes the birth timestamp so
# every seed instantiates the identical deterministic cosmologicalProfile,
# isolating cross-seed variance to the model.
#
# Preconditions (checked by the operator, not this script):
#   - arena resolves @teleologyhi-sdk/{maic,him,nhe} to the local 1.0.1 dists
#   - node governance-eval-selftest.mjs reports 42 passed, 0 failed
#   - .env.local carries a valid GROK_API_KEY and GROK_MODEL
#
# Runs are strictly sequential: parallel execution would contaminate the latency
# measurement. Each run writes its own store and its own eval-results.jsonl and
# eval-scorecard.json, never overwriting another seed.
#
# Usage (from the arena/ directory):
#   bash benchmark-1.0.1/run-all-seeds.sh
set -euo pipefail

ARENA="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ARENA"
BM="$ARENA/benchmark-1.0.1"
BORN_AT="2026-07-05T18:38:45.107Z"   # seed-1 (Round 9) birth timestamp

for SEED in 1 2 3 4 5; do
  echo "=== seed-${SEED} start ==="
  EVAL_STORE_ROOT="$BM/seed-${SEED}/store" \
  EVAL_BORN_AT="$BORN_AT" \
  RUN_LABEL="bench-seed-${SEED}" \
  node --env-file=.env.local governance-eval-harness.mjs > "$BM/seed-${SEED}/run.log" 2>&1
  echo "=== seed-${SEED} done, verdict: ==="
  node -e "const s=require('$BM/seed-${SEED}/store/eval-scorecard.json');console.log(s.verdict, s.gates.filter(g=>!g.pass&&g.hard).length,'hard fails')"
done

echo "=== aggregating ==="
node "$BM/aggregate.mjs"
echo "=== charts ==="
python3 "$BM/make_charts.py"
