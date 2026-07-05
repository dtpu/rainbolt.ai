"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// A stable per-browser id for signed-out visitors, so guests (e.g. interviewers)
// get the full app - create sessions, upload, chat - without an account. Their
// data lives in localStorage under this id, separate from real accounts.
function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "guest";
  let id = window.localStorage.getItem("rainbolt-guest-id");
  if (!id) {
    const rand =
      window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    id = `guest-${rand}`;
    window.localStorage.setItem("rainbolt-guest-id", id);
  }
  return id;
}

export interface AppUser {
  /** Supabase auth user id (uuid) - doubles as the database user_id. */
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

function mapUser(u: User | null | undefined): AppUser | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, string | undefined>;
  return {
    sub: u.id,
    email: u.email ?? "",
    name: meta.full_name || meta.name || u.email?.split("@")[0] || "Explorer",
    picture: meta.avatar_url || meta.picture,
  };
}

/**
 * Auth state for the whole app, backed by Supabase Auth. Keeps the historical
 * name/shape from the Auth0+Firebase era so call sites didn't have to change:
 * `firebaseUserId` is the account's database id, or a per-browser guest id.
 */
export function useAuth0Firebase() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(mapUser(data.session?.user));
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(mapUser(session?.user));
      setIsLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    firebaseUserId: isLoading ? null : (user?.sub ?? getOrCreateGuestId()),
    isLoading,
    error: null as string | null,
  };
}
