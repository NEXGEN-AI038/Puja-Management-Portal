import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, CommitteeWithMembership } from '@/types';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isPlatformAdmin: boolean;
  committees: CommitteeWithMembership[];
  activeCommittee: CommitteeWithMembership | null;
  setActiveCommittee: (c: CommitteeWithMembership | null) => void;
  refreshProfile: () => Promise<void>;
  refreshCommittees: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [committees, setCommittees] = useState<CommitteeWithMembership[]>([]);
  const [activeCommittee, setActiveCommittee] = useState<CommitteeWithMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data as Profile | null);
  }, []);

  const loadCommittees = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('committee_members')
      .select(`
        role,
        status,
        committee:committees(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (data) {
      const mapped: CommitteeWithMembership[] = data.map((item: any) => ({
        ...item.committee,
        role: item.role,
        member_status: item.status,
      }));
      setCommittees(mapped);
      if (mapped.length > 0 && !activeCommittee) {
        setActiveCommittee(mapped[0]);
      }
    } else {
      setCommittees([]);
    }
  }, [activeCommittee]);

  // Claim any pending invitations (and super-admin status) first, then load everything.
  const bootstrap = useCallback(async (userId: string) => {
    await supabase.rpc('claim_invitations');
    const { data: admin } = await supabase.rpc('is_platform_admin');
    setIsPlatformAdmin(admin === true);
    await Promise.all([loadProfile(userId), loadCommittees(userId)]);
  }, [loadProfile, loadCommittees]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const refreshCommittees = useCallback(async () => {
    if (user) await loadCommittees(user.id);
  }, [user, loadCommittees]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore network errors; we still clear the local session below
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setCommittees([]);
      setActiveCommittee(null);
      setIsPlatformAdmin(false);
      window.location.hash = '/';
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        bootstrap(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await bootstrap(session.user.id);
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setCommittees([]);
        setActiveCommittee(null);
        setIsPlatformAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isPlatformAdmin,
        committees,
        activeCommittee,
        setActiveCommittee,
        refreshProfile,
        refreshCommittees,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
