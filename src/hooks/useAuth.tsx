import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_EMAIL = "taissamanuellefj@gmail.com";

function getDeviceFingerprint(): string {
  const key = "meux_device_fp";
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem(key, fp);
  }
  return fp;
}

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

type MasterPasswordStatus = "loading" | "needs_create" | "needs_verify" | "verified";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAllowedEmail: boolean;
  pinStatus: "loading" | "needs_create" | "needs_verify" | "verified";
  totpStatus: "loading" | "needs_enroll" | "needs_verify" | "verified";
  masterPasswordStatus: MasterPasswordStatus;
  setPinVerified: () => void;
  setTotpVerified: () => void;
  setMasterPasswordVerified: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  isAllowedEmail: false,
  pinStatus: "loading",
  totpStatus: "loading",
  masterPasswordStatus: "loading",
  setPinVerified: () => {},
  setTotpVerified: () => {},
  setMasterPasswordVerified: () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinStatus, setPinStatus] = useState<"loading" | "needs_create" | "needs_verify" | "verified">("loading");
  const [masterPasswordStatus, setMasterPasswordStatus] = useState<MasterPasswordStatus>("loading");
  const [totpStatus, setTotpStatus] = useState<"loading" | "needs_enroll" | "needs_verify" | "verified">(() => {
    const cached = localStorage.getItem("meux_totp_verified");
    if (cached) {
      try {
        const { userId, ts } = JSON.parse(cached);
        if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return "verified";
      } catch {}
    }
    return "loading";
  });

  const user = session?.user ?? null;
  const isAllowedEmail = user?.email === ALLOWED_EMAIL;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
        checkTotpStatus();
      } else {
        setProfile(null);
        setPinStatus("loading");
        setTotpStatus("loading");
        setMasterPasswordStatus("loading");
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
        checkTotpStatus();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkTotpStatus = async () => {
    if (totpStatus === "verified") return;
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactors = factorsData?.totp || [];
      const verifiedFactor = totpFactors.find((f: any) => f.status === "verified");

      if (!verifiedFactor) {
        setTotpStatus("needs_enroll");
        return;
      }

      const cached = localStorage.getItem("meux_totp_verified");
      if (cached) {
        try {
          const { ts } = JSON.parse(cached);
          if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) {
            setTotpStatus("verified");
            return;
          }
        } catch {}
      }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel === "aal2") {
        setTotpStatus("verified");
        localStorage.setItem("meux_totp_verified", JSON.stringify({ userId: user?.id, ts: Date.now() }));
      } else {
        setTotpStatus("needs_verify");
      }
    } catch {
      setTotpStatus("needs_enroll");
    }
  };

  const checkMasterPasswordStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-master-password", {
        body: { action: "status", device_fingerprint: getDeviceFingerprint() },
      });

      if (error || !data) {
        setMasterPasswordStatus("needs_create");
        return;
      }

      if (!data.has_password) {
        setMasterPasswordStatus("needs_create");
      } else if (data.device_verified) {
        setMasterPasswordStatus("verified");
      } else {
        setMasterPasswordStatus("needs_verify");
      }
    } catch {
      setMasterPasswordStatus("needs_create");
    }
  };

  const checkPinSession = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("pin_sessions")
      .select("expires_at")
      .eq("user_id", userId)
      .gte("expires_at", new Date().toISOString())
      .limit(1);
    return !!(data && data.length > 0);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, email")
      .eq("user_id", userId)
      .single();
    if (data) {
      setProfile(data as Profile);
      try {
        const { data: statusData } = await supabase.functions.invoke("verify-pin", {
          body: { action: "status" },
        });
        if (!statusData?.has_pin) {
          setPinStatus("needs_create");
        } else {
          const hasValidSession = await checkPinSession(userId);
          setPinStatus(hasValidSession ? "verified" : "needs_verify");
        }
      } catch {
        setPinStatus("needs_create");
      }

      // Check master password status
      await checkMasterPasswordStatus();
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const setPinVerified = () => setPinStatus("verified");
  const setTotpVerified = () => {
    setTotpStatus("verified");
    if (user) {
      localStorage.setItem("meux_totp_verified", JSON.stringify({ userId: user.id, ts: Date.now() }));
    }
  };
  const setMasterPasswordVerified = () => setMasterPasswordStatus("verified");

  const signOut = async () => {
    localStorage.removeItem("meux_totp_verified");
    // Don't remove device fingerprint - it's tied to the device, not the session
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading, signOut, isAllowedEmail,
      pinStatus, totpStatus, masterPasswordStatus,
      setPinVerified, setTotpVerified, setMasterPasswordVerified, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
