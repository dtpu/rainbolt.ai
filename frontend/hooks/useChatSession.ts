"use client";

import { useEffect } from "react";
import { useChatStore } from "@/components/useChatStore";
import { DEMO_SESSION_CONTENT } from "@/lib/demo-constellation";

// Pause before a message appears: longer after long messages (reading time),
// kept tight so a full replay stays in the ~10s range.
const replayDelay = (prevText: string) =>
  Math.min(1100, 450 + prevText.length * 4);

export function useChatSession(sessionId: string) {
  useEffect(() => {
    // Guest demo sessions are read-only and backend-free: seed the example
    // marker + chat straight into the store instead of opening a socket.
    if (sessionId && DEMO_SESSION_CONTENT[sessionId]) {
      const content = DEMO_SESSION_CONTENT[sessionId];
      const all = content?.messages ?? [];
      const replayedKey = `rainbolt-demo-replayed-${sessionId}`;
      const alreadyReplayed =
        typeof window === "undefined" || !!sessionStorage.getItem(replayedKey);

      useChatStore.setState({
        sessionId,
        markers: content?.markers ?? [],
        messages: alreadyReplayed ? all : [],
        currentMarker: 0,
        sending: false,
        thinking: false,
        // The analyzed photo shows in the chat panel as the "uploaded" input.
        uploadedImageUrl: content?.markers?.[0]?.mapillary_images?.[0] ?? null,
      });

      if (alreadyReplayed || all.length === 0) return;

      // First visit: stream the conversation in so the analysis reads as it
      // happened - thinking dots before each assistant turn, a beat before
      // each user follow-up. Any click skips to the full transcript.
      let i = 0;
      let timer = 0;
      const finish = () => {
        sessionStorage.setItem(replayedKey, "1");
        window.removeEventListener("pointerdown", flush);
        useChatStore.setState({ thinking: false });
      };
      const flush = () => {
        window.clearTimeout(timer);
        useChatStore.setState({ messages: all });
        finish();
      };
      const step = () => {
        if (i >= all.length) {
          finish();
          return;
        }
        const msg = all[i];
        i += 1;
        useChatStore.setState((s) => ({
          messages: [...s.messages, msg],
          thinking: i < all.length && all[i].role === "assistant",
        }));
        if (i < all.length) timer = window.setTimeout(step, replayDelay(msg.text));
        else finish();
      };

      useChatStore.setState({ thinking: true });
      timer = window.setTimeout(step, 900);
      window.addEventListener("pointerdown", flush);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener("pointerdown", flush);
      };
    }

    const { connectWebSocket } = useChatStore.getState();

    if (sessionId) {
      connectWebSocket(sessionId).catch((err) => {
        console.error("Failed to connect WebSocket:", err);
      });
    }
  }, [sessionId]);

  useEffect(() => {
    return () => {
      useChatStore.getState().disconnectWebSocket();
    };
  }, []);
}
