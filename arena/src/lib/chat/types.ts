export type MessageRole = "user" | "assistant";

export type ChannelVariant = "raw" | "governed";

export type VerdictKind = "approve" | "warn" | "deny";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  /** Server-measured round-trip latency. Assistant messages only. */
  durationMs?: number;
  /** Post-review verdict from the MAIC client. Governed-assistant only. */
  verdict?: VerdictKind;
  /** Pre-review verdict (when it differs from post). Governed-assistant only. */
  preVerdict?: VerdictKind;
  /** True when the NHE refused the user prompt. Governed-assistant only. */
  refused?: boolean;
  /** Interaction kind (e.g. "redirect"). Governed-assistant only. */
  kind?: string;
  /** Axiom IDs cited by the HIM persona. Governed-assistant only. */
  citedAxioms?: string[];
};

export type ChannelConfig = {
  id: ChannelVariant;
  title: string;
  subtitle: string;
};
