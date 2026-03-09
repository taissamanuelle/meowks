import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, EyeOff, Key, ExternalLink } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNicknameChanged?: (nickname: string) => void;
}

export function SettingsDialog({ open, onOpenChange, onNicknameChanged }: SettingsDialogProps) {
  const { user, profile } = useAuth();
  const [nickname, setNickname] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      supabase.from("profiles").select("nickname, gemini_api_key").eq("user_id", user.id).single().then(({ data }) => {
        setNickname((data as any)?.nickname || "");
        const key = (data as any)?.gemini_api_key || "";
        setHasExistingKey(!!key);
        setApiKey(key);
      });
    }
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const updates: Record<string, any> = { nickname: nickname.trim() || null };
    
    // Only update key if changed
    if (apiKey.trim()) {
      updates.gemini_api_key = apiKey.trim();
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id);
    if (error) {
      console.error("Settings save error:", error);
      toast.error("Erro ao salvar configurações");
    } else {
      toast.success("Configurações salvas!");
      onNicknameChanged?.(nickname.trim());
      setHasExistingKey(!!apiKey.trim());
      onOpenChange(false);
    }
    setSaving(false);
  };

  const maskedKey = apiKey ? apiKey.slice(0, 8) + "•".repeat(Math.max(0, apiKey.length - 12)) + apiKey.slice(-4) : "";

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

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-accent" />
              <label className="text-sm font-medium text-foreground">API Key do Gemini</label>
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasExistingKey ? "••••••••••••" : "Cole sua API key aqui..."}
                className="w-full rounded-xl border border-input bg-secondary px-4 py-2.5 pr-10 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {hasExistingKey && (
              <p className="text-xs text-green-500">✓ Key configurada. Cole uma nova para substituir.</p>
            )}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Gerar nova key no Google AI Studio
            </a>
            <p className="text-[11px] text-muted-foreground/70">
              Quando a quota esgotar, gere uma nova key no link acima e cole aqui. A troca é instantânea.
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
