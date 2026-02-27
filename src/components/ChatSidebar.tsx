import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
}

export function ChatSidebar({ conversations, activeId, onSelect, onNew, onDelete }: ChatSidebarProps) {
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
          <div
            key={c.id}
            className={cn(
              "group mb-0.5 flex cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent",
              activeId === c.id && "bg-sidebar-accent text-foreground"
            )}
            onClick={() => onSelect(c.id)}
          >
            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{c.title}</span>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
