/**
 * Pure-function tests for the SSE / NDJSON parsers consumed by the OpenAI-
 * compatible streaming adapters (Grok / DeepSeek / Mistral / Gemini) and
 * Ollama. The integration tests in `adapter-streaming.test.ts` cover each
 * adapter end-to-end with a mocked stream; these tests pin the parser
 * behaviour itself, isolating partial-chunk handling and frame-boundary
 * edge cases that are hard to observe from the adapter layer.
 */
import { describe, expect, it } from "vitest";
import { ndjsonEvents, sseEvents } from "../src/adapters/sse";

const encoder = new TextEncoder();

/** Build a `ReadableStream<Uint8Array>` from a sequence of string chunks. */
function streamOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe("sseEvents — SSE `data:` parser", () => {
  it("yields the payload of a single complete frame", async () => {
    const out = await collect(sseEvents(streamOf(["data: hello\n\n"])));
    expect(out).toEqual(["hello"]);
  });

  it("yields each frame separately when multiple arrive in one chunk", async () => {
    const out = await collect(
      sseEvents(streamOf(["data: one\n\ndata: two\n\ndata: three\n\n"])),
    );
    expect(out).toEqual(["one", "two", "three"]);
  });

  it("reassembles a frame split across multiple chunks", async () => {
    const out = await collect(
      sseEvents(streamOf(["data: hel", "lo wor", "ld\n\n"])),
    );
    expect(out).toEqual(["hello world"]);
  });

  it("ignores non-`data:` lines inside a frame (event:, id:, comments)", async () => {
    const out = await collect(
      sseEvents(
        streamOf([
          "event: message\ndata: payload-A\nid: 1\n\n",
          ": keep-alive\n\n",
          "event: message\ndata: payload-B\n\n",
        ]),
      ),
    );
    expect(out).toEqual(["payload-A", "payload-B"]);
  });

  it("trims surrounding whitespace from the data payload", async () => {
    const out = await collect(
      sseEvents(streamOf(["data:   trimmed   \n\n"])),
    );
    expect(out).toEqual(["trimmed"]);
  });

  it("drops a trailing partial frame that never gets its `\\n\\n` terminator", async () => {
    // The producer ends the stream mid-frame. Per SSE semantics the parser
    // discards the incomplete tail rather than emitting it as a phantom event.
    const out = await collect(
      sseEvents(streamOf(["data: complete\n\ndata: partial-no-terminator"])),
    );
    expect(out).toEqual(["complete"]);
  });
});

describe("ndjsonEvents — newline-delimited JSON parser", () => {
  it("yields each non-empty line as a separate event", async () => {
    const out = await collect(
      ndjsonEvents(streamOf(['{"a":1}\n{"b":2}\n{"c":3}\n'])),
    );
    expect(out).toEqual(['{"a":1}', '{"b":2}', '{"c":3}']);
  });

  it("reassembles a line split across multiple chunks", async () => {
    const out = await collect(
      ndjsonEvents(streamOf(['{"foo', '":', '"bar"}\n'])),
    );
    expect(out).toEqual(['{"foo":"bar"}']);
  });

  it("emits a trailing line that lacks a final newline", async () => {
    const out = await collect(
      ndjsonEvents(streamOf(['{"a":1}\n{"b":2}'])),
    );
    expect(out).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("skips empty lines between records", async () => {
    const out = await collect(
      ndjsonEvents(streamOf(['{"a":1}\n\n\n{"b":2}\n'])),
    );
    expect(out).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("trims surrounding whitespace from each line", async () => {
    const out = await collect(
      ndjsonEvents(streamOf(['  {"a":1}  \n  {"b":2}  \n'])),
    );
    expect(out).toEqual(['{"a":1}', '{"b":2}']);
  });
});
