import type { LocalMaic } from "@teleologyhi-sdk/maic";
import type { Nhe } from "../nhe.js";

/**
 * Pure tool handlers, separated from MCP transport for testability.
 * Each returns a single text block whose body is a JSON-encoded result.
 */

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

function ok(payload: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function err(message: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

export interface RespondToolInput {
  userPrompt: string;
  redirectAttempt?: number | undefined;
  jurisdiction?: string | undefined;
}

export async function nheRespondHandler(nhe: Nhe, input: RespondToolInput): Promise<ToolResult> {
  try {
    const reqInput: Parameters<typeof nhe.respond>[0] = { userPrompt: input.userPrompt };
    if (input.redirectAttempt !== undefined) reqInput.redirectAttempt = input.redirectAttempt;
    if (input.jurisdiction !== undefined) reqInput.jurisdiction = input.jurisdiction;
    const out = await nhe.respond(reqInput);
    return ok({
      kind: out.kind,
      text: out.text,
      refused: out.refused,
      redirect: out.redirect ?? null,
      preReviewVerdict: {
        kind: out.preReviewVerdict.kind,
        reasonSummary: out.preReviewVerdict.reasonSummary,
        citedAxioms: out.preReviewVerdict.citedAxioms,
      },
      postReviewVerdict: {
        kind: out.postReviewVerdict.kind,
        reasonSummary: out.postReviewVerdict.reasonSummary,
        citedAxioms: out.postReviewVerdict.citedAxioms,
      },
      tokens: out.tokens,
      auditIds: out.auditIds,
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export interface RecallToolInput {
  query: string;
  limit?: number | undefined;
}

export async function nheRecallHandler(nhe: Nhe, input: RecallToolInput): Promise<ToolResult> {
  const opts: { limit?: number } = {};
  if (input.limit !== undefined) opts.limit = input.limit;
  const hits = await nhe.recall(input.query, opts);
  return ok({
    count: hits.length,
    memories: hits.map((m) => ({
      id: m.id,
      classification: m.classification,
      teleologicalValue: m.teleologicalValue,
      consolidatedAt: m.consolidatedAt,
      insight: m.insight,
    })),
  });
}

export async function nheSleepHandler(nhe: Nhe): Promise<ToolResult> {
  const result = await nhe.sleep({ kind: "explicit", reason: "mcp-tool" });
  const rem = result.record.phases.find((p) => p.phase === "REM");
  const dreamCount = rem && rem.content.kind === "dreams" ? rem.content.dreams.length : 0;
  return ok({
    yamlPath: result.yamlPath,
    durationMinutes: result.record.sleep.durationMinutes,
    dreamCount,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
  });
}

export async function nheWakeHandler(nhe: Nhe): Promise<ToolResult> {
  const result = await nhe.wake();
  return ok({
    processedSleepFiles: result.processedSleepFiles,
    memoriesWritten: result.memoriesWritten.length,
    discarded: result.discarded,
    classifications: result.memoriesWritten.map((m) => ({
      id: m.id,
      classification: m.classification,
      teleologicalValue: m.teleologicalValue,
    })),
  });
}

export async function maicListAxiomsHandler(maic: LocalMaic): Promise<ToolResult> {
  const axioms = await maic.listAxioms();
  return ok({
    count: axioms.length,
    axioms: axioms.map((a) => ({
      id: a.id,
      rank: a.rank,
      statement: a.statement,
      weight: a.weight,
      flexibility: a.flexibility,
      immutable: a.immutable,
    })),
  });
}

export async function maicListHimsHandler(maic: LocalMaic): Promise<ToolResult> {
  const hims = await maic.listHims();
  return ok({
    count: hims.length,
    hims: hims.map((h) => ({
      himId: h.himId,
      primaryArchetype: h.birthSignature.primaryArchetype,
      bornAt: h.birthSignature.bornAt,
      axiomCount: h.axiomsSnapshot.length,
      registeredAt: h.registeredAt,
    })),
  });
}
