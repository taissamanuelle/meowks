import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

interface TotpSetupProps {
  mode: "enroll" | "verify";
  onSuccess: () => void;
}

export function TotpSetup({ mode, onSuccess }: TotpSetupProps) {
  const { signOut } = useAuth();
  const [qrUri, setQrUri] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(mode === "enroll");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (mode === "enroll") {
      enrollFactor();
    }
  }, []);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, [enrolling, qrUri]);

  const enrollFactor = async () => {
    setEnrolling(true);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Meux",
      issuer: "Meux",
    });
    if (enrollError) {
      // Factor already exists — switch to verify mode
      if (enrollError.message?.includes("already exists")) {
        setEnrolling(false);
        return;
      }
      setError("Erro ao configurar 2FA: " + enrollError.message);
      return;
    }
    if (data) {
      setQrUri(data.totp.uri);
      setFactorId(data.id);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    // Handle paste into a single input (some mobile browsers paste full string into onChange)
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6);
      if (digits.length >= 2) {
        const newCode = [...code];
        for (let j = 0; j < digits.length && index + j < 6; j++) {
          newCode[index + j] = digits[j];
        }
        setCode(newCode);
        setError("");
        const lastIdx = Math.min(index + digits.length - 1, 5);
        inputRefs.current[lastIdx]?.focus();
        return;
      }
    }
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError("");
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const codeStr = code.join("");
    if (codeStr.length !== 6) {
      setError("Digite todos os 6 dígitos");
      return;
    }

    setLoading(true);

    try {
      if (mode === "enroll" && enrolling && factorId) {
        // Challenge + verify for enrollment
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId,
        });
        if (challengeError) throw challengeError;

        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challengeData.id,
          code: codeStr,
        });
        if (verifyError) throw verifyError;

        toast.success("2FA ativado com sucesso!");
        onSuccess();
      } else {
        // Get existing factors and verify
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const totp = factorsData?.totp?.[0];
        if (!totp) {
          setError("Nenhum fator TOTP encontrado");
          setLoading(false);
          return;
        }

        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: totp.id,
        });
        if (challengeError) throw challengeError;

        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: totp.id,
          challengeId: challengeData.id,
          code: codeStr,
        });
        if (verifyError) throw verifyError;

        toast.success("Verificação 2FA concluída!");
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Código inválido");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }

    setLoading(false);
  };

  // Auto-submit when all digits filled
  useEffect(() => {
    if (code.every((d) => d !== "")) {
      handleVerify();
    }
  }, [code]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">🔐</h1>
        <h2 className="text-2xl font-semibold text-foreground">
          {mode === "enroll" && enrolling ? "Configurar 2FA" : "Verificação em duas etapas"}
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          {mode === "enroll" && enrolling
            ? "Escaneie o QR code no Google Authenticator e digite o código gerado"
            : "Digite o código do Google Authenticator"}
        </p>
      </div>

      {mode === "enroll" && qrUri && (
        <div className="rounded-2xl bg-white p-4">
          <QRCodeSVG value={qrUri} size={200} />
        </div>
      )}

      <div className="flex gap-3" onPaste={handlePaste}>
        {code.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={loading || (mode === "enroll" && !qrUri)}
            className="h-14 w-12 rounded-xl border border-border bg-card text-center text-2xl font-bold text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all disabled:opacity-50"
          />
        ))}
      </div>

      {error && <p className="text-destructive text-sm font-medium">{error}</p>}

      {loading && (
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      )}

      <button
        onClick={() => signOut()}
        className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-4"
      >
        Sair da conta
      </button>
    </div>
  );
}
