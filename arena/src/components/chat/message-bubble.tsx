import {
  CheckCircle,
  Robot,
  ShieldCheck,
  User,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import type {
  ChannelVariant,
  ChatMessage,
  VerdictKind,
} from "@/lib/chat/types";
import { formatTime } from "@/lib/chat/utils";

type MessageBubbleProps = {
  message: ChatMessage;
  variant: ChannelVariant;
};

export function MessageBubble({ message, variant }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.content.startsWith("ERROR:");

  const assistantAvatar =
    variant === "governed"
      ? "bg-chat-governed text-chat-governed-foreground"
      : "bg-chat-raw text-chat-raw-foreground";
  const AssistantIcon = variant === "governed" ? ShieldCheck : Robot;

  const showFooter =
    !isUser &&
    !isError &&
    (message.durationMs !== undefined ||
      message.verdict !== undefined ||
      message.refused === true ||
      (message.citedAxioms && message.citedAxioms.length > 0) ||
      (message.kind && message.kind !== "regular" && message.kind !== "ok"));

  return (
    <li
      className={cn(
        "flex w-full items-start gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-bubble-user text-bubble-user-foreground" : assistantAvatar,
        )}
      >
        {isUser ? (
          <User size={16} weight="bold" />
        ) : (
          <AssistantIcon size={16} weight="bold" />
        )}
      </div>

      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap",
            isUser
              ? "bg-bubble-user text-bubble-user-foreground rounded-tr-sm"
              : "bg-bubble-assistant text-bubble-assistant-foreground border border-border rounded-tl-sm",
            isError && "text-destructive",
          )}
        >
          {message.content}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-1 text-[11px] text-muted-foreground">
          <time
            dateTime={new Date(message.timestamp).toISOString()}
            className="tabular-nums"
          >
            {formatTime(message.timestamp)}
          </time>
          {showFooter && (
            <>
              {message.durationMs !== undefined && (
                <span className="tabular-nums">{message.durationMs}ms</span>
              )}
              {message.verdict && <VerdictChip value={message.verdict} />}
              {message.preVerdict &&
                message.preVerdict !== message.verdict && (
                  <span>
                    pre <VerdictChip value={message.preVerdict} compact />
                  </span>
                )}
              {message.refused === true && (
                <span className="font-medium text-destructive">refused</span>
              )}
              {message.kind &&
                message.kind !== "regular" &&
                message.kind !== "ok" && (
                  <span>
                    kind{" "}
                    <span className="font-mono text-foreground">
                      {message.kind}
                    </span>
                  </span>
                )}
            </>
          )}
        </div>

        {message.citedAxioms && message.citedAxioms.length > 0 && (
          <ul className="flex max-w-full flex-wrap gap-1 px-1">
            {message.citedAxioms.map((id) => (
              <li
                key={id}
                className="rounded-full border border-border bg-muted/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {id}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function VerdictChip({
  value,
  compact = false,
}: {
  value: VerdictKind;
  compact?: boolean;
}) {
  const Icon =
    value === "approve"
      ? CheckCircle
      : value === "warn"
        ? WarningCircle
        : XCircle;
  const tone =
    value === "approve"
      ? "border-verdict-approve text-verdict-approve"
      : value === "warn"
        ? "border-verdict-warn text-verdict-warn"
        : "border-verdict-deny text-verdict-deny";
  return (
    <span
      aria-label={`verdict ${value}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        tone,
      )}
    >
      <Icon size={10} weight="bold" aria-hidden="true" />
      {!compact && value}
    </span>
  );
}
