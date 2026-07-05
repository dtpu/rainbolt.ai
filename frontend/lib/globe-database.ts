import { supabase } from "./supabase";

// ── Serialization helpers ──────────────────────────────────────────────────
// Session data is a map of key -> JSON-stringified value (the zustand persist
// layer writes whole stores as single keys). Stored as-is inside a jsonb
// column, so the shape survives the Firestore -> Postgres move unchanged.

export const serializeSessionData = (data: any): Record<string, string> => {
  const serialized: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) {
      serialized[key] = JSON.stringify(value);
    }
  }
  return serialized;
};

export const deserializeSessionData = (
  serializedData: Record<string, string>,
): any => {
  const deserialized: any = {};
  for (const [key, value] of Object.entries(serializedData)) {
    if (typeof value !== "string") {
      deserialized[key] = value;
      continue;
    }
    try {
      deserialized[key] = JSON.parse(value);
    } catch {
      deserialized[key] = value;
    }
  }
  return deserialized;
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface GlobeSession {
  id: string;
  userId: string;
  title: string;
  status: "active" | "completed";
  createdAt: any;
  updatedAt: any;
  lastAccessedAt: any;
  data: Record<string, string>;
}

export interface GlobeSessionWithData {
  id: string;
  userId: string;
  title: string;
  status: "active" | "completed";
  createdAt: any;
  updatedAt: any;
  lastAccessedAt: any;
  data: any;
}

interface SessionRow {
  id: string;
  user_id: string;
  title: string;
  status: string;
  data: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

const rowToSession = (r: SessionRow): GlobeSessionWithData => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  status: (r.status as "active" | "completed") ?? "active",
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  lastAccessedAt: r.last_accessed_at,
  data: deserializeSessionData(r.data ?? {}),
});

// ── Globe sessions ─────────────────────────────────────────────────────────

export const createGlobeSession = async (userId: string, title: string) => {
  try {
    const sessionId = `globe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await supabase.from("globe_sessions").insert({
      id: sessionId,
      user_id: userId,
      title,
      status: "active",
      data: {},
    });
    if (error) throw error;
    return { success: true, id: sessionId };
  } catch (error) {
    console.error("Error creating globe session:", error);
    return { success: false, error: (error as Error).message };
  }
};

export const getGlobeSession = async (
  sessionId: string,
): Promise<GlobeSessionWithData | null> => {
  try {
    const { data, error } = await supabase
      .from("globe_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToSession(data as SessionRow) : null;
  } catch (error) {
    console.error("Error getting globe session:", error);
    return null;
  }
};

export const getUserGlobeSessions = async (
  userId: string,
): Promise<GlobeSessionWithData[]> => {
  try {
    const { data, error } = await supabase
      .from("globe_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as SessionRow[]).map(rowToSession);
  } catch (error) {
    console.error("Error getting user globe sessions:", error);
    return [];
  }
};

export const deleteGlobeSession = async (sessionId: string) => {
  try {
    const { error } = await supabase
      .from("globe_sessions")
      .delete()
      .eq("id", sessionId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error deleting globe session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const updateSessionData = async (sessionId: string, newData: any) => {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("globe_sessions")
      .update({
        data: serializeSessionData(newData),
        updated_at: now,
        last_accessed_at: now,
      })
      .eq("id", sessionId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error updating session data:", error);
    return { success: false, error: (error as Error).message };
  }
};

// Merge one key into the session's data map (read-modify-write; sessions are
// only ever written by their owner, so lost updates aren't a practical risk).
export const updateSessionDataKey = async (
  sessionId: string,
  key: string,
  value: any,
) => {
  try {
    const { data, error } = await supabase
      .from("globe_sessions")
      .select("data")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    const merged = { ...((data?.data as Record<string, string>) ?? {}), [key]: JSON.stringify(value) };
    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("globe_sessions")
      .update({ data: merged, updated_at: now, last_accessed_at: now })
      .eq("id", sessionId);
    if (upErr) throw upErr;
    return { success: true };
  } catch (error) {
    console.error("Error updating session data key:", error);
    return { success: false, error: (error as Error).message };
  }
};

export const addGlobeImage = async (
  sessionId: string,
  imageData: {
    imageUrl: string;
    location: { lat: number; lng: number };
    locationName?: string;
    userNote?: string;
  },
) => {
  try {
    const session = await getGlobeSession(sessionId);
    if (!session) return { success: false, error: "Session not found" };
    const newImage = {
      id: `img_${Date.now()}`,
      ...imageData,
      timestamp: new Date().toISOString(),
    };
    const images = Array.isArray(session.data?.globeImages)
      ? session.data.globeImages
      : [];
    const result = await updateSessionDataKey(sessionId, "globeImages", [
      ...images,
      newImage,
    ]);
    return result.success
      ? { success: true, imageId: newImage.id }
      : { success: false, error: result.error };
  } catch (error) {
    console.error("Error adding globe image:", error);
    return { success: false, error: (error as Error).message };
  }
};

// ── Session links (constellation edges between related sessions) ──────────

export interface SessionLink {
  id: string;
  userId: string;
  fromSessionId: string;
  toSessionId: string;
  createdAt: any;
  updatedAt?: any;
  linkType?: "related" | "sequential" | "reference";
  description?: string;
}

interface LinkRow {
  id: string;
  user_id: string;
  from_session_id: string;
  to_session_id: string;
  link_type: string;
  description: string | null;
  created_at: string;
}

const rowToLink = (r: LinkRow): SessionLink => ({
  id: r.id,
  userId: r.user_id,
  fromSessionId: r.from_session_id,
  toSessionId: r.to_session_id,
  linkType: (r.link_type as SessionLink["linkType"]) ?? "related",
  description: r.description ?? undefined,
  createdAt: r.created_at,
});

export const createSessionLink = async (
  userId: string,
  fromSessionId: string,
  toSessionId: string,
  linkType: "related" | "sequential" | "reference" = "related",
  description?: string,
): Promise<{ success: boolean; linkId?: string; error?: string }> => {
  try {
    const linkId = `link_${fromSessionId}_${toSessionId}_${Date.now()}`;
    const { error } = await supabase.from("session_links").insert({
      id: linkId,
      user_id: userId,
      from_session_id: fromSessionId,
      to_session_id: toSessionId,
      link_type: linkType,
      description: description?.trim() || null,
    });
    if (error) throw error;
    return { success: true, linkId };
  } catch (error) {
    console.error("Error creating session link:", error);
    return { success: false, error: (error as Error).message };
  }
};

export const getUserSessionLinks = async (
  userId: string,
): Promise<SessionLink[]> => {
  try {
    const { data, error } = await supabase
      .from("session_links")
      .select("*")
      .eq("user_id", userId);
    if (error) throw error;
    return ((data ?? []) as LinkRow[]).map(rowToLink);
  } catch (error) {
    console.error("Error fetching user session links:", error);
    return [];
  }
};

export const deleteSessionLink = async (
  linkId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from("session_links")
      .delete()
      .eq("id", linkId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error deleting session link:", error);
    return { success: false, error: (error as Error).message };
  }
};

export const deleteSessionLinks = async (
  sessionId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from("session_links")
      .delete()
      .or(`from_session_id.eq.${sessionId},to_session_id.eq.${sessionId}`);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error deleting session links:", error);
    return { success: false, error: (error as Error).message };
  }
};

// ── Legacy user-profile shims ──────────────────────────────────────────────
// The Auth0 era kept a userSessions collection mapping external ids to app
// users. Supabase's auth.uid() IS the app user id, so these are no-ops kept
// only so the old UserProvider keeps compiling; nothing calls them with
// meaningful input anymore.

export interface UserSession {
  id: string;
  userId: string;
  auth0Id: string;
  email: string;
  displayName: string;
  profilePicture?: string;
  sessionIds?: string[];
  createdAt: any;
  lastActive: any;
}

export const createUserSession = async (
  userData: Omit<UserSession, "id" | "createdAt" | "lastActive">,
) => ({ success: true, id: userData.userId });

export const getUserSession = async (_userId: string): Promise<UserSession | null> => null;

export const getUserByAuth0Id = async (_id: string): Promise<UserSession | null> => null;

export const updateUserLastActive = async (_userId: string) => ({ success: true });

export const getUserSessionIds = async (_userId: string): Promise<string[]> => [];
