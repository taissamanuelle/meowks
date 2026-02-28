import { useState, useRef } from "react";
import { Pencil, Check, X } from "lucide-react";
import { FluentEmoji } from "@/components/FluentEmoji";

interface ConversationRenameProps {
  title: string;
  onRename: (newTitle: string) => void;
}

function parseTitle(title: string): { emoji: string | null; text: string } {
  if (!title) return { emoji: null, text: title };
  if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter("en", { granularity: "grapheme" });
    const segments = segmenter.segment(title);
    const first = segments[Symbol.iterator]().next().value;
    if (first) {
      const char = first.segment;
      const emojiTest = /\p{Emoji_Presentation}|[\p{Emoji}]\uFE0F|[\u{1F1E0}-\u{1F1FF}]/u;
      if (emojiTest.test(char)) {
        return { emoji: char, text: title.slice(char.length).trim() };
      }
    }
  }
  const emojiRegex = /^([\p{Emoji_Presentation}\p{Extended_Pictographic}](?:\uFE0F)?(?:\u200D[\p{Emoji_Presentation}\p{Extended_Pictographic}](?:\uFE0F)?)*|[\u{1F1E0}-\u{1F1FF}]{2})/u;
  const match = title.match(emojiRegex);
  if (match) return { emoji: match[0], text: title.slice(match[0].length).trim() };
  return { emoji: null, text: title };
}

export function ConversationRename({ title, onRename }: ConversationRenameProps) {
  const [editing, setEditing] = useState(false);
  const parsed = parseTitle(title);
  const [textValue, setTextValue] = useState(parsed.text);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    const p = parseTitle(title);
    setTextValue(p.text);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const save = () => {
    const trimmed = textValue.trim();
    if (trimmed) {
      // Keep existing emoji prefix if present
      const newTitle = parsed.emoji ? `${parsed.emoji} ${trimmed}` : trimmed;
      if (newTitle !== title) onRename(newTitle);
    }
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (!editing) {
    return (
      <button
        onClick={startEdit}
        className="group flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-accent transition-colors"
      >
        {parsed.emoji && <FluentEmoji emoji={parsed.emoji} size={22} />}
        <span className="max-w-[200px] truncate">{parsed.text}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {parsed.emoji && <FluentEmoji emoji={parsed.emoji} size={20} />}
      <input
        ref={inputRef}
        value={textValue}
        onChange={(e) => setTextValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
        className="w-[180px] rounded-lg border border-border bg-secondary px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        placeholder="Nome da conversa"
      />
      <button onClick={save} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary transition-colors">
        <Check className="h-4 w-4 text-accent" />
      </button>
      <button onClick={cancel} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary transition-colors">
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
