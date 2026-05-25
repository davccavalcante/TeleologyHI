"use client";

import { CHANNELS } from "@/lib/chat/configs";
import { useDualChat } from "@/hooks/use-dual-chat";
import { ChatColumn } from "./chat-column";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";

export function ChatView() {
  const {
    raw,
    governed,
    rawModel,
    governedModel,
    isThinking,
    error,
    lastRoundId,
    sendMessage,
  } = useDualChat();

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ChatHeader />

      <main className="flex-1 overflow-hidden p-3 sm:p-4">
        <div className="grid h-full min-h-0 grid-cols-1 grid-rows-2 gap-3 sm:gap-4 md:grid-cols-2 md:grid-rows-1">
          <ChatColumn
            config={CHANNELS.raw}
            messages={raw.messages}
            isThinking={raw.isThinking}
            model={rawModel}
          />
          <ChatColumn
            config={CHANNELS.governed}
            messages={governed.messages}
            isThinking={governed.isThinking}
            model={governedModel}
          />
        </div>
      </main>

      <footer className="border-t border-border bg-card px-3 py-3 sm:px-4 sm:py-4">
        <ChatInput
          onSubmit={sendMessage}
          disabled={isThinking}
          error={error}
          lastRoundId={lastRoundId}
        />
      </footer>
    </div>
  );
}
