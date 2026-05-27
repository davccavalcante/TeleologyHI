"use client";

import { SidebarSimple, Sparkle } from "@phosphor-icons/react";

interface ChatHeaderProps {
  /** Whether the sidebar is currently open. Controls the toggle aria state. */
  sidebarOpen: boolean;
  /** Called when the user clicks the sidebar toggle. */
  onToggleSidebar: () => void;
}

export function ChatHeader({ sidebarOpen, onToggleSidebar }: ChatHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-3 sm:gap-4 sm:px-4 sm:py-3">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        aria-expanded={sidebarOpen}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent/40 hover:text-foreground"
      >
        <SidebarSimple size={20} weight="bold" />
      </button>
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden="true"
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:flex"
        >
          <Sparkle size={22} weight="fill" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight text-foreground">
            TeleologyHI · Arena
          </h1>
          <p className="hidden truncate text-xs leading-tight text-muted-foreground sm:block">
            Compare a raw LLM against the same model under MAIC + HIM + NHE governance.
          </p>
        </div>
      </div>
    </header>
  );
}
