import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { BookmarkPlus, RefreshCw, Loader2, Check, X, ArrowRight } from "lucide-react";
import { useState, useMemo } from "react";
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
}

export function ChatMessage({
  role, content, images, avatar, isStreaming, onSaveMemory, onUpdateMemory,
}: ChatMessageProps) {
  const isUser = role === "user";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleSaveUserMsg = async () => {
    if (!onSaveMemory || saving) return;
    setSaving(true);
    try {
      await onSaveMemory(content);
      setSaved(true);
    } catch { /* handled upstream */ }
    setSaving(false);
  };

  // Extract UPDATE_MEMORY tag content (OLD ||| NEW format)
  const { cleanContent, memoryOld, memoryNew } = useMemo(() => {
    if (isUser) return { cleanContent: content, memoryOld: null, memoryNew: null };
    
    const updateMatch = content.match(/\[UPDATE_MEMORY:\s*OLD:\s*(.+?)\s*\|\|\|\s*NEW:\s*(.+?)\]/);
    let oldContent: string | null = null;
    let newContent: string | null = null;
    
    if (updateMatch) {
      oldContent = updateMatch[1].trim();
      newContent = updateMatch[2].trim();
    } else {
      // Fallback: old format without OLD/NEW
      const legacyMatch = content.match(/\[UPDATE_MEMORY:\s*(.+?)\]/);
      if (legacyMatch) {
        newContent = legacyMatch[1].trim();
      }
    }
    
    const cleaned = content
      .replace(/\[SAVE_MEMORY:[^\]]*\]/g, "")
      .replace(/\[UPDATE_MEMORY:[^\]]*\]/g, "")
      .replace(/\[DELETE_MEMORY:[^\]]*\]/g, "")
      .trim();
    
    return { cleanContent: cleaned, memoryOld: oldContent, memoryNew: newContent };
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

  if (isUser) {
    return (
      <div className="flex justify-end py-4">
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
              <div className="rounded-2xl rounded-tr-sm skeu-bubble-user px-5 py-3 text-[17px] md:text-[17px] leading-relaxed text-white">
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
    <div className="py-4">
      <div className="w-full px-4">
        <div className="prose prose-invert prose-base max-w-none text-[17px] md:text-[17px] leading-[1.8] text-foreground/90 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_strong]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_code]:bg-background [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-background [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_a]:text-accent [&_blockquote]:border-accent/40 [&_blockquote]:text-muted-foreground">
          <ReactMarkdown>{cleanContent}</ReactMarkdown>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 ml-1">
              <span className="inline-block text-base leading-none animate-bounce" style={{ animationDuration: '0.6s' }}>✍️</span>
              <span className="inline-block w-1.5 h-5 bg-accent animate-pulse rounded-full" />
            </span>
          )}
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

        {/* Preview dialog */}
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
