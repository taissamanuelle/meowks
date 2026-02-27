import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  avatar?: string | null;
}

export function ChatMessage({ role, content, avatar }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser && "flex-row-reverse")}>
      <div className="mt-1 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center">
        {isUser && avatar ? (
          <img src={avatar} alt="You" className="h-full w-full object-cover" />
        ) : !isUser ? (
          <span className="text-xs font-bold text-accent">M</span>
        ) : (
          <span className="text-xs font-bold text-primary-foreground">U</span>
        )}
      </div>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-user-bubble text-primary-foreground"
            : "bg-ai-bubble text-foreground"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
