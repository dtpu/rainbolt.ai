/**
 * Global user id, set once auth resolves, read by the storage adapter
 * (which lives outside React).
 */
let currentUserId: string | null = null;

export const setCurrentUserId = (userId: string | null) => {
  currentUserId = userId;
};

export const getCurrentUserId = (): string | null => {
  return currentUserId;
};
