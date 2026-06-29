import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createFirebaseStorage } from "@/lib/firebase-storage";
import { setCurrentSessionId } from "@/lib/session-context";

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
  type?: "status" | "normal";
  /** Optional attached image (e.g. a reference photo added from the Similar tab). */
  image?: string;
};

export type Marker = {
  latitude: number;
  longitude: number;
  accuracy: number;
  facts: string;
  name: string;
  mapillary_images?: string[];
};

type ChatState = {
  open: boolean;
  messages: Message[];
  sending: boolean;
  thinking: boolean;
  ws: WebSocket | null;
  sessionId: string | null;
  currentAssistantMessage: string;
  uploadedImageUrl: string | null;
  hasProcessedSession: boolean;
  markers: Marker[];
  currentMarker: number;
  send: (text: string) => Promise<void>;
  toggle: (value?: boolean) => void;
  clear: () => void;
  connectWebSocket: (sessionId: string) => Promise<void>;
  disconnectWebSocket: () => void;
  markSessionProcessed: (sessionId: string) => void;
  setMarkers: (markers: Marker[]) => void;
  addMarkers: (markers: Marker[]) => void;
  deleteMarker: (index: number) => void;
  setCurrentMarker: (index: number) => void;
  nextMarker: () => void;
  previousMarker: () => void;
};

type StoreApi = {
  get: () => ChatState;
  set: (
    partial: Partial<ChatState> | ((state: ChatState) => Partial<ChatState>),
  ) => void;
};

// The send() flow stashes its timeout on the socket so a later "complete"/"error"
// message can cancel it. Typed here instead of casting to any.
type SocketWithTimeout = WebSocket & {
  sendingTimeout?: ReturnType<typeof setTimeout>;
};

type CoordinatePayload = {
  latitude: number;
  longitude: number;
  accuracy: number;
  facts: string | string[];
  name?: string;
};

// The backend (FastAPI) is a separate service from the frontend, so the socket
// URL always comes from NEXT_PUBLIC_BACKEND_WS (baked in at build time), falling
// back to localhost for development.
function backendSocketUrl(sessionId: string): string {
  const base = process.env.NEXT_PUBLIC_BACKEND_WS || "ws://localhost:8000";
  return `${base}/ws/chat/${sessionId}`;
}

function clearSendingTimeout(ws: WebSocket | null) {
  const socket = ws as SocketWithTimeout | null;
  if (socket && socket.sendingTimeout) {
    clearTimeout(socket.sendingTimeout);
    delete socket.sendingTimeout;
  }
}

// Shared handler for every incoming socket message. Used by both the
// already-processed-session path and the new-session path.
function handleSocketMessage(event: MessageEvent, { get, set }: StoreApi) {
  const data = JSON.parse(event.data);
  const state = get();

  if (data.type === "status") {
    const statusMsg: Message = {
      id: `status-${Date.now()}`,
      role: "assistant",
      text: data.message,
      ts: Date.now(),
      type: "status",
    };
    set({ messages: [...state.messages, statusMsg], thinking: true });
  } else if (
    data.type === "reasoning_chunk" ||
    data.type === "chat_response_chunk"
  ) {
    const updatedText = state.currentAssistantMessage + data.text;
    set({ currentAssistantMessage: updatedText });

    const lastMessage = state.messages[state.messages.length - 1];
    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      lastMessage.type !== "status"
    ) {
      const updatedMessages = [...state.messages];
      updatedMessages[updatedMessages.length - 1] = {
        ...lastMessage,
        text: updatedText,
        type: "normal",
      };
      set({ messages: updatedMessages });
    } else {
      const newMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: updatedText,
        ts: Date.now(),
        type: "normal",
      };
      set({ messages: [...state.messages, newMessage] });
    }
  } else if (data.type === "coordinates") {
    try {
      let cleanedText = data.text;
      cleanedText = cleanedText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "");

      const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }

      const coordinates = JSON.parse(cleanedText);

      const newMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: `${coordinates.length} location(s) identified.`,
        ts: Date.now(),
        type: "status",
      };
      set({ messages: [...state.messages, newMessage] });

      const newMarkers: Marker[] = coordinates.map(
        (coord: CoordinatePayload) => ({
          latitude: coord.latitude,
          longitude: coord.longitude,
          accuracy: coord.accuracy / 100,
          facts: Array.isArray(coord.facts)
            ? coord.facts.join(". ")
            : coord.facts,
          name: coord.name || "Unknown Location",
        }),
      );

      const currentMarkers = get().markers;
      set({ markers: [...currentMarkers, ...newMarkers] });
    } catch (e) {
      console.error("Failed to parse coordinates:", e, "Raw data:", data.text);
    }
  } else if (data.type === "complete") {
    clearSendingTimeout(get().ws);
    set({ thinking: false, sending: false, currentAssistantMessage: "" });
  } else if (data.type === "error") {
    console.error("[WebSocket Error]:", data.message);
    clearSendingTimeout(get().ws);

    const errorMessage: Message = {
      id: `error-${Date.now()}`,
      role: "assistant",
      text: `Error: ${data.message}`,
      ts: Date.now(),
      type: "normal",
    };
    set({
      messages: [...state.messages, errorMessage],
      thinking: false,
      sending: false,
      currentAssistantMessage: "",
    });
  }
}

// Wire the shared message/error/close handlers onto a socket. onopen differs
// between the two connect paths, so it is set by the caller.
function attachSocketHandlers(
  ws: WebSocket,
  api: StoreApi,
  reject: (reason?: unknown) => void,
) {
  ws.onmessage = (event) => handleSocketMessage(event, api);

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    api.set({ thinking: false, sending: false });
    reject(error);
  };

  ws.onclose = () => {
    // Reconnection (if needed) is handled lazily on the next send.
    api.set({ thinking: false, sending: false, ws: null });
  };
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      open: false,
      messages: [],
      sending: false,
      thinking: false,
      ws: null,
      sessionId: null,
      currentAssistantMessage: "",
      uploadedImageUrl: null,
      hasProcessedSession: false,
      markers: [],
      currentMarker: 0,

      toggle: (value?: boolean) => {
        set((state) => ({
          open: value !== undefined ? value : !state.open,
        }));
      },

      markSessionProcessed: (sessionId: string) => {
        set({ sessionId, hasProcessedSession: true });
      },

      setMarkers: (markers: Marker[]) => {
        set({ markers, currentMarker: 0 });
      },

      addMarkers: (markers: Marker[]) => {
        const state = get();
        set({ markers: [...state.markers, ...markers] });
      },

      deleteMarker: (index: number) => {
        const state = get();
        if (index < 0 || index >= state.markers.length) return;

        const newMarkers = state.markers.filter((_, i) => i !== index);

        let newCurrentMarker = state.currentMarker;
        if (newMarkers.length === 0) {
          newCurrentMarker = 0;
        } else if (state.currentMarker >= newMarkers.length) {
          newCurrentMarker = newMarkers.length - 1;
        } else if (state.currentMarker > index) {
          newCurrentMarker = state.currentMarker - 1;
        }

        set({ markers: newMarkers, currentMarker: newCurrentMarker });
      },

      setCurrentMarker: (index: number) => {
        const state = get();
        if (index >= 0 && index < state.markers.length) {
          set({ currentMarker: index });
        }
      },

      nextMarker: () => {
        const state = get();
        if (state.markers.length === 0) return;
        set({
          currentMarker: (state.currentMarker + 1) % state.markers.length,
        });
      },

      previousMarker: () => {
        const state = get();
        if (state.markers.length === 0) return;
        set({
          currentMarker:
            state.currentMarker === 0
              ? state.markers.length - 1
              : state.currentMarker - 1,
        });
      },

      connectWebSocket: (sessionId: string) => {
        return new Promise<void>((resolve, reject) => {
          const state = get();

          // Already connected to this session.
          if (state.ws && state.sessionId === sessionId) {
            resolve();
            return;
          }

          // If this session already has data (e.g. opened from the learning
          // page), connect for chat but skip re-processing the image.
          const hasExistingData =
            state.markers.length > 0 || state.messages.length > 0;
          const shouldSkipProcessing =
            (state.sessionId === sessionId && state.hasProcessedSession) ||
            hasExistingData;

          if (shouldSkipProcessing) {
            const ws = new WebSocket(backendSocketUrl(sessionId));
            ws.onopen = () => {
              set({ sessionId, ws, hasProcessedSession: true });
              resolve();
            };
            attachSocketHandlers(ws, { get, set }, reject);
            return;
          }

          // New session: mark processed immediately to avoid double connections.
          set({ sessionId, hasProcessedSession: true });

          const ws = new WebSocket(backendSocketUrl(sessionId));
          ws.onopen = () => {
            set({ thinking: true, ws });
            ws.send(
              JSON.stringify({ type: "process_image", session_id: sessionId }),
            );
            // Give the message a moment to flush before resolving.
            setTimeout(() => resolve(), 50);
          };
          attachSocketHandlers(ws, { get, set }, reject);
        });
      },

      disconnectWebSocket: () => {
        const { ws } = get();
        if (ws) {
          ws.close();
          set({ ws: null, thinking: false, sending: false });
        }
      },

      send: async (text: string) => {
        const state = get();

        if (!text.trim() || state.sending) {
          return;
        }

        // Reconnect if the socket dropped but we still have a session.
        if (!state.ws && state.sessionId) {
          try {
            await get().connectWebSocket(state.sessionId);
          } catch (error) {
            console.error("Failed to reconnect WebSocket:", error);
            const errorMessage: Message = {
              id: `error-${Date.now()}`,
              role: "assistant",
              text: "Connection lost. Please refresh the page to continue.",
              ts: Date.now(),
              type: "normal",
            };
            set({ messages: [...state.messages, errorMessage] });
            return;
          }
        }

        const currentState = get();
        if (!currentState.ws) {
          return;
        }

        const userMessage: Message = {
          id: `user-${Date.now()}`,
          role: "user",
          text: text.trim(),
          ts: Date.now(),
          type: "normal",
        };

        const freshStateForMessage = get();
        set({
          messages: [...freshStateForMessage.messages, userMessage],
          sending: true,
          thinking: true,
          currentAssistantMessage: "",
        });

        // Reset the sending flag if no response arrives within 30 seconds.
        const sendingTimeout = setTimeout(() => {
          console.warn("Message send timeout - resetting sending flag");
          set({ sending: false, thinking: false });
        }, 30000);

        try {
          const freshState = get();
          const sessionId = freshState.sessionId;

          if (!sessionId) {
            clearTimeout(sendingTimeout);
            throw new Error("No session ID available");
          }

          if (!freshState.ws) {
            clearTimeout(sendingTimeout);
            throw new Error("WebSocket not connected");
          }

          const chatMessage = {
            type: "chat_message",
            text: text.trim(),
            session_id: sessionId,
            history: freshState.messages.map((msg) => ({
              role: msg.role,
              text: msg.text,
            })),
          };

          freshState.ws.send(JSON.stringify(chatMessage));

          // Stash the timeout so an incoming response can cancel it.
          (freshState.ws as SocketWithTimeout).sendingTimeout = sendingTimeout;
        } catch (error) {
          console.error("Failed to send message:", error);
          clearTimeout(sendingTimeout);
          set({ sending: false, thinking: false });
        }
      },

      clear: () => {
        set({
          messages: [],
          currentAssistantMessage: "",
          uploadedImageUrl: null,
          hasProcessedSession: false,
          markers: [],
          currentMarker: 0,
        });
      },
    }),
    {
      name: "rainbolt-chat-storage",
      storage: createJSONStorage(() =>
        createFirebaseStorage({
          getUserId: () => {
            // Imported dynamically to avoid a circular dependency.
            const { getCurrentUserId } = require("@/lib/user-context");
            return getCurrentUserId();
          },
          getSessionId: () => {
            // Imported dynamically to avoid a circular dependency.
            const { getCurrentSessionId } = require("@/lib/session-context");
            return getCurrentSessionId();
          },
          collectionName: "globeSessions",
        }),
      ),
      partialize: (state) => {
        // Keep the global session context in sync as the session id changes.
        setCurrentSessionId(state.sessionId);

        // Persist only serializable data (no WebSocket instance).
        return {
          messages: state.messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            text: msg.text,
            ts: msg.ts,
            type: msg.type,
          })),
          sessionId: state.sessionId,
          uploadedImageUrl: state.uploadedImageUrl,
          hasProcessedSession: state.hasProcessedSession,
          markers: state.markers.map((marker) => ({
            latitude: marker.latitude,
            longitude: marker.longitude,
            accuracy: marker.accuracy,
            facts: marker.facts,
            name: marker.name,
            mapillary_images: marker.mapillary_images,
          })),
          currentMarker: state.currentMarker,
        };
      },
    },
  ),
);
