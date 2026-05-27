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

/**
 * Audit fix F6: the prop was previously `lastRoundId`, a leftover from
 * the pre-E27-F round-based model. The arena is now conversation-based,
 * so the identifier the input echoes is the conversation UUID v7. The
 * old label "saved as round <ULID>" surfaced a UUID under a "round"
 * caption, which was both technically and conceptually wrong.
 *
 * Audit fix (UX hygiene): the previous cut also accepted an `error`
 * prop that was intentionally ignored inside the component (Creator
 * directive: "não pode printar no output mensagem de erro"). Keeping
 * an ignored prop on the type signature invited consumers to wire up
 * error plumbing that would silently disappear. The current cut
 * removes the prop entirely so failure handling stays where it
 * belongs — in the hook and the route layer.
 */
type ChatInputProps = {
  onSubmit: (value: string) => boolean;
  disabled?: boolean;
  activeConversationUuid?: string | null;
};

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 160;

export function ChatInput({
  onSubmit,
  disabled,
  activeConversationUuid,
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
          /* `text-base` (16px) on small screens prevents iOS Safari from
             auto-zooming the page when the input receives focus; `sm:text-sm`
             switches back to the compact 14px on tablets and up where the
             zoom heuristic does not apply. */
          className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-3 text-base leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:px-4 sm:text-sm"
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
      <p
        className="hidden truncate px-1 text-[11px] text-muted-foreground sm:block"
        aria-live="polite"
      >
        {activeConversationUuid ? (
          <>
            Press Enter to send · Shift + Enter for a new line — conversation{" "}
            <code className="font-mono text-foreground">
              {activeConversationUuid}
            </code>
          </>
        ) : (
          "Press Enter to send · Shift + Enter for a new line."
        )}
      </p>
    </form>
  );
}
