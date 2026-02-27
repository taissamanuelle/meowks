import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { BookmarkPlus, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

// Parse [SAVE_MEMORY: ...] and [UPDATE_MEMORY: id | ...] from AI text
function parseMemoryActions(text: string) {
  const saveRegex = /\[SAVE_MEMORY:\s*(.+?)\]/g;
  const updateRegex = /\[UPDATE_MEMORY:\s*(\S+?)\s*\|\s*(.+?)\]/g;

  const saves: string[] = [];
  const updates: { id: string; content: string }[] = [];

  let match;
  while ((match = saveRegex.exec(text)) !== null) {
    saves.push(match[1].trim());
  }
  while ((match = updateRegex.exec(text)) !== null) {
    updates.push({ id: match[1].trim(), content: match[2].trim() });
  }

  // Remove the tags from displayed text
  const cleanText = text
    .replace(/\[SAVE_MEMORY:\s*.+?\]/g, "")
    .replace(/\[UPDATE_MEMORY:\s*\S+?\s*\|\s*.+?\]/g, "")
    .trim();

  return { cleanText, saves, updates };
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  avatar?: string | null;
  isStreaming?: boolean;
  onSaveMemory?: (userText: string) => Promise<void>;
  onUpdateMemory?: (id: string, content: string) => Promise<void>;
  onSaveNewMemory?: (content: string) => Promise<void>;
}

export function ChatMessage({
  role, content, avatar, isStreaming,
  onSaveMemory, onUpdateMemory, onSaveNewMemory,
}: ChatMessageProps) {
  const isUser = role === "user";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionsDone, setActionsDone] = useState<Set<number>>(new Set());
  const [actionsLoading, setActionsLoading] = useState<Set<number>>(new Set());

  const handleSaveUserMsg = async () => {
    if (!onSaveMemory || saving) return;
    setSaving(true);
    try {
      await onSaveMemory(content);
      setSaved(true);
    } catch { /* handled upstream */ }
    setSaving(false);
  };

  // Parse AI memory actions
  const isAI = !isUser;
  const { cleanText, saves, updates } = isAI ? parseMemoryActions(content) : { cleanText: content, saves: [], updates: [] };

  const handleAction = async (idx: number, action: () => Promise<void>) => {
    setActionsLoading((prev) => new Set(prev).add(idx));
    try {
      await action();
      setActionsDone((prev) => new Set(prev).add(idx));
    } catch { /* handled */ }
    setActionsLoading((prev) => {
      const n = new Set(prev);
      n.delete(idx);
      return n;
    });
  };

  return (
    <div className={cn("flex gap-3 py-3 animate-fade-in", isUser ? "justify-end" : "justify-start")}>
      {isAI && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20">
          <span className="text-sm font-bold text-accent">✦</span>
        </div>
      )}

      <div className={cn("max-w-[75%] flex flex-col gap-1.5", isUser && "items-end")}>
        <div className="relative">
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-base leading-relaxed",
              isUser
                ? "bg-user-bubble text-primary-foreground rounded-br-sm"
                : "bg-ai-bubble text-foreground rounded-bl-sm"
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              <div className="prose prose-invert prose-base max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5">
                <ReactMarkdown>{cleanText}</ReactMarkdown>
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

        {/* Memory action buttons from AI response */}
        {isAI && !isStreaming && (saves.length > 0 || updates.length > 0) && (
          <div className="flex flex-col gap-1">
            {saves.map((s, i) => (
              <button
                key={`save-${i}`}
                disabled={actionsDone.has(i) || actionsLoading.has(i)}
                onClick={() => handleAction(i, () => onSaveNewMemory?.(s) || Promise.resolve())}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all border",
                  actionsDone.has(i)
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {actionsLoading.has(i) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                {actionsDone.has(i) ? "Salvo!" : <span className="line-clamp-3">{`Salvar: "${s}"`}</span>}
              </button>
            ))}
            {updates.map((u, i) => {
              const idx = saves.length + i;
              return (
                <button
                  key={`update-${i}`}
                  disabled={actionsDone.has(idx) || actionsLoading.has(idx)}
                  onClick={() => handleAction(idx, () => onUpdateMemory?.(u.id, u.content) || Promise.resolve())}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all border",
                    actionsDone.has(idx)
                      ? "border-accent/30 bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  {actionsLoading.has(idx) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {actionsDone.has(idx) ? "Atualizado!" : <span className="line-clamp-3">{`Atualizar: "${u.content}"`}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Save memory button on USER messages */}
        {isUser && onSaveMemory && !saved && (
          <button
            onClick={handleSaveUserMsg}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
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
