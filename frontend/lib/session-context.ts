/**
 * Global session context module
 * Used to track the current chat session ID for Firebase storage
 */

let currentSessionId: string | null = null;

export const setCurrentSessionId = (sessionId: string | null) => {
    currentSessionId = sessionId;
};

export const getCurrentSessionId = (): string | null => {
    return currentSessionId;
};
