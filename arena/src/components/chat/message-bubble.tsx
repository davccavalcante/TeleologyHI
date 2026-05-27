import {
  CheckCircle,
  Robot,
  ShieldCheck,
  User,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
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

/**
 * Markdown renderers for assistant bubbles. The Gemini API returns text
 * with standard markdown (bold, italic, headings, lists, inline code,
 * fenced code, blockquotes, GFM tables / strikethrough). Without an
 * actual renderer the literal `**foo**` characters appeared in the UI
 * — that was the Creator-reported regression. The component map below
 * keeps spacing tight enough to fit inside the message bubble while
 * still surfacing the structural cues (bold, list bullets, etc).
 *
 * `ReactMarkdown` is safe by default: raw HTML in the LLM output is
 * NOT rendered (no `rehype-raw`), so a `<script>` tag injected via
 * prompt would appear as literal text — no XSS path.
 */
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-sm font-bold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-2 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children, className }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {children}
        </code>
      );
    }
    return (
      <code className={cn("font-mono text-xs", className)}>{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 text-xs">
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-foreground/40 underline-offset-2 hover:decoration-foreground"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted/30 px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1">{children}</td>
  ),
  hr: () => <hr className="my-3 border-border" />,
};

export function MessageBubble({ message, variant }: MessageBubbleProps) {
  const isUser = message.role === "user";
  // Audit fix F8: when the assistant content came back empty (rotation
  // exhausted, empty completion unrecovered, etc.) we still want a
  // visible bubble — otherwise the user's prompt floats orphaned next
  // to an empty avatar. We render a subtle ellipsis as a placeholder
  // so the failure is acknowledged without leaking a technical error
  // message (Creator directive: "não pode printar no output mensagem
  // de erro").
  const isEmptyAssistant = !isUser && message.content.length === 0;

  const assistantAvatar =
    variant === "governed"
      ? "bg-chat-governed text-chat-governed-foreground"
      : "bg-chat-raw text-chat-raw-foreground";
  const AssistantIcon = variant === "governed" ? ShieldCheck : Robot;

  const showFooter =
    !isUser &&
    (message.durationMs !== undefined ||
      message.verdict !== undefined ||
      message.refused === true ||
      (message.citedAxioms && message.citedAxioms.length > 0) ||
      (message.kind && message.kind !== "regular" && message.kind !== "ok"));

  return (
    <li
      className={cn(
        "flex w-full items-start gap-2 sm:gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8",
          isUser ? "bg-bubble-user text-bubble-user-foreground" : assistantAvatar,
        )}
      >
        {isUser ? (
          <User size={14} weight="bold" className="sm:hidden" />
        ) : (
          <AssistantIcon size={14} weight="bold" className="sm:hidden" />
        )}
        {isUser ? (
          <User size={16} weight="bold" className="hidden sm:block" />
        ) : (
          <AssistantIcon size={16} weight="bold" className="hidden sm:block" />
        )}
      </div>

      <div
        className={cn(
          "flex min-w-0 max-w-[88%] flex-col gap-1 sm:max-w-[85%]",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words sm:px-4 sm:py-2.5",
            isUser
              ? "whitespace-pre-wrap bg-bubble-user text-bubble-user-foreground rounded-tr-sm"
              : "bg-bubble-assistant text-bubble-assistant-foreground border border-border rounded-tl-sm",
          )}
        >
          {isEmptyAssistant ? (
            <span
              aria-label="No response — try resending"
              className="select-none text-muted-foreground/60"
            >
              …
            </span>
          ) : isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          )}
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
