"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import {
  UserSession,
  getUserSession,
  createUserSession,
  updateUserLastActive,
  getUserByAuth0Id,
  getUserSessionIds as getSessionIdsFromDb,
} from "@/lib/globe-database";

interface UserContextType {
  user: UserSession | null;
  loading: boolean;
  error: string | null;
  createUser: (
    userData: Omit<UserSession, "id" | "createdAt" | "lastActive">,
  ) => Promise<boolean>;
  updateLastActive: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getUserSessionIds: () => Promise<string[]>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
  auth0User?: Record<string, unknown> & {
    sub: string;
    email?: string;
    name?: string;
    nickname?: string;
    picture?: string;
  };
}

export const UserProvider = ({ children, auth0User }: UserProviderProps) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize user session when Auth0 user is available
  useEffect(() => {
    const initializeUser = async () => {
      if (!auth0User) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // First, try to find existing user by Auth0 ID
        let existingUser = await getUserByAuth0Id(auth0User.sub);

        if (!existingUser) {
          // Create new user if doesn't exist
          const newUserData = {
            userId: auth0User.sub, // Use Auth0 sub as user ID
            auth0Id: auth0User.sub,
            email: auth0User.email || "",
            displayName: auth0User.name || auth0User.nickname || "Anonymous",
            profilePicture: auth0User.picture,
          };

          const result = await createUserSession(newUserData);
          if (result.success) {
            existingUser = await getUserSession(auth0User.sub);
          } else {
            throw new Error("Failed to create user session");
          }
        } else {
          // Update last active for existing user
          await updateUserLastActive(existingUser.id);
        }

        setUser(existingUser);
      } catch (err) {
        console.error("Error initializing user:", err);
        setError("Failed to initialize user session");
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, [auth0User]);

  const createUser = async (
    userData: Omit<UserSession, "id" | "createdAt" | "lastActive">,
  ): Promise<boolean> => {
    try {
      setError(null);
      const result = await createUserSession(userData);
      if (result.success) {
        const newUser = await getUserSession(userData.userId);
        setUser(newUser);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error creating user:", err);
      setError("Failed to create user");
      return false;
    }
  };

  const updateLastActive = async () => {
    if (!user) return;

    try {
      await updateUserLastActive(user.id);
    } catch (err) {
      console.error("Error updating last active:", err);
    }
  };

  const refreshUser = async () => {
    if (!user) return;

    try {
      const updatedUser = await getUserSession(user.id);
      setUser(updatedUser);
    } catch (err) {
      console.error("Error refreshing user:", err);
      setError("Failed to refresh user data");
    }
  };

  const getUserSessionIds = async (): Promise<string[]> => {
    if (!user) {
      console.warn("No user available to fetch session IDs");
      return [];
    }

    try {
      const sessionIds = await getSessionIdsFromDb(user.userId);
      return sessionIds;
    } catch (err) {
      console.error("Error fetching user session IDs:", err);
      return [];
    }
  };

  // Update last active every 5 minutes when user is active
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(
      () => {
        updateLastActive();
      },
      5 * 60 * 1000,
    ); // 5 minutes

    return () => clearInterval(interval);
  }, [user]);

  const value: UserContextType = {
    user,
    loading,
    error,
    createUser,
    updateLastActive,
    refreshUser,
    getUserSessionIds,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
