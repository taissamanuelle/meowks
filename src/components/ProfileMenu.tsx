import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Brain } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemoryDialog } from "./MemoryDialog";

interface ProfileMenuProps {
  onMemoriesChanged?: () => void;
  layout?: "header" | "sidebar";
}

export function ProfileMenu({ onMemoriesChanged, layout = "header" }: ProfileMenuProps) {
  const { profile, signOut } = useAuth();
  const [memoryOpen, setMemoryOpen] = useState(false);

  if (layout === "sidebar") {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 hover:bg-sidebar-accent transition-colors text-left">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Perfil" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-accent text-accent-foreground text-xs font-bold">
                    {profile?.display_name?.[0] || "U"}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{profile?.display_name || "Usuário"}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
            <DropdownMenuItem onClick={() => setMemoryOpen(true)}>
              <Brain className="mr-2 h-4 w-4" />
              Memórias
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <MemoryDialog open={memoryOpen} onOpenChange={setMemoryOpen} onMemoriesChanged={onMemoriesChanged} />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-9 w-9 overflow-hidden rounded-full border-2 border-primary/30 hover:border-primary transition-colors focus:outline-none">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Perfil" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground text-sm font-bold">
                {profile?.display_name?.[0] || "U"}
              </div>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{profile?.display_name || "Usuário"}</p>
            <p className="text-xs text-muted-foreground">{profile?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setMemoryOpen(true)}>
            <Brain className="mr-2 h-4 w-4" />
            Memórias
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MemoryDialog open={memoryOpen} onOpenChange={setMemoryOpen} onMemoriesChanged={onMemoriesChanged} />
    </>
  );
}
