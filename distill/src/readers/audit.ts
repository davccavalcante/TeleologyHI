import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConversationSample } from "../types.js";

/**
 * Stream behavior-review audit events from MAIC's NDJSON log and shape each
 * one as a `ConversationSample`. Other audit kinds (axiom-mint, him-register,
 * etc.) are skipped — they are not conversational substrate.
 *
 * The MAIC `BehaviorReport.payload` carries the user prompt + proposed
 * response under `phase: "pre" | "post"`. We pair them via `auditId` siblings
 * within the same NHE/HIM context.
 */
export async function* readAuditCorpus(
  storeDir: string,
): AsyncIterable<ConversationSample> {
  const logPath = join(storeDir, "audit", "log.ndjson");
  let raw: string;
  try {
    raw = await readFile(logPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
  const lines = raw.split("\n").filter((l) => l.length > 0);

  // Group prompt and response by (nheId, himId, near-timestamp).
  const pending = new Map<string, { user: string; ts: string; verdict?: string }>();

  for (const line of lines) {
    const ev = JSON.parse(line) as {
      auditId: string;
      kind: string;
      ts: string;
      data: Record<string, unknown>;
    };
    if (ev.kind !== "behavior-review") continue;
    const data = ev.data;
    const nheId = String(data.nheId ?? "");
    const himId = String(data.himId ?? "");
    const payload = (data.payload as Record<string, unknown>) ?? {};
    const phase = String(payload.phase ?? "");
    const verdictKind = (data.verdict as { kind?: string } | undefined)?.kind;

    const groupKey = `${nheId}::${himId}`;
    if (phase === "pre") {
      pending.set(groupKey, {
        user: String(payload.userPrompt ?? ""),
        ts: ev.ts,
        ...(verdictKind ? { verdict: verdictKind } : {}),
      });
      continue;
    }
    if (phase === "post" || phase === "post-redirect") {
      const head = pending.get(groupKey);
      if (!head) continue;
      pending.delete(groupKey);
      const responseText = String(payload.responseText ?? "");
      if (!head.user || !responseText) continue;
      const tags: string[] = [];
      if (head.verdict) tags.push(`pre-verdict:${head.verdict}`);
      if (verdictKind) tags.push(`post-verdict:${verdictKind}`);
      if (phase === "post-redirect") tags.push("redirect");
      yield {
        id: ev.auditId,
        source: "audit",
        sourceId: ev.auditId,
        ...(nheId ? { nheId } : {}),
        ...(himId ? { himId } : {}),
        ts: head.ts,
        tags,
        messages: [
          { role: "user", content: head.user },
          { role: "assistant", content: responseText },
        ],
      };
    }
  }
}
