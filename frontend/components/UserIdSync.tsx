"use client";

import { useEffect } from "react";
import { useAuth0Firebase } from "@/hooks/useAuth0Firebase";
import { setCurrentUserId } from "@/lib/user-context";

/**
 * Firebase User Sync Component
 * This component sets up the global user ID for Firebase storage sync
 * Should be mounted at the root of the app
 */
export function FirebaseUserSync() {
  const { firebaseUserId } = useAuth0Firebase();

  useEffect(() => {
    setCurrentUserId(firebaseUserId);
  }, [firebaseUserId]);

  // This component doesn't render anything
  return null;
}
