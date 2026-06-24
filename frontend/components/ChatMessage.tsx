"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Copy } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  text: string;
  ts: number;
  type?: "status" | "normal";
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

function ChatMessageComponent({
  role,
  text,
  ts,
  type = "normal",
}: ChatMessageProps) {
  const isUser = role === "user";
  const isStatus = type === "status";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Status message styling
  if (isStatus) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex w-full justify-center mb-3"
      >
        <div className="relative max-w-[85%] rounded-4xl px-4 py-2.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 backdrop-blur-sm">
          <p className="text-sm text-blue-200 font-medium italic">{text}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      <Tooltip.Provider delayDuration={300}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <div
              className={`group relative max-w-[75%] rounded-2xl px-3 py-2 md:px-4 md:py-2.5 transition-all duration-200 ${
                isUser
                  ? "bg-blue-500/90 text-white"
                  : "bg-white/10 dark:bg-black/20 text-white border border-white/10"
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {text}
              </p>

              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-lg bg-black/50 hover:bg-black/70 backdrop-blur-sm"
                aria-label="Copy message"
              >
                <Copy className="w-3 h-3 text-white" />
              </button>
            </div>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="px-2 py-1 text-xs bg-black/90 text-white rounded-lg backdrop-blur-sm"
              sideOffset={5}
            >
              {formatTime(ts)}
              <Tooltip.Arrow className="fill-black/90" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    </motion.div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
