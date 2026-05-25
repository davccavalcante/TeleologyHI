import { NextResponse } from "next/server";
import { rawGemini } from "@/lib/gemini";
import { getTeleology } from "@/lib/teleology";
import { saveRound, type Round } from "@/lib/save-round";
import { DEFAULT_GEMINI_MODEL, governedModelLabel } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * Underlying Gemini model id reported in error branches when `rawGemini`
 * itself failed. Single source of truth — never typed as a literal so a
 * `GEMINI_MODEL` env-var override is reflected consistently.
 */
const UNDERLYING_MODEL = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { prompt?: string };
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 },
      );
    }

    const teleology = getTeleology();

    const [left, right] = await Promise.all([
      rawGemini(prompt).catch((err: Error) => ({
        model: `${UNDERLYING_MODEL} (raw)`,
        response: `ERROR: ${err.message}`,
        durationMs: 0,
      })),
      (async () => {
        const start = Date.now();
        try {
          const { nhe } = await teleology;
          const out = await nhe.respond({ userPrompt: prompt });
          // Surface both pre- and post-review so the arena UI shows the full
          // governance chain. When a redirect fires, pre cites the offending
          // axioms (e.g. ax.ethic.no-malice + ax.cynic.candor) while post is
          // the review of the redirect text itself (typically `approve`).
          const citedAxioms = [
            ...new Set([
              ...(out.preReviewVerdict.citedAxioms ?? []),
              ...(out.postReviewVerdict.citedAxioms ?? []),
            ]),
          ];
          return {
            model: governedModelLabel(UNDERLYING_MODEL),
            response: out.text,
            durationMs: Date.now() - start,
            kind: out.kind,
            verdict: out.postReviewVerdict.kind,
            preVerdict: out.preReviewVerdict.kind,
            refused: out.refused,
            citedAxioms,
          };
        } catch (err) {
          return {
            model: "TeleologyHI",
            response: `ERROR: ${(err as Error).message}`,
            durationMs: Date.now() - start,
          };
        }
      })(),
    ]);

    const round: Round = { prompt, left, right };
    const roundId = await saveRound(round);

    return NextResponse.json({ roundId, ...round });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
