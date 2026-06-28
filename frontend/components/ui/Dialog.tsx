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
        className={`relative z-[10000] w-full max-w-lg animate-in zoom-in-95 duration-200 ${className}`}
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
      </div>
    </div>
  );
};
