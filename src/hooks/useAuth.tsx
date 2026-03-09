import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
  setPinVerified: () => void;
  setTotpVerified: () => void;
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
  setPinVerified: () => {},
  setTotpVerified: () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinStatus, setPinStatus] = useState<"loading" | "needs_create" | "needs_verify" | "verified">("loading");
  const [totpStatus, setTotpStatus] = useState<"loading" | "needs_enroll" | "needs_verify" | "verified">(() => {
    const cached = localStorage.getItem("meux_totp_verified");
    if (cached) {
      try {
        const { userId, ts } = JSON.parse(cached);
        // Valid for 7 days
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
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactors = factorsData?.totp || [];
      const verifiedFactor = totpFactors.find((f: any) => f.status === "verified");

      if (!verifiedFactor) {
        setTotpStatus("needs_enroll");
        return;
      }

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

  const setPinVerified = () => setPinStatus("verified");
  const setTotpVerified = () => setTotpStatus("verified");

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading, signOut, isAllowedEmail,
      pinStatus, totpStatus, setPinVerified, setTotpVerified, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
