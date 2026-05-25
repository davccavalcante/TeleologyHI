import type {
  ConversationSample,
  DistilabelRow,
  DistillKitRow,
  ExportFormat,
  MlxLmRow,
  TorchtuneRow,
} from "./types.js";

/**
 * Project one `ConversationSample` into the JSONL row shape a specific
 * downstream toolkit expects. Used by `DistillationExporter.write`.
 */
export function toFormat(
  sample: ConversationSample,
  format: ExportFormat,
):
  | ConversationSample
  | DistillKitRow
  | TorchtuneRow
  | DistilabelRow
  | MlxLmRow {
  switch (format) {
    case "conversation":
      return sample;
    case "distillkit":
      return toDistillKit(sample);
    case "torchtune":
      return toTorchtune(sample);
    case "distilabel":
      return toDistilabel(sample);
    case "mlx-lm":
      return toMlxLm(sample);
  }
}

function toDistillKit(s: ConversationSample): DistillKitRow {
  // DistillKit's logit trainer wants a single `text` field per row. Encode the
  // conversation as an OpenAI-style chat dump so the teacher tokenizer can
  // produce comparable logits on student forward pass.
  const text = s.messages
    .map((m) => `<|${m.role}|>\n${m.content}`)
    .join("\n");
  return { text, metadata: buildMetadata(s) };
}

function toTorchtune(s: ConversationSample): TorchtuneRow {
  return { messages: s.messages, metadata: buildMetadata(s) };
}

function toDistilabel(s: ConversationSample): DistilabelRow {
  const user = s.messages.find((m) => m.role === "user");
  const assistant = s.messages.find((m) => m.role === "assistant");
  const row: DistilabelRow = {
    instruction: user?.content ?? "",
    metadata: buildMetadata(s),
  };
  if (assistant?.content) row.response = assistant.content;
  return row;
}

function toMlxLm(s: ConversationSample): MlxLmRow {
  return { messages: s.messages };
}

function buildMetadata(s: ConversationSample): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    id: s.id,
    source: s.source,
    ts: s.ts,
    tags: s.tags,
  };
  if (s.sourceId) meta.sourceId = s.sourceId;
  if (s.nheId) meta.nheId = s.nheId;
  if (s.himId) meta.himId = s.himId;
  if (typeof s.teleologicalValue === "number") {
    meta.teleologicalValue = s.teleologicalValue;
  }
  return meta;
}
