import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield, Eye, EyeOff, Lock } from "lucide-react";

interface MasterPasswordSetupProps {
  mode: "create" | "verify";
  onSuccess: () => void;
}

function getDeviceFingerprint(): string {
  const key = "meux_device_fp";
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem(key, fp);
  }
  return fp;
}

export function MasterPasswordSetup({ mode, onSuccess }: MasterPasswordSetupProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input after mount for autofill
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "create") {
      if (password.length < 12) {
        setError("A senha deve ter pelo menos 12 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        setError("As senhas não coincidem.");
        return;
      }
    }

    if (mode === "verify" && !password) {
      setError("Digite sua senha.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-master-password", {
        body: {
          password,
          action: mode === "create" ? "create" : "verify",
          device_fingerprint: getDeviceFingerprint(),
        },
      });

      if (fnError) {
        setError("Erro de conexão. Tente novamente.");
        setLoading(false);
        return;
      }

      if (data?.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      if (data?.success) {
        toast.success(mode === "create" ? "Senha mestra criada!" : "Acesso liberado!");
        onSuccess();
      }
    } catch {
      setError("Erro inesperado. Tente novamente.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/50 bg-card/80 shadow-lg backdrop-blur-sm">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold text-foreground">
              {mode === "create" ? "Criar senha mestra" : "Senha mestra"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "create"
                ? "Crie uma senha forte para proteger seu acesso. Use o Bitwarden para gerar e salvar."
                : "Novo dispositivo detectado. Digite sua senha mestra para continuar."}
            </p>
          </div>
        </div>

        {/* Form - proper autocomplete for Bitwarden */}
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
          {/* Hidden username field for password manager association */}
          <input
            type="email"
            name="username"
            autoComplete="username"
            value="taissamanuellefj@gmail.com"
            readOnly
            className="sr-only"
            tabIndex={-1}
          />

          <div className="space-y-2">
            <label htmlFor="master-password" className="text-sm font-medium text-foreground">
              {mode === "create" ? "Nova senha mestra" : "Senha mestra"}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                id="master-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "create" ? "Mínimo 12 caracteres..." : "Digite sua senha..."}
                className="w-full rounded-xl border border-input bg-secondary pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {mode === "create" && (
            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                Confirmar senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha..."
                  className="w-full rounded-xl border border-input bg-secondary pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {mode === "create" && password.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[12, 16, 20, 24].map((threshold, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      password.length >= threshold
                        ? i < 2 ? "bg-yellow-500" : "bg-green-500"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {password.length < 12
                  ? `${12 - password.length} caracteres restantes`
                  : password.length < 20
                  ? "Boa senha"
                  : "Senha forte ✓"}
              </p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full h-12 text-sm">
            {loading
              ? "Verificando..."
              : mode === "create"
              ? "Criar senha mestra"
              : "Desbloquear"}
          </Button>
        </form>

        {mode === "create" && (
          <p className="text-xs text-muted-foreground/70 text-center leading-relaxed">
            💡 Dica: Use o gerador de senhas do Bitwarden para criar uma senha forte e salvá-la automaticamente.
          </p>
        )}
      </div>
    </div>
  );
}
