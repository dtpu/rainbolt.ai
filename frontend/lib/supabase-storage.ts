import { StateStorage } from "zustand/middleware";
import { supabase } from "./supabase";

interface SupabaseStorageOptions {
  getUserId: () => string | null;
  getSessionId?: () => string | null;
}

/**
 * Zustand storage that syncs each persisted key into the current session's
 * jsonb `data` map in Postgres (globe_sessions.data[key] = JSON string).
 * Guests never touch the network: their state lives in localStorage only.
 * localStorage doubles as a synchronous cache for signed-in users.
 */
export function createSupabaseStorage(
  options: SupabaseStorageOptions,
): StateStorage {
  const { getUserId, getSessionId } = options;

  const isGuest = () => {
    const uid = getUserId();
    return !uid || uid.startsWith("guest-");
  };

  // Debounced write queue so streaming chat doesn't hammer the database.
  let writeQueue: Array<{ key: string; value: string }> = [];
  let writeTimer: ReturnType<typeof setTimeout> | null = null;

  const processWriteQueue = async () => {
    if (writeQueue.length === 0) return;
    const batch = writeQueue;
    writeQueue = [];
    if (isGuest()) return; // localStorage already has it

    const sessionId = getSessionId?.() ?? null;
    const userId = getUserId();
    if (!sessionId || !userId) return;

    try {
      const { data, error } = await supabase
        .from("globe_sessions")
        .select("data")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) throw error;

      const merged: Record<string, string> = {
        ...((data?.data as Record<string, string>) ?? {}),
      };
      for (const { key, value } of batch) merged[key] = value;
      const now = new Date().toISOString();

      if (data) {
        const { error: upErr } = await supabase
          .from("globe_sessions")
          .update({ data: merged, updated_at: now, last_accessed_at: now })
          .eq("id", sessionId);
        if (upErr) throw upErr;
      } else {
        // Session row doesn't exist yet (e.g. chat opened before create
        // finished) - create it so the state isn't lost.
        const { error: insErr } = await supabase.from("globe_sessions").insert({
          id: sessionId,
          user_id: userId,
          title: "Chat Session",
          status: "active",
          data: merged,
        });
        if (insErr) throw insErr;
      }
    } catch (error) {
      console.error("[Supabase Storage] Error syncing:", error);
      // localStorage already holds the state, so nothing is lost locally.
    }
  };

  return {
    getItem: async (name: string): Promise<string | null> => {
      // localStorage first: synchronous cache and the guest source of truth.
      if (typeof window !== "undefined") {
        try {
          const local = localStorage.getItem(name);
          if (local) return local;
        } catch {
          /* ignore */
        }
      }

      if (isGuest()) return null;
      const sessionId = getSessionId?.() ?? null;
      if (!sessionId) return null;

      try {
        const { data, error } = await supabase
          .from("globe_sessions")
          .select("data")
          .eq("id", sessionId)
          .maybeSingle();
        if (error) throw error;
        const value = (data?.data as Record<string, string>)?.[name];
        if (value && typeof window !== "undefined") {
          try {
            localStorage.setItem(name, value);
          } catch {
            /* ignore */
          }
        }
        return value ?? null;
      } catch (error) {
        console.error("[Supabase Storage] Error reading:", error);
        return null;
      }
    },

    setItem: async (name: string, value: string): Promise<void> => {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(name, value);
        } catch {
          /* ignore */
        }
      }
      writeQueue.push({ key: name, value });
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = setTimeout(() => {
        processWriteQueue();
        writeTimer = null;
      }, 1000);
    },

    removeItem: async (name: string): Promise<void> => {
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(name);
        } catch {
          /* ignore */
        }
      }
      if (isGuest()) return;
      const sessionId = getSessionId?.() ?? null;
      if (!sessionId) return;
      try {
        const { data } = await supabase
          .from("globe_sessions")
          .select("data")
          .eq("id", sessionId)
          .maybeSingle();
        if (!data) return;
        const merged = { ...((data.data as Record<string, string>) ?? {}) };
        delete merged[name];
        await supabase
          .from("globe_sessions")
          .update({ data: merged, updated_at: new Date().toISOString() })
          .eq("id", sessionId);
      } catch (error) {
        console.error("[Supabase Storage] Error removing:", error);
      }
    },
  };
}
