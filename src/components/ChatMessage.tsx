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
    <div className={cn("flex gap-3 py-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20">
          <span className="text-sm font-bold text-accent">✦</span>
        </div>
      )}
      <div
        className={cn(
          "text-sm leading-relaxed",
          isUser
            ? "max-w-[70%] rounded-3xl bg-secondary px-5 py-3 text-foreground"
            : "max-w-[85%] text-foreground"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && avatar && (
        <div className="mt-1 h-8 w-8 shrink-0 overflow-hidden rounded-full">
          <img src={avatar} alt="Você" className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  );
}
