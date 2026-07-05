"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className = "",
}) => {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
    <motion.div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={onClose}
        style={{ pointerEvents: "auto" }}
      />

      {/* Modal */}
      <motion.div
        className={`relative z-[10000] w-full max-w-lg ${className}`}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.24, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: "auto" }}
      >
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-space-900 shadow-2xl">
          {/* Header */}
          {(title || description) && (
            <div className="relative flex items-start justify-between gap-4 px-6 pt-6 pb-5">
              <div className="flex-1">
                {title && (
                  <h2 className="text-lg font-semibold text-fg">{title}</h2>
                )}
                {description && (
                  <p className="mt-1 text-sm text-fg-muted">{description}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="-mr-1.5 -mt-1.5 rounded-lg p-2 text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Content */}
          <div className="relative px-6 pb-6">{children}</div>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
};
