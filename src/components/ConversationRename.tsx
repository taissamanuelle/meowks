import { useState, useRef } from "react";
import { Pencil, Check, X, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FluentEmoji } from "@/components/FluentEmoji";

const EMOJI_LIST = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙",
  "🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏","😒",
  "🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳",
  "🥸","😎","🤓","🧐","😕","🫤","😟","🙁","😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥","😢",
  "😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹",
  "👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾","🐶","🐱","🐭","🐹","🐰","🦊",
  "🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥",
  "🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓","💗","💖","💘","💝",
  "⭐","🌟","✨","⚡","🔥","💥","🎉","🎊","🎈","🎯","🎮","🎲","🎵","🎶","🎸","🎹","🎺","🎻","🥁","🎤",
  "💻","📱","💡","🔑","🔒","📚","📖","✏️","📝","📌","📎","✂️","🗂️","📁","📂","🗄️","📊","📈","📉","🗒️",
  "🚀","✈️","🚗","🚕","🚙","🏠","🏢","🏰","🗼","🗽","🌍","🌎","🌏","🌈","☀️","🌙","⭐","☁️","⛅","🌤️",
  "🍕","🍔","🍟","🌭","🍿","🧂","🥚","🍳","🥞","🧇","🥓","🥩","🍗","🍖","🌮","🌯","🥙","🧆","🥗","🥘",
  "🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦐","🍩","🍪","🎂","🍰","🧁","🥧","🍫","🍬","🍭","🍮","🍯","🍼",
  "☕","🍵","🫖","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧃","🥤","🧋","🍾","🫗","💧","🌊",
  "👍","👎","👊","✊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✌️","🤞","🫰","🤟","🤘","👌","🤌",
  "🤏","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","🫱","🫲","🫳","🫴","👋","🤙","💪","🦾","🖕",
  "🏆","🥇","🥈","🥉","🏅","🎖️","🏵️","🎗️","🎪","🎭","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🪘","🎷","🎺",
  "🎸","🪕","🎻","🪗","🎲","♟️","🎯","🎳","🎮","🕹️","🧩","🪀","🪁","🎰","🎱",
];

interface ConversationRenameProps {
  title: string;
  onRename: (newTitle: string) => void;
}

export function ConversationRename({ title, onRename }: ConversationRenameProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setValue(title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const save = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== title) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setValue(title);
    setEditing(false);
  };

  const insertEmoji = (emoji: string) => {
    setValue((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  if (!editing) {
    return (
      <button
        onClick={startEdit}
        className="group flex items-center gap-3 text-sm font-medium text-foreground hover:text-accent transition-colors"
      >
        <span className="max-w-[200px] truncate">{title}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
        className="w-[200px] rounded-lg border border-border bg-secondary px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger asChild>
          <button className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary transition-colors">
            <Smile className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
            {EMOJI_LIST.map((emoji, i) => (
              <button
                key={i}
                onClick={() => insertEmoji(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary transition-colors"
              >
                <FluentEmoji emoji={emoji} size={22} />
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <button onClick={save} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary transition-colors">
        <Check className="h-4 w-4 text-accent" />
      </button>
      <button onClick={cancel} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary transition-colors">
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
