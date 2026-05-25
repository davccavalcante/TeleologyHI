import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(HERE, "..", "dist", "cli.js");

function freshProvenanceJson() {
  const now = new Date().toISOString();
  return {
    P: { source: "test:fixture-P", asOf: now },
    R: { source: "test:fixture-R", asOf: now },
    D: { source: "test:fixture-D", asOf: now },
  };
}

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileP("node", [CLI, ...args]);
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", code: e.code ?? 1 };
  }
}

describe("teleologyhi-phi-prime CLI", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "phi-prime-cli-"));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("--help prints usage and exits 0", async () => {
    const { stdout, code } = await runCli(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toMatch(/teleologyhi-phi-prime/);
    expect(stdout).toMatch(/Exit codes:/);
    expect(stdout).toMatch(/0\s+gate: pass/);
    expect(stdout).toMatch(/1\s+gate: warn/);
    expect(stdout).toMatch(/2\s+gate: block/);
  });

  it("exits 0 (pass) with strong fresh-provenance fixtures", async () => {
    const fpath = join(dir, "pass.json");
    await writeFile(
      fpath,
      JSON.stringify({ P: 0.95, R: 0.98, D: 0.7, provenance: freshProvenanceJson() }),
    );
    const { stdout, code } = await runCli([`--fixtures=${fpath}`]);
    expect(stdout).toMatch(/gate: PASS/);
    expect(code).toBe(0);
  });

  it("exits 2 (block) when R falls below the hard target", async () => {
    const fpath = join(dir, "block.json");
    await writeFile(
      fpath,
      JSON.stringify({ P: 0.95, R: 0.5, D: 0.6, provenance: freshProvenanceJson() }),
    );
    const { stdout, code } = await runCli([`--fixtures=${fpath}`]);
    expect(stdout).toMatch(/gate: BLOCK/);
    expect(code).toBe(2);
  });

  it("exits 1 (warn) when P falls into the soft-tolerance window", async () => {
    const fpath = join(dir, "warn.json");
    await writeFile(
      fpath,
      JSON.stringify({ P: 0.78, R: 0.96, D: 0.6, provenance: freshProvenanceJson() }),
    );
    const { stdout, code } = await runCli([`--fixtures=${fpath}`]);
    expect(stdout).toMatch(/gate: WARN/);
    expect(code).toBe(1);
  });

  it("prints downgrade notices when provenance is stale", async () => {
    const fpath = join(dir, "stale.json");
    const stale = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    await writeFile(
      fpath,
      JSON.stringify({
        P: 0.95,
        R: 0.98,
        D: 0.7,
        provenance: {
          P: { source: "old", asOf: stale },
          R: { source: "old", asOf: stale },
          D: { source: "old", asOf: stale },
        },
      }),
    );
    const { stdout, code } = await runCli([`--fixtures=${fpath}`]);
    expect(stdout).toMatch(/WARN downgrades:/);
    expect(stdout).toMatch(/provenance is \d+d old/);
    expect(code).toBe(1); // pass downgraded to warn
  });

  it("--verbose includes provenance detail in output", async () => {
    const fpath = join(dir, "verbose.json");
    await writeFile(
      fpath,
      JSON.stringify({ P: 0.9, R: 0.95, D: 0.5, provenance: freshProvenanceJson() }),
    );
    const { stdout } = await runCli([`--fixtures=${fpath}`, "--verbose"]);
    expect(stdout).toMatch(/provenance:/);
    expect(stdout).toMatch(/test:fixture-P/);
    expect(stdout).toMatch(/test:fixture-R/);
    expect(stdout).toMatch(/test:fixture-D/);
  });

  it("exits 1 with stderr message on missing fixtures", async () => {
    const { stderr, code } = await runCli([`--fixtures=${join(dir, "nope.json")}`]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/phi-prime:/);
  });
});
