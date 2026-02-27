import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { BookmarkPlus } from "lucide-react";
import { useState } from "react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  avatar?: string | null;
  isStreaming?: boolean;
  onSaveMemory?: (content: string) => void;
}

export function ChatMessage({ role, content, avatar, isStreaming, onSaveMemory }: ChatMessageProps) {
  const isUser = role === "user";
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (onSaveMemory) {
      onSaveMemory(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className={cn("flex gap-3 py-3 animate-fade-in", isUser ? "justify-end" : "justify-start")}>
      {/* AI avatar */}
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20">
          <span className="text-sm font-bold text-accent">✦</span>
        </div>
      )}

      <div className={cn("max-w-[75%] flex flex-col gap-1", isUser && "items-end")}>
        {/* Bubble with tail */}
        <div className="relative">
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              isUser
                ? "bg-user-bubble text-primary-foreground rounded-br-sm"
                : "bg-ai-bubble text-foreground rounded-bl-sm"
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5">
                <ReactMarkdown>{content}</ReactMarkdown>
                {isStreaming && (
                  <span className="inline-block w-2 h-4 ml-0.5 bg-accent/70 animate-pulse rounded-sm" />
                )}
              </div>
            )}
          </div>
          {/* Tail */}
          {isUser ? (
            <div className="absolute -bottom-0 right-0 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-user-bubble" />
          ) : (
            <div className="absolute -bottom-0 left-0 w-0 h-0 border-r-[8px] border-r-transparent border-t-[8px] border-t-ai-bubble" />
          )}
        </div>

        {/* Save memory button for AI messages */}
        {!isUser && !isStreaming && onSaveMemory && (
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all",
              saved
                ? "bg-accent/20 text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            {saved ? "Salvo!" : "Salvar na memória"}
          </button>
        )}
      </div>

      {/* User avatar */}
      {isUser && avatar && (
        <div className="mt-1 h-8 w-8 shrink-0 overflow-hidden rounded-full">
          <img src={avatar} alt="Você" className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  );
}
