import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { applyTheme } from "@/lib/theme";
import { useLastSeenHeartbeat } from "@/hooks/usePresence";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: string;
  status: string;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  zoom_link: string | null;
  subjects: string[] | null;
  hourly_rate: number | null;
  rate_currency: string | null;
  grade_level: string | null;
  theme: string;
  accepting_students: boolean | null;
  is_onboarded: boolean;
  rejection_reason: string | null;
  active_services?: string[] | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Stamps profiles.last_seen_at while the app is open, anywhere in it.
  useLastSeenHeartbeat(user?.id);

  useEffect(() => {
    // getSession only reads the token out of storage; it never asks whether
    // the account behind it still exists. After the local database is reset the
    // stored token still parses, so the app came up "signed in" as somebody who
    // had been deleted: profile lookups returned 406 and every write with a
    // foreign key to auth.users failed. getUser checks with the server, so a
    // dead session is cleared instead of half-working.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { error } = await supabase.auth.getUser();
        if (error) {
          console.warn("Stored session is no longer valid, signing out.", error.message);
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      // maybeSingle, not single: a missing row is a state to handle, not a 406.
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data && !error) {
        // An admin disabled this account. New sign-ins are already refused at
        // the auth layer (migration 20260813000100 bans the account and drops
        // its sessions), but an access token minted before the delete stays
        // valid until it expires. This ends that session the moment its profile
        // is read, so a browser left open on a now-deleted account is booted
        // rather than left working.
        if (data.status === "deleted" || data.status === "suspended") {
          toast.error("This account has been deactivated. Contact Yakal if this is a mistake.");
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          return null;
        }

        setProfile(data as Profile);

        // The profile is how the choice travels between machines, so on sign
        // in it wins and is written back to this browser. Between sign ins the
        // browser is the source, applied before React mounts.
        if (data.theme === 'dark' || data.theme === 'light') {
          applyTheme(data.theme);
        }
        return data as Profile;
      }
      return null;
    } catch (err) {
      console.error("Error fetching profile", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch the current user's profile (call after profile updates / approval).
  const refreshProfile = async (): Promise<Profile | null> => {
    const { data: { user: current } } = await supabase.auth.getUser();
    if (!current) return null;
    return fetchProfile(current.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
