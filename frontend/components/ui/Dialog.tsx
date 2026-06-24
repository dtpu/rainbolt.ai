"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        style={{ pointerEvents: "auto" }}
      />

      {/* Modal */}
      <div
        className={`relative z-[10000] w-full max-w-2xl animate-in zoom-in-95 duration-200 ${className}`}
        onClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: "auto" }}
      >
        <div className="relative backdrop-blur-md border border-white/10 rounded-xl bg-[#0a0a0f]/95 shadow-2xl overflow-hidden">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-600/10 pointer-events-none" />

          {/* Header */}
          {(title || description) && (
            <div className="relative border-b border-white/10 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {title && (
                    <h2 className="text-2xl font-bold text-white mb-2">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-white/60 text-sm">{description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="ml-4 p-2 rounded-lg hover:bg-white/10 transition-colors group"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="relative p-6">{children}</div>
        </div>
      </div>
    </div>
  );
};
