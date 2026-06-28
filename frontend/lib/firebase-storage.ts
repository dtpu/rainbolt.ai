import { StateStorage } from "zustand/middleware";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

interface FirebaseStorageOptions {
  getUserId: () => string | null;
  getSessionId?: () => string | null;
  collectionName?: string;
}

/**
 * Creates a Zustand storage that syncs with Firebase Firestore
 * Falls back to localStorage if Firebase is unavailable or user is not authenticated
 */
export function createFirebaseStorage(
  options: FirebaseStorageOptions,
): StateStorage {
  const { getUserId, getSessionId, collectionName = "globeSessions" } = options;

  // Create a queue for pending writes to avoid overwhelming Firebase
  let writeQueue: Array<{ key: string; value: string }> = [];
  let writeTimer: NodeJS.Timeout | null = null;

  const processWriteQueue = async () => {
    if (writeQueue.length === 0) return;

    const userId = getUserId();
    const sessionId = getSessionId ? getSessionId() : null;

    if (!userId || userId.startsWith("guest-")) {
      // Guests use localStorage only — Firestore rules reject guest IDs.
      if (typeof window !== "undefined") {
        writeQueue.forEach(({ key, value }) => {
          try {
            localStorage.setItem(key, value);
          } catch (e) {
            console.error("Error writing to localStorage:", e);
          }
        });
      }
      writeQueue = [];
      return;
    }

    // Batch all queued writes
    const updates = writeQueue.reduce(
      (acc, { key, value }) => {
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    writeQueue = [];

    try {
      if (sessionId && collectionName === "globeSessions") {
        // Save to globeSessions with data in the data map field
        const docRef = doc(db, collectionName, sessionId);

        // First check if the document exists
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          // Update existing session - merge into data field
          // Parse and sanitize the value to ensure it's Firestore-compatible
          const key = Object.keys(updates)[0];
          const value = Object.values(updates)[0];

          // Try to parse the value and remove any non-serializable properties
          let sanitizedValue = value;
          try {
            const parsed = JSON.parse(value);
            // Remove any circular references or non-serializable data
            sanitizedValue = JSON.stringify(parsed);
          } catch (e) {
            // If parsing fails, value is already a simple string
            console.warn("[Firebase Storage] Value is not JSON, using as-is");
          }

          await updateDoc(docRef, {
            [`data.${key}`]: sanitizedValue,
            updatedAt: serverTimestamp(),
            lastAccessedAt: serverTimestamp(),
          });
        } else {
          // Create new session document
          await setDoc(docRef, {
            userId,
            title: "Chat Session",
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastAccessedAt: serverTimestamp(),
            data: updates,
          });

          // Add sessionId to user's sessionIds array
          try {
            const userDocRef = doc(db, "userSessions", userId);
            await updateDoc(userDocRef, {
              sessionIds: arrayUnion(sessionId),
            });
          } catch (error) {
            console.error(
              "[Firebase Storage] Error updating user sessionIds:",
              error,
            );
          }
        }
      } else {
        // Fallback to old behavior for other collections
        const docRef = doc(db, collectionName, userId);
        await setDoc(docRef, updates, { merge: true });
      }
    } catch (error) {
      console.error("[Firebase Storage] Error syncing to Firebase:", error);
      // Fall back to localStorage (browser only)
      if (typeof window !== "undefined") {
        Object.entries(updates).forEach(([key, value]) => {
          try {
            localStorage.setItem(key, value);
          } catch (e) {
            console.error("Error writing to localStorage:", e);
          }
        });
      }
    }
  };

  return {
    getItem: async (name: string): Promise<string | null> => {
      const userId = getUserId();

      // Try localStorage first (synchronous, faster) - only in browser
      if (typeof window !== "undefined") {
        try {
          const localValue = localStorage.getItem(name);
          if (localValue) {
            return localValue;
          }
        } catch (e) {
          console.error("Error reading from localStorage:", e);
        }
      }

      // If user is authenticated (not a guest), try Firebase
      if (userId && !userId.startsWith("guest-")) {
        try {
          const sessionId = getSessionId ? getSessionId() : null;

          if (sessionId && collectionName === "globeSessions") {
            // Read from globeSessions data field
            const docRef = doc(db, collectionName, sessionId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              const sessionData = docSnap.data();
              const dataMap = sessionData.data || {};
              const value = dataMap[name];

              if (value) {
                // Cache in localStorage for faster subsequent loads (browser only)
                if (typeof window !== "undefined") {
                  try {
                    localStorage.setItem(name, value);
                  } catch (e) {
                    console.error("Error caching to localStorage:", e);
                  }
                }
                return value;
              }
            }
          } else {
            // Fallback to old behavior
            const docRef = doc(db, collectionName, userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              const data = docSnap.data();
              const value = data[name];

              if (value) {
                // Cache in localStorage for faster subsequent loads (browser only)
                if (typeof window !== "undefined") {
                  try {
                    localStorage.setItem(name, value);
                  } catch (e) {
                    console.error("Error caching to localStorage:", e);
                  }
                }
                return value;
              }
            }
          }
        } catch (error) {
          console.error(
            "[Firebase Storage] Error reading from Firebase:",
            error,
          );
        }
      }

      return null;
    },

    setItem: async (name: string, value: string): Promise<void> => {
      // Always write to localStorage immediately (synchronous backup) - only in browser
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(name, value);
        } catch (e) {
          console.error("Error writing to localStorage:", e);
        }
      }

      // Queue write to Firebase (debounced to avoid too many writes)
      writeQueue.push({ key: name, value });

      // Clear existing timer
      if (writeTimer) {
        clearTimeout(writeTimer);
      }

      // Set new timer to batch writes
      writeTimer = setTimeout(() => {
        processWriteQueue();
        writeTimer = null;
      }, 1000); // Wait 1 second before syncing to Firebase
    },

    removeItem: async (name: string): Promise<void> => {
      const userId = getUserId();
      const sessionId = getSessionId ? getSessionId() : null;

      // Remove from localStorage - only in browser
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(name);
        } catch (e) {
          console.error("Error removing from localStorage:", e);
        }
      }

      // Remove from Firebase if authenticated (not a guest)
      if (userId && !userId.startsWith("guest-")) {
        try {
          if (sessionId && collectionName === "globeSessions") {
            // Remove from globeSessions data field
            const docRef = doc(db, collectionName, sessionId);
            await updateDoc(docRef, {
              [`data.${name}`]: null,
              updatedAt: serverTimestamp(),
            });
          } else {
            // Fallback to old behavior
            const docRef = doc(db, collectionName, userId);
            await setDoc(docRef, { [name]: null }, { merge: true });
          }
        } catch (error) {
          console.error(
            "[Firebase Storage] Error removing from Firebase:",
            error,
          );
        }
      }
    },
  };
}
