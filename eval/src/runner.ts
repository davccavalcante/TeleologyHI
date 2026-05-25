import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { computePhiPrime } from "@teleologyhi-sdk/him";
import {
  ALL_AUDIT_EVENT_KINDS,
  CreatorKeyring,
  LocalMaic,
} from "@teleologyhi-sdk/maic";
import {
  PhiPrimeFixturesSchema,
  type PhiPrimeFixtures,
  type PhiPrimeRunResult,
  type ProvenanceBlock,
  type RunPhiPrimeOptions,
} from "./types.js";

const DEFAULT_PROVENANCE_MAX_AGE_DAYS = 90;

/**
 * Φ′ release-gate runner. Loads `P / R / D` from a fixtures file,
 * computes `C` live from an `@teleologyhi-sdk/maic` instance, feeds the
 * four into `computePhiPrime`, returns the full report.
 *
 * The runner is **not** the place where dialogues are authored. The
 * Creator curates the dialogues + adversarial labels + dream values
 * offline (one-shot runs, possibly distributed across machines), drops
 * the aggregated scalars + provenance into `fixtures/scores.json`, and
 * this runner makes the release-gate verdict reproducible.
 *
 * Provenance staleness (>90 days by default) downgrades a `pass` to
 * `warn` — the gate is only as fresh as its underlying measurements.
 */
export async function runPhiPrime(
  opts: RunPhiPrimeOptions = {},
): Promise<PhiPrimeRunResult> {
  const fixturesPath =
    opts.fixturesPath ?? resolve(process.cwd(), "fixtures/scores.json");
  const raw = await readFile(fixturesPath, "utf8");
  const fixtures = parseFixtures(raw, fixturesPath);

  const P = averageOrScalar(fixtures.P);
  const C = await computeComplianceCoverage(opts.maic);

  const components = { P, R: fixtures.R, C, D: fixtures.D };
  const baseReport = computePhiPrime(components);

  const maxAgeDays = opts.provenanceMaxAgeDays ?? DEFAULT_PROVENANCE_MAX_AGE_DAYS;
  const downgrades = collectProvenanceDowngrades(fixtures.provenance, maxAgeDays);

  // Downgrade pass→warn when provenance is stale; never downgrade block.
  const report =
    downgrades.length > 0 && baseReport.gate === "pass"
      ? { ...baseReport, gate: "warn" as const }
      : baseReport;

  return {
    fixtures,
    components,
    report,
    provenance: fixtures.provenance,
    downgrades,
  };
}

function parseFixtures(raw: string, path: string): PhiPrimeFixtures {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `runPhiPrime: fixtures at ${path} is not valid JSON — ${(err as Error).message}`,
    );
  }
  // Strip leading-underscore convenience fields (e.g. `_comment_`) before
  // schema validation so authors can document the fixture inline without
  // tripping zod's strict mode.
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const k of Object.keys(parsed)) {
      if (k.startsWith("_")) delete (parsed as Record<string, unknown>)[k];
    }
  }
  const result = PhiPrimeFixturesSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `runPhiPrime: fixtures at ${path} failed schema validation:\n${issues}`,
    );
  }
  return result.data;
}

function averageOrScalar(value: number | readonly number[]): number {
  if (typeof value === "number") return value;
  if (value.length === 0) return 0;
  return value.reduce((a, b) => a + b, 0) / value.length;
}

function collectProvenanceDowngrades(
  provenance: ProvenanceBlock,
  maxAgeDays: number,
): readonly string[] {
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const out: string[] = [];
  for (const k of ["P", "R", "D"] as const) {
    const entry = provenance[k];
    const ageMs = now - Date.parse(entry.asOf);
    if (ageMs > maxAgeMs) {
      const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      out.push(`${k} provenance is ${days}d old (>${maxAgeDays}d threshold)`);
    }
  }
  return out;
}

/**
 * `C` is mechanical: it asks the supplied MAIC instance (or a transient
 * empty one) to project its audit log onto both shipped frameworks. The
 * coverage value is the mean across frameworks; a release stays at 1.0
 * as long as every `AuditEventKind` declared in `@teleologyhi-sdk/maic`
 * is mapped. The denominator is imported live from maic
 * (`ALL_AUDIT_EVENT_KINDS`) so new kinds can never silently inflate `C`.
 */
async function computeComplianceCoverage(maic?: LocalMaic): Promise<number> {
  const target = maic ?? (await transientMaic());
  const frameworks = ["iso-42001", "eu-ai-act"] as const;
  const totalKinds = ALL_AUDIT_EVENT_KINDS.length;
  let sum = 0;
  for (const f of frameworks) {
    const report = await target.toCompliance(f);
    const uncovered = report.uncoveredKinds.length;
    sum += 1 - uncovered / totalKinds;
  }
  return sum / frameworks.length;
}

let _transient: LocalMaic | undefined;
async function transientMaic(): Promise<LocalMaic> {
  if (_transient) return _transient;
  const dir = await mkdtemp(join(tmpdir(), "phi-prime-transient-"));
  const kr = CreatorKeyring.generate();
  _transient = await LocalMaic.open({
    storeDir: dir,
    creatorPublicKey: kr.publicKey(),
  });
  return _transient;
}
