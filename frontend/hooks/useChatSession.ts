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

    if (!sessionId) return;
    let cancelled = false;

    (async () => {
      // Re-opening a saved session: restore the stored analysis instead of
      // re-running the whole pipeline (the learning page clears the store on
      // navigation, so without this every visit meant a full re-process).
      const st = useChatStore.getState();
      // Different session than the store holds (browser back/forward skips
      // the rail's clear): wipe first, or the old session's markers leak
      // into this one and suppress its processing.
      if (st.sessionId !== sessionId && (st.markers.length > 0 || st.messages.length > 0)) {
        useChatStore.getState().clear();
      }
      if (st.sessionId !== sessionId || st.markers.length === 0) {
        try {
          const { getGlobeSession } = await import("@/lib/globe-database");
          const row = await getGlobeSession(sessionId);
          const persisted = row?.data?.["rainbolt-chat-storage"];
          const state =
            typeof persisted === "string" ? JSON.parse(persisted)?.state : persisted?.state;
          if (!cancelled && state?.markers?.length) {
            useChatStore.setState({
              sessionId,
              messages: state.messages ?? [],
              markers: state.markers ?? [],
              currentMarker: state.currentMarker ?? 0,
              uploadedImageUrl: state.uploadedImageUrl ?? null,
              hasProcessedSession: true,
              sending: false,
              thinking: false,
            });
          }
        } catch {
          // No saved copy (fresh upload, guest, or offline) - process normally.
        }
      }
      // Photo recovery: the upload preview only lives in the uploading tab,
      // so reloads and other devices pull the copy from Supabase Storage.
      if (!useChatStore.getState().uploadedImageUrl) {
        try {
          const { supabase } = await import("@/lib/supabase");
          const url = supabase.storage.from("photos").getPublicUrl(`${sessionId}.jpg`).data.publicUrl;
          const head = await fetch(url, { method: "HEAD" });
          if (head.ok && !cancelled) useChatStore.setState({ uploadedImageUrl: url });
        } catch {
          // No stored copy - the session just renders without its photo.
        }
      }

      if (cancelled) return;
      useChatStore.getState().connectWebSocket(sessionId).catch((err) => {
        console.error("Failed to connect WebSocket:", err);
      });
    })();

    return () => {
      cancelled = true;
      // Runs on unmount AND when the session id changes in place (the page
      // component survives /chat/A -> /chat/B). Without this the old socket
      // stays open and its late messages corrupt the new session's store.
      useChatStore.getState().disconnectWebSocket();
    };
  }, [sessionId]);
}
