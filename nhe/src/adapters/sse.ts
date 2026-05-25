/**
 * Parse Server-Sent Events from a ReadableStream into a sequence of `data:`
 * payload strings. Used by OpenAI-compatible streaming adapters (Grok /
 * DeepSeek / Mistral) and Ollama's newline-delimited streaming.
 */
export async function* sseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf("\n\n");
      while (idx !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of frame.split("\n")) {
          if (line.startsWith("data:")) yield line.slice(5).trim();
        }
        idx = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse newline-delimited JSON from a ReadableStream. Ollama and some
 * Google endpoints stream this format instead of SSE.
 */
export async function* ndjsonEvents(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf("\n");
      while (idx !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line.length > 0) yield line;
        idx = buffer.indexOf("\n");
      }
    }
    if (buffer.trim().length > 0) yield buffer.trim();
  } finally {
    reader.releaseLock();
  }
}
