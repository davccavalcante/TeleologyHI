import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuditEvent } from "../src/audit/log";
import { AuditLog } from "../src/audit/log";

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of iter) out.push(x);
  return out;
}

describe("AuditLog", () => {
  let dir: string;
  let log: AuditLog;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "maic-audit-"));
    log = await AuditLog.open(dir);
  });

  it("starts empty", async () => {
    const events = await collect(log.query({}));
    expect(events).toEqual([]);
  });

  it("appends an event and reads it back", async () => {
    const event = await log.append({
      kind: "behavior-review",
      data: { foo: "bar" },
    });
    expect(event.auditId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(event.prevHash).toBe("GENESIS");
    expect(event.thisHash).toMatch(/^sha256:[0-9a-f]{64}$/);

    const all = await collect(log.query({}));
    expect(all).toHaveLength(1);
    expect(all[0]?.auditId).toBe(event.auditId);
  });

  it("chains hashes: each prevHash equals previous thisHash", async () => {
    const a = await log.append({ kind: "axiom-mint", data: { id: "ax.a" } });
    const b = await log.append({ kind: "axiom-mint", data: { id: "ax.b" } });
    const c = await log.append({ kind: "behavior-review", data: { ok: true } });

    expect(b.prevHash).toBe(a.thisHash);
    expect(c.prevHash).toBe(b.thisHash);
  });

  it("persists and re-verifies on reopen", async () => {
    await log.append({ kind: "axiom-mint", data: { id: "ax.a" } });
    await log.append({ kind: "axiom-mint", data: { id: "ax.b" } });

    const reopened = await AuditLog.open(dir);
    const all = await collect(reopened.query({}));
    expect(all).toHaveLength(2);
  });

  it("detects tampering on reopen (modified data → chain mismatch)", async () => {
    await log.append({ kind: "axiom-mint", data: { id: "ax.a" } });
    await log.append({ kind: "axiom-mint", data: { id: "ax.b" } });

    // Tamper: rewrite first line with altered payload but original hashes.
    const path = join(dir, "audit", "log.ndjson");
    const lines = (await readFile(path, "utf-8")).trim().split("\n");
    const tampered = JSON.parse(lines[0]!);
    tampered.data.id = "ax.evil";
    lines[0] = JSON.stringify(tampered);
    await writeFile(path, `${lines.join("\n")}\n`, "utf-8");

    await expect(AuditLog.open(dir)).rejects.toThrow(/tamper|chain|hash/i);
  });

  it("filters by event kind", async () => {
    await log.append({ kind: "axiom-mint", data: { id: "a" } });
    await log.append({ kind: "behavior-review", data: { ok: true } });
    await log.append({ kind: "axiom-mint", data: { id: "b" } });

    const mints = await collect(log.query({ kind: "axiom-mint" }));
    expect(mints).toHaveLength(2);
    expect(mints.every((e) => e.kind === "axiom-mint")).toBe(true);
  });

  it("filters by date range (inclusive bounds)", async () => {
    const a = await log.append({ kind: "axiom-mint", data: { id: "a" } });
    // Force a separate ms boundary
    await new Promise((r) => setTimeout(r, 5));
    const b = await log.append({ kind: "axiom-mint", data: { id: "b" } });

    const justB = await collect(log.query({ since: b.ts }));
    expect(justB.map((e: AuditEvent) => e.auditId)).toEqual([b.auditId]);

    const justA = await collect(log.query({ until: a.ts }));
    expect(justA.map((e: AuditEvent) => e.auditId)).toEqual([a.auditId]);
  });

  it("filters by nheId and himId when provided in data", async () => {
    await log.append({ kind: "behavior-review", data: { nheId: "n1", himId: "h1" } });
    await log.append({ kind: "behavior-review", data: { nheId: "n2", himId: "h1" } });

    const onlyN1 = await collect(log.query({ nheId: "n1" }));
    expect(onlyN1).toHaveLength(1);

    const allH1 = await collect(log.query({ himId: "h1" }));
    expect(allH1).toHaveLength(2);
  });
});
