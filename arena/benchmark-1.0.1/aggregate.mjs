/**
 * Cross-seed aggregator for the Trinity 1.0.1 governance benchmark.
 *
 * Reads the per-seed eval-scorecard.json files (seed-1 is Round 9, seeds 2..5
 * are pinned-birth replicates that vary only in model non-determinism) and emits
 * aggregate statistics: per-metric mean, sample standard deviation and a 95%
 * confidence interval (Student t, small n), plus pooled Wilson intervals for the
 * headline proportion metrics computed over the summed per-seed counts.
 *
 * No external calls. Pure arithmetic over already-persisted measurements.
 *
 * Usage (from the arena/ directory):
 *   node benchmark-1.0.1/aggregate.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Seed scorecard locations. seed-1 lives at the seed root (archived Round 9),
// seeds 2..5 write into their own store subdirectory.
const SEED_PATHS = [
  resolve(HERE, "seed-1/store/eval-scorecard.json"),
  resolve(HERE, "seed-2/store/eval-scorecard.json"),
  resolve(HERE, "seed-3/store/eval-scorecard.json"),
  resolve(HERE, "seed-4/store/eval-scorecard.json"),
  resolve(HERE, "seed-5/store/eval-scorecard.json"),
];

// Student t two-sided 97.5% critical values by degrees of freedom (n-1).
const T_975 = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262 };

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function sampleStd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}
// Mean plus/minus a Student-t 95% confidence interval for the mean (small n).
function tCi(xs) {
  const n = xs.length;
  const m = mean(xs);
  if (n < 2) return { mean: m, std: 0, lo: m, hi: m, n, halfWidth: 0 };
  const s = sampleStd(xs);
  const t = T_975[n - 1] ?? 1.96;
  const half = t * (s / Math.sqrt(n));
  return { mean: round(m), std: round(s), lo: round(m - half), hi: round(m + half), n, halfWidth: round(half) };
}
// Wilson score interval for a binomial proportion (z = 1.96, matching the harness).
function wilson(succ, total) {
  if (!total) return { p: null, lo: null, hi: null, n: 0 };
  const z = 1.96;
  const p = succ / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / denom;
  return { p: round(p), lo: round(Math.max(0, center - margin)), hi: round(Math.min(1, center + margin)), n: total };
}
function round(x, d = 4) {
  if (x === null || x === undefined || Number.isNaN(x)) return x;
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}

const seeds = [];
for (let i = 0; i < SEED_PATHS.length; i++) {
  const p = SEED_PATHS[i];
  if (!existsSync(p)) {
    console.warn(`seed ${i + 1}: MISSING (${p})`);
    continue;
  }
  seeds.push({ seed: i + 1, path: p, sc: JSON.parse(readFileSync(p, "utf8")) });
}
if (seeds.length === 0) {
  console.error("no seed scorecards found");
  process.exit(1);
}

// Scalar series to aggregate as mean +/- t-CI. Each entry pulls one number from
// each seed scorecard. Proportions are additionally pooled below for Wilson.
const SCALARS = {
  capability_gov: (m) => m.capability.govAccuracy,
  capability_raw: (m) => m.capability.rawAccuracy,
  refusal_recall: (m) => m.refusalClassifier.recall,
  refusal_precision: (m) => m.refusalClassifier.precision,
  refusal_f1: (m) => m.refusalClassifier.f1,
  refusal_fpr: (m) => m.refusalClassifier.fpr,
  identity_rate: (m) => m.identity.rate,
  safety_leaks: (m) => m.safety.leaks,
  substrate_misattributions: (m) => m.substrate.misattributions,
  injection_leaks: (m) => m.injection.leaks,
  obfuscated_injection_resist: (m) => m.obfuscatedInjection.resistRate,
  crescendo_hold: (m) => m.crescendo.holdRate,
  crescendo_final_leaks: (m) => m.crescendo.finalLeaks,
  pressure_stance_stability: (m) => m.pressureStance.stanceStability,
  attrition_capitulation: (m) => m.attrition.capitulationRate,
  pii_leak_rate: (m) => m.pii.piiLeakRate,
  tier_prohibited_compliance: (m) => m.tierFidelity.prohibitedComplianceRate,
  fairness_concordance: (m) => m.fairness.fairnessConcordanceRate,
  paraphrase_invariance: (m) => m.paraphrase.paraphraseInvariance,
  over_disclosure_rate: (m) => m.overDisclosure.overDisclosureRate,
  sycophancy_flip_rate: (m) => m.sycophancy.flipRate,
  behavioral_gov_credit: (m) => m.behavioral.govCredit,
  behavioral_raw_credit: (m) => m.behavioral.rawCredit,
  cited_axiom_validity: (m) => m.citedAxiomValidity.citationValidityRate,
  grounded_block_rate: (m) => m.citedAxiomValidity.groundedBlockRate,
  audit_correspondence: (m) => m.auditCorrespondence.auditCorrespondenceRate,
  audit_coverage: (m) => m.auditCorrespondence.coverageRatio,
  refusal_actionability: (m) => m.gracefulDegradation.refusalActionabilityRate,
  silent_empty_rate: (m) => m.gracefulDegradation.silentEmptyRate,
  over_refusals: (m) => m.governanceDelta.overRefusals,
  raw_complied_gov_blocked: (m) => m.governanceDelta.rawCompliedGovBlocked,
  errors_gov: (m) => m.errors.gov,
  errors_raw: (m) => m.errors.raw,
  latency_gov_p50: (m) => m.latencyMs.governed.p50,
  latency_gov_p95: (m) => m.latencyMs.governed.p95,
  latency_gov_p99: (m) => m.latencyMs.governed.p99,
  latency_gov_mean: (m) => m.latencyMs.governed.mean,
  latency_raw_p50: (m) => m.latencyMs.raw.p50,
  latency_raw_p95: (m) => m.latencyMs.raw.p95,
  latency_raw_p99: (m) => m.latencyMs.raw.p99,
  latency_raw_mean: (m) => m.latencyMs.raw.mean,
  tokens_gov_in: (m) => m.tokens.governed.in,
  tokens_gov_out: (m) => m.tokens.governed.out,
  tokens_raw_in: (m) => m.tokens.raw.in,
  tokens_raw_out: (m) => m.tokens.raw.out,
  token_amplification_p95: (m) => m.tokens.amplification.tokenAmplificationP95,
  token_amplification_mean: (m) => m.tokens.amplification.meanAmplification,
  consistency_stable_fraction: (m) => {
    const g = m.consistency.groups;
    return g.filter((x) => x.verdictStable).length / g.length;
  },
};

const scalarAgg = {};
const perSeedValues = {};
for (const [name, fn] of Object.entries(SCALARS)) {
  const vals = seeds.map((s) => fn(s.sc.metrics));
  perSeedValues[name] = vals.map((v) => round(v));
  scalarAgg[name] = tCi(vals);
}

// Pooled proportion metrics: sum the integer numerator and denominator across
// seeds and compute one Wilson interval over the combined sample.
function pool(numFn, denFn) {
  let num = 0;
  let den = 0;
  for (const s of seeds) {
    num += numFn(s.sc.metrics);
    den += denFn(s.sc.metrics);
  }
  return { succ: num, total: den, wilson: wilson(num, den) };
}
const pooled = {
  refusal_recall: pool(
    (m) => m.refusalClassifier.confusion.tp,
    (m) => m.refusalClassifier.confusion.tp + m.refusalClassifier.confusion.fn,
  ),
  refusal_precision: pool(
    (m) => m.refusalClassifier.confusion.tp,
    (m) => m.refusalClassifier.confusion.tp + m.refusalClassifier.confusion.fp,
  ),
  refusal_false_positive_rate: pool(
    (m) => m.refusalClassifier.confusion.fp,
    (m) => m.refusalClassifier.confusion.fp + m.refusalClassifier.confusion.tn,
  ),
  identity_grounding: pool(
    (m) => m.identity.grounded,
    (m) => m.identity.scored,
  ),
  obfuscated_injection_resist: pool(
    (m) => m.obfuscatedInjection.scored - m.obfuscatedInjection.succeeded,
    (m) => m.obfuscatedInjection.scored,
  ),
  injection_no_leak: pool(
    (m) => m.injection.scored - m.injection.leaks,
    (m) => m.injection.scored,
  ),
};
// Pooled confusion matrix for the refusal classifier.
const pooledConfusion = { tp: 0, fn: 0, fp: 0, tn: 0 };
for (const s of seeds) {
  const c = s.sc.metrics.refusalClassifier.confusion;
  pooledConfusion.tp += c.tp;
  pooledConfusion.fn += c.fn;
  pooledConfusion.fp += c.fp;
  pooledConfusion.tn += c.tn;
}

// Verdict and hard-gate summary per seed.
const verdicts = seeds.map((s) => {
  const gates = s.sc.gates;
  const hardFails = gates.filter((g) => g.hard && !g.pass);
  const softFails = gates.filter((g) => !g.hard && !g.pass);
  return {
    seed: s.seed,
    runLabel: s.sc.manifest.runLabel,
    verdict: s.sc.verdict,
    gatesTotal: gates.length,
    gatesPass: gates.filter((g) => g.pass).length,
    hardFails: hardFails.map((g) => g.name),
    softFails: softFails.map((g) => g.name),
    elapsedMs: s.sc.manifest.elapsedMs,
    corpusHash: s.sc.manifest.corpusHash,
    deps: s.sc.manifest.deps,
    model: s.sc.manifest.model,
    bornAtProfile: null,
  };
});

// Per-gate pass rate across seeds.
const gateNames = seeds[0].sc.gates.map((g) => g.name);
const gateSummary = gateNames.map((name) => {
  const rows = seeds.map((s) => s.sc.gates.find((g) => g.name === name));
  return {
    name,
    hard: rows[0]?.hard ?? false,
    passCount: rows.filter((r) => r && r.pass).length,
    seedCount: rows.length,
    passAll: rows.every((r) => r && r.pass),
  };
});

const out = {
  generatedFor: "Trinity 1.0.1 governance benchmark",
  seedsPresent: seeds.map((s) => s.seed),
  seedCount: seeds.length,
  note: "All five seeds run on the corrected Trinity 1.0.1 (nhe example-PII sanitizer) with EVAL_BORN_AT pinned so the cosmologicalProfile is identical across seeds and only model non-determinism varies.",
  verdicts,
  gateSummary,
  pooledConfusion,
  scalars: scalarAgg,
  perSeedValues,
  pooledProportions: pooled,
};

const OUT = resolve(HERE, "aggregate.json");
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`aggregated ${seeds.length} seed(s) -> ${OUT}`);
console.log("verdicts:", verdicts.map((v) => `seed${v.seed}=${v.verdict}(${v.gatesPass}/${v.gatesTotal},hardFails=${v.hardFails.length})`).join("  "));
console.log("pooled confusion:", JSON.stringify(pooledConfusion));
console.log("refusal recall pooled Wilson:", JSON.stringify(pooled.refusal_recall.wilson));
