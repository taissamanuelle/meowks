import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Monitor, Smartphone, Globe, Trash2, AlertTriangle, X, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function getDeviceFingerprint(): string {
  return localStorage.getItem("meux_device_fp") || "";
}

function parseUserAgent(ua: string): { type: "desktop" | "mobile"; browser: string; os: string } {
  const isMobile = /mobile|android|iphone|ipad/i.test(ua);
  let browser = "Navegador";
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/edg/i.test(ua)) browser = "Edge";

  let os = "Desconhecido";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/mac/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad/i.test(ua)) os = "iOS";

  return { type: isMobile ? "mobile" : "desktop", browser, os };
}

export function SessionsTab() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [sessRes, alertRes] = await Promise.all([
      supabase.from("user_sessions").select("*").eq("user_id", user.id).order("last_active_at", { ascending: false }),
      supabase.from("login_alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (sessRes.data) setSessions(sessRes.data);
    if (alertRes.data) setAlerts(alertRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const revokeSession = async (sessionId: string) => {
    const { error } = await supabase.from("user_sessions").delete().eq("id", sessionId);
    if (error) {
      toast.error("Erro ao revogar sessão");
    } else {
      toast.success("Sessão revogada");
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    }
  };

  const dismissAlert = async (alertId: string) => {
    await supabase.from("login_alerts").update({ acknowledged: true }).eq("id", alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const currentFp = getDeviceFingerprint();

  if (loading) {
    return <div className="flex items-center justify-center py-8">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>;
  }

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {unacknowledgedAlerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Tentativas suspeitas
          </div>
          {unacknowledgedAlerts.map(alert => (
            <div key={alert.id} className="flex items-start justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium text-foreground">
                  Login de {alert.city || "local desconhecido"}, {alert.region || ""} - {alert.country || ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  IP: {alert.ip_address} · {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <button onClick={() => dismissAlert(alert.id)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Active Sessions */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Dispositivos conectados</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sessão ativa.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map(session => {
              const device = parseUserAgent(session.user_agent || "");
              const isCurrentDevice = session.device_fingerprint === currentFp;
              return (
                <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 p-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {device.type === "mobile"
                      ? <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" />
                      : <Monitor className="h-5 w-5 text-muted-foreground shrink-0" />
                    }
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {device.browser} · {device.os}
                        </p>
                        {isCurrentDevice && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/20 text-primary shrink-0">
                            Este dispositivo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        <span>{session.ip_address || "IP desconhecido"}</span>
                        <span>·</span>
                        <Clock className="h-3 w-3" />
                        <span>{formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true, locale: ptBR })}</span>
                      </div>
                    </div>
                  </div>
                  {!isCurrentDevice && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeSession(session.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
