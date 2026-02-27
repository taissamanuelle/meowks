import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

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
      .order("created_at", { ascending: false });
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
      content: newMemory.trim(),
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
      .update({ content: editValue.trim(), updated_at: new Date().toISOString() })
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Minhas Memórias</DialogTitle>
              {memories.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setDeleteAllConfirm(true)} className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Apagar tudo
                </Button>
              )}
            </div>
            <DialogDescription>Gerencie as informações que a IA lembra sobre você.</DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <textarea
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              placeholder="Escreva algo pra eu lembrar sobre você..."
              rows={3}
              className="flex-1 resize-none rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                      rows={2}
                      autoFocus
                      className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                    <p className="flex-1 whitespace-pre-wrap">{m.content}</p>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{m.source === "ai" ? "IA" : "Você"}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(m)} title="Editar">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                        </button>
                        <button onClick={() => setDeleteConfirmId(m.id)} title="Excluir">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
