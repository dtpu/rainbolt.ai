"use client";

import { useEffect } from "react";
import { useAuth0Firebase } from "@/hooks/useAuth0Firebase";
import { setCurrentUserId } from "@/lib/user-context";
import { useChatStore } from "@/components/useChatStore";

/**
 * Publishes the current user id into the global user context so non-React
 * code (the zustand storage adapter) can read it. Mounted once at the root.
 * Also wipes the shared localStorage chat state when the identity changes,
 * so on a shared browser one person never sees the previous person's chats.
 */
export function UserIdSync() {
  const { firebaseUserId } = useAuth0Firebase();

  useEffect(() => {
    setCurrentUserId(firebaseUserId);
    if (!firebaseUserId) return; // auth still resolving
    try {
      const prev = localStorage.getItem("rainbolt-last-user");
      if (prev && prev !== firebaseUserId) {
        localStorage.removeItem("rainbolt-chat-storage");
        useChatStore.getState().clear();
      }
      localStorage.setItem("rainbolt-last-user", firebaseUserId);
    } catch {
      /* private mode etc. - nothing to leak from localStorage then */
    }
  }, [firebaseUserId]);

  // This component doesn't render anything
  return null;
}
