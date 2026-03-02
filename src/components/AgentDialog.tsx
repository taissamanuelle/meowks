import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Camera, Link, Trash2, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export interface Agent {
  id: string;
  name: string;
  description: string;
  personality: string;
  avatar_url: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface AgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: Agent | null; // null = create, existing = edit
  onSaved: () => void;
}

export function AgentDialog({ open, onOpenChange, agent, onSaved }: AgentDialogProps) {
  const { user } = useAuth();
  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [personality, setPersonality] = useState(agent?.personality || "");
  const [avatarUrl, setAvatarUrl] = useState(agent?.avatar_url || "");
  const [avatarMode, setAvatarMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset form when agent changes
  const resetForm = () => {
    setName(agent?.name || "");
    setDescription(agent?.description || "");
    setPersonality(agent?.personality || "");
    setAvatarUrl(agent?.avatar_url || "");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/agent-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("chat-images").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("chat-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
      toast.success("Imagem enviada!");
    } catch {
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        personality: personality.trim(),
        avatar_url: avatarUrl.trim() || null,
        user_id: user.id,
      };
      if (agent) {
        await supabase.from("agents").update(payload).eq("id", agent.id);
        toast.success("Agente atualizado!");
      } else {
        await supabase.from("agents").insert(payload);
        toast.success("Agente criado!");
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar agente");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agent) return;
    try {
      await supabase.from("agents").delete().eq("id", agent.id);
      toast.success("Agente excluído!");
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao excluir agente");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (o) resetForm(); onOpenChange(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{agent ? "Editar Agente" : "Criar Agente"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-border bg-secondary">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                    {name?.[0]?.toUpperCase() || "A"}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAvatarMode("url")} className={avatarMode === "url" ? "border-accent" : ""}>
                  <Link className="h-3.5 w-3.5 mr-1" /> URL
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Camera className="h-3.5 w-3.5 mr-1" /> {uploading ? "Enviando..." : "Upload"}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </div>
              {avatarMode === "url" && (
                <Input
                  placeholder="https://exemplo.com/avatar.png"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="text-sm"
                />
              )}
            </div>

            {/* Name */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Professor, Terapeuta..." />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Descrição</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Uma breve descrição do agente" />
            </div>

            {/* Personality */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Personalidade / Instruções</label>
              <Textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="Descreva como o agente deve se comportar, responder, qual tom usar..."
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {agent && (
                <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !name.trim()} className="skeu-btn-accent">
                {saving ? "Salvando..." : agent ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. Conversas vinculadas a este agente continuarão existindo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
