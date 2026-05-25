"use client";

import { Sparkle } from "@phosphor-icons/react";

export function ChatHeader() {
  return (
    <header className="flex items-center gap-4 border-b border-border bg-card px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        >
          <Sparkle size={22} weight="fill" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight text-foreground">
            TeleologyHI · Arena
          </h1>
          <p className="truncate text-xs leading-tight text-muted-foreground">
            Compare a raw LLM against the same model under MAIC + HIM + NHE governance.
          </p>
        </div>
      </div>
    </header>
  );
}
