import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AuditLog } from "../src/audit/log";

/**
 * Load test for the SHA-256 hash chain (TASK.md I1).
 *
 * 10k events is the documented public-use ceiling, above this, NDJSON should
 * be rotated. The test budget is conservative (12s) so this also runs cleanly
 * inside the GitHub Actions matrix on the slowest runner.
 */
const N = 10_000;
const BUDGET_MS = 12_000;

describe("AuditLog, load (I1, 10k events)", () => {
  it(
    `appends ${N} events and reopen verifies them under ${BUDGET_MS}ms`,
    async () => {
      const dir = await mkdtemp(join(tmpdir(), "audit-load-"));

      const writeStart = Date.now();
      const log = await AuditLog.open(dir);
      for (let i = 0; i < N; i++) {
        await log.append({
          kind: "behavior-review",
          data: { nheId: `nhe-${i % 50}`, himId: `him-${i % 10}`, idx: i },
        });
      }
      const writeMs = Date.now() - writeStart;
      expect(log.size()).toBe(N);

      const reopenStart = Date.now();
      const reopened = await AuditLog.open(dir);
      const reopenMs = Date.now() - reopenStart;
      expect(reopened.size()).toBe(N);

      expect(writeMs + reopenMs).toBeLessThan(BUDGET_MS);
    },
    BUDGET_MS + 3000,
  );

  it("detects tampering anywhere in the chain on reopen", async () => {
    const dir = await mkdtemp(join(tmpdir(), "audit-tamper-"));
    const log = await AuditLog.open(dir);
    for (let i = 0; i < 100; i++) {
      await log.append({ kind: "behavior-review", data: { idx: i } });
    }
    const ndjsonPath = join(dir, "audit", "log.ndjson");
    const raw = await readFile(ndjsonPath, "utf-8");
    const lines = raw.split("\n").filter((l) => l.length > 0);
    // Mutate one byte in the middle line's `data` payload.
    const target = 50;
    const parsed = JSON.parse(lines[target]!);
    parsed.data.idx = parsed.data.idx + 1;
    lines[target] = JSON.stringify(parsed);
    await writeFile(ndjsonPath, `${lines.join("\n")}\n`, "utf-8");

    await expect(AuditLog.open(dir)).rejects.toThrow(/tamper|hash/i);
  });
});
