import { useEffect, useState } from "react";
import { useAuth0Firebase } from "./useAuth0Firebase";
import {
  createGlobeSession,
  getUserGlobeSessions,
  GlobeSessionWithData,
} from "@/lib/globe-database";

export function useGlobeSession(autoCreate: boolean = false) {
  const { user, firebaseUserId } = useAuth0Firebase();
  const [currentSession, setCurrentSession] =
    useState<GlobeSessionWithData | null>(null);
  const [sessions, setSessions] = useState<GlobeSessionWithData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUserId) {
      setLoading(false);
      return;
    }

    const loadSessions = async () => {
      try {
        const userSessions = await getUserGlobeSessions(firebaseUserId);
        setSessions(userSessions);

        // Get active session or create new one if autoCreate is true
        const activeSession = userSessions.find((s) => s.status === "active");

        if (activeSession) {
          setCurrentSession(activeSession);
        } else if (autoCreate) {
          // Create new session automatically
          const result = await createGlobeSession(
            firebaseUserId,
            `Session ${new Date().toLocaleDateString()}`,
          );

          if (result.success && result.id) {
            const newSession: GlobeSessionWithData = {
              id: result.id,
              userId: firebaseUserId,
              title: `Session ${new Date().toLocaleDateString()}`,
              status: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
              lastAccessedAt: new Date(),
              data: {},
            };
            setCurrentSession(newSession);
            setSessions([newSession, ...userSessions]);
          }
        }
      } catch (error) {
        console.error("Error loading sessions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [firebaseUserId, autoCreate]);

  const createNewSession = async (title?: string) => {
    if (!firebaseUserId) return null;

    const result = await createGlobeSession(
      firebaseUserId,
      title || `Session ${new Date().toLocaleDateString()}`,
    );

    if (result.success && result.id) {
      const newSession: GlobeSessionWithData = {
        id: result.id,
        userId: firebaseUserId,
        title: title || `Session ${new Date().toLocaleDateString()}`,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
        data: {},
      };
      setCurrentSession(newSession);
      setSessions([newSession, ...sessions]);
      return newSession;
    }

    return null;
  };

  return {
    user,
    firebaseUserId,
    currentSession,
    sessions,
    loading,
    createNewSession,
  };
}
