import { useState, useEffect } from "react";
import {
  SessionLink,
  createSessionLink,
  getUserSessionLinks,
  deleteSessionLink,
} from "@/lib/globe-database";
import { useAuth0Firebase } from "./useAuth0Firebase";

export const useSessionLinks = () => {
  const { firebaseUserId } = useAuth0Firebase();
  const [links, setLinks] = useState<SessionLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Load links from database
  const loadLinks = async () => {
    // Guests aren't authenticated to Firebase; skip Firestore (which denies the
    // read) and rely on the demo links instead.
    if (!firebaseUserId || firebaseUserId.startsWith("guest-")) {
      setLinks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userLinks = await getUserSessionLinks(firebaseUserId);
      setLinks(userLinks);
    } catch (error) {
      console.error("Error loading session links:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load links when user changes
  useEffect(() => {
    loadLinks();
  }, [firebaseUserId]);

  // Create a new link between sessions
  const createLink = async (
    fromSessionId: string,
    toSessionId: string,
    linkType: "related" | "sequential" | "reference" = "related",
    description?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!firebaseUserId) {
      return { success: false, error: "User not authenticated" };
    }

    // Check if link already exists
    const existingLink = links.find(
      (link) =>
        (link.fromSessionId === fromSessionId &&
          link.toSessionId === toSessionId) ||
        (link.fromSessionId === toSessionId &&
          link.toSessionId === fromSessionId),
    );

    if (existingLink) {
      return {
        success: false,
        error: "Link already exists between these sessions",
      };
    }

    try {
      const result = await createSessionLink(
        firebaseUserId,
        fromSessionId,
        toSessionId,
        linkType,
        description && description.trim() !== "" ? description : undefined,
      );

      if (result.success && result.linkId) {
        // Add the new link to local state
        const newLink: SessionLink = {
          id: result.linkId,
          userId: firebaseUserId,
          fromSessionId,
          toSessionId,
          linkType,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Only add description if it's provided
        if (description && description.trim() !== "") {
          newLink.description = description;
        }

        setLinks((prev) => [...prev, newLink]);
      }

      return result;
    } catch (error) {
      console.error("Error creating session link:", error);
      return { success: false, error: (error as Error).message };
    }
  };

  // Delete a link
  const removeLink = async (
    linkId: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await deleteSessionLink(linkId);

      if (result.success) {
        // Remove from local state
        setLinks((prev) => prev.filter((link) => link.id !== linkId));
      }

      return result;
    } catch (error) {
      console.error("Error deleting session link:", error);
      return { success: false, error: (error as Error).message };
    }
  };

  // Get all links involving a specific session
  const getSessionLinks = (sessionId: string): SessionLink[] => {
    return links.filter(
      (link) =>
        link.fromSessionId === sessionId || link.toSessionId === sessionId,
    );
  };

  // Get connected session IDs for a given session
  const getConnectedSessions = (sessionId: string): string[] => {
    return links.reduce((connected: string[], link) => {
      if (link.fromSessionId === sessionId) {
        connected.push(link.toSessionId);
      } else if (link.toSessionId === sessionId) {
        connected.push(link.fromSessionId);
      }
      return connected;
    }, []);
  };

  // Debug function to clear all links for testing
  const clearAllLinks = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!firebaseUserId) {
      return { success: false, error: "User not authenticated" };
    }

    try {
      const userLinks = await getUserSessionLinks(firebaseUserId);

      const deletePromises = userLinks.map((link) =>
        deleteSessionLink(link.id),
      );
      await Promise.all(deletePromises);

      // Clear local state
      setLinks([]);

      return { success: true };
    } catch (error) {
      console.error("Error clearing links:", error);
      return { success: false, error: (error as Error).message };
    }
  };

  return {
    links,
    loading,
    createLink,
    removeLink,
    getSessionLinks,
    getConnectedSessions,
    reloadLinks: loadLinks,
    clearAllLinks, // Debug function
  };
};
