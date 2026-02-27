import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_EMAIL = "taissamanuellefj@gmail.com";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  pin_hash?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAllowedEmail: boolean;
  pinStatus: "loading" | "needs_create" | "needs_verify" | "verified";
  setPinVerified: () => void;
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
  setPinVerified: () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinStatus, setPinStatus] = useState<"loading" | "needs_create" | "needs_verify" | "verified">("loading");

  const user = session?.user ?? null;
  const isAllowedEmail = user?.email === ALLOWED_EMAIL;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 500);
      } else {
        setProfile(null);
        setPinStatus("loading");
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, email, pin_hash")
      .eq("user_id", userId)
      .single();
    if (data) {
      setProfile(data as Profile);
      // Check PIN status
      const pinVerified = localStorage.getItem(`meowks_pin_verified_${userId}`);
      if (!(data as any).pin_hash) {
        setPinStatus("needs_create");
      } else if (pinVerified === "true") {
        setPinStatus("verified");
      } else {
        setPinStatus("needs_verify");
      }
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const setPinVerified = () => {
    setPinStatus("verified");
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
      setPinVerified,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
