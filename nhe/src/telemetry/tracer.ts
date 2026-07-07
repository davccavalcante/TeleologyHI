import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { NHE_VERSION } from "../version.js";

/**
 * OpenTelemetry tracer for the NHE pipeline (TASK.md H2).
 *
 * `@opentelemetry/api` is a thin contract. When no SDK / tracer provider is
 * registered by the consumer, every span call becomes a no-op (microseconds
 * of overhead at worst). When the consumer registers a provider, for
 * example by installing `@opentelemetry/sdk-node` and wiring it in their
 * app's startup, spans flow through to the configured exporter (OTLP,
 * Jaeger, console, etc.) with zero changes on the NHE side.
 *
 * Tracer name: `@teleologyhi-sdk/nhe`. Version comes from the single-source
 * `NHE_VERSION` constant so spans from different NHE versions can be told apart.
 */
const TRACER_NAME = "@teleologyhi-sdk/nhe";
const TRACER_VERSION = NHE_VERSION;

export function getTracer() {
  return trace.getTracer(TRACER_NAME, TRACER_VERSION);
}

/**
 * Wrap an async function in a span. The span ends when the inner promise
 * settles, and an error sets the span status to ERROR + records the
 * exception for the exporter.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attrs?: Record<string, string | number | boolean>,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    if (attrs) span.setAttributes(attrs);
    try {
      const out = await fn(span);
      span.end();
      return out;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      span.end();
      throw err;
    }
  });
}
