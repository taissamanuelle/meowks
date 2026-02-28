import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Fingerprint } from "lucide-react";
import { isWebAuthnSupported, checkBiometricStatus, registerBiometric, verifyBiometric } from "@/lib/webauthn";

interface PinSetupProps {
  mode: "create" | "verify";
  onSuccess: () => void;
}

export function PinSetup({ mode, onSuccess }: PinSetupProps) {
  const { user, signOut } = useAuth();
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"enter" | "confirm">(mode === "create" ? "enter" : "enter");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricRegistered, setBiometricRegistered] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, [step]);

  // Check biometric availability
  useEffect(() => {
    if (mode !== "verify" || !isWebAuthnSupported()) return;
    (async () => {
      const registered = await checkBiometricStatus();
      setBiometricAvailable(true);
      setBiometricRegistered(registered);
      // Auto-trigger biometric if registered
      if (registered) {
        handleBiometricVerify();
      }
    })();
  }, [mode]);

  const activePin = step === "confirm" ? confirmPin : pin;
  const setActivePin = step === "confirm" ? setConfirmPin : setPin;
  const activeRefs = step === "confirm" ? confirmRefs : inputRefs;

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...activePin];
    newPin[index] = value.slice(-1);
    setActivePin(newPin);
    setError("");

    if (value && index < 5) {
      activeRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !activePin[index] && index > 0) {
      activeRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newPin = pasted.split("");
      setActivePin(newPin);
      activeRefs.current[5]?.focus();
    }
  };

  async function verifyPinServer(pinStr: string, action: "create" | "verify"): Promise<{ success: boolean; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: "Not authenticated" };

    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-pin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ pin: pinStr, action }),
    });

    const data = await resp.json();
    if (resp.ok && data.success) return { success: true };
    return { success: false, error: data.error || "Erro desconhecido" };
  }

  const handleBiometricVerify = async () => {
    setBiometricLoading(true);
    setError("");
    try {
      const success = await verifyBiometric();
      if (success) {
        toast.success("Biometria verificada!");
        onSuccess();
      } else {
        setError("Falha na verificação biométrica");
      }
    } catch {
      setError("Biometria não disponível");
    }
    setBiometricLoading(false);
  };

  const handleBiometricRegister = async () => {
    if (!user) return;
    setBiometricLoading(true);
    setError("");
    try {
      const success = await registerBiometric(user.id);
      if (success) {
        toast.success("Digital registrada com sucesso!");
        setBiometricRegistered(true);
      } else {
        setError("Falha ao registrar digital");
      }
    } catch {
      setError("Erro ao acessar biometria do dispositivo");
    }
    setBiometricLoading(false);
  };

  const handleSubmit = async () => {
    const pinStr = activePin.join("");
    if (pinStr.length !== 6) {
      setError("Digite todos os 6 dígitos");
      return;
    }

    setLoading(true);

    if (mode === "create") {
      if (step === "enter") {
        setStep("confirm");
        setLoading(false);
        return;
      }

      // Confirm step
      if (pin.join("") !== confirmPin.join("")) {
        setError("Os PINs não coincidem. Tente novamente.");
        setConfirmPin(["", "", "", "", "", ""]);
        setLoading(false);
        confirmRefs.current[0]?.focus();
        return;
      }

      const result = await verifyPinServer(pin.join(""), "create");
      if (!result.success) {
        setError(result.error || "Erro ao salvar PIN");
        setLoading(false);
        return;
      }

      toast.success("PIN criado com sucesso!");
      onSuccess();
    } else {
      // Verify mode — server-side verification
      const result = await verifyPinServer(pinStr, "verify");
      if (result.success) {
        toast.success("PIN verificado!");
        // After successful PIN verify, offer biometric registration if available and not registered
        if (isWebAuthnSupported() && !biometricRegistered) {
          // Register biometric silently in background after PIN success
          registerBiometric(user!.id).then((ok) => {
            if (ok) {
              setBiometricRegistered(true);
              toast.success("Digital registrada! Da próxima vez, use sua digital para entrar.");
            }
          });
        }
        onSuccess();
      } else {
        setError("PIN incorreto");
        setPin(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    }
    setLoading(false);
  };

  // Auto-submit when all digits filled
  useEffect(() => {
    if (activePin.every(d => d !== "")) {
      handleSubmit();
    }
  }, [activePin]);

  const title = mode === "create"
    ? step === "enter" ? "Crie seu PIN" : "Confirme seu PIN"
    : "Digite seu PIN";

  const subtitle = mode === "create"
    ? step === "enter"
      ? "Escolha um PIN de 6 dígitos para proteger sua conta"
      : "Digite novamente para confirmar"
    : biometricRegistered
      ? "Ou use sua digital para desbloquear"
      : "Verificação de segurança necessária";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">🔒</h1>
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>

      {/* Biometric button - shown on verify mode when registered */}
      {mode === "verify" && biometricAvailable && biometricRegistered && (
        <button
          onClick={handleBiometricVerify}
          disabled={biometricLoading}
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-8 py-5 hover:bg-secondary transition-all active:scale-95 disabled:opacity-50"
        >
          <Fingerprint className={`h-12 w-12 text-accent ${biometricLoading ? "animate-pulse" : ""}`} />
          <span className="text-sm font-medium text-foreground">
            {biometricLoading ? "Verificando..." : "Usar digital"}
          </span>
        </button>
      )}

      {mode === "verify" && biometricAvailable && biometricRegistered && (
        <div className="flex items-center gap-3 w-48">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">ou PIN</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      <div className="flex gap-3" onPaste={handlePaste}>
        {activePin.map((digit, i) => (
          <input
            key={`${step}-${i}`}
            ref={el => { (step === "confirm" ? confirmRefs : inputRefs).current[i] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={loading}
            className="h-14 w-12 rounded-xl border border-border bg-card text-center text-2xl font-bold text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all disabled:opacity-50"
          />
        ))}
      </div>

      {error && <p className="text-destructive text-sm font-medium">{error}</p>}

      {loading && (
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      )}

      <button
        onClick={() => { signOut(); }}
        className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-4"
      >
        Sair da conta
      </button>
    </div>
  );
}
