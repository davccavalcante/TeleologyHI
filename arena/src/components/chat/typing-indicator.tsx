import { Robot, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import type { ChannelVariant } from "@/lib/chat/types";

type TypingIndicatorProps = {
  variant: ChannelVariant;
};

export function TypingIndicator({ variant }: TypingIndicatorProps) {
  const avatar =
    variant === "governed"
      ? "bg-chat-governed text-chat-governed-foreground"
      : "bg-chat-raw text-chat-raw-foreground";

  const Icon = variant === "governed" ? ShieldCheck : Robot;

  return (
    <li
      className="flex items-start gap-3"
      aria-live="polite"
      aria-label="Thinking"
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          avatar,
        )}
      >
        <Icon size={16} weight="bold" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-bubble-assistant px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </li>
  );
}
