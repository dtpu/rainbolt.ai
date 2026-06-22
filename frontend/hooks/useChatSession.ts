"use client";

import { useEffect } from "react";
import { useChatStore } from "@/components/useChatStore";
import { DEMO_SESSION_CONTENT } from "@/lib/demo-constellation";

export function useChatSession(sessionId: string) {
  const uploadedImageUrl = useChatStore((state) => state.uploadedImageUrl);

  useEffect(() => {
    // Guest demo sessions are read-only and backend-free: seed the example
    // marker + chat straight into the store instead of opening a socket.
    if (sessionId?.startsWith("demo-")) {
      const content = DEMO_SESSION_CONTENT[sessionId];
      useChatStore.setState({
        sessionId,
        markers: content?.markers ?? [],
        messages: content?.messages ?? [],
        currentMarker: 0,
        sending: false,
        thinking: false,
        // The analyzed photo shows in the chat panel as the "uploaded" input.
        uploadedImageUrl: content?.markers?.[0]?.mapillary_images?.[0] ?? null,
      });
      return;
    }

    const { connectWebSocket } = useChatStore.getState();

    if (sessionId) {
      connectWebSocket(sessionId).catch((err) => {
        console.error("Failed to connect WebSocket:", err);
      });
    }
  }, [sessionId, uploadedImageUrl]);

  useEffect(() => {
    return () => {
      useChatStore.getState().disconnectWebSocket();
    };
  }, []);
}
