import { Plus, MessageSquare, MoreHorizontal, Pencil, Trash2, SquarePen, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FluentEmoji } from "@/components/FluentEmoji";
import { EmojiPicker } from "@/components/EmojiPicker";
import { cn } from "@/lib/utils";
import { useState, useRef, useCallback, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const EMOJI_LIST = [
  // Smileys
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙",
  "🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","🫠","🫡","🫢","🫣",
  "🫤","🫥","😏","😒","🙄","😬","🫨","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴",
  "😵","😵‍💫","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","🥹","😦",
  "😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿",
  "💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖",
  // Cats
  "😺","😸","😹","😻","😼","😽","🙀","😿","😾",
  // Animals
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐽","🐸","🐵","🙈","🙉","🙊",
  "🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋",
  "🐌","🐞","🐜","🪰","🪲","🪳","🦂","🕷️","🕸️","🐢","🐍","🦎","🐙","🦑","🦐","🦀","🐠","🐟","🐡",
  "🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂",
  "🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐈","🐈‍⬛","🐓","🦃","🦚","🦜","🦢","🦩",
  "🕊️","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿️","🦔","🪶","🦤","🦭","🐉","🐲","🦕","🦖",
  // Nature & Plants
  "🌸","🏵️","🌹","🥀","🌺","🌻","🌼","🌷","🪻","🌱","🪴","🌲","🌳","🌴","🌵","🌾","🌿","☘️","🍀","🍁",
  "🍂","🍃","🪹","🪺","🍄","🐚","🪸","🪨","🌊","💐","🪷",
  // Hearts & Love
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓","💗","💖","💘","💝",
  "💟","♥️","💑","💏","💋","🫶",
  // Stars & Weather
  "⭐","🌟","✨","⚡","🔥","💥","💫","💦","💨","🌈","☀️","🌙","🌚","🌝","🌞","⛅","🌤️","🌥️","🌦️","🌧️",
  "🌩️","🌪️","❄️","☃️","⛄","☁️","🌫️",
  // Celebrations
  "🎉","🎊","🎈","🎁","🎀","🎆","🎇","🧨","🎃","🎄","🎋","🎍","🎎","🎏","🎐","🧧","🪅","🪆","🔮","🪄","🧿","🎑",
  // Sports & Activities
  "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🥍","🏑","🥅","⛳","🪁","🏹",
  "🎣","🤿","🥊","🥋","🎿","⛷️","🏂","🪂","🏋️","🤸","🛹","🛼","🏄","🚣","🧗","🏇",
  // Music & Arts
  "🎯","🎮","🎲","🧩","🎵","🎶","🎸","🎹","🎺","🎻","🥁","🪘","🎤","🎧","🎼","🎨","🎬","🎭","🎪","🎷","🪗","🪕","🪈",
  // Tech & Objects
  "💻","📱","⌨️","🖥️","🖨️","🖱️","💡","🔑","🗝️","🔒","🔓","📚","📖","📕","📗","📘","📙","📓","📔","📒",
  "✏️","📝","📌","📍","📎","🖇️","✂️","🗂️","📁","📂","📊","📈","📉","🗒️","📋","🔍","🔎","🔬","🔭","📡",
  "💾","💿","📀","📷","📸","📹","🎥","📺","📻","🧲","🔧","🔨","⚒️","🛠️","⛏️","🪚","🔩","⚙️","🧰","⛓️",
  "🪝","💊","🩹","🩺","🧬","🧪","🧫","🧹","🪣","🧴","🛒","🎒","🪑","🛋️","🛏️","🪞","🪟","🚪","🔔","🔕",
  "📯","🗑️","📦","🏷️","💰","💴","💵","💶","💷","💸","💳","🪙","⏰","⌚","⏳","⌛","🔋","🔌",
  // Accessories
  "💎","💍","👑","🎩","🧢","👓","🕶️","🥽","👗","👘","👙","👚","👛","👜","👝","🎽","🩱","🩲","🩳","👔",
  "👕","👖","🧣","🧤","🧥","🧦","👞","👟","👠","👡","🩴","👢","👒","🪖","⛑️",
  // Transport & Places
  "🚀","✈️","🛸","🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️","🛵",
  "🛺","🚲","🛴","🛹","🚂","🚆","🚇","🚈","🚝","🚄","🛳️","⛴️","🛥️","🚤","⛵","🚢","🛶","🚁","🛩️",
  "🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽","⛪",
  "🕌","🛕","🕍","⛩️","🗻","🏔️","⛺","🏕️","🎡","🎢","🎠","⛲","🌍","🌎","🌏","🗺️",
  // Food & Drink
  "🍕","🍔","🍟","🌭","🍿","🧂","🥚","🍳","🥞","🧇","🥓","🥩","🍗","🍖","🌮","🌯","🥙","🧆","🥗","🥘",
  "🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨",
  "🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍩","🍪","🌰","🥜","🍯","🥛","🍼","☕","🫖",
  "🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🍸","🍹","🍾","🧊","🥃","🫗",
  // Fruits & Vegs
  "🍎","🍏","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆",
  "🥑","🫛","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🧄","🧅","🥔","🍠","🫚","🥐","🥯","🍞","🥖","🥨",
  "🧀","🥪","🫔",
  // Hands & Gestures
  "👍","👎","👊","✊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✌️","🤞","🫰","🤟","🤘","👌","🤌",
  "🤏","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","🫳","🫴","👋","🤙","💪","🦾","🖕","✍️","🫵","🤳",
  // People
  "👶","👧","🧒","👦","👩","🧑","👨","👵","🧓","👴","💃","🕺","🎅","🤶","🧙","🧚","🧛","🧜","🧝",
  "🦸","🦹","🧞","🧟","🤷","🤦","🙋","🙇","🧑‍💻","🧑‍🎨","🧑‍🚀","🧑‍🔬","🧑‍🍳","🧑‍🎓","🧑‍🏫",
  "🧑‍⚕️","🧑‍🌾","🧑‍🔧","🧑‍💼","🧑‍🚒",
  // Awards & Trophies
  "🏆","🥇","🥈","🥉","🏅","🎖️",
  // Symbols
  "♻️","⚠️","🚫","❌","⭕","✅","☑️","❓","❗","‼️","⁉️","💤","💬","💭","🗯️","♾️","🔊","🔇","📢","📣",
  // Misc
  "🪩","🎗️","🎟️","🎫","🧸","🖼️","🛍️","📿","🔗","🪪","📮","✉️","📧","📩","📨","🗓️","📅","📆",
  // Zodiac
  "♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓",
  // Flags
  "🏁","🚩","🎌","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","🏴‍☠️","🇧🇷","🇺🇸","🇯🇵","🇰🇷","🇬🇧","🇫🇷","🇩🇪","🇮🇹","🇪🇸","🇵🇹","🇦🇷","🇲🇽",
];

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  primaryId: string | null;
  loading?: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onSetPrimary: (id: string | null) => void;
}

function extractEmoji(title: string): { emoji: string | null; rest: string } {
  if (!title) return { emoji: null, rest: title };
  // Match leading emoji including ZWJ sequences, flags, skin tones, etc.
  const emojiRegex = /^((?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*(?:\uFE0F)?)/u;
  const match = title.match(emojiRegex);
  if (match) {
    return { emoji: match[0], rest: title.slice(match[0].length).trim() };
  }
  // Try flag emoji (regional indicators)
  const flagRegex = /^([\u{1F1E0}-\u{1F1FF}]{2})/u;
  const flagMatch = title.match(flagRegex);
  if (flagMatch) {
    return { emoji: flagMatch[0], rest: title.slice(flagMatch[0].length).trim() };
  }
  return { emoji: null, rest: title };
}

function SidebarItem({ conv, isActive, isPrimary, onSelect, onDelete, onRename, onSetPrimary }: {
  conv: Conversation; isActive: boolean; isPrimary: boolean; onSelect: () => void; onDelete: () => void; onRename: (t: string) => void; onSetPrimary: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const extracted = extractEmoji(conv.title);
  // Local display state for immediate feedback
  const [displayEmoji, setDisplayEmoji] = useState(extracted.emoji);
  const [displayRest, setDisplayRest] = useState(extracted.rest);
  const [editValue, setEditValue] = useState(extracted.rest);
  const [editEmoji, setEditEmoji] = useState(extracted.emoji);
  const [emojiHover, setEmojiHover] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync display state from props when conv.title changes (e.g. from DB refetch)
  useEffect(() => {
    const e = extractEmoji(conv.title);
    setDisplayEmoji(e.emoji);
    setDisplayRest(e.rest);
  }, [conv.title]);

  const buildTitle = (em: string | null, text: string) => em ? em + " " + text : text;

  const startEdit = () => { setEditValue(displayRest); setEditEmoji(displayEmoji); setEditing(true); setMenuOpen(false); setTimeout(() => inputRef.current?.focus(), 50); };
  const saveEdit = () => { const t = editValue.trim(); if (t) { const newTitle = buildTitle(editEmoji, t); if (newTitle !== conv.title) onRename(newTitle); } setEditing(false); };
  const cancelEdit = () => { setEditValue(displayRest); setEditEmoji(displayEmoji); setEditing(false); };

  const insertEmojiInline = (e: string) => {
    const newTitle = e + " " + displayRest;
    // Update local display immediately
    setDisplayEmoji(e);
    // Then propagate to parent
    onRename(newTitle);
    setEmojiPickerOpen(false);
    setEmojiHover(false);
  };

  const insertEmojiEdit = (e: string) => {
    setEditEmoji(e);
    setEmojiPickerOpen(false);
    inputRef.current?.focus();
  };

  const handleTouchStart = useCallback(() => { longPressTimer.current = setTimeout(() => setMenuOpen(true), 500); }, []);
  const handleTouchEnd = useCallback(() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }, []);
  const handleContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); setMenuOpen(true); }, []);

  if (editing) {
    return (
      <div className="mb-0.5 flex items-center gap-1.5 rounded-xl px-3 py-2 bg-sidebar-accent">
        <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
          <PopoverTrigger asChild>
            <button className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-secondary transition-colors">{editEmoji ? <FluentEmoji emoji={editEmoji} size={18} /> : <FluentEmoji emoji="😀" size={18} />}</button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" side="right" align="start">
            <EmojiPicker emojis={EMOJI_LIST} onSelect={(em) => insertEmojiEdit(em)} />
          </PopoverContent>
        </Popover>
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
          onBlur={saveEdit}
          className="flex-1 min-w-0 rounded-md border border-border bg-secondary px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group mb-0.5 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors hover:bg-sidebar-accent relative",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
      )}
      onClick={onSelect}
      onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      <div className="shrink-0 relative" onMouseEnter={() => setEmojiHover(true)} onMouseLeave={() => { if (!emojiPickerOpen) setEmojiHover(false); }}>
        <Popover open={emojiPickerOpen} onOpenChange={(o) => { setEmojiPickerOpen(o); if (!o) setEmojiHover(false); }}>
          <PopoverTrigger asChild>
            <button className={cn("flex h-7 w-7 items-center justify-center rounded transition-all", emojiHover && "scale-125")} onClick={(e) => { e.stopPropagation(); setEmojiPickerOpen(true); }}>
              {displayEmoji ? <FluentEmoji key={displayEmoji} emoji={displayEmoji} size={24} /> : <MessageSquare className="h-4 w-4 text-muted-foreground" />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" side="right" align="start">
            <EmojiPicker emojis={EMOJI_LIST} onSelect={(em) => insertEmojiInline(em)} />
          </PopoverContent>
        </Popover>
      </div>

      <span className="flex-1 truncate">{displayEmoji ? displayRest : conv.title}</span>
      {isPrimary && <Star className="h-3.5 w-3.5 shrink-0 fill-accent text-accent" />}
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1" side="right" align="start">
          <button onClick={(e) => { e.stopPropagation(); onSetPrimary(); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] hover:bg-secondary transition-colors">
            <Star className={cn("h-3.5 w-3.5", isPrimary && "fill-yellow-400 text-yellow-400")} /> {isPrimary ? "Remover principal" : "Principal"}
          </button>
          <button onClick={(e) => { e.stopPropagation(); startEdit(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] hover:bg-secondary transition-colors">
            <Pencil className="h-3.5 w-3.5" /> Renomear
          </button>
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setDeleteConfirmOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] text-destructive hover:bg-secondary transition-colors">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </PopoverContent>
      </Popover>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta conversa? Todas as mensagens serão perdidas e essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setDeleteConfirmOpen(false); onDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ChatSidebar({ conversations, activeId, primaryId, loading, onSelect, onNew, onDelete, onRename, onSetPrimary }: ChatSidebarProps) {
  return (
    <div className="flex h-full flex-col skeu-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Meux" className="h-7 w-7" />
          <h2 className="text-base font-semibold text-foreground tracking-tight">Meux</h2>
        </div>
        <button onClick={onNew} title="Nova conversa" className="skeu-btn flex h-8 w-8 items-center justify-center rounded-lg transition-colors">
          <SquarePen className="h-4 w-4 text-sidebar-foreground" />
        </button>
      </div>

      {/* Nav items */}
      <div className="px-3 pb-3 space-y-0.5">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-sidebar-foreground skeu-btn transition-colors"
        >
          <SquarePen className="h-4 w-4" />
          Nova conversa
        </button>
      </div>

      <div className="mx-3 mb-2 skeu-divider" />

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="space-y-1 px-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
                <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
                <Skeleton className="h-4 flex-1 rounded-md" />
              </div>
            ))}
          </div>
        ) : (
          conversations.map((c) => (
            <SidebarItem
              key={c.id}
              conv={c}
              isActive={activeId === c.id}
              isPrimary={primaryId === c.id}
              onSelect={() => onSelect(c.id)}
              onDelete={() => onDelete(c.id)}
              onRename={(t) => onRename(c.id, t)}
              onSetPrimary={() => onSetPrimary(primaryId === c.id ? null : c.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
