"use client";

import type { ChannelConfig, ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { Robot, ShieldCheck } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { EmptyState } from "./empty-state";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";

type ChatColumnProps = {
  config: ChannelConfig;
  messages: ChatMessage[];
  isThinking: boolean;
  /**
   * Underlying LLM model id reported by the API. Surfaces the technical
   * detail (e.g. `gemini-3.5-flash`) below the subtitle so
   * both laypeople and engineers can see which model produced the reply.
   * Null until the first round completes.
   */
  model?: string | null;
};

export function ChatColumn({
  config,
  messages,
  isThinking,
  model,
}: ChatColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [isThinking]);

  const headerAccent =
    config.id === "governed"
      ? "bg-chat-governed text-chat-governed-foreground"
      : "bg-chat-raw text-chat-raw-foreground";

  const badgeAccent =
    config.id === "governed"
      ? "bg-chat-governed-soft text-chat-governed"
      : "bg-chat-raw-soft text-chat-raw";

  const Icon = config.id === "governed" ? ShieldCheck : Robot;
  // Server reports the governed model as
  // `TeleologyHI (MAIC+HIM+NHE) → gemini-…`. Strip the wrapper so both
  // columns surface the same underlying LLM id — that is the technical
  // fact the user is comparing.
  const underlyingModel = model?.split("→").pop()?.trim() ?? null;
  const modelLabel =
    underlyingModel ?? "model pending — send a message to run a round";

  return (
    <section
      aria-label={config.title}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            aria-hidden="true"
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              headerAccent,
            )}
          >
            <Icon size={18} weight="bold" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="truncate text-sm font-semibold leading-tight text-foreground">
              {config.title}
            </h2>
            <p className="text-xs leading-snug text-muted-foreground">
              {config.subtitle}
            </p>
            <p
              className="truncate font-mono text-[11px] leading-snug text-muted-foreground/80"
              title={model ?? undefined}
            >
              <span className="uppercase tracking-wider text-muted-foreground/60">
                model
              </span>{" "}
              {modelLabel}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide tabular-nums",
            badgeAccent,
          )}
          aria-label={`${messages.length} messages`}
        >
          {messages.length}
        </span>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isThinking ? (
          <EmptyState variant={config.id} title={config.title} />
        ) : (
          <ul className="flex flex-col gap-4 p-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                variant={config.id}
              />
            ))}
            {isThinking && <TypingIndicator variant={config.id} />}
          </ul>
        )}
      </div>
    </section>
  );
}
