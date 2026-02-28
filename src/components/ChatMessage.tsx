import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { BookmarkPlus, RefreshCw, Loader2, Check, X, ArrowRight, Sparkles, Pencil, RotateCcw } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  avatar?: string | null;
  isStreaming?: boolean;
  onSaveMemory?: (userText: string) => Promise<void>;
  onUpdateMemory?: (oldContent: string, newContent: string) => Promise<void>;
  onSuggestMemory?: (text: string) => Promise<void>;
  onEdit?: (newContent: string) => void;
  onRegenerate?: () => void;
}

export function ChatMessage({
  role, content, images, avatar, isStreaming, onSaveMemory, onUpdateMemory, onSuggestMemory, onEdit, onRegenerate,
}: ChatMessageProps) {
  const isUser = role === "user";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [updating, setUpdating] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [suggestSaving, setSuggestSaving] = useState(false);
  const [suggestSaved, setSuggestSaved] = useState(false);
  const [suggestDismissed, setSuggestDismissed] = useState(false);

  const handleSaveUserMsg = async () => {
    if (!onSaveMemory || saving) return;
    setSaving(true);
    try {
      await onSaveMemory(content);
      setSaved(true);
    } catch { /* handled upstream */ }
    setSaving(false);
  };

  // Extract UPDATE_MEMORY and SUGGEST_MEMORY tag content
  const { cleanContent, memoryOld, memoryNew, suggestedMemory } = useMemo(() => {
    if (isUser) return { cleanContent: content, memoryOld: null, memoryNew: null, suggestedMemory: null };
    
    const updateMatch = content.match(/\[UPDATE_MEMORY:\s*OLD:\s*(.+?)\s*\|\|\|\s*NEW:\s*(.+?)\]/);
    let oldContent: string | null = null;
    let newContent: string | null = null;
    
    if (updateMatch) {
      oldContent = updateMatch[1].trim();
      newContent = updateMatch[2].trim();
    } else {
      const legacyMatch = content.match(/\[UPDATE_MEMORY:\s*(.+?)\]/);
      if (legacyMatch) {
        newContent = legacyMatch[1].trim();
      }
    }

    // Extract SUGGEST_MEMORY
    const suggestMatch = content.match(/\[SUGGEST_MEMORY:\s*(.+?)\]/);
    const suggested = suggestMatch ? suggestMatch[1].trim() : null;
    
    const cleaned = content
      .replace(/\[SAVE_MEMORY:[^\]]*\]/g, "")
      .replace(/\[UPDATE_MEMORY:[^\]]*\]/g, "")
      .replace(/\[DELETE_MEMORY:[^\]]*\]/g, "")
      .replace(/\[SUGGEST_MEMORY:[^\]]*\]/g, "")
      .trim();
    
    return { cleanContent: cleaned, memoryOld: oldContent, memoryNew: newContent, suggestedMemory: suggested };
  }, [content, isUser]);

  const handleApproveUpdate = async () => {
    if (!onUpdateMemory || !memoryNew || updating) return;
    setUpdating(true);
    try {
      await onUpdateMemory(memoryOld || "", memoryNew);
      setUpdated(true);
      setShowPreview(false);
    } catch { /* handled upstream */ }
    setUpdating(false);
  };

  const handleSaveSuggested = async () => {
    if (!onSuggestMemory || !suggestedMemory || suggestSaving) return;
    setSuggestSaving(true);
    try {
      await onSuggestMemory(suggestedMemory);
      setSuggestSaved(true);
    } catch { /* handled upstream */ }
    setSuggestSaving(false);
  };

  if (isUser) {
    const handleSubmitEdit = () => {
      if (editText.trim() && editText.trim() !== content && onEdit) {
        onEdit(editText.trim());
      }
      setEditing(false);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmitEdit();
      }
      if (e.key === "Escape") {
        setEditing(false);
        setEditText(content);
      }
    };

    return (
      <div className="flex justify-end py-4 group">
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
            {editing ? (
              <div className="w-full min-w-[200px]">
                <textarea
                  ref={editRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="w-full rounded-2xl bg-secondary border border-border px-4 py-3 text-[17px] leading-relaxed text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-accent"
                  rows={Math.min(8, editText.split("\n").length + 1)}
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditing(false); setEditText(content); }}
                    className="h-7 px-2.5 text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitEdit}
                    disabled={!editText.trim() || editText.trim() === content}
                    className="h-7 px-2.5 text-xs"
                  >
                    Enviar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {content && (
                  <div className="rounded-2xl rounded-tr-sm skeu-bubble-user px-5 py-3 text-[17px] md:text-[17px] leading-relaxed text-white">
                    <p className="whitespace-pre-wrap">{content}</p>
                  </div>
                )}
                {/* Action buttons row */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onEdit && !isStreaming && (
                    <button
                      onClick={() => { setEditText(content); setEditing(true); }}
                      className="flex items-center gap-1 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                      title="Editar mensagem"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
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
                </div>
              </>
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
    <div className="py-4 group">
      <div className="w-full px-4">
        <div className="prose prose-invert prose-base max-w-none text-[17px] md:text-[17px] leading-[1.8] text-foreground/90 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_strong]:text-foreground [&_h1]:text-[32px] [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-[24px] [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-[20px] [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mt-2 [&_h3]:mb-1 [&_code]:bg-background [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-background [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_a]:text-accent [&_blockquote]:border-accent/40 [&_blockquote]:text-muted-foreground">
          {cleanContent ? (
            <>
              <ReactMarkdown>{cleanContent}</ReactMarkdown>
              {isStreaming && (
                <span className="inline-flex items-center gap-1 ml-1">
                  <span className="inline-block text-base leading-none animate-bounce" style={{ animationDuration: '0.6s' }}>✍️</span>
                  <span className="inline-block w-1.5 h-5 bg-accent animate-pulse rounded-full" />
                </span>
              )}
            </>
          ) : isStreaming ? (
            <div className="flex items-center gap-1 py-1">
              <span className="inline-block text-base leading-none animate-bounce" style={{ animationDuration: '0.6s' }}>✍️</span>
              <span className="inline-block w-1.5 h-5 bg-accent animate-pulse rounded-full" />
            </div>
          ) : null}
        </div>

        {/* Memory update suggestion - click to preview */}
        {memoryNew && onUpdateMemory && !updated && !isStreaming && (
          <button
            onClick={() => setShowPreview(true)}
            className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border/50 transition-all"
          >
            <RefreshCw className="h-3 w-3" />
            Revisar atualização de memória
          </button>
        )}
        {updated && (
          <span className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-accent/20 text-accent w-fit">
            <RefreshCw className="h-3 w-3" /> Memória atualizada!
          </span>
        )}

        {/* Memory suggestion */}
        {suggestedMemory && onSuggestMemory && !suggestSaved && !suggestDismissed && !isStreaming && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={handleSaveSuggested}
              disabled={suggestSaving}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border/50 transition-all"
            >
              {suggestSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {suggestSaving ? "Salvando..." : "Salvar na memória"}
            </button>
            <button
              onClick={() => setSuggestDismissed(true)}
              className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {suggestSaved && (
          <span className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-accent/20 text-accent w-fit">
            <Sparkles className="h-3 w-3" /> Memória salva!
          </span>
        )}

        {/* Regenerate button */}
        {onRegenerate && !isStreaming && cleanContent && (
          <button
            onClick={onRegenerate}
            className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 opacity-0 group-hover:opacity-100 transition-all"
            title="Gerar outra resposta"
          >
            <RotateCcw className="h-3 w-3" />
            Regenerar
          </button>
        )}

        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Atualizar memória
              </DialogTitle>
              <DialogDescription>
                Revise a mudança proposta antes de aprovar.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 py-2">
              {memoryOld && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-[11px] font-medium text-destructive/70 uppercase tracking-wider mb-1.5">Antes</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{memoryOld}</p>
                </div>
              )}
              
              {memoryOld && (
                <div className="flex justify-center">
                  <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                </div>
              )}
              
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                <p className="text-[11px] font-medium text-accent/70 uppercase tracking-wider mb-1.5">
                  {memoryOld ? "Depois" : "Nova memória"}
                </p>
                <p className="text-sm text-foreground leading-relaxed">{memoryNew}</p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(false)}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleApproveUpdate}
                disabled={updating}
                className="gap-1.5"
              >
                {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {updating ? "Atualizando..." : "Aprovar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
