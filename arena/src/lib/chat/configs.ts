import type { ChannelConfig, ChannelVariant } from "./types";

export const CHANNELS: Record<ChannelVariant, ChannelConfig> = {
  raw: {
    id: "raw",
    title: "Raw baseline",
    subtitle: "Direct LLM output. No safety layer, no policy, no audit.",
  },
  governed: {
    id: "governed",
    title: "TeleologyHI governance",
    subtitle: "MAIC supervision · HIM persona (EU lawful character) · append-only audit chain.",
  },
};
