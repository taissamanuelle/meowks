import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
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
}

export function MemoryDialog({ open, onOpenChange }: MemoryDialogProps) {
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [loading, setLoading] = useState(false);

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
      toast.success("Memória salva!");
    }
    setLoading(false);
  };

  const deleteMemory = async (id: string) => {
    await supabase.from("memories").delete().eq("id", id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    toast.success("Memória removida");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Minhas Memórias</DialogTitle>
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
              <p className="flex-1 whitespace-pre-wrap">{m.content}</p>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{m.source === "ai" ? "IA" : "Você"}</span>
                <button onClick={() => deleteMemory(m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
