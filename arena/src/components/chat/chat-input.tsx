"use client";

import { PaperPlaneTilt } from "@phosphor-icons/react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";

type ChatInputProps = {
  onSubmit: (value: string) => boolean;
  disabled?: boolean;
  error?: string | null;
  lastRoundId?: string | null;
};

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 160;

export function ChatInput({
  onSubmit,
  disabled,
  error,
  lastRoundId,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = `${MIN_HEIGHT}px`;
    const next = Math.min(Math.max(node.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    node.style.height = `${next}px`;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: adjustHeight
  // closes over a stable ref; running once on mount is intentional and safe.
  useEffect(() => {
    adjustHeight();
  }, []);

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!value.trim() || disabled) return;
    const sent = onSubmit(value);
    if (sent) {
      setValue("");
      requestAnimationFrame(adjustHeight);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = value.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-4xl flex-col gap-2"
    >
      <div className="flex items-stretch gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask both sides the same question…"
          rows={1}
          style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
          className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          type="submit"
          disabled={!canSubmit}
          aria-label="Send message"
          style={{ minHeight: MIN_HEIGHT }}
          className="h-auto shrink-0 self-stretch px-4 sm:px-5"
        >
          <PaperPlaneTilt size={18} weight="fill" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
      <p className="px-1 text-[11px] text-muted-foreground" aria-live="polite">
        {error ? (
          <span className="text-destructive" role="alert">
            Error: {error}
          </span>
        ) : lastRoundId ? (
          <>
            Press Enter to send · Shift + Enter for a new line — saved as round{" "}
            <code className="font-mono text-foreground">{lastRoundId}</code>
          </>
        ) : (
          "Press Enter to send · Shift + Enter for a new line."
        )}
      </p>
    </form>
  );
}
