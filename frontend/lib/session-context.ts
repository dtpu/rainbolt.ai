/**
 * Global session id, kept in sync by the chat store, read by the storage
 * adapter to know which session row to write.
 */

let currentSessionId: string | null = null;

export const setCurrentSessionId = (sessionId: string | null) => {
  currentSessionId = sessionId;
};

export const getCurrentSessionId = (): string | null => {
  return currentSessionId;
};
