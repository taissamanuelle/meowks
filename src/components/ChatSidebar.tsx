import { Plus, MessageSquare, MoreHorizontal, Pencil, Trash2, SquarePen, Star, Pin, Bot, Eraser, ChevronUp, ChevronDown, Palette } from "lucide-react";
import { CompactColorPicker } from "@/components/CompactColorPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { FluentEmoji } from "@/components/FluentEmoji";
import { EmojiPicker } from "@/components/EmojiPicker";
import { cn } from "@/lib/utils";
import { useState, useRef, useCallback, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Agent } from "@/components/AgentDialog";

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
  agent_id?: string | null;
  accent_color?: string | null;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  primaryId: string | null;
  loading?: boolean;
  agents?: Agent[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onSetPrimary: (id: string | null) => void;
  onSelectAgent?: (agent: Agent) => void;
  onEditAgent?: (agent: Agent) => void;
  onDeleteAgent?: (agent: Agent) => void;
  onClearAgent?: (agent: Agent) => void;
  onFavoriteAgent?: (agent: Agent) => void;
  favoriteAgentId?: string | null;
  onNewAgent?: () => void;
  onConversationColorChange?: (id: string, color: string | null) => void;
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

function AgentSidebarItem({ agent, onSelect, onEdit, onDelete, onClear, onFavorite, isFavorite, onPin, isPinned, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: {
  agent: Agent; onSelect: () => void; onEdit?: () => void; onDelete?: () => void; onClear?: () => void; onFavorite?: () => void; isFavorite?: boolean;
  onPin?: () => void; isPinned?: boolean; onMoveUp?: () => void; onMoveDown?: () => void; canMoveUp?: boolean; canMoveDown?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div
      className="group flex items-center gap-2.5 rounded-xl px-3 py-2 md:py-2.5 py-3 text-base md:text-[15px] cursor-pointer hover:bg-sidebar-accent transition-colors relative"
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
    >
      <div className="h-8 w-8 md:h-7 md:w-7 rounded-full overflow-hidden bg-secondary shrink-0 flex items-center justify-center">
        {agent.avatar_url ? (
          <img src={agent.avatar_url} alt={agent.name} className="h-full w-full object-cover" />
        ) : (
          <Bot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="block truncate text-sidebar-foreground">{agent.name}</span>
        {agent.description && (
          <span className="block truncate text-[11px] text-muted-foreground leading-tight">{agent.description}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        {isPinned && <Pin className="h-3 w-3 text-muted-foreground rotate-45" />}
        {isFavorite && <Star className="h-3.5 w-3.5 fill-accent text-accent" />}
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5" onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
           <PopoverContent className="w-56 md:w-48 p-1.5" side="right" align="start">
            {onPin && (
              <button onClick={(e) => { e.stopPropagation(); onPin(); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 md:py-1.5 text-[16px] md:text-[13px] hover:bg-secondary transition-colors whitespace-nowrap">
                <Pin className={cn("h-4 w-4 md:h-3.5 md:w-3.5", isPinned && "fill-foreground")} /> {isPinned ? "Desafixar" : "Fixar no topo"}
              </button>
            )}
            {onMoveUp && canMoveUp && (
              <button onClick={(e) => { e.stopPropagation(); onMoveUp(); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 md:py-1.5 text-[16px] md:text-[13px] hover:bg-secondary transition-colors whitespace-nowrap">
                <ChevronUp className="h-4 w-4 md:h-3.5 md:w-3.5" /> Mover para cima
              </button>
            )}
            {onMoveDown && canMoveDown && (
              <button onClick={(e) => { e.stopPropagation(); onMoveDown(); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 md:py-1.5 text-[16px] md:text-[13px] hover:bg-secondary transition-colors whitespace-nowrap">
                <ChevronDown className="h-4 w-4 md:h-3.5 md:w-3.5" /> Mover para baixo
              </button>
            )}
            {onFavorite && (
              <button onClick={(e) => { e.stopPropagation(); onFavorite(); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 md:py-1.5 text-[16px] md:text-[13px] hover:bg-secondary transition-colors whitespace-nowrap">
                <Star className="h-4 w-4 md:h-3.5 md:w-3.5" /> {isFavorite ? "Remover favorito" : "Conversa principal"}
              </button>
            )}
            {onEdit && (
              <button onClick={(e) => { e.stopPropagation(); onEdit(); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 md:py-1.5 text-[16px] md:text-[13px] hover:bg-secondary transition-colors whitespace-nowrap">
                <Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" /> Editar agente
              </button>
            )}
            {onClear && (
              <button onClick={(e) => { e.stopPropagation(); onClear(); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 md:py-1.5 text-[16px] md:text-[13px] hover:bg-secondary transition-colors whitespace-nowrap">
                <Eraser className="h-4 w-4 md:h-3.5 md:w-3.5" /> Limpar conversa
              </button>
            )}
            {onDelete && (
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setDeleteOpen(true); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 md:py-1.5 text-[16px] md:text-[13px] text-destructive hover:bg-secondary transition-colors whitespace-nowrap">
                <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" /> Excluir agente
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir o agente "{agent.name}"? Todas as conversas com ele serão mantidas, mas ele não poderá mais ser usado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setDeleteOpen(false); onDelete?.(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SidebarItem({ conv, isActive, isPrimary, isPinned, agent, onSelect, onDelete, onRename, onSetPrimary, onTogglePin, onColorChange }: {
  conv: Conversation; isActive: boolean; isPrimary: boolean; isPinned: boolean; agent?: Agent | null; onSelect: () => void; onDelete: () => void; onRename: (t: string) => void; onSetPrimary: () => void; onTogglePin: () => void; onColorChange?: (color: string | null) => void;
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
      data-conv-id={conv.id}
      className={cn(
        "group mb-0.5 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3.5 md:py-3 text-base md:text-[15px] transition-colors hover:bg-sidebar-accent relative",
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
        <Popover open={emojiPickerOpen} onOpenChange={(o) => { setEmojiPickerOpen(o); if (!o) setEmojiHover(false); }} modal={true}>
          <PopoverTrigger asChild>
            <button className={cn("flex h-7 w-7 items-center justify-center rounded transition-all", emojiHover && "scale-125")} onClick={(e) => { e.stopPropagation(); if (!agent) setEmojiPickerOpen(true); }}>
              {agent ? (
                agent.avatar_url ? (
                  <img src={agent.avatar_url} alt={agent.name} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <Bot className="h-4 w-4 text-muted-foreground" />
                )
              ) : displayEmoji ? <FluentEmoji key={displayEmoji} emoji={displayEmoji} size={24} /> : <MessageSquare className="h-4 w-4 text-muted-foreground" />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" side="right" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
            <EmojiPicker emojis={EMOJI_LIST} onSelect={(em) => insertEmojiInline(em)} />
          </PopoverContent>
        </Popover>
      </div>

      <span className="flex-1 truncate">{displayEmoji ? displayRest : conv.title}</span>
      <div className="flex items-center gap-0.5 shrink-0 ml-auto">
        {isPrimary && <Star className="h-3.5 w-3.5 fill-accent text-accent" />}
        {isPinned && !isPrimary && <Pin className="h-3 w-3 text-muted-foreground rotate-45" />}
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5" onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
           <PopoverContent className="w-56 md:w-48 p-1.5" side="right" align="start">
            <button onClick={(e) => { e.stopPropagation(); onTogglePin(); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 md:py-1.5 text-[16px] md:text-[13px] hover:bg-secondary transition-colors whitespace-nowrap">
              <Pin className={cn("h-4 w-4 md:h-3.5 md:w-3.5", isPinned && "fill-foreground")} /> {isPinned ? "Desafixar" : "Fixar no topo"}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onSetPrimary(); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 md:py-1.5 text-[16px] md:text-[13px] hover:bg-secondary transition-colors whitespace-nowrap">
              <Star className={cn("h-4 w-4 md:h-3.5 md:w-3.5", isPrimary && "fill-yellow-400 text-yellow-400")} /> {isPrimary ? "Remover principal" : "Principal"}
            </button>
            <button onClick={(e) => { e.stopPropagation(); startEdit(); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 md:py-1.5 text-[16px] md:text-[13px] hover:bg-secondary transition-colors whitespace-nowrap">
              <Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" /> Renomear
            </button>
            {onColorChange && (
              <>
                <div className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 md:py-1.5 text-[16px] md:text-[13px] whitespace-nowrap">
                  <Palette className="h-4 w-4 md:h-3.5 md:w-3.5" /> Cor
                  {conv.accent_color && (
                    <div className="w-3 h-3 rounded-full ml-auto" style={{ backgroundColor: conv.accent_color }} />
                  )}
                </div>
                <CompactColorPicker
                  value={conv.accent_color || null}
                  onChange={(color) => { onColorChange(color); }}
                />
              </>
            )}
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setDeleteConfirmOpen(true); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 md:py-1.5 text-[16px] md:text-[13px] text-destructive hover:bg-secondary transition-colors whitespace-nowrap">
              <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" /> Excluir
            </button>
          </PopoverContent>
        </Popover>
      </div>

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

export function ChatSidebar({ conversations, activeId, primaryId, loading, agents, onSelect, onNew, onDelete, onRename, onSetPrimary, onSelectAgent, onEditAgent, onDeleteAgent, onClearAgent, onFavoriteAgent, favoriteAgentId, onNewAgent, onConversationColorChange }: ChatSidebarProps) {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("meowks_pinned") || "[]"); } catch { return []; }
  });

  const [pinnedAgentIds, setPinnedAgentIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("meowks_pinned_agents") || "[]"); } catch { return []; }
  });

  const [agentOrder, setAgentOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("meowks_agent_order") || "[]"); } catch { return []; }
  });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hasScrolledToActive = useRef(false);

  // Scroll to active conversation on initial load
  useEffect(() => {
    if (!activeId || loading || hasScrolledToActive.current) return;
    hasScrolledToActive.current = true;
    requestAnimationFrame(() => {
      const el = sidebarRef.current?.querySelector(`[data-conv-id="${activeId}"]`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
  }, [activeId, loading, conversations]);

  const togglePin = useCallback((id: string) => {
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem("meowks_pinned", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleAgentPin = useCallback((id: string) => {
    setPinnedAgentIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem("meowks_pinned_agents", JSON.stringify(next));
      return next;
    });
  }, []);

  // Build ordered agent list: pinned first, then rest in custom order
  const orderedAgents = (() => {
    if (!agents) return [];
    // Merge agent order with actual agents (handle new agents not in order yet)
    const orderMap = new Map(agentOrder.map((id, i) => [id, i]));
    const sorted = [...agents].sort((a, b) => {
      const oa = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
      const ob = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
      if (oa === ob) return 0;
      return oa - ob;
    });
    const pinned = sorted.filter(a => pinnedAgentIds.includes(a.id));
    const unpinned = sorted.filter(a => !pinnedAgentIds.includes(a.id));
    return [...pinned, ...unpinned];
  })();

  const moveAgent = useCallback((id: string, direction: "up" | "down") => {
    setAgentOrder(prev => {
      // Ensure all current agents are in the order array
      const currentIds = agents?.map(a => a.id) || [];
      let order = prev.length > 0 ? prev.filter(x => currentIds.includes(x)) : [];
      // Add missing agents at the end
      for (const aid of currentIds) {
        if (!order.includes(aid)) order.push(aid);
      }
      const idx = order.indexOf(id);
      if (idx === -1) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= order.length) return prev;
      const next = [...order];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      localStorage.setItem("meowks_agent_order", JSON.stringify(next));
      return next;
    });
  }, [agents]);

  // Exclude agent conversations from the regular list — they're accessed via the agents section
  const regularConvs = conversations.filter(c => !c.agent_id);
  const pinned = regularConvs.filter(c => pinnedIds.includes(c.id));
  const unpinned = regularConvs.filter(c => !pinnedIds.includes(c.id));

  return (
    <div className="flex h-full flex-col skeu-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Meux" className="h-7 w-7" />
          <h2 className="text-lg font-semibold text-foreground tracking-tight">Meux</h2>
        </div>
        <button onClick={onNew} title="Nova conversa" className="skeu-btn flex h-8 w-8 items-center justify-center rounded-lg transition-colors">
          <SquarePen className="h-4 w-4 text-sidebar-foreground" />
        </button>
      </div>

      {/* Nav items */}
      <div className="px-3 pb-3 space-y-0.5">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[15px] font-medium text-sidebar-foreground skeu-btn transition-colors"
        >
          <SquarePen className="h-4 w-4" />
          Nova conversa
        </button>
      </div>

      {/* Agents section */}
      {agents && (
        <div className="px-2 pb-1">
          <div className="flex items-center justify-between px-2 pt-1 pb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agentes</p>
            {onNewAgent && (
              <button onClick={onNewAgent} className="p-0.5 rounded hover:bg-secondary transition-colors">
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          {agents.length === 0 ? (
            <button onClick={onNewAgent} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[15px] text-muted-foreground hover:bg-sidebar-accent transition-colors">
              <Bot className="h-4 w-4" /> Criar primeiro agente
            </button>
          ) : (
          <div className="space-y-0.5">
            {orderedAgents.map((a, idx) => (
              <AgentSidebarItem
                key={a.id}
                agent={a}
                onSelect={() => onSelectAgent?.(a)}
                onEdit={onEditAgent ? () => onEditAgent(a) : undefined}
                onDelete={onDeleteAgent ? () => onDeleteAgent(a) : undefined}
                onClear={onClearAgent ? () => onClearAgent(a) : undefined}
                onFavorite={onFavoriteAgent ? () => onFavoriteAgent(a) : undefined}
                isFavorite={favoriteAgentId === a.id}
                onPin={() => toggleAgentPin(a.id)}
                isPinned={pinnedAgentIds.includes(a.id)}
                onMoveUp={() => moveAgent(a.id, "up")}
                onMoveDown={() => moveAgent(a.id, "down")}
                canMoveUp={idx > 0}
                canMoveDown={idx < orderedAgents.length - 1}
              />
            ))}
          </div>
          )}
        </div>
      )}

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
          <>
            {pinned.length > 0 && (
              <>
                <p className="px-3 pt-1 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fixadas</p>
                {pinned.map((c) => (
                  <SidebarItem
                    key={c.id}
                    conv={c}
                    isActive={activeId === c.id}
                    isPrimary={primaryId === c.id}
                    isPinned={true}
                    agent={c.agent_id ? agents?.find(a => a.id === c.agent_id) : null}
                    onSelect={() => onSelect(c.id)}
                    onDelete={() => onDelete(c.id)}
                    onRename={(t) => onRename(c.id, t)}
                    onSetPrimary={() => onSetPrimary(primaryId === c.id ? null : c.id)}
                    onTogglePin={() => togglePin(c.id)}
                    onColorChange={onConversationColorChange ? (color) => onConversationColorChange(c.id, color) : undefined}
                  />
                ))}
                <div className="mx-2 my-1.5 skeu-divider" />
              </>
            )}
            {unpinned.map((c) => (
              <SidebarItem
                key={c.id}
                conv={c}
                isActive={activeId === c.id}
                isPrimary={primaryId === c.id}
                isPinned={false}
                agent={c.agent_id ? agents?.find(a => a.id === c.agent_id) : null}
                onSelect={() => onSelect(c.id)}
                onDelete={() => onDelete(c.id)}
                onRename={(t) => onRename(c.id, t)}
                onSetPrimary={() => onSetPrimary(primaryId === c.id ? null : c.id)}
                onTogglePin={() => togglePin(c.id)}
                onColorChange={onConversationColorChange ? (color) => onConversationColorChange(c.id, color) : undefined}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
