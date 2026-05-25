import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import type { ChannelVariant } from "@/lib/chat/types";

type EmptyStateProps = {
  variant: ChannelVariant;
  title: string;
};

export function EmptyState({ variant, title }: EmptyStateProps) {
  const accent =
    variant === "governed"
      ? "bg-chat-governed-soft text-chat-governed"
      : "bg-chat-raw-soft text-chat-raw";

  const helper =
    variant === "governed"
      ? "Every reply on this side passes through axiom-based supervision, an EU-lawful persona, and an append-only audit trail."
      : "No safety layer, no policy, no audit. You see exactly what the underlying LLM would say on its own.";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div
        aria-hidden="true"
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          accent,
        )}
      >
        <ChatCircleDots size={24} weight="bold" />
      </div>
      <p className="max-w-[340px] text-sm text-muted-foreground text-balance">
        {helper}
      </p>
      <p className="text-[11px] text-muted-foreground/70">{title}</p>
    </div>
  );
}
