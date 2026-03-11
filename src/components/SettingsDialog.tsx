import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, EyeOff, Key, ExternalLink, Plus, Trash2, Settings, Shield, Monitor } from "lucide-react";
import { UsageStats } from "@/components/UsageStats";
import { SessionsTab } from "@/components/SessionsTab";
import { AccentColorPicker } from "@/components/AccentColorPicker";
import { applyAccentColor } from "@/hooks/useAccentColor";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNicknameChanged?: (nickname: string) => void;
}

export function SettingsDialog({ open, onOpenChange, onNicknameChanged }: SettingsDialogProps) {
  const { user, profile } = useAuth();
  const [nickname, setNickname] = useState("");
  const [apiKeys, setApiKeys] = useState<string[]>([""]);
  const [showKeys, setShowKeys] = useState<boolean[]>([false]);
  const [saving, setSaving] = useState(false);
  const [usageRefresh, setUsageRefresh] = useState(0);
  const [accentColor, setAccentColor] = useState("#00e89d");

  useEffect(() => {
    if (open && user) {
      setUsageRefresh(prev => prev + 1);
      supabase.from("profiles").select("nickname, gemini_api_key, accent_color").eq("user_id", user.id).single().then(({ data }) => {
        setNickname((data as any)?.nickname || "");
        setAccentColor((data as any)?.accent_color || "#00e89d");
        const raw = (data as any)?.gemini_api_key || "";
        const keys = raw.split(",").map((k: string) => k.trim()).filter((k: string) => k.length > 0);
        setApiKeys(keys.length > 0 ? keys : [""]);
        setShowKeys(new Array(Math.max(keys.length, 1)).fill(false));
      });
    }
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const validKeys = apiKeys.map(k => k.trim()).filter(k => k.length > 10);
    const updates: Record<string, any> = {
      nickname: nickname.trim() || null,
      gemini_api_key: validKeys.length > 0 ? validKeys.join(",") : null,
      accent_color: accentColor,
    };

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao salvar configurações");
    } else {
      toast.success(`Configurações salvas! ${validKeys.length} key(s) ativa(s).`);
      onNicknameChanged?.(nickname.trim());
      onOpenChange(false);
    }
    setSaving(false);
  };

  const addKeySlot = () => {
    setApiKeys(prev => [...prev, ""]);
    setShowKeys(prev => [...prev, false]);
  };

  const removeKeySlot = (index: number) => {
    setApiKeys(prev => prev.filter((_, i) => i !== index));
    setShowKeys(prev => prev.filter((_, i) => i !== index));
  };

  const updateKey = (index: number, value: string) => {
    setApiKeys(prev => prev.map((k, i) => i === index ? value : k));
  };

  const toggleShowKey = (index: number) => {
    setShowKeys(prev => prev.map((v, i) => i === index ? !v : v));
  };

  const activeKeysCount = apiKeys.filter(k => k.trim().length > 10).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="general" className="gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs">
              <Shield className="h-3.5 w-3.5" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-1.5 text-xs">
              <Monitor className="h-3.5 w-3.5" />
              Sessões
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-5 pt-2">
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

            <AccentColorPicker
              value={accentColor}
              onChange={(hex) => {
                setAccentColor(hex);
                applyAccentColor(hex); // live preview
              }}
            />

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar"}
            </Button>

            
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-5 pt-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-accent" />
                  <label className="text-sm font-medium text-foreground">API Keys do Gemini</label>
                </div>
                {activeKeysCount > 0 && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                    {activeKeysCount} ativa{activeKeysCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {apiKeys.map((key, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showKeys[index] ? "text" : "password"}
                      value={key}
                      onChange={(e) => updateKey(index, e.target.value)}
                      placeholder={`Key ${index + 1}...`}
                      className="w-full rounded-xl border border-input bg-secondary px-3 py-2 pr-9 text-xs text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey(index)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showKeys[index] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {apiKeys.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeKeySlot(index)}
                      className="p-1.5 text-destructive/70 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addKeySlot}
                className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar outra key
              </button>

              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Gerar nova key no Google AI Studio
              </a>
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                💡 Adicione <strong>várias keys</strong> para evitar bloqueios. Quando uma atinge o limite, o sistema usa a próxima automaticamente.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar keys"}
            </Button>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="pt-2">
            <SessionsTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
