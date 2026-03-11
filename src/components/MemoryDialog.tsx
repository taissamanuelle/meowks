import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Pencil, Check, X, ArrowLeft, Brain, List } from "lucide-react";
import { toast } from "sonner";
import { NeuralGraph } from "@/components/NeuralGraph";

interface Memory {
  id: string;
  content: string;
  source: string;
  created_at: string;
}

interface MemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemoriesChanged?: () => void;
}

export function MemoryDialog({ open, onOpenChange, onMemoriesChanged }: MemoryDialogProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [view, setView] = useState<"list" | "neural">("list");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  const fetchMemories = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("memories")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setMemories(data);
  };

  useEffect(() => {
    if (open) fetchMemories();
  }, [open, user]);

  const addMemory = async () => {
    if (!user || !newMemory.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("memories").insert({
      user_id: user.id,
      content: newMemory.trim().charAt(0).toUpperCase() + newMemory.trim().slice(1),
      source: "user",
    });
    if (error) {
      toast.error("Erro ao salvar memória");
    } else {
      setNewMemory("");
      fetchMemories();
      onMemoriesChanged?.();
      toast.success("Memória salva!");
    }
    setLoading(false);
  };

  const startEdit = (m: Memory) => {
    setEditingId(m.id);
    setEditValue(m.content);
  };

  const saveEdit = async () => {
    if (!editingId || !editValue.trim()) return;
    const { error } = await supabase
      .from("memories")
      .update({ content: editValue.trim().charAt(0).toUpperCase() + editValue.trim().slice(1), updated_at: new Date().toISOString() })
      .eq("id", editingId);
    if (error) {
      toast.error("Erro ao editar memória");
    } else {
      toast.success("Memória atualizada!");
      setEditingId(null);
      fetchMemories();
      onMemoriesChanged?.();
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const deleteMemory = async (id: string) => {
    await supabase.from("memories").delete().eq("id", id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    onMemoriesChanged?.();
    setDeleteConfirmId(null);
    toast.success("Memória removida");
  };

  const deleteAllMemories = async () => {
    if (!user) return;
    await supabase.from("memories").delete().eq("user_id", user.id);
    setMemories([]);
    onMemoriesChanged?.();
    setDeleteAllConfirm(false);
    toast.success("Todas as memórias foram removidas");
  };

  const tabSwitcher = (
    <div className="flex gap-1 rounded-lg bg-secondary p-1 mb-2">
      <button
        onClick={() => setView("list")}
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <List className="h-3.5 w-3.5" /> Memórias
      </button>
      <button
        onClick={() => setView("neural")}
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          view === "neural" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Brain className="h-3.5 w-3.5" /> Rede Neural
      </button>
    </div>
  );

  const memoryContent = (
    <>
      {tabSwitcher}
      {view === "neural" ? (
        <div className="flex-1 min-h-[300px]">
          <NeuralGraph />
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <textarea
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              placeholder="Escreva algo pra eu lembrar sobre você..."
              rows={4}
              className="flex-1 min-h-[6rem] resize-none rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button onClick={addMemory} disabled={loading || !newMemory.trim()} size="icon" className="h-auto">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 mt-2">
            {memories.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhuma memória salva ainda.</p>
            )}
            {memories.map((m) => (
              <div key={m.id} className="group flex gap-2 rounded-lg bg-secondary p-3 text-sm">
                {editingId === m.id ? (
                  <div className="flex-1 flex flex-col gap-2">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={4}
                      autoFocus
                      className="w-full min-h-[6rem] resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={cancelEdit} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-background transition-colors">
                        <X className="h-3 w-3" /> Cancelar
                      </button>
                      <button onClick={saveEdit} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs bg-accent text-accent-foreground hover:bg-accent/90 transition-colors">
                        <Check className="h-3 w-3" /> Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      <span className="text-[10px] text-muted-foreground mt-1 block">{m.source === "ai" ? "IA" : "Você"}</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 ml-2">
                      <button
                        onClick={() => startEdit(m)}
                        title="Editar"
                        className="p-1.5 rounded-md hover:bg-background transition-colors"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(m.id)}
                        title="Excluir"
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );

  const headerActions = memories.length > 0 ? (
    <Button variant="ghost" size="sm" onClick={() => setDeleteAllConfirm(true)} className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
      <Trash2 className="h-3.5 w-3.5 mr-1" /> Apagar tudo
    </Button>
  ) : null;

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="h-full flex flex-col p-0 rounded-none [&>button]:hidden">
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <SheetTitle>Minhas Memórias</SheetTitle>
                </div>
                {headerActions}
              </div>
              <SheetDescription className="pl-10">Gerencie as informações que a IA lembra sobre você.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 flex flex-col gap-2 px-4 py-3 overflow-hidden">
              {memoryContent}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Minhas Memórias</DialogTitle>
                {headerActions}
              </div>
              <DialogDescription>Gerencie as informações que a IA lembra sobre você.</DialogDescription>
            </DialogHeader>
            {memoryContent}
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm delete memory */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir memória?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta memória? Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && deleteMemory(deleteConfirmId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete all */}
      <AlertDialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar todas as memórias?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Todas as memórias serão permanentemente removidas e a IA não lembrará mais de nada sobre você.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAllMemories} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Apagar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
