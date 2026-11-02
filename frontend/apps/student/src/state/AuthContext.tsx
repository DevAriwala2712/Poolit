import { api, setAuthTokenProvider, useStore } from "@poolit/domain";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import { otpErrorMessage } from "../lib/phone";
import { useProfile } from "./ProfileContext";

interface AuthContextValue {
  session: Session | null;
  /** True until the stored session (if any) has been read. */
  loading: boolean;
  phone: string | null;
  sendOtp: (e164: string) => Promise<{ error: string | null }>;
  verifyOtp: (e164: string, code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Student sign-in with an Indian mobile number + SMS one-time code
 * (Supabase Auth phone provider). Browsing stays open to everyone; placing
 * an order and viewing your orders need a session.
 *
 * On sign-in the local profile (name, hostel, block, room) is reconciled with
 * the server: the saved server profile wins if there is one, otherwise the
 * local one is uploaded. Must sit inside StoreProvider and ProfileProvider.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { refresh, hostels } = useStore();
  const { profile, update } = useProfile();

  // Latest values for the sign-in effect without re-subscribing.
  const profileRef = useRef(profile);
  const hostelsRef = useRef(hostels);
  const updateRef = useRef(update);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    profileRef.current = profile;
    hostelsRef.current = hostels;
    updateRef.current = update;
    refreshRef.current = refresh;
  }, [profile, hostels, update, refresh]);

  const syncProfile = useCallback(async () => {
    try {
      const me = await api.getMe();
      if (me.profile) {
        updateRef.current({
          name: me.profile.name,
          ...(me.profile.hostelId ? { hostelId: me.profile.hostelId } : {}),
          ...(me.profile.block ? { block: me.profile.block } : {}),
          ...(me.profile.room ? { room: me.profile.room } : {}),
        });
      } else {
        const p = profileRef.current;
        const knownHostel = hostelsRef.current.some((h) => h.id === p.hostelId);
        await api.updateMe({
          name: p.name.trim() || "Student",
          hostelId: knownHostel ? p.hostelId : undefined,
          block: p.block,
          room: p.room,
        });
      }
    } catch {
      // Non-fatal: ordering still works; the profile syncs on the next sign-in.
    }
  }, []);

  useEffect(() => {
    setAuthTokenProvider(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });

    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_IN") void syncProfile().then(() => refreshRef.current());
      if (event === "SIGNED_OUT") void refreshRef.current();
    });
    return () => sub.subscription.unsubscribe();
  }, [syncProfile]);

  // While signed in, save profile edits (name, hostel, block, room) to the
  // server, debounced, so they follow the student to another phone.
  const signedIn = Boolean(session);
  const { name, hostelId, block, room } = profile;
  useEffect(() => {
    if (!signedIn || !name.trim()) return;
    const id = setTimeout(() => {
      const knownHostel = hostelsRef.current.some((h) => h.id === hostelId);
      void api
        .updateMe({ name: name.trim(), hostelId: knownHostel ? hostelId : undefined, block, room })
        .catch(() => undefined);
    }, 800);
    return () => clearTimeout(id);
  }, [signedIn, name, hostelId, block, room]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      phone: session?.user.phone ? `+${session.user.phone.replace(/^\+/, "")}` : null,
      sendOtp: async (e164) => {
        const { error } = await supabase.auth.signInWithOtp({ phone: e164, options: { channel: "sms" } });
        return { error: error ? otpErrorMessage(error.message) : null };
      },
      verifyOtp: async (e164, code) => {
        const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: "sms" });
        return { error: error ? otpErrorMessage(error.message) : null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
