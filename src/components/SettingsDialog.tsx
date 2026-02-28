import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Fingerprint, Loader2, Check, Trash2 } from "lucide-react";
import { isWebAuthnSupported, checkBiometricStatus, registerBiometric } from "@/lib/webauthn";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNicknameChanged?: (nickname: string) => void;
}

export function SettingsDialog({ open, onOpenChange, onNicknameChanged }: SettingsDialogProps) {
  const { user, profile } = useAuth();
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricRegistered, setBiometricRegistered] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      supabase.from("profiles").select("nickname").eq("user_id", user.id).single().then(({ data }) => {
        setNickname((data as any)?.nickname || "");
      });

      // Check biometric
      if (isWebAuthnSupported()) {
        setBiometricSupported(true);
        checkBiometricStatus().then(setBiometricRegistered);
      }
    }
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nickname: nickname.trim() || null })
      .eq("user_id", user.id);
    if (error) {
      console.error("Nickname save error:", error);
      toast.error("Erro ao salvar apelido");
    } else {
      toast.success("Configurações salvas!");
      onNicknameChanged?.(nickname.trim());
      onOpenChange(false);
    }
    setSaving(false);
  };

  const handleRegisterBiometric = async () => {
    if (!user) return;
    setBiometricLoading(true);
    try {
      const success = await registerBiometric(user.id);
      if (success) {
        toast.success("Digital registrada com sucesso!");
        setBiometricRegistered(true);
      } else {
        toast.error("Falha ao registrar digital");
      }
    } catch {
      toast.error("Erro ao acessar biometria do dispositivo");
    }
    setBiometricLoading(false);
  };

  const handleRemoveBiometric = async () => {
    if (!user) return;
    setBiometricLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ webauthn_credential: null } as any)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao remover digital");
    } else {
      toast.success("Digital removida!");
      setBiometricRegistered(false);
    }
    setBiometricLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Como o Meux deve te chamar?</label>
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

          {/* Biometric / Fingerprint */}
          {biometricSupported && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Desbloqueio por digital</label>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 p-3">
                <Fingerprint className={`h-8 w-8 ${biometricRegistered ? "text-accent" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {biometricRegistered ? "Digital registrada" : "Nenhuma digital"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {biometricRegistered ? "Use sua digital para desbloquear o app" : "Registre para desbloquear mais rápido"}
                  </p>
                </div>
                {biometricRegistered ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveBiometric}
                    disabled={biometricLoading}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                  >
                    {biometricLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleRegisterBiometric}
                    disabled={biometricLoading}
                    className="h-8 px-3 text-xs"
                  >
                    {biometricLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Registrar"}
                  </Button>
                )}
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
