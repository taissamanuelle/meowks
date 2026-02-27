import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { BookmarkPlus, RefreshCw, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  avatar?: string | null;
  isStreaming?: boolean;
  onSaveMemory?: (userText: string) => Promise<void>;
  onUpdateMemory?: (newContent: string) => Promise<void>;
}

export function ChatMessage({
  role, content, images, avatar, isStreaming, onSaveMemory, onUpdateMemory,
}: ChatMessageProps) {
  const isUser = role === "user";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updated, setUpdated] = useState(false);

  const handleSaveUserMsg = async () => {
    if (!onSaveMemory || saving) return;
    setSaving(true);
    try {
      await onSaveMemory(content);
      setSaved(true);
    } catch { /* handled upstream */ }
    setSaving(false);
  };

  // Extract UPDATE_MEMORY tag content from AI responses
  const { cleanContent, memoryUpdate } = useMemo(() => {
    if (isUser) return { cleanContent: content, memoryUpdate: null };
    
    const updateMatch = content.match(/\[UPDATE_MEMORY:\s*(.+?)\]/);
    const updateContent = updateMatch ? updateMatch[1].trim() : null;
    
    const cleaned = content
      .replace(/\[SAVE_MEMORY:[^\]]*\]/g, "")
      .replace(/\[UPDATE_MEMORY:[^\]]*\]/g, "")
      .replace(/\[DELETE_MEMORY:[^\]]*\]/g, "")
      .trim();
    
    return { cleanContent: cleaned, memoryUpdate: updateContent };
  }, [content, isUser]);

  const handleUpdateMemory = async () => {
    if (!onUpdateMemory || !memoryUpdate || updating) return;
    setUpdating(true);
    try {
      await onUpdateMemory(memoryUpdate);
      setUpdated(true);
    } catch { /* handled upstream */ }
    setUpdating(false);
  };

  if (isUser) {
    return (
      <div className="flex justify-end py-4 animate-fade-in">
        <div className="flex items-start gap-3 max-w-[70%]">
          <div className="flex flex-col items-end gap-1.5">
            {images && images.length > 0 && (
              <div className="flex gap-2 flex-wrap justify-end">
                {images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt="Imagem enviada"
                    className="max-h-64 max-w-full rounded-xl border border-border object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(src, "_blank")}
                  />
                ))}
              </div>
            )}
            {content && (
              <div className="rounded-2xl rounded-tr-sm bg-user-bubble px-5 py-3 text-[15px] leading-relaxed text-primary-foreground shadow-sm">
                <p className="whitespace-pre-wrap">{content}</p>
              </div>
            )}
            {onSaveMemory && !saved && content && (
              <button
                onClick={handleSaveUserMsg}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkPlus className="h-3 w-3" />}
                {saving ? "Salvando..." : "Salvar na memória"}
              </button>
            )}
            {saved && (
              <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs bg-accent/20 text-accent">
                <BookmarkPlus className="h-3 w-3" /> Salvo!
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-5 animate-fade-in">
      <div className="max-w-[85%]">
        <div className="rounded-2xl rounded-tl-sm bg-secondary/60 px-5 py-3 shadow-sm prose prose-invert prose-base max-w-none text-[15px] leading-[1.75] text-foreground/90 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_strong]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_code]:bg-background [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-background [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_a]:text-accent [&_blockquote]:border-accent/40 [&_blockquote]:text-muted-foreground">
          <ReactMarkdown>{cleanContent}</ReactMarkdown>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 ml-1">
              <span className="inline-block text-base leading-none animate-bounce" style={{ animationDuration: '0.6s' }}>✍️</span>
              <span className="inline-block w-1.5 h-5 bg-accent animate-pulse rounded-full" />
            </span>
          )}
        </div>
        {/* Memory update suggestion */}
        {memoryUpdate && onUpdateMemory && !updated && !isStreaming && (
          <button
            onClick={handleUpdateMemory}
            disabled={updating}
            className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border/50 transition-all"
          >
            {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {updating ? "Atualizando..." : "Atualizar memória"}
          </button>
        )}
        {updated && (
          <span className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-accent/20 text-accent w-fit">
            <RefreshCw className="h-3 w-3" /> Memória atualizada!
          </span>
        )}
      </div>
    </div>
  );
}
