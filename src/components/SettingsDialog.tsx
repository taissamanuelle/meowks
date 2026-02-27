import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNicknameChanged?: (nickname: string) => void;
}

export function SettingsDialog({ open, onOpenChange, onNicknameChanged }: SettingsDialogProps) {
  const { user, profile } = useAuth();
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      // Fetch current nickname
      supabase.from("profiles").select("nickname").eq("user_id", user.id).single().then(({ data }) => {
        setNickname((data as any)?.nickname || "");
      });
    }
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nickname: nickname.trim() || null } as any)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Configurações salvas!");
      onNicknameChanged?.(nickname.trim());
      onOpenChange(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Como o Meowks deve te chamar?</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={profile?.display_name || "Seu apelido..."}
              className="w-full rounded-xl border border-input bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para usar seu nome de perfil ({profile?.display_name || "Usuário"}).
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
