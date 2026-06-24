"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { X, Minus, MoreVertical, Trash2 } from "lucide-react";
import { useChatStore } from "./useChatStore";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatHeaderProps {
  onClose: () => void;
  onMinimize?: () => void;
}

export function ChatHeader({ onClose, onMinimize }: ChatHeaderProps) {
  const { clear, messages } = useChatStore();
  const [showMenu, setShowMenu] = useState(false);

  const handleClear = () => {
    if (messages.length > 0) {
      clear();
      setShowMenu(false);
    }
  };

  return (
    <div className="flex-shrink-0 border-b border-white/10 p-3 md:p-4 bg-gradient-to-b from-black/40 to-transparent">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping" />
          </div>
          <h2 className="text-white font-medium text-base">Rainbolt AI</h2>
        </div>

        <div className="flex items-center gap-1">
          {/* More menu */}
          <Tooltip.Provider delayDuration={300}>
            <div className="relative">
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label="More options"
                  >
                    <MoreVertical className="w-4 h-4 text-white/70" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="px-2 py-1 text-xs bg-black/90 text-white rounded-lg backdrop-blur-sm"
                    sideOffset={5}
                  >
                    More options
                    <Tooltip.Arrow className="fill-black/90" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>

              {/* Dropdown menu */}
              <AnimatePresence>
                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1 w-48 bg-black/90 backdrop-blur-md border border-white/10 rounded-lg shadow-xl overflow-hidden z-50"
                    >
                      <button
                        onClick={handleClear}
                        disabled={messages.length === 0}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear conversation
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Minimize button (optional - desktop only) */}
            {onMinimize && (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={onMinimize}
                    className="hidden md:block p-2 rounded-lg hover:bg-white/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label="Minimize"
                  >
                    <Minus className="w-4 h-4 text-white/70" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="px-2 py-1 text-xs bg-black/90 text-white rounded-lg backdrop-blur-sm"
                    sideOffset={5}
                  >
                    Minimize
                    <Tooltip.Arrow className="fill-black/90" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}

            {/* Close button */}
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/20"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4 text-white/70" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="px-2 py-1 text-xs bg-black/90 text-white rounded-lg backdrop-blur-sm"
                  sideOffset={5}
                >
                  Close
                  <Tooltip.Arrow className="fill-black/90" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </div>
    </div>
  );
}
