import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// Serialization helpers for session data
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
    try {
      deserialized[key] = JSON.parse(value);
    } catch (error) {
      console.warn(`Failed to parse session data for key "${key}":`, error);
      // If parsing fails, keep as string
      deserialized[key] = value;
    }
  }

  return deserialized;
};

// TypeScript interfaces for your data structures
export interface UserSession {
  id: string;
  userId: string;
  auth0Id: string; // Link to Auth0 user ID
  email: string;
  displayName: string;
  profilePicture?: string;
  sessionIds?: string[]; // Array of globe session IDs
  createdAt: any;
  lastActive: any;
}

// Globe Learning Session - focused on actual globe interactions
export interface GlobeSession {
  id: string;
  userId: string;
  title: string;
  status: "active" | "completed";
  createdAt: any;
  updatedAt: any;
  lastAccessedAt: any;

  // Serialized data stored as strings in database, deserialized as objects in memory
  data: Record<string, string>; // In database: strings
}

// Globe Session with deserialized data for use in components
export interface GlobeSessionWithData {
  id: string;
  userId: string;
  title: string;
  status: "active" | "completed";
  createdAt: any;
  updatedAt: any;
  lastAccessedAt: any;

  // Deserialized data as objects for use in application
  data: any; // In memory: objects
}

// User session management functions
export const createUserSession = async (
  userData: Omit<UserSession, "id" | "createdAt" | "lastActive">,
) => {
  try {
    const userSessionData = {
      ...userData,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    };

    const docRef = doc(collection(db, "userSessions"), userData.userId);
    await setDoc(docRef, userSessionData);

    return { success: true, id: userData.userId };
  } catch (error) {
    console.error("Error creating user session:", error);
    return { success: false, error: (error as Error).message };
  }
};

export const getUserSession = async (
  userId: string,
): Promise<UserSession | null> => {
  try {
    const docRef = doc(db, "userSessions", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as UserSession;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting user session:", error);
    return null;
  }
};

export const getUserByAuth0Id = async (
  auth0Id: string,
): Promise<UserSession | null> => {
  try {
    const q = query(
      collection(db, "userSessions"),
      where("auth0Id", "==", auth0Id),
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as UserSession;
    }
    return null;
  } catch (error) {
    console.error("Error getting user by Auth0 ID:", error);
    return null;
  }
};

export const updateUserLastActive = async (userId: string) => {
  try {
    const docRef = doc(db, "userSessions", userId);
    await updateDoc(docRef, {
      lastActive: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating last active:", error);
    return { success: false, error: (error as Error).message };
  }
};

export const getUserSessionIds = async (userId: string): Promise<string[]> => {
  try {
    const docRef = doc(db, "userSessions", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const userData = docSnap.data();
      return userData.sessionIds || [];
    }

    return [];
  } catch (error) {
    console.error("Error getting user session IDs:", error);
    return [];
  }
};

// Globe session management functions
export const createGlobeSession = async (userId: string, title: string) => {
  try {
    const sessionId = `globe_${userId}_${Date.now()}`;
    const globeSession: Omit<GlobeSession, "id"> = {
      userId,
      title,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastAccessedAt: serverTimestamp(),
      data: {},
    };

    const docRef = doc(collection(db, "globeSessions"), sessionId);
    await setDoc(docRef, globeSession);

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
    const docRef = doc(db, "globeSessions", sessionId);
    const sessionSnap = await getDoc(docRef);

    if (sessionSnap.exists()) {
      const sessionData = {
        id: sessionSnap.id,
        ...sessionSnap.data(),
      } as GlobeSession;

      // Deserialize the data field from strings to objects
      const deserializedSession: GlobeSessionWithData = {
        ...sessionData,
        data: deserializeSessionData(sessionData.data || {}),
      };

      return deserializedSession;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting globe session:", error);
    return null;
  }
};

export const getUserGlobeSessions = async (
  userId: string,
): Promise<GlobeSessionWithData[]> => {
  try {
    const q = query(
      collection(db, "globeSessions"),
      where("userId", "==", userId),
    );
    const querySnapshot = await getDocs(q);

    const sessions: GlobeSessionWithData[] = [];
    querySnapshot.forEach((doc) => {
      const sessionData = { id: doc.id, ...doc.data() } as GlobeSession;

      // Deserialize the data field from strings to objects
      const deserializedSession: GlobeSessionWithData = {
        ...sessionData,
        data: deserializeSessionData(sessionData.data || {}),
      };

      sessions.push(deserializedSession);
    });

    return sessions;
  } catch (error) {
    console.error("Error getting user globe sessions:", error);
    return [];
  }
};

export const deleteGlobeSession = async (sessionId: string) => {
  try {
    const sessionRef = doc(db, "globeSessions", sessionId);
    await deleteDoc(sessionRef);
    return { success: true };
  } catch (error) {
    console.error("Error deleting globe session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Update session data with automatic serialization
export const updateSessionData = async (sessionId: string, newData: any) => {
  try {
    const docRef = doc(db, "globeSessions", sessionId);

    // Serialize the data before storing
    const serializedData = serializeSessionData(newData);

    await updateDoc(docRef, {
      data: serializedData,
      updatedAt: serverTimestamp(),
      lastAccessedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating session data:", error);
    return { success: false, error: (error as Error).message };
  }
};

// Add or update a specific key in session data
export const updateSessionDataKey = async (
  sessionId: string,
  key: string,
  value: any,
) => {
  try {
    const docRef = doc(db, "globeSessions", sessionId);

    // Serialize the specific value
    const serializedValue = JSON.stringify(value);

    await updateDoc(docRef, {
      [`data.${key}`]: serializedValue,
      updatedAt: serverTimestamp(),
      lastAccessedAt: serverTimestamp(),
    });

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
    const docRef = doc(db, "globeSessions", sessionId);
    const sessionSnap = await getDoc(docRef);

    if (!sessionSnap.exists()) {
      return { success: false, error: "Session not found" };
    }

    const sessionData = sessionSnap.data() as GlobeSession;
    const newImage = {
      id: `img_${Date.now()}`,
      ...imageData,
      timestamp: new Date().toISOString(), // Use ISO string instead of serverTimestamp()
    };

    const currentImages = Array.isArray(sessionData.data?.globeImages)
      ? sessionData.data.globeImages
      : [];
    const updatedImages = [...currentImages, newImage];

    await updateDoc(docRef, {
      "data.globeImages": updatedImages,
      updatedAt: serverTimestamp(),
      lastAccessedAt: serverTimestamp(),
    });

    return { success: true, imageId: newImage.id };
  } catch (error) {
    console.error("Error adding globe image:", error);
    return { success: false, error: (error as Error).message };
  }
};

export const addChatMessage = async (
  sessionId: string,
  message: {
    role: "user" | "ai";
    message: string;
    relatedImage?: string;
  },
) => {
  try {
    const docRef = doc(db, "globeSessions", sessionId);
    const sessionSnap = await getDoc(docRef);

    if (!sessionSnap.exists()) {
      return { success: false, error: "Session not found" };
    }

    const sessionData = sessionSnap.data() as GlobeSession;
    const newMessage = {
      id: `chat_${Date.now()}`,
      ...message,
      timestamp: new Date().toISOString(), // Use ISO string instead of serverTimestamp()
    };

    const currentChatHistory = Array.isArray(sessionData.data?.chatHistory)
      ? sessionData.data.chatHistory
      : [];
    const updatedChatHistory = [...currentChatHistory, newMessage];

    await updateDoc(docRef, {
      "data.chatHistory": updatedChatHistory,
      updatedAt: serverTimestamp(),
      lastAccessedAt: serverTimestamp(),
    });

    return { success: true, messageId: newMessage.id };
  } catch (error) {
    console.error("Error adding chat message:", error);
    return { success: false, error: (error as Error).message };
  }
};

// Session Link Interface
export interface SessionLink {
  id: string;
  userId: string;
  fromSessionId: string;
  toSessionId: string;
  createdAt: any;
  updatedAt: any;
  linkType?: "related" | "sequential" | "reference"; // Optional categorization
  description?: string; // Optional description of the relationship
}

// Create a link between two sessions
export const createSessionLink = async (
  userId: string,
  fromSessionId: string,
  toSessionId: string,
  linkType: "related" | "sequential" | "reference" = "related",
  description?: string,
): Promise<{ success: boolean; linkId?: string; error?: string }> => {
  try {
    const linkId = `link_${fromSessionId}_${toSessionId}_${Date.now()}`;
    const linkRef = doc(db, "sessionLinks", linkId);

    const linkData: Partial<SessionLink> = {
      id: linkId,
      userId,
      fromSessionId,
      toSessionId,
      linkType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Only add description if it's provided and not undefined
    if (
      description !== undefined &&
      description !== null &&
      description.trim() !== ""
    ) {
      linkData.description = description;
    }

    await setDoc(linkRef, linkData);
    return { success: true, linkId };
  } catch (error) {
    console.error("Error creating session link:", error);
    return { success: false, error: (error as Error).message };
  }
};

// Get all links for a user
export const getUserSessionLinks = async (
  userId: string,
): Promise<SessionLink[]> => {
  try {
    const linksQuery = query(
      collection(db, "sessionLinks"),
      where("userId", "==", userId),
    );

    const linksSnapshot = await getDocs(linksQuery);

    const links = linksSnapshot.docs.map((doc) => {
      const data = doc.data() as SessionLink;
      return data;
    });

    return links;
  } catch (error) {
    console.error("Error fetching user session links:", error);
    return [];
  }
};

// Delete a session link
export const deleteSessionLink = async (
  linkId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    await deleteDoc(doc(db, "sessionLinks", linkId));
    return { success: true };
  } catch (error) {
    console.error("Error deleting session link:", error);
    return { success: false, error: (error as Error).message };
  }
};

// Delete all links related to a session (called when deleting a session)
export const deleteSessionLinks = async (
  sessionId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Find all links that involve this session
    const fromLinksQuery = query(
      collection(db, "sessionLinks"),
      where("fromSessionId", "==", sessionId),
    );
    const toLinksQuery = query(
      collection(db, "sessionLinks"),
      where("toSessionId", "==", sessionId),
    );

    const [fromSnapshot, toSnapshot] = await Promise.all([
      getDocs(fromLinksQuery),
      getDocs(toLinksQuery),
    ]);

    // Delete all found links
    const deletePromises = [
      ...fromSnapshot.docs.map((doc) => deleteDoc(doc.ref)),
      ...toSnapshot.docs.map((doc) => deleteDoc(doc.ref)),
    ];

    await Promise.all(deletePromises);
    return { success: true };
  } catch (error) {
    console.error("Error deleting session links:", error);
    return { success: false, error: (error as Error).message };
  }
};

// Migration function to convert old structure to new structure
export const migrateGlobeSessionData = async (sessionId: string) => {
  try {
    const docRef = doc(db, "globeSessions", sessionId);
    const sessionSnap = await getDoc(docRef);

    if (!sessionSnap.exists()) {
      return { success: false, error: "Session not found" };
    }

    const sessionData = sessionSnap.data();

    // Check if migration is needed (old structure has globeImages and chatHistory as top-level fields)
    if (
      sessionData.globeImages &&
      sessionData.chatHistory &&
      !sessionData.data
    ) {
      const migratedData: any = {
        ...sessionData,
        data: {
          globeImages: sessionData.globeImages || [],
          chatHistory: sessionData.chatHistory || [],
        },
      };

      // Remove old fields
      delete migratedData.globeImages;
      delete migratedData.chatHistory;

      await updateDoc(docRef, migratedData);

      return { success: true, message: "Session migrated successfully" };
    }

    return { success: true, message: "Session already using new structure" };
  } catch (error) {
    console.error("Error migrating session data:", error);
    return { success: false, error: (error as Error).message };
  }
};

// Helper function to ensure session has proper data structure
export const ensureSessionDataStructure = (session: any): GlobeSession => {
  // If session has old structure, convert it on the fly
  if (session.globeImages && session.chatHistory && !session.data) {
    return {
      ...session,
      data: {
        globeImages: session.globeImages || [],
        chatHistory: session.chatHistory || [],
      },
    };
  }

  // If session doesn't have data field at all, create empty one
  if (!session.data) {
    return {
      ...session,
      data: {},
    };
  }

  // Return session as-is since data is just a simple object
  return session;
};
