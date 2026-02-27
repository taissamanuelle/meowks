import { useState, useRef, KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
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

  return (
    <div className="px-4 pb-5 pt-2">
      <div className="mx-auto max-w-3xl">
        <div className="relative rounded-2xl border border-border bg-card shadow-xl transition-all focus-within:border-accent/40 focus-within:shadow-accent/5">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Mensagem para o Meowks"
            rows={1}
            disabled={disabled}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-14 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button
              onClick={handleSend}
              disabled={disabled || !value.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground transition-all disabled:opacity-20 hover:bg-accent/80 hover:scale-105"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <p className="mt-2.5 text-center text-[11px] text-muted-foreground/40">
          Meowks é uma IA e pode cometer erros.
        </p>
      </div>
    </div>
  );
}
