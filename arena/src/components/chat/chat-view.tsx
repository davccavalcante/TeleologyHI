"use client";

import { useEffect, useState } from "react";
import { CHANNELS } from "@/lib/chat/configs";
import { useDualChat } from "@/hooks/use-dual-chat";
import { ConsentBanner } from "../consent-banner";
import { ChatColumn } from "./chat-column";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { ConversationList } from "./conversation-list";

export function ChatView() {
  // Auth + consent gate. `ConsentBanner` shows the sign-in page when no
  // session exists, the consent form when the user has not yet accepted
  // the current policy version, and renders its children (the actual
  // arena UI) only when both gates pass. Per Entry 26 §9.6, no LLM call
  // and no governance state mutation happens before the gate clears.
  return (
    <ConsentBanner>
      <AuthedChatView />
    </ConsentBanner>
  );
}

/**
 * Tailwind `lg` breakpoint matches the media query used at runtime to
 * decide the sidebar's default open state. Keep these in sync.
 */
const LG_BREAKPOINT_QUERY = "(max-width: 1023px)";

function AuthedChatView() {
  const {
    raw,
    governed,
    rawModel,
    governedModel,
    isThinking,
    activeConversationUuid,
    conversationsRefreshKey,
    sendMessage,
    selectConversation,
  } = useDualChat();

  // Sidebar visibility. Default open (matches SSR + desktop expectation);
  // on mount, close it if the viewport is below the `lg` breakpoint so
  // mobile users land on a clean chat surface instead of a sidebar
  // covering most of the screen. After mount the state is user-driven.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia(LG_BREAKPOINT_QUERY).matches) {
      setSidebarOpen(false);
    }
  }, []);

  return (
    <div className="flex h-dvh bg-background">
      {sidebarOpen && (
        <>
          {/* Mobile backdrop — dismisses the overlay sidebar on tap.
              Hidden on `lg` and up where the sidebar lives in the flex
              flow and does not require a backdrop. */}
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* The aside is `fixed` on mobile (overlay above the main
              content) and `relative` on `lg+` (flex child that pushes
              the main content). Width grows slightly on small screens
              so the touch targets do not feel cramped. */}
          <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] sm:w-80 lg:relative lg:z-auto lg:w-64 lg:max-w-none lg:shrink-0">
            <ConversationList
              activeConversationUuid={activeConversationUuid}
              refreshKey={conversationsRefreshKey}
              onSelect={(uuid) => {
                void selectConversation(uuid);
                // On mobile, auto-close the overlay after picking a
                // conversation so the user lands directly on the
                // chat surface they just selected.
                if (
                  typeof window !== "undefined" &&
                  window.matchMedia(LG_BREAKPOINT_QUERY).matches
                ) {
                  setSidebarOpen(false);
                }
              }}
              onCreated={(uuid) => {
                void selectConversation(uuid);
                if (
                  typeof window !== "undefined" &&
                  window.matchMedia(LG_BREAKPOINT_QUERY).matches
                ) {
                  setSidebarOpen(false);
                }
              }}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </>
      )}

      {/* When the sidebar is open AND we are on lg+, the aside is in
          the flex flow and the main column shrinks naturally — Tailwind
          handles the responsive split via the flex parent above. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />

        <main className="flex-1 overflow-hidden p-2 sm:p-3 md:p-4">
          <div className="grid h-full min-h-0 grid-cols-1 grid-rows-2 gap-2 sm:gap-3 md:grid-cols-2 md:grid-rows-1 md:gap-4">
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

        <footer className="border-t border-border bg-card px-2 py-2 sm:px-4 sm:py-3 md:py-4">
          <ChatInput
            onSubmit={sendMessage}
            disabled={isThinking || !activeConversationUuid}
            activeConversationUuid={activeConversationUuid}
          />
        </footer>
      </div>
    </div>
  );
}
