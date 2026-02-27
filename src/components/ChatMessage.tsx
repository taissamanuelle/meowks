import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { BookmarkPlus, Loader2 } from "lucide-react";
import { useState } from "react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  avatar?: string | null;
  isStreaming?: boolean;
  onSaveMemory?: (userText: string) => Promise<void>;
}

export function ChatMessage({
  role, content, images, avatar, isStreaming, onSaveMemory,
}: ChatMessageProps) {
  const isUser = role === "user";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveUserMsg = async () => {
    if (!onSaveMemory || saving) return;
    setSaving(true);
    try {
      await onSaveMemory(content);
      setSaved(true);
    } catch { /* handled upstream */ }
    setSaving(false);
  };

  if (isUser) {
    return (
      <div className="flex justify-end py-4 animate-fade-in">
        <div className="flex items-start gap-3 max-w-[70%]">
          <div className="flex flex-col items-end gap-1.5">
            {/* Images */}
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

  // Strip any leftover memory tags the AI might still output
  const cleanContent = content
    .replace(/\[SAVE_MEMORY:\s*.+?\]/g, "")
    .replace(/\[UPDATE_MEMORY:\s*\S+?\s*\|\s*.+?\]/g, "")
    .trim();

  return (
    <div className="py-5 animate-fade-in">
      <div className="max-w-full">
        <div className="prose prose-invert prose-base max-w-none text-[15px] leading-[1.75] text-foreground/90 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_strong]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-secondary [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_a]:text-accent [&_blockquote]:border-accent/40 [&_blockquote]:text-muted-foreground">
          <ReactMarkdown>{cleanContent}</ReactMarkdown>
          {isStreaming && (
            <span className="inline-block w-1.5 h-5 ml-0.5 bg-accent animate-pulse rounded-full" />
          )}
        </div>
      </div>
    </div>
  );
}
