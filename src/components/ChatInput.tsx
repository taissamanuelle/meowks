import { useState, useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowUp, Paperclip, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Attachment {
  file: File;
  preview: string; // blob URL for images, empty for docs
  type: "image" | "pdf" | "csv" | "json";
}

interface ChatInputProps {
  onSend: (message: string, images?: string[], documents?: File[]) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = "image/*,.pdf,.csv,.json";
const MAX_ATTACHMENTS = 5;

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const handleSend = () => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    const imageFiles = attachments.filter(a => a.type === "image").map(a => a.preview);
    const docFiles = attachments.filter(a => a.type !== "image").map(a => a.file);
    onSend(trimmed, imageFiles.length > 0 ? imageFiles : undefined, docFiles.length > 0 ? docFiles : undefined);
    setValue("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !isMobile && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const addFiles = (files: FileList | File[]) => {
    const newAttachments: Attachment[] = [];
    Array.from(files).forEach((file) => {
      if (attachments.length + newAttachments.length >= MAX_ATTACHMENTS) return;
      if (file.type.startsWith("image/")) {
        newAttachments.push({ file, preview: URL.createObjectURL(file), type: "image" });
      } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        newAttachments.push({ file, preview: "", type: "pdf" });
      } else if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        newAttachments.push({ file, preview: "", type: "csv" });
      } else if (file.type === "application/json" || file.name.endsWith(".json")) {
        newAttachments.push({ file, preview: "", type: "json" });
      }
    });
    if (newAttachments.length > 0) setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pasteFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) pasteFiles.push(file);
      }
    }
    if (pasteFiles.length > 0) {
      e.preventDefault();
      addFiles(pasteFiles);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => {
      if (prev[idx].preview) URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  return (
    <div className="px-4 pb-3 pt-2">
      <div className="mx-auto max-w-3xl">
        <div
          className="rounded-[24px] skeu-surface-dark transition-all"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex gap-2 px-5 pt-4 flex-wrap">
              {attachments.map((att, i) => (
                <div key={i} className="relative group">
                  {att.type === "image" ? (
                    <img
                      src={att.preview}
                      alt="Anexo"
                      className="h-20 w-20 rounded-xl object-cover border border-border"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-xl border border-border bg-secondary flex flex-col items-center justify-center gap-1">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground font-mono uppercase">{att.type}</span>
                      <span className="text-[8px] text-muted-foreground/70 truncate max-w-[70px] px-1">{att.file.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onPaste={handlePaste}
            placeholder="Mensagem para o Meux"
            rows={1}
            disabled={disabled}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="flex h-9 w-9 items-center justify-center rounded-full skeu-btn text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                title="Anexar arquivo"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={disabled || (!value.trim() && attachments.length === 0)}
              className="flex h-9 w-9 items-center justify-center rounded-full skeu-btn-accent transition-all disabled:opacity-20 hover:scale-105"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
