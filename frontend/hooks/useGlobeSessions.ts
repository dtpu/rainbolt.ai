import { useState, useEffect } from "react";
import { useAuth0Firebase } from "./useAuth0Firebase";
import {
  getUserGlobeSessions,
  createGlobeSession,
  deleteGlobeSession,
  GlobeSessionWithData,
  updateSessionData,
  updateSessionDataKey,
} from "@/lib/globe-database";

export function useGlobeSessions() {
  const { firebaseUserId } = useAuth0Firebase();
  const [sessions, setSessions] = useState<GlobeSessionWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load sessions from database
  const loadSessions = async () => {
    // Guests (per-browser "guest-" id) aren't authenticated to Firebase, so
    // Firestore denies their reads ("Missing or insufficient permissions").
    // Skip the query and let the page fall back to the demo constellation.
    if (!firebaseUserId || firebaseUserId.startsWith("guest-")) {
      setSessions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const userSessions = await getUserGlobeSessions(firebaseUserId);
      setSessions(userSessions);
    } catch (err) {
      console.error("Error loading sessions:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Create a new session
  const createNewSession = async (title: string) => {
    if (!firebaseUserId) {
      throw new Error("User not authenticated");
    }

    try {
      const result = await createGlobeSession(firebaseUserId, title);

      if (result.success && result.id) {
        // Reload sessions to include the new one
        await loadSessions();
        return result.id;
      } else {
        throw new Error(result.error || "Failed to create session");
      }
    } catch (err) {
      console.error("Error creating session:", err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  // Delete a session
  const deleteSession = async (sessionId: string) => {
    try {
      const result = await deleteGlobeSession(sessionId);

      if (result.success) {
        // Remove from local state immediately for better UX
        setSessions((prev) =>
          prev.filter((session) => session.id !== sessionId),
        );
      } else {
        throw new Error(result.error || "Failed to delete session");
      }
    } catch (err) {
      console.error("Error deleting session:", err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  // Update session data
  const updateSessionDataWithRefresh = async (
    sessionId: string,
    newData: any,
  ) => {
    try {
      const result = await updateSessionData(sessionId, newData);

      if (result.success) {
        // Refresh sessions to reflect changes
        await loadSessions();
      } else {
        throw new Error(result.error || "Failed to update session data");
      }

      return result;
    } catch (err) {
      console.error("Error updating session data:", err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  // Update specific key in session data
  const updateSessionDataKeyWithRefresh = async (
    sessionId: string,
    key: string,
    value: any,
  ) => {
    try {
      const result = await updateSessionDataKey(sessionId, key, value);

      if (result.success) {
        // Refresh sessions to reflect changes
        await loadSessions();
      } else {
        throw new Error(result.error || "Failed to update session data key");
      }

      return result;
    } catch (err) {
      console.error("Error updating session data key:", err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  // Load sessions when user changes
  useEffect(() => {
    loadSessions();
  }, [firebaseUserId]);

  return {
    sessions,
    loading,
    error,
    createNewSession,
    deleteSession,
    updateSessionData: updateSessionDataWithRefresh,
    updateSessionDataKey: updateSessionDataKeyWithRefresh,
    refreshSessions: loadSessions,
  };
}
