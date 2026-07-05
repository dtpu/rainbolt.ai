"use client";

import { useLayoutEffect, useRef, useState } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { useChatStore } from "../useChatStore";

export function ChatHistory() {
  const { messages, sending, thinking, markers, currentMarker } = useChatStore();
  const clues = markers[currentMarker]?.clues;
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // First fill (mount, or switching back to this tab) jumps straight to the
  // latest message before paint - animated travel from the top is nauseating.
  // Only genuinely new messages scroll smoothly.
  const prevCount = useRef(0);
  useLayoutEffect(() => {
    const vp = scrollViewportRef.current;
    if (vp && isAtBottom) {
      if (prevCount.current === 0) vp.scrollTop = vp.scrollHeight;
      else vp.scrollTo({ top: vp.scrollHeight, behavior: "smooth" });
    }
    prevCount.current = messages.length;
  }, [messages.length, isAtBottom]);

  // Late-loading content (evidence thumbnails) grows the history after the
  // initial jump; stay pinned to the bottom unless the user scrolled away.
  const atBottomRef = useRef(true);
  atBottomRef.current = isAtBottom;
  useLayoutEffect(() => {
    const vp = scrollViewportRef.current;
    const content = vp?.firstElementChild;
    if (!vp || !content) return;
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) vp.scrollTop = vp.scrollHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  const handleScroll = () => {
    if (!scrollViewportRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);
    setShowScrollButton(!atBottom && messages.length > 0);
  };

  const scrollToBottom = () => {
    scrollViewportRef.current?.scrollTo({
      top: scrollViewportRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative min-h-0 flex-1">
      <ScrollArea.Root className="h-full">
        <ScrollArea.Viewport
          ref={scrollViewportRef}
          onScroll={handleScroll}
          className="h-full px-3 py-4"
        >
          {messages.length === 0 && !thinking && (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-white/20">Upload an image to get started</p>
            </div>
          )}

          <div role="log" aria-live="polite" className="flex flex-col">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                text={msg.text}
                ts={msg.ts}
                type={msg.type}
                image={msg.image}
                evidence={msg.evidenceIndex != null ? markers[msg.evidenceIndex] : undefined}
                clues={clues}
              />
            ))}

            {(sending || thinking) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-2 flex justify-start"
              >
                <div className="flex items-center gap-1.5 px-1 py-2">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="block h-1 w-1 rounded-full bg-white/30"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea.Viewport>

        <ScrollArea.Scrollbar
          className="flex select-none touch-none p-0.5 transition-colors data-[orientation=vertical]:w-1.5"
          orientation="vertical"
        >
          <ScrollArea.Thumb className="flex-1 rounded-full bg-white/[0.12]" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            onClick={scrollToBottom}
            className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.1] text-white/60 hover:bg-white/[0.16] hover:text-white"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
