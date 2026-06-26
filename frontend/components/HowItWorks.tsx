"use client";

import { useEffect, useState } from "react";
import { Upload, Sparkles, Waypoints, ChevronLeft, ChevronRight, Check, X } from "lucide-react";

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
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, STEPS.length - 1));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const { icon: Icon, title, body } = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How rainbolt.ai works"
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-space-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-white/40 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-space-800 text-sky-300">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">{body}</p>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={isFirst}
            aria-label="Previous"
            className="text-white/50 transition-colors enabled:hover:text-white disabled:opacity-20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-sky-400" : "w-1.5 bg-white/25 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          {isLast ? (
            <button
              onClick={onClose}
              aria-label="Done"
              className="text-sky-300 transition-colors hover:text-sky-200"
            >
              <Check className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              aria-label="Next"
              className="text-white/50 transition-colors hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
