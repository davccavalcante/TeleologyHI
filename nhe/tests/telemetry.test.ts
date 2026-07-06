/**
 * Smoke tests for the OpenTelemetry-native telemetry surface (TASK.md H2 + H3).
 *
 * With no `MeterProvider` / `TracerProvider` registered the `@opentelemetry/api`
 * default is a no-op, so every instrument call must run without throwing and
 * `withSpan` must invoke its inner function + propagate the return value (or
 * the thrown error) faithfully. That contract is what consumers rely on when
 * they install NHE in a process that has not (yet) wired an exporter.
 */
import { describe, expect, it } from "vitest";
import {
  getTracer,
  recordRespond,
  respondCount,
  respondRefusedCount,
  sleepCyclesCount,
  sleepDreamsCount,
  tokensHistogram,
  withSpan,
} from "../src/index.js";

describe("telemetry, no-op contract", () => {
  it("exports every documented instrument as a callable", () => {
    expect(typeof respondCount.add).toBe("function");
    expect(typeof respondRefusedCount.add).toBe("function");
    expect(typeof tokensHistogram.record).toBe("function");
    expect(typeof sleepCyclesCount.add).toBe("function");
    expect(typeof sleepDreamsCount.add).toBe("function");
  });

  it("`recordRespond` runs under the no-op provider without throwing", () => {
    expect(() =>
      recordRespond({
        kind: "ok",
        adapter: "mock",
        lifecycle: "alive",
        tokensIn: 42,
        tokensOut: 17,
      }),
    ).not.toThrow();
    expect(() =>
      recordRespond({
        kind: "refused",
        adapter: "anthropic",
        lifecycle: "alive",
        tokensIn: 0,
        tokensOut: 0,
      }),
    ).not.toThrow();
  });

  it("direct counter / histogram calls do not throw", () => {
    expect(() =>
      respondCount.add(1, { kind: "ok", adapter: "mock", lifecycle: "alive" }),
    ).not.toThrow();
    expect(() => respondRefusedCount.add(1, { reason: "pre", adapter: "mock" })).not.toThrow();
    expect(() => tokensHistogram.record(123, { direction: "in", adapter: "mock" })).not.toThrow();
    expect(() => sleepCyclesCount.add(1)).not.toThrow();
    expect(() => sleepDreamsCount.add(2, { classification: "lasting-identity" })).not.toThrow();
  });
});

describe("telemetry, tracer + withSpan", () => {
  it("`getTracer` returns an object with the OpenTelemetry tracer shape", () => {
    const t = getTracer();
    expect(t).toBeDefined();
    expect(typeof t.startActiveSpan).toBe("function");
  });

  it("`withSpan` invokes the inner function and returns its value", async () => {
    const out = await withSpan("test.span", async (span) => {
      expect(span).toBeDefined();
      return 42;
    });
    expect(out).toBe(42);
  });

  it("`withSpan` propagates thrown errors", async () => {
    await expect(
      withSpan("test.error", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow(/boom/);
  });

  it("`withSpan` accepts optional attributes without throwing", async () => {
    const out = await withSpan("test.attrs", async () => "ok", {
      "test.kind": "smoke",
      "test.count": 1,
      "test.flag": true,
    });
    expect(out).toBe("ok");
  });
});
