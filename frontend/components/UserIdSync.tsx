"use client";

import { useEffect } from "react";
import { useAuth0Firebase } from "@/hooks/useAuth0Firebase";
import { setCurrentUserId } from "@/lib/user-context";

/**
 * Publishes the current user id into the global user context so non-React
 * code (the zustand storage adapter) can read it. Mounted once at the root.
 */
export function UserIdSync() {
  const { firebaseUserId } = useAuth0Firebase();

  useEffect(() => {
    setCurrentUserId(firebaseUserId);
  }, [firebaseUserId]);

  // This component doesn't render anything
  return null;
}
