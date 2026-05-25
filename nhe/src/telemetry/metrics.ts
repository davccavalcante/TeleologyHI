import { metrics } from "@opentelemetry/api";

/**
 * OpenTelemetry-native metrics for the NHE pipeline (TASK.md H3).
 *
 * Uses the standard `@opentelemetry/api` metrics surface. When no
 * `MeterProvider` is registered by the consumer, every call is a no-op.
 * Consumers who want Prometheus scrape-target semantics install
 * `@opentelemetry/sdk-metrics` + `@opentelemetry/exporter-prometheus`
 * and expose the resulting `/metrics` endpoint from their app — NHE's
 * counters/histograms appear automatically with no additional wiring.
 *
 * Exposed instruments:
 *   - `nhe.respond.count` — counter, labels { kind, adapter, lifecycle }
 *   - `nhe.respond.refused` — counter, labels { reason, adapter }
 *   - `nhe.tokens` — histogram of total token usage per respond, labels { direction, adapter }
 *   - `nhe.sleep.cycles` — counter of completed sleep cycles
 *   - `nhe.sleep.dreams` — counter of dreams produced (classification label)
 */
const METER_NAME = "@teleologyhi-sdk/nhe";
const METER_VERSION = "1.0.0-trinity";

const meter = metrics.getMeter(METER_NAME, METER_VERSION);

export const respondCount = meter.createCounter("nhe.respond.count", {
  description: "Number of Nhe.respond invocations grouped by outcome kind and adapter.",
});

export const respondRefusedCount = meter.createCounter("nhe.respond.refused", {
  description: "Refusal events. Labelled by reason (pre / post / terminated / withdrawn).",
});

export const tokensHistogram = meter.createHistogram("nhe.tokens", {
  description: "Token usage per respond invocation. direction ∈ {in, out}.",
  unit: "{tokens}",
});

export const sleepCyclesCount = meter.createCounter("nhe.sleep.cycles", {
  description: "Completed sleep cycles.",
});

export const sleepDreamsCount = meter.createCounter("nhe.sleep.dreams", {
  description: "REM dreams produced. Labelled by classification (after wake consolidates).",
});

/**
 * Helper: increment `respondCount` and `tokensHistogram` for one respond call.
 */
export function recordRespond(args: {
  kind: "ok" | "redirect" | "refused";
  adapter: string;
  lifecycle: string;
  tokensIn: number;
  tokensOut: number;
}): void {
  const labels = { kind: args.kind, adapter: args.adapter, lifecycle: args.lifecycle };
  respondCount.add(1, labels);
  tokensHistogram.record(args.tokensIn, { direction: "in", adapter: args.adapter });
  tokensHistogram.record(args.tokensOut, { direction: "out", adapter: args.adapter });
}
