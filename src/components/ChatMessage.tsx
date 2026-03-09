import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { BookmarkPlus, RefreshCw, Loader2, Check, X, ArrowRight, Sparkles, Pencil, RotateCcw, Copy, CheckCheck, FolderSync, Send } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { useTypewriter } from "@/hooks/useTypewriter";
import { toast } from "sonner";
import { LinkPreviewCards } from "@/components/LinkPreviewCard";
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
  onMoveMemory?: (memoryText: string, newCategory: string) => Promise<void>;
  onEdit?: (newContent: string) => void;
  onRegenerate?: () => void;
  onResend?: () => void;
  currentMemories?: string[];
}

export function ChatMessage({
  role, content, images, avatar, isStreaming, onSaveMemory, onUpdateMemory, onSuggestMemory, onMoveMemory, onEdit, onRegenerate, currentMemories,
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
  const [moving, setMoving] = useState(false);
  const [moved, setMoved] = useState(false);

  // Check if memory actions were already completed by looking at current memories
  const isMemoryAlreadySaved = useMemo(() => {
    if (!currentMemories || !content) return false;
    const normalized = content.trim().toLowerCase();
    return currentMemories.some(m => m.toLowerCase().trim() === normalized || 
      m.toLowerCase().trim() === (normalized.charAt(0).toUpperCase() + normalized.slice(1)).toLowerCase());
  }, [currentMemories, content]);

  const isUpdateAlreadyApplied = useMemo(() => {
    if (!currentMemories) return false;
    // Extract NEW content from UPDATE_MEMORY tag
    const updateMatch = content.match(/\[UPDATE_MEMORY:\s*OLD:\s*(.+?)\s*\|\|\|\s*NEW:\s*(.+?)\]/);
    if (updateMatch) {
      const newContent = updateMatch[2].trim().toLowerCase();
      return currentMemories.some(m => m.toLowerCase().trim() === newContent || 
        m.toLowerCase().trim() === (newContent.charAt(0).toUpperCase() + newContent.slice(1)).toLowerCase());
    }
    return false;
  }, [currentMemories, content]);

  const isSuggestAlreadySaved = useMemo(() => {
    if (!currentMemories) return false;
    const suggestMatch = content.match(/\[SUGGEST_MEMORY:\s*(.+?)\]/);
    if (suggestMatch) {
      const suggested = suggestMatch[1].trim().toLowerCase();
      return currentMemories.some(m => m.toLowerCase().trim() === suggested ||
        m.toLowerCase().trim() === (suggested.charAt(0).toUpperCase() + suggested.slice(1)).toLowerCase());
    }
    return false;
  }, [currentMemories, content]);
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Erro ao copiar"); }
  };

  const handleSaveUserMsg = async () => {
    if (!onSaveMemory || saving) return;
    setSaving(true);
    try {
      await onSaveMemory(content);
      setSaved(true);
    } catch { /* handled upstream */ }
    setSaving(false);
  };

  // Extract UPDATE_MEMORY, SUGGEST_MEMORY, and MOVE_MEMORY tag content
  const { cleanContent, memoryOld, memoryNew, suggestedMemory, moveMemoryText, moveCategory } = useMemo(() => {
    if (isUser) return { cleanContent: content, memoryOld: null, memoryNew: null, suggestedMemory: null, moveMemoryText: null, moveCategory: null };
    
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

    // Extract MOVE_MEMORY
    const moveMatch = content.match(/\[MOVE_MEMORY:\s*(.+?)\s*\|\|\|\s*CATEGORY:\s*(.+?)\]/);
    const moveText = moveMatch ? moveMatch[1].trim() : null;
    const moveCat = moveMatch ? moveMatch[2].trim() : null;
    
    const cleaned = content
      .replace(/\[SAVE_MEMORY:[^\]]*\]/g, "")
      .replace(/\[UPDATE_MEMORY:[^\]]*\]/g, "")
      .replace(/\[DELETE_MEMORY:[^\]]*\]/g, "")
      .replace(/\[SUGGEST_MEMORY:[^\]]*\]/g, "")
      .replace(/\[MOVE_MEMORY:[^\]]*\]/g, "")
      .trim();
    
    return { cleanContent: cleaned, memoryOld: oldContent, memoryNew: newContent, suggestedMemory: suggested, moveMemoryText: moveText, moveCategory: moveCat };
  }, [content, isUser]);

  // Extract URLs from assistant content for link previews
  const extractedUrls = useMemo(() => {
    if (isUser || !cleanContent || isStreaming) return [];
    const urlRegex = /https?:\/\/[^\s)\]>"']+/g;
    const matches = cleanContent.match(urlRegex) || [];
    // Deduplicate and limit
    return [...new Set(matches)].slice(0, 5);
  }, [cleanContent, isUser, isStreaming]);

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

  const handleMoveMemory = async () => {
    if (!onMoveMemory || !moveMemoryText || !moveCategory || moving) return;
    setMoving(true);
    try {
      await onMoveMemory(moveMemoryText, moveCategory);
      setMoved(true);
    } catch { /* handled upstream */ }
    setMoving(false);
  };

  const CATEGORY_LABELS: Record<string, string> = {
    saude: "Saúde", autoconhecimento: "Autoconhecimento", trabalho: "Trabalho",
    estudos: "Estudos", financas: "Finanças", relacionamentos: "Relacionamentos",
    casa: "Casa", veiculos: "Veículos", lazer: "Lazer", alimentacao: "Alimentação",
    tecnologia: "Tecnologia", espiritualidade: "Espiritualidade", geral: "Geral",
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
      <div className="flex justify-end py-2 group">
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
                  className="w-full rounded-2xl bg-secondary border border-border px-4 py-3 text-[17px] leading-relaxed text-foreground resize-vertical focus:outline-none focus:ring-2 focus:ring-accent min-h-[120px]"
                  rows={Math.max(4, Math.min(12, editText.split("\n").length + 2))}
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
                  <div className="rounded-2xl rounded-tr-sm skeu-bubble-user px-5 py-3 text-[17px] md:text-[17px] leading-relaxed text-white" data-selectable="true">
                    <p className="whitespace-pre-wrap select-text">{content}</p>
                  </div>
                )}
                {/* Action buttons row */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(content)}
                    className="flex items-center gap-1 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                    title="Copiar mensagem"
                  >
                    {copied ? <CheckCheck className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  {onEdit && !isStreaming && (
                    <button
                      onClick={() => { setEditText(content); setEditing(true); }}
                      className="flex items-center gap-1 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                      title="Editar mensagem"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onSaveMemory && !saved && !isMemoryAlreadySaved && content && (
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
            {(saved || isMemoryAlreadySaved) && (
              <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs bg-accent/20 text-accent">
                <BookmarkPlus className="h-3 w-3" /> Salvo!
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const typewriterContent = useTypewriter(cleanContent, !!isStreaming, 60);

  return (
    <div className="py-2 group">
      <div className="w-full px-4">
        {/* Agent avatar above message */}
        {avatar && (
          <div className="mb-1.5">
            <img
              src={avatar}
              alt="Avatar do agente"
              className="h-8 w-8 rounded-full object-cover"
            />
          </div>
        )}
        {!cleanContent && isStreaming ? (
          <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-secondary/60 px-5 py-3.5">
            <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDuration: '1.2s', animationDelay: '0s' }} />
            <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDuration: '1.2s', animationDelay: '0.2s' }} />
            <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDuration: '1.2s', animationDelay: '0.4s' }} />
          </div>
        ) : cleanContent ? (
        <div className={cn(
          "prose prose-invert prose-base max-w-none text-[17px] md:text-[17px] leading-[1.8] text-foreground/90 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_strong]:text-foreground [&_h1]:text-[32px] [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-[24px] [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-[20px] [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mt-2 [&_h3]:mb-1 [&_code]:bg-background [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-background [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_a]:text-accent [&_blockquote]:border-accent/40 [&_blockquote]:text-muted-foreground [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-border [&_th]:bg-secondary [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-foreground/80 [&_td]:whitespace-normal [&_tr:hover]:bg-secondary/30",
          isStreaming && "streaming-typewriter"
        )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
              table: ({ children, ...props }) => (
                <div className="overflow-x-auto -mx-1 px-1 my-3" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="min-w-max" {...props}>{children}</table>
                </div>
              ),
            }}>{typewriterContent}</ReactMarkdown>
        </div>
        ) : null}

        {/* Link preview cards */}
        {extractedUrls.length > 0 && !isStreaming && (
          <LinkPreviewCards urls={extractedUrls} />
        )}

        {/* Memory update suggestion - click to preview */}
        {memoryNew && onUpdateMemory && !updated && !isUpdateAlreadyApplied && !isStreaming && (
          <button
            onClick={() => setShowPreview(true)}
            className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border/50 transition-all"
          >
            <RefreshCw className="h-3 w-3" />
            Revisar atualização de memória
          </button>
        )}
        {(updated || isUpdateAlreadyApplied) && memoryNew && (
          <span className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-accent/20 text-accent w-fit">
            <RefreshCw className="h-3 w-3" /> Memória atualizada!
          </span>
        )}

        {/* Memory move suggestion */}
        {moveMemoryText && moveCategory && onMoveMemory && !moved && !isStreaming && (
          <button
            onClick={handleMoveMemory}
            disabled={moving}
            className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border/50 transition-all"
          >
            {moving ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderSync className="h-3 w-3" />}
            {moving ? "Movendo..." : `Mover para ${CATEGORY_LABELS[moveCategory] || moveCategory}`}
          </button>
        )}
        {moved && moveMemoryText && (
          <span className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-accent/20 text-accent w-fit">
            <FolderSync className="h-3 w-3" /> Memória reorganizada!
          </span>
        )}
        {/* Memory suggestion */}
        {suggestedMemory && onSuggestMemory && !suggestSaved && !isSuggestAlreadySaved && !suggestDismissed && !isStreaming && (
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
        {(suggestSaved || isSuggestAlreadySaved) && suggestedMemory && (
          <span className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs bg-accent/20 text-accent w-fit">
            <Sparkles className="h-3 w-3" /> Memória salva!
          </span>
        )}

        {/* Copy + Regenerate buttons */}
        {!isStreaming && cleanContent && (
          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={() => handleCopy(cleanContent)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all"
              title="Copiar resposta"
            >
              {copied ? <CheckCheck className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all"
                title="Gerar outra resposta"
              >
                <RotateCcw className="h-3 w-3" />
                Regenerar
              </button>
            )}
          </div>
        )}

        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
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
