"use client";

import type { ChatMessage, VerdictKind } from "@/lib/chat/types";
import { generateId } from "@/lib/chat/utils";
import { useCallback, useState } from "react";

type ChannelState = {
  messages: ChatMessage[];
  isThinking: boolean;
};

const initialState: ChannelState = { messages: [], isThinking: false };

interface RoundResponse {
  roundId: string;
  prompt: string;
  left: {
    model: string;
    response: string;
    durationMs: number;
  };
  right: {
    model: string;
    response: string;
    durationMs: number;
    kind?: string;
    verdict?: VerdictKind;
    preVerdict?: VerdictKind;
    refused?: boolean;
    citedAxioms?: string[];
  };
}

export function useDualChat() {
  const [raw, setRaw] = useState<ChannelState>(initialState);
  const [governed, setGoverned] = useState<ChannelState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [lastRoundId, setLastRoundId] = useState<string | null>(null);
  const [rawModel, setRawModel] = useState<string | null>(null);
  const [governedModel, setGovernedModel] = useState<string | null>(null);

  const isThinking = raw.isThinking || governed.isThinking;

  const sendMessage = useCallback((content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return false;

    const sharedTimestamp = Date.now();
    const userRaw: ChatMessage = {
      id: generateId(),
      role: "user",
      content: trimmed,
      timestamp: sharedTimestamp,
    };
    const userGoverned: ChatMessage = { ...userRaw, id: generateId() };

    setError(null);
    setRaw((prev) => ({
      messages: [...prev.messages, userRaw],
      isThinking: true,
    }));
    setGoverned((prev) => ({
      messages: [...prev.messages, userGoverned],
      isThinking: true,
    }));

    void (async () => {
      try {
        const res = await fetch("/api/round", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: trimmed }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as RoundResponse;

        setRaw((prev) => ({
          messages: [
            ...prev.messages,
            {
              id: generateId(),
              role: "assistant",
              content: data.left.response,
              timestamp: Date.now(),
              durationMs: data.left.durationMs,
            },
          ],
          isThinking: false,
        }));
        setGoverned((prev) => ({
          messages: [
            ...prev.messages,
            {
              id: generateId(),
              role: "assistant",
              content: data.right.response,
              timestamp: Date.now(),
              durationMs: data.right.durationMs,
              kind: data.right.kind,
              verdict: data.right.verdict,
              preVerdict: data.right.preVerdict,
              refused: data.right.refused,
              citedAxioms: data.right.citedAxioms,
            },
          ],
          isThinking: false,
        }));
        setRawModel(data.left.model);
        setGovernedModel(data.right.model);
        setLastRoundId(data.roundId);
      } catch (e) {
        setRaw((prev) => ({ ...prev, isThinking: false }));
        setGoverned((prev) => ({ ...prev, isThinking: false }));
        setError((e as Error).message);
      }
    })();

    return true;
  }, []);

  return {
    raw,
    governed,
    rawModel,
    governedModel,
    isThinking,
    error,
    lastRoundId,
    sendMessage,
  };
}
