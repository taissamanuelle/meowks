import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Camera, Link, Trash2, Paperclip, FileText, Image, Loader2, X } from "lucide-react";
import { AccentColorPicker } from "@/components/AccentColorPicker";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface Agent {
  id: string;
  name: string;
  description: string;
  personality: string;
  avatar_url: string | null;
  accent_color?: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface AgentDocument {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  content_text: string | null;
  created_at: string;
}

interface AgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: Agent | null;
  onSaved: () => void;
}

const ALLOWED_TYPES = ["png", "jpeg", "jpg", "pdf", "csv", "docx", "json"];
const ALLOWED_MIME: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function getFileIcon(type: string) {
  if (["png", "jpeg", "jpg"].includes(type)) return <Image className="h-4 w-4 text-blue-400" />;
  if (type === "json") return <FileText className="h-4 w-4 text-yellow-400" />;
  return <FileText className="h-4 w-4 text-orange-400" />;
}

export function AgentDialog({ open, onOpenChange, agent, onSaved }: AgentDialogProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [personality, setPersonality] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarMode, setAvatarMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [accentColor, setAccentColor] = useState<string>("#00e89d");
  const fileRef = useRef<HTMLInputElement>(null);

  // Knowledge base
  const [documents, setDocuments] = useState<AgentDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  // Sync form state when agent prop changes or dialog opens
  useEffect(() => {
    if (open) {
      setName(agent?.name || "");
      setDescription(agent?.description || "");
      setPersonality(agent?.personality || "");
      setAvatarUrl(agent?.avatar_url || "");
      setAccentColor(agent?.accent_color || "#00e89d");
    }
  }, [agent, open]);

  // Load documents when editing an agent
  useEffect(() => {
    if (agent?.id && open) {
      loadDocuments(agent.id);
    } else {
      setDocuments([]);
    }
  }, [agent?.id, open]);

  // Poll for processing completion
  const hasProcessing = documents.some(d => !d.content_text);
  useEffect(() => {
    if (!hasProcessing || !agent?.id || !open) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("agent_documents")
        .select("*")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false });
      if (data) {
        setDocuments(data as AgentDocument[]);
        if (data.every((d: any) => d.content_text)) clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [hasProcessing, agent?.id, open]);

  const loadDocuments = async (agentId: string) => {
    const { data } = await supabase
      .from("agent_documents")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });
    if (data) setDocuments(data as AgentDocument[]);
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

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user || !agent) return;

    setUploadingDoc(true);
    let count = 0;

    for (const file of Array.from(files)) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!ALLOWED_TYPES.includes(ext)) {
        toast.error(`Formato .${ext} não suportado`);
        continue;
      }

      try {
        const path = `${user.id}/${agent.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("agent-documents")
          .upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        // Insert record
        const { error: insertError } = await supabase.from("agent_documents").insert({
          agent_id: agent.id,
          user_id: user.id,
          file_name: file.name,
          file_path: path,
          file_type: ext,
        });
        if (insertError) throw insertError;

        // Trigger text extraction in background
        const { data: { session } } = await supabase.auth.getSession();
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ filePath: path, fileType: ext, agentId: agent.id }),
        }).catch(console.error); // fire and forget

        count++;
      } catch (err) {
        console.error("Upload error:", err);
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    if (count > 0) {
      toast.success(`${count} arquivo${count > 1 ? "s" : ""} enviado${count > 1 ? "s" : ""}! Processando...`);
      await loadDocuments(agent.id);
    }

    setUploadingDoc(false);
    if (docFileRef.current) docFileRef.current.value = "";
  };

  const handleDeleteDoc = async (doc: AgentDocument) => {
    setDeletingDocId(doc.id);
    try {
      await supabase.storage.from("agent-documents").remove([doc.file_path]);
      await supabase.from("agent_documents").delete().eq("id", doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast.success("Arquivo removido");
    } catch {
      toast.error("Erro ao remover arquivo");
    }
    setDeletingDocId(null);
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
        accent_color: accentColor === "#00e89d" ? null : accentColor,
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
      // Delete all documents from storage
      if (documents.length > 0) {
        await supabase.storage.from("agent-documents").remove(documents.map(d => d.file_path));
      }
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{agent ? "Editar Agente" : "Criar Agente"}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-4 pt-2 pb-2">
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

              {/* Accent Color */}
              <AccentColorPicker
                value={accentColor}
                onChange={setAccentColor}
              />

              {/* Knowledge Base - only show for existing agents */}
              {agent && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Base de Conhecimento
                    {documents.length > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        {documents.length} arquivo{documents.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Anexe documentos para o agente usar como referência. Formatos: PNG, JPEG, PDF, CSV, DOCX.
                  </p>

                  {/* Document list */}
                  {documents.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                          {getFileIcon(doc.file_type)}
                          <span className="text-sm text-foreground truncate flex-1">{doc.file_name}</span>
                          {doc.content_text ? (
                            <span className="text-[10px] text-emerald-400 shrink-0">Processado</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Processando
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteDoc(doc)}
                            disabled={deletingDocId === doc.id}
                            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            {deletingDocId === doc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => docFileRef.current?.click()}
                    disabled={uploadingDoc}
                    className="w-full gap-2"
                  >
                    {uploadingDoc ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Paperclip className="h-4 w-4" />
                        Anexar arquivos
                      </>
                    )}
                  </Button>
                  <input
                    ref={docFileRef}
                    type="file"
                    accept=".png,.jpeg,.jpg,.pdf,.csv,.docx,.json"
                    multiple
                    className="hidden"
                    onChange={handleDocUpload}
                  />
                </div>
              )}

              {!agent && (
                <p className="text-xs text-muted-foreground text-center">
                  Após criar o agente, você poderá anexar documentos à base de conhecimento.
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {agent && (
                  <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                )}
                <div className="flex-1" />
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving || !name.trim() || hasProcessing} className="skeu-btn-accent">
                  {saving ? "Salvando..." : agent ? "Salvar" : "Criar"}
                </Button>
              </div>
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
