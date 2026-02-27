import { Plus, MessageSquare, MoreHorizontal, Pencil, Trash2, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  "👍","👎","👊","✊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✌️","🤞","🫰","🤟","🤘","👌","🤌",
  "🏆","🥇","🥈","🥉","🏅","🎖️","🏵️","🎗️","🎪","🎭","🎨","🎬","🎤","🎧","🎼",
];

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

function extractEmoji(title: string) {
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u;
  const match = title.match(emojiRegex);
  return match ? { emoji: match[0], rest: title.slice(match[0].length).trim() } : { emoji: null, rest: title };
}

function SidebarItem({
  conv, isActive, onSelect, onDelete, onRename,
}: {
  conv: Conversation; isActive: boolean;
  onSelect: () => void; onDelete: () => void;
  onRename: (newTitle: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(conv.title);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { emoji, rest } = extractEmoji(conv.title);

  const startEdit = () => {
    setEditValue(conv.title);
    setEditing(true);
    setMenuOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const saveEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== conv.title) onRename(trimmed);
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditValue(conv.title);
    setEditing(false);
  };

  const insertEmoji = (e: string) => {
    setEditValue((prev) => e + prev.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u, ""));
    setEmojiPickerOpen(false);
    inputRef.current?.focus();
  };

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => setMenuOpen(true), 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  if (editing) {
    return (
      <div className="mb-0.5 flex flex-col gap-1.5 rounded-2xl px-3 py-2.5 bg-sidebar-accent">
        <div className="flex items-center gap-1.5">
          <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
            <PopoverTrigger asChild>
              <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-secondary transition-colors">
                <Smile className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" side="right" align="start">
              <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
                {EMOJI_LIST.map((em, i) => (
                  <button key={i} onClick={() => insertEmoji(em)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary text-lg transition-colors">
                    {em}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
            onBlur={saveEdit}
            className="flex-1 min-w-0 rounded-lg border border-border bg-secondary px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group mb-0.5 flex cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent relative",
        isActive && "bg-sidebar-accent text-foreground"
      )}
      onClick={onSelect}
      onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      <span className="shrink-0 text-base">{emoji || <MessageSquare className="h-4 w-4 text-muted-foreground" />}</span>
      <span className="flex-1 truncate">{emoji ? rest : conv.title}</span>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
          >
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1" side="right" align="start">
          <button
            onClick={(e) => { e.stopPropagation(); startEdit(); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Renomear
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-secondary transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function ChatSidebar({ conversations, activeId, onSelect, onNew, onDelete, onRename }: ChatSidebarProps) {
  return (
    <div className="flex h-full w-[260px] flex-col bg-sidebar">
      <div className="flex items-center justify-between p-4">
        <h2 className="text-lg font-semibold text-foreground tracking-tight">Meowks</h2>
        <Button variant="ghost" size="icon" onClick={onNew} title="Nova conversa" className="rounded-full h-9 w-9">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.map((c) => (
          <SidebarItem
            key={c.id}
            conv={c}
            isActive={activeId === c.id}
            onSelect={() => onSelect(c.id)}
            onDelete={() => onDelete(c.id)}
            onRename={(newTitle) => onRename(c.id, newTitle)}
          />
        ))}
      </div>
    </div>
  );
}
