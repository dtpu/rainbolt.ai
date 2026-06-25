"use client";

import { useEffect } from "react";
import { Upload, Sparkles, Waypoints, X } from "lucide-react";

const STEPS = [
  {
    icon: Upload,
    title: "Upload a photo",
    body: "Drop in any photo and the model guesses where on Earth it was taken.",
  },
  {
    icon: Sparkles,
    title: "See it reason",
    body: "It reads the clues, road lines, signage, plates, vegetation, and streams its thinking live.",
  },
  {
    icon: Waypoints,
    title: "Explore your map",
    body: "Every guess becomes a star you can drag, link to others, and revisit.",
  },
];

export function HowItWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How rainbolt.ai works"
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-space-900 p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-white/40 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-xl font-bold tracking-tight text-white">How it works</h2>
        <p className="mt-1 text-sm text-white/50">Find where any photo was taken, in three steps.</p>

        <div className="relative mt-6">
          {/* Thread connecting the steps, echoing the constellation links */}
          <div
            className="absolute bottom-5 left-[17px] top-5 w-px bg-gradient-to-b from-sky-400/50 via-white/15 to-rose-500/40"
            aria-hidden
          />
          <ol className="space-y-5">
            {STEPS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="relative flex gap-4">
                <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-space-800 text-sky-300">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="pt-1">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-white/55">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <button
          onClick={onClose}
          className="mt-7 w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90"
        >
          Start exploring
        </button>
        <p className="mt-3 text-center text-xs text-white/35">
          No sign-in needed. Sign in anytime to save your map.
        </p>
      </div>
    </div>
  );
}
