import { useState, useRef } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FluentEmoji } from "@/components/FluentEmoji";

const EMOJI_LIST = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙",
  "🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒",
  "🙄","😬","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳",
  "😎","🤓","🧐","😕","😟","🙁","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢",
  "😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","💩","🤡",
  "👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾",
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","💕","💞","💓","💗","💖","💘","💝",
  "⭐","🌟","✨","⚡","🔥","💥","🎉","🎊","🎈","🎯","🎮","🎲","🎵","🎶","🎸","🎹",
  "💻","📱","💡","🔑","🔒","📚","📖","✏️","📝","📌","📎","📊","📈","📉",
  "🚀","✈️","🚗","🏠","🏢","🌍","🌈","☀️","🌙","☁️",
  "🍕","🍔","🍟","🍿","🍳","🍗","🌮","🍝","🍣","🍩","🍪","🎂","🍰","🍫","🍬","🍭","☕","🍺","🍷",
  "👍","👎","👊","✊","👏","🙌","🙏","✌️","👋","💪",
  "🏆","🥇","🎨","🎬","🎧","🩺","🧠","💼","💰","🍽️",
];

interface ConversationRenameProps {
  title: string;
  onRename: (newTitle: string) => void;
}

// Extract leading emoji from title
const EMOJI_REGEX = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u;

function parseTitle(title: string): { emoji: string | null; text: string } {
  const match = title.match(EMOJI_REGEX);
  if (match) {
    return { emoji: match[0], text: title.slice(match[0].length).trim() };
  }
  return { emoji: null, text: title };
}

export function ConversationRename({ title, onRename }: ConversationRenameProps) {
  const [editing, setEditing] = useState(false);
  const parsed = parseTitle(title);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(parsed.emoji);
  const [textValue, setTextValue] = useState(parsed.text);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    const p = parseTitle(title);
    setSelectedEmoji(p.emoji);
    setTextValue(p.text);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const save = () => {
    const trimmed = textValue.trim();
    if (trimmed) {
      const newTitle = selectedEmoji ? `${selectedEmoji}${trimmed}` : trimmed;
      if (newTitle !== title) {
        onRename(newTitle);
      }
    }
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  const pickEmoji = (emoji: string) => {
    setSelectedEmoji(emoji === selectedEmoji ? null : emoji);
    setEmojiOpen(false);
    inputRef.current?.focus();
  };

  const displayEmoji = parsed.emoji;
  const displayText = parsed.text;

  if (!editing) {
    return (
      <button
        onClick={startEdit}
        className="group flex items-center gap-3 text-sm font-medium text-foreground hover:text-accent transition-colors"
      >
        {displayEmoji && <FluentEmoji emoji={displayEmoji} size={22} />}
        <span className="max-w-[200px] truncate">{displayText}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Emoji picker button - separate from name */}
      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger asChild>
          <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary hover:bg-muted transition-colors">
            {selectedEmoji ? (
              <FluentEmoji emoji={selectedEmoji} size={18} />
            ) : (
              <span className="text-xs text-muted-foreground">+</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start" side="bottom">
          <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
            {EMOJI_LIST.map((emoji, i) => (
              <button
                key={i}
                onClick={() => pickEmoji(emoji)}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                  emoji === selectedEmoji ? "bg-accent/20 ring-1 ring-accent" : "hover:bg-secondary"
                }`}
              >
                <FluentEmoji emoji={emoji} size={20} />
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Name input - separate from emoji */}
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
