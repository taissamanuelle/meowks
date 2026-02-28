import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { checkBiometricStatus, isWebAuthnSupported, verifyBiometric } from "@/lib/webauthn";

const ALLOWED_EMAIL = "taissamanuellefj@gmail.com";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAllowedEmail: boolean;
  pinStatus: "loading" | "needs_create" | "needs_verify" | "verified";
  totpStatus: "loading" | "needs_enroll" | "needs_verify" | "verified";
  biometricStatus: "loading" | "not_registered" | "needs_verify" | "verified";
  setPinVerified: () => void;
  setTotpVerified: () => void;
  setBiometricVerified: () => void;
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
  biometricStatus: "loading",
  setPinVerified: () => {},
  setTotpVerified: () => {},
  setBiometricVerified: () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinStatus, setPinStatus] = useState<"loading" | "needs_create" | "needs_verify" | "verified">("loading");
  const [totpStatus, setTotpStatus] = useState<"loading" | "needs_enroll" | "needs_verify" | "verified">("loading");
  const [biometricStatus, setBiometricStatus] = useState<"loading" | "not_registered" | "needs_verify" | "verified">("loading");

  const user = session?.user ?? null;
  const isAllowedEmail = user?.email === ALLOWED_EMAIL;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
        checkTotpStatus();
        checkBiometricOnMobile();
      } else {
        setProfile(null);
        setPinStatus("loading");
        setTotpStatus("loading");
        setBiometricStatus("loading");
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
        checkTotpStatus();
        checkBiometricOnMobile();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkTotpStatus = async () => {
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactors = factorsData?.totp || [];
      const verifiedFactor = totpFactors.find((f: any) => f.status === "verified");

      if (!verifiedFactor) {
        setTotpStatus("needs_enroll");
        return;
      }

      // Always check AAL2 from server — never trust localStorage
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel === "aal2") {
        setTotpStatus("verified");
      } else {
        setTotpStatus("needs_verify");
      }
    } catch {
      setTotpStatus("needs_enroll");
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
      // Check PIN status via edge function (never expose pin_hash to client)
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
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const setPinVerified = () => {
    setPinStatus("verified");
  };

  const setTotpVerified = () => {
    setTotpStatus("verified");
  };

  const setBiometricVerified = () => {
    setBiometricStatus("verified");
  };

  // Check biometric early (in parallel with other checks) for faster loading
  const checkBiometricOnMobile = async () => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    if (!mobile) {
      setBiometricStatus("verified");
      return;
    }
    if (!isWebAuthnSupported()) {
      setBiometricStatus("not_registered");
      return;
    }
    try {
      const registered = await checkBiometricStatus();
      setBiometricStatus(registered ? "needs_verify" : "not_registered");
    } catch {
      setBiometricStatus("not_registered");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      loading,
      signOut,
      isAllowedEmail,
      pinStatus,
      totpStatus,
      biometricStatus,
      setPinVerified,
      setTotpVerified,
      setBiometricVerified,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
