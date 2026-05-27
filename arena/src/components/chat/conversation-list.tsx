"use client";

/**
 * ConversationList — sidebar history for the authenticated user (E27-F).
 *
 * Replaces the legacy `RoundList`. Renders one row per conversation
 * (`ConversationSummary`), newest-first, with title + relative timestamp +
 * turn count. Clicking a row asks the parent to load that conversation.
 *
 * Conversations are partitioned per-user at the filesystem layer (Entry 26
 * §7), so this list is intrinsically scoped to the current user. No
 * client-side filtering needed.
 *
 * The "New conversation" button at the top creates an empty conversation
 * server-side and asks the parent to activate it.
 *
 * Toggle support: when the parent passes `onClose`, the sidebar renders
 * a collapse button in its own header — the parent owns the open/closed
 * state and decides whether the aside is mounted, overlaid, or pushed
 * into the layout. The list does not own visibility state; it only
 * surfaces the close affordance so the user can dismiss the sidebar
 * from inside it as well as from the header toggle.
 */
import { SidebarSimple } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

interface ConversationSummary {
  conversationUuid: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
}

interface ListResponse {
  conversations: ConversationSummary[];
}

interface CreateResponse {
  conversation: { conversationUuid: string };
}

interface ConversationListProps {
  /** Fired when the user clicks a conversation row. Parent loads it. */
  onSelect: (conversationUuid: string) => void;
  /** Fired when the user clicks "New conversation". Parent activates it. */
  onCreated: (conversationUuid: string) => void;
  /** Refresh signal — bump to force a re-fetch (e.g. after a new turn). */
  refreshKey?: number;
  /** Currently-active conversation UUID (for highlight). */
  activeConversationUuid?: string | null;
  /**
   * Optional collapse callback. When provided, the sidebar header renders
   * a button that calls this on click, letting the user close the sidebar
   * from inside it (useful on mobile overlay mode). When omitted, no
   * close button is rendered.
   */
  onClose?: () => void;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ConversationList({
  onSelect,
  onCreated,
  refreshKey,
  activeConversationUuid,
  onClose,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/conversations", {
        credentials: "same-origin",
      });
      // Silenced error mode (E27-G directive): on failure the previous
      // list stays visible and no error text is shown.
      if (!res.ok) return;
      const data = (await res.json()) as ListResponse;
      setConversations(data.conversations);
    } catch {
      // Keep the previous list intact.
    } finally {
      setLoading(false);
    }
  }, []);

  const createNew = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      // Silenced (E27-G): on failure no error UI, the user can press
      // "+ New" again.
      if (!res.ok) return;
      const data = (await res.json()) as CreateResponse;
      onCreated(data.conversation.conversationUuid);
      await fetchList();
    } catch {
      // No-op.
    } finally {
      setCreating(false);
    }
  }, [onCreated, fetchList]);

  useEffect(() => {
    void fetchList();
  }, [fetchList, refreshKey]);

  return (
    <aside
      className="flex h-full w-full flex-col overflow-y-auto border-r border-border bg-card/40"
      aria-label="Conversation history"
    >
      <header className="border-b border-border px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
            Conversations
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void createNew()}
              disabled={creating}
              className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground transition hover:opacity-80 disabled:opacity-50"
              aria-label="New conversation"
            >
              {creating ? "..." : "+ New"}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-muted-foreground transition hover:bg-accent/40 hover:text-foreground"
                aria-label="Close sidebar"
              >
                <SidebarSimple size={16} weight="bold" />
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
        </p>
      </header>

      {loading && (
        <div className="px-3 py-4 text-xs text-muted-foreground">
          Loading conversations...
        </div>
      )}

      {!loading && conversations.length === 0 && (
        <div className="px-3 py-4 text-xs text-muted-foreground">
          No conversations yet.
        </div>
      )}

      <ul className="divide-y divide-border">
        {conversations.map((c) => (
          <li key={c.conversationUuid}>
            <button
              type="button"
              onClick={() => onSelect(c.conversationUuid)}
              className={`w-full text-left px-3 py-2.5 hover:bg-accent/40 transition-colors ${
                activeConversationUuid === c.conversationUuid ? "bg-accent/60" : ""
              }`}
            >
              <p className="text-xs font-medium truncate">{c.title}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatTime(c.updatedAt)} · {c.turnCount} turn
                {c.turnCount === 1 ? "" : "s"}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export type { ConversationSummary };
