"use client";

/**
 * `useDualChat` — state machine for the arena's dual-column chat (E27-F).
 *
 * The hook now operates on a conversation-as-base-unit model:
 *
 *   - On mount it ensures an `activeConversationUuid` exists: it creates a
 *     fresh empty conversation server-side ("a new clean conversation" on
 *     every site entry per Entry 26 + Creator directive).
 *   - `selectConversation(uuid)` loads that conversation's turns into both
 *     columns (raw + governed).
 *   - `createConversation()` mints a new empty conversation and activates
 *     it (clearing the columns).
 *   - `sendMessage(prompt)` appends a turn to the active conversation
 *     server-side and reflects the response in both columns.
 *
 * Multi-turn context lives server-side: the `POST /api/conversations/[uuid]/turn`
 * endpoint loads prior turns from disk and threads them into BOTH the raw
 * Gemini call AND the NHE.respond call (`history` field), so the model
 * sees the same conversational context that Claude/ChatGPT users expect.
 */
import type { ChatMessage, VerdictKind } from "@/lib/chat/types";
import { generateId } from "@/lib/chat/utils";
import { useCallback, useEffect, useRef, useState } from "react";

type ChannelState = {
  messages: ChatMessage[];
  isThinking: boolean;
};

const initialState: ChannelState = { messages: [], isThinking: false };

interface RemoteTurn {
  turnId: string;
  at: string;
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

interface RemoteConversation {
  conversationUuid: string;
  userId: string;
  himId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: RemoteTurn[];
}

interface CreateResponse {
  conversation: RemoteConversation;
}

interface LoadResponse {
  conversation: RemoteConversation;
}

interface AppendResponse {
  conversation: RemoteConversation;
  turn: RemoteTurn;
}

/**
 * Convert a remote turn into one user-message + one assistant-message for
 * each column. Used both when restoring history and after a fresh turn lands.
 */
function turnToMessages(turn: RemoteTurn): {
  raw: ChatMessage[];
  governed: ChatMessage[];
} {
  const ts = new Date(turn.at).getTime();
  return {
    raw: [
      {
        id: generateId(),
        role: "user",
        content: turn.prompt,
        timestamp: ts,
      },
      {
        id: generateId(),
        role: "assistant",
        content: turn.left.response,
        timestamp: ts,
        durationMs: turn.left.durationMs,
      },
    ],
    governed: [
      {
        id: generateId(),
        role: "user",
        content: turn.prompt,
        timestamp: ts,
      },
      {
        id: generateId(),
        role: "assistant",
        content: turn.right.response,
        timestamp: ts,
        durationMs: turn.right.durationMs,
        kind: turn.right.kind,
        verdict: turn.right.verdict,
        preVerdict: turn.right.preVerdict,
        refused: turn.right.refused,
        citedAxioms: turn.right.citedAxioms,
      },
    ],
  };
}

export function useDualChat() {
  const [raw, setRaw] = useState<ChannelState>(initialState);
  const [governed, setGoverned] = useState<ChannelState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [activeConversationUuid, setActiveConversationUuid] = useState<string | null>(null);
  const [rawModel, setRawModel] = useState<string | null>(null);
  const [governedModel, setGovernedModel] = useState<string | null>(null);
  /** Bumped after createConversation or successful turn — drives sidebar refetch. */
  const [conversationsRefreshKey, setConversationsRefreshKey] = useState(0);
  /** Guard so the bootstrap effect runs only once per mount. */
  const bootstrappedRef = useRef(false);

  const isThinking = raw.isThinking || governed.isThinking;

  /**
   * Replace the column state with the conversation's persisted turns.
   * Used by the sidebar select handler and indirectly by `createConversation`
   * (which uses an empty conversation).
   */
  const applyConversation = useCallback((conv: RemoteConversation) => {
    setError(null);
    setActiveConversationUuid(conv.conversationUuid);
    const rawMessages: ChatMessage[] = [];
    const governedMessages: ChatMessage[] = [];
    let latestRawModel: string | null = null;
    let latestGovernedModel: string | null = null;
    for (const t of conv.turns) {
      const { raw: r, governed: g } = turnToMessages(t);
      rawMessages.push(...r);
      governedMessages.push(...g);
      latestRawModel = t.left.model;
      latestGovernedModel = t.right.model;
    }
    setRaw({ messages: rawMessages, isThinking: false });
    setGoverned({ messages: governedMessages, isThinking: false });
    setRawModel(latestRawModel);
    setGovernedModel(latestGovernedModel);
  }, []);

  /**
   * Mint a new empty conversation server-side and activate it.
   *
   * Silenced error mode (E27-G directive): on failure we restore the
   * previous state and return `null` WITHOUT surfacing a technical
   * message to the user. The bootstrap effect will retry on next mount.
   */
  const createConversation = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as CreateResponse;
      applyConversation(data.conversation);
      setConversationsRefreshKey((k) => k + 1);
      return data.conversation.conversationUuid;
    } catch {
      return null;
    }
  }, [applyConversation]);

  /**
   * Fetch and apply an existing conversation by UUID. Hard-privacy is
   * server-enforced; this never receives another user's conversation.
   *
   * Silenced error mode (E27-G directive): on failure we leave the
   * current view intact and surface nothing to the user.
   */
  const selectConversation = useCallback(
    async (uuid: string) => {
      setError(null);
      try {
        const res = await fetch(`/api/conversations/${encodeURIComponent(uuid)}`, {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = (await res.json()) as LoadResponse;
        applyConversation(data.conversation);
      } catch {
        // No-op: the user keeps the current view.
      }
    },
    [applyConversation],
  );

  /**
   * Append a turn to the active conversation. Optimistically pushes the
   * user message into both columns and toggles the thinking indicator;
   * settles both columns with the server response once the round-trip
   * lands.
   */
  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return false;
      if (!activeConversationUuid) {
        // Silenced (E27-G): the bootstrap is still settling. The user
        // can resend in a beat. No visible error.
        return false;
      }

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
          const res = await fetch(
            `/api/conversations/${encodeURIComponent(activeConversationUuid)}/turn`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({ prompt: trimmed }),
            },
          );
          if (!res.ok) {
            // Silenced error mode (E27-G directive): roll back the
            // optimistically-pushed user message and stop the thinking
            // indicator without exposing a technical error to the user.
            // The user can simply re-send.
            setRaw((prev) => ({
              messages: prev.messages.slice(0, -1),
              isThinking: false,
            }));
            setGoverned((prev) => ({
              messages: prev.messages.slice(0, -1),
              isThinking: false,
            }));
            return;
          }
          const data = (await res.json()) as AppendResponse;

          setRaw((prev) => ({
            messages: [
              ...prev.messages,
              {
                id: generateId(),
                role: "assistant",
                content: data.turn.left.response,
                timestamp: Date.now(),
                durationMs: data.turn.left.durationMs,
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
                content: data.turn.right.response,
                timestamp: Date.now(),
                durationMs: data.turn.right.durationMs,
                kind: data.turn.right.kind,
                verdict: data.turn.right.verdict,
                preVerdict: data.turn.right.preVerdict,
                refused: data.turn.right.refused,
                citedAxioms: data.turn.right.citedAxioms,
              },
            ],
            isThinking: false,
          }));
          setRawModel(data.turn.left.model);
          setGovernedModel(data.turn.right.model);
          setConversationsRefreshKey((k) => k + 1);
        } catch {
          // Silenced error mode (E27-G directive): roll back the user
          // message and stop thinking without any visible error text.
          setRaw((prev) => ({
            messages: prev.messages.slice(0, -1),
            isThinking: false,
          }));
          setGoverned((prev) => ({
            messages: prev.messages.slice(0, -1),
            isThinking: false,
          }));
        }
      })();

      return true;
    },
    [activeConversationUuid],
  );

  // Bootstrap: ensure an empty conversation is active on mount.
  //
  // Behaviour matches ChatGPT / Claude / Grok: if the authenticated user
  // already has at least one conversation with zero turns (an "empty"
  // conversation), the newest one is reused; only when no empty
  // conversation exists is a new one minted. This prevents page reloads
  // from accumulating one orphaned empty conversation per refresh —
  // previously each reload unconditionally POSTed `/api/conversations`
  // and produced a new UUID v7 conversation, polluting the sidebar.
  //
  // The list endpoint already returns summaries newest-first, so
  // `.find(c => c.turnCount === 0)` lands on the most recent empty
  // conversation deterministically. Failure modes:
  //   - List fetch failure: treated as "no conversations known" and we
  //     fall through to `createConversation()` for at-least-once start.
  //   - The found empty conversation is gone (deleted between list and
  //     load): `selectConversation` silently no-ops, leaving the user
  //     without an active conversation; a subsequent mount cycle (next
  //     reload) retries. The bootstrap effect runs once per mount, not
  //     once per session, so reload is the retry mechanism.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/conversations", {
          credentials: "same-origin",
        });
        if (res.ok) {
          const data = (await res.json()) as {
            conversations: Array<{ conversationUuid: string; turnCount: number }>;
          };
          const empty = data.conversations.find((c) => c.turnCount === 0);
          if (empty) {
            await selectConversation(empty.conversationUuid);
            return;
          }
        }
      } catch {
        // Network or parse failure — fall through to creation.
      }
      await createConversation();
    })();
  }, [createConversation, selectConversation]);

  return {
    raw,
    governed,
    rawModel,
    governedModel,
    isThinking,
    error,
    activeConversationUuid,
    conversationsRefreshKey,
    sendMessage,
    createConversation,
    selectConversation,
  };
}
