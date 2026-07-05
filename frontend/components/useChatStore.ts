import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSupabaseStorage } from "@/lib/supabase-storage";
import { setCurrentSessionId } from "@/lib/session-context";

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
  type?: "status" | "normal";
  /** Optional attached image (e.g. a reference photo added from the Similar tab). */
  image?: string;
  /** Index into `markers`: renders a photo-evidence strip (nearby sourced
   *  photos + map link for that candidate) under the message. */
  evidenceIndex?: number;
};

export type GeoClue = {
  sign: string;
  implies: string;
  /** Where the clue sits on the analyzed photo, as width/height fractions;
   *  omitted = listed in the legend but not pinned on the image. */
  at?: [number, number];
};

export type Marker = {
  latitude: number;
  longitude: number;
  accuracy: number;
  facts: string;
  name: string;
  mapillary_images?: string[];
  /** Visual evidence the guess was built from: "clue -> what it implies". */
  clues?: GeoClue[];
  /** False for remote spots with no Google Street View coverage (hides the tab). */
  streetView?: boolean;
};

type ChatState = {
  open: boolean;
  /** Text queued for the composer (from the Places tab or a photo note):
   *  lands in the input ready to edit, never auto-sends. */
  draft: string;
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

// Where a fractional photo coordinate sits, in words the model can use.
function regionLabel(x: number, y: number): string {
  const v = y < 0.34 ? "top" : y < 0.67 ? "middle" : "bottom";
  const h = x < 0.34 ? "left" : x < 0.67 ? "center" : "right";
  return v === "middle" && h === "center" ? "center" : `${v} ${h}`;
}

// Annotations on the analyzed photo (the AI's numbered clue pins + the
// user's own notes from the Photo view), phrased as a context message so
// the model can answer "what about pin 2?" or "look at my note on the sign".
function annotationContext(sessionId: string | null, marker: Marker | undefined): string | null {
  if (!sessionId) return null;
  let notes: { x: number; y: number; text: string }[] = [];
  try {
    notes = JSON.parse(localStorage.getItem(`rainbolt-notes-${sessionId}`) ?? "[]");
  } catch {
    /* ignore */
  }
  const pins = marker?.clues?.filter((c) => c.at) ?? [];
  if (notes.length === 0 && pins.length === 0) return null;

  const lines: string[] = [];
  if (pins.length > 0) {
    lines.push(
      "Numbered clue pins on the analyzed photo: " +
        pins.map((c, i) => `#${i + 1} ${c.sign} (${regionLabel(c.at![0], c.at![1])})`).join("; "),
    );
  }
  if (notes.length > 0) {
    lines.push(
      "Notes I pinned on the photo myself: " +
        notes.map((n) => `"${n.text}" (${regionLabel(n.x, n.y)})`).join("; "),
    );
  }
  return `For reference, the analyzed photo is annotated. ${lines.join(". ")}. If I mention a pin number or one of my notes, use this to know what and where it is.`;
}

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
      if (!Array.isArray(coordinates) || coordinates.length === 0) {
        throw new Error("Empty coordinates payload");
      }

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

      // Show the work: attach nearby sourced photos for the top new candidate
      // so the guess is checkable in-chat, not just a name on the globe.
      if (newMarkers.length > 0) {
        const st = get();
        const evidenceMsg: Message = {
          id: `evidence-${Date.now()}`,
          role: "assistant",
          text: `Reference imagery near ${newMarkers[0].name}:`,
          ts: Date.now(),
          type: "normal",
          evidenceIndex: currentMarkers.length,
        };
        set({ messages: [...st.messages, evidenceMsg] });
      }
    } catch (e) {
      console.error("Failed to parse coordinates:", e, "Raw data:", data.text);
      // Surface it - a silent failure here looks like the app just froze.
      const failMsg: Message = {
        id: `coord-fail-${Date.now()}`,
        role: "assistant",
        text: "I couldn't pin down usable coordinates from that pass. Ask me to try again - e.g. \"give me your best guesses\".",
        ts: Date.now(),
        type: "normal",
      };
      set({ messages: [...get().messages, failMsg] });
    }
  } else if (data.type === "clues") {
    // The backend pinned the visual clues it used onto the photo. Attach them
    // to every candidate (the photo - and its clues - are shared), replacing
    // any previous set so a revised guess re-pins the image live.
    try {
      const parsed = JSON.parse(data.text);
      if (!Array.isArray(parsed)) throw new Error("clues payload is not a list");
      const clues: GeoClue[] = parsed
        .filter((c) => c && typeof c.sign === "string" && c.sign.trim())
        .slice(0, 8)
        .map((c) => ({
          sign: String(c.sign).trim(),
          implies: String(c.implies ?? "").trim(),
          ...(Array.isArray(c.at) && c.at.length === 2 && isFinite(+c.at[0]) && isFinite(+c.at[1])
            ? { at: [
                Math.min(0.97, Math.max(0.03, +c.at[0])),
                Math.min(0.97, Math.max(0.03, +c.at[1])),
              ] as [number, number] }
            : {}),
        }));
      if (clues.length > 0) {
        set({ markers: get().markers.map((m) => ({ ...m, clues })) });
      }
    } catch (e) {
      console.error("Failed to parse clues:", e, "Raw data:", data.text);
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
      draft: "",
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

          // Photo annotations ride along as leading context so the model can
          // resolve "pin 2" or "my note about the sign".
          const ctx = annotationContext(sessionId, freshState.markers[freshState.currentMarker]);
          const chatMessage = {
            type: "chat_message",
            text: text.trim(),
            session_id: sessionId,
            history: [
              ...(ctx ? [{ role: "user" as const, text: ctx }] : []),
              ...freshState.messages.map((msg) => ({
                role: msg.role,
                text: msg.text,
              })),
            ],
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
          draft: "",
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
        createSupabaseStorage({
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
            evidenceIndex: msg.evidenceIndex,
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
            clues: marker.clues,
          })),
          currentMarker: state.currentMarker,
        };
      },
    },
  ),
);
