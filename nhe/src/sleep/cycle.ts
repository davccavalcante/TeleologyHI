import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LlmAdapter } from "../adapters/types.js";
import { generateNremSummaries, generateRemDreams, interactionsToFragments } from "./phases.js";
import type { DreamRecord, InteractionRecord, SleepPhase, SleepTrigger } from "./types.js";
import { dreamRecordToYaml, sleepYamlFilename } from "./yaml.js";

export interface SleepCycleOptions {
  /** Total wall-clock seconds the cycle should occupy. Default 60. */
  totalSeconds?: number;
  /**
   * MAIC- or Creator-induced dream content. When provided, REM incorporates it.
   * The current implementation propagates only the metadata; the LLM is left to weave the scenario in.
   */
  induction?: {
    scenario: string;
    desiredLearning: string;
    inducedBy: "maic" | "creator";
  };
}

export interface SleepCycleInput {
  nheId: string;
  himId: string;
  storeDir: string;
  llm: LlmAdapter;
  trigger: SleepTrigger;
  interactions: readonly InteractionRecord[];
  options?: SleepCycleOptions;
}

export interface SleepCycleResult {
  record: DreamRecord;
  yamlPath: string;
  tokensIn: number;
  tokensOut: number;
}

/**
 * Phase duration proportions (sum = 1). N1-N4 + REM. The current cycle keeps
 * non-REM phases structurally present but lightweight; only N1 carries actual
 * content (the interactions snapshot) and only REM calls the LLM.
 */
const PHASE_PROPORTIONS: Record<SleepPhase["phase"], number> = {
  N1: 0.1,
  N2: 0.2,
  N3: 0.15,
  N4: 0.1,
  REM: 0.45,
};

/**
 * Run a single sleep cycle: build phases, generate REM dreams, write YAML.
 * Returns the persisted DreamRecord plus the path written.
 */
export async function runSleepCycle(input: SleepCycleInput): Promise<SleepCycleResult> {
  const opts = input.options ?? {};
  const total = opts.totalSeconds ?? 60;
  const startMs = Date.now();
  const startedAt = new Date(startMs).toISOString();

  // N1, snapshot recent interactions as fragments
  const fragments = interactionsToFragments(input.interactions);

  // N2/N3/N4, parallel one-sentence summaries (emotional / lasting / discard)
  const nrem = await generateNremSummaries(input.llm, fragments);

  // REM, generate dreams via LLM, conditioned on the NREM summaries
  const remStartMs = startMs + secondsFor(["N1", "N2", "N3", "N4"], total) * 1000;
  const {
    dreams,
    tokensIn: remIn,
    tokensOut: remOut,
  } = await generateRemDreams(input.llm, fragments, opts.induction, {
    n2: nrem.n2,
    n3: nrem.n3,
    n4: nrem.n4,
  });
  const tokensIn = nrem.tokensIn + remIn;
  const tokensOut = nrem.tokensOut + remOut;

  const phases: SleepPhase[] = [
    {
      phase: "N1",
      startedAt,
      durationSeconds: secondsFor(["N1"], total),
      content: { kind: "fragments", fragments },
    },
    nremPhase("N2", startMs, total, nrem.n2),
    nremPhase("N3", startMs, total, nrem.n3),
    nremPhase("N4", startMs, total, nrem.n4),
    {
      phase: "REM",
      startedAt: new Date(remStartMs).toISOString(),
      durationSeconds: secondsFor(["REM"], total),
      content: { kind: "dreams", dreams },
    },
  ];

  const endMs = startMs + total * 1000;
  const endedAt = new Date(endMs).toISOString();

  const record: DreamRecord = {
    version: 1,
    nheId: input.nheId,
    himId: input.himId,
    sleep: {
      startedAt,
      endedAt,
      durationMinutes: total / 60,
    },
    phases,
    metadata: {
      llmAdapter: input.llm.id,
      triggerKind: input.trigger.kind,
      ...(input.trigger.reason !== undefined ? { triggerReason: input.trigger.reason } : {}),
      recentInteractionsConsidered: input.interactions.length,
    },
  };

  const yaml = dreamRecordToYaml(record);
  const dir = join(input.storeDir, "in-dreams", "sleep");
  await mkdir(dir, { recursive: true });
  const yamlPath = join(dir, sleepYamlFilename(startedAt, total / 60));
  await writeFile(yamlPath, yaml, "utf-8");

  return { record, yamlPath, tokensIn, tokensOut };
}

/**
 * Build an NREM phase entry from the LLM-produced summary. Empty summaries
 * (provider failure or zero interactions) collapse to `{kind: "empty"}` so
 * the YAML stays minimal, a downstream reader treats the phase as a no-op.
 */
function nremPhase(
  name: Exclude<SleepPhase["phase"], "N1" | "REM">,
  startMs: number,
  total: number,
  summary: string,
): SleepPhase {
  const before = preceding(name);
  const offsetSec = secondsFor(before, total);
  const startedAt = new Date(startMs + offsetSec * 1000).toISOString();
  const durationSeconds = secondsFor([name], total);
  return summary
    ? { phase: name, startedAt, durationSeconds, content: { kind: "summary", summary } }
    : { phase: name, startedAt, durationSeconds, content: { kind: "empty" } };
}

function preceding(name: SleepPhase["phase"]): SleepPhase["phase"][] {
  const order: SleepPhase["phase"][] = ["N1", "N2", "N3", "N4", "REM"];
  return order.slice(0, order.indexOf(name));
}

function secondsFor(phases: SleepPhase["phase"][], total: number): number {
  let sum = 0;
  for (const p of phases) sum += PHASE_PROPORTIONS[p];
  return sum * total;
}
