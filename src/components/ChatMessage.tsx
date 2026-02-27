import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { BookmarkPlus, Loader2 } from "lucide-react";
import { useState } from "react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  avatar?: string | null;
  isStreaming?: boolean;
  onSaveMemory?: (userText: string) => Promise<void>;
}

export function ChatMessage({ role, content, avatar, isStreaming, onSaveMemory }: ChatMessageProps) {
  const isUser = role === "user";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!onSaveMemory || saving) return;
    setSaving(true);
    try {
      await onSaveMemory(content);
      setSaved(true);
    } catch {
      // error handled upstream
    }
    setSaving(false);
  };

  return (
    <div className={cn("flex gap-3 py-3 animate-fade-in", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20">
          <span className="text-sm font-bold text-accent">✦</span>
        </div>
      )}

      <div className={cn("max-w-[75%] flex flex-col gap-1", isUser && "items-end")}>
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
          {isUser ? (
            <div className="absolute -bottom-0 right-0 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-user-bubble" />
          ) : (
            <div className="absolute -bottom-0 left-0 w-0 h-0 border-r-[8px] border-r-transparent border-t-[8px] border-t-ai-bubble" />
          )}
        </div>

        {/* Save memory button on USER messages */}
        {isUser && onSaveMemory && !saved && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookmarkPlus className="h-3.5 w-3.5" />
            )}
            {saving ? "Salvando..." : "Salvar na memória"}
          </button>
        )}
        {isUser && saved && (
          <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs bg-accent/20 text-accent">
            <BookmarkPlus className="h-3.5 w-3.5" />
            Salvo!
          </span>
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
