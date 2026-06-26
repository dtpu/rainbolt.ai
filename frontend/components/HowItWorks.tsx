"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";

const STEPS = [
  {
    title: "Upload a photo",
    body: "Drop in any photo and the model guesses where on Earth it was taken.",
    image: "/howto/upload.jpg",
  },
  {
    title: "See it reason",
    body: "It reads the clues, road lines, signage, plates, vegetation, and streams its thinking live.",
    image: "/howto/reason.jpg",
  },
  {
    title: "Explore your map",
    body: "Every guess becomes a star you can drag, link to others, and revisit.",
    image: "/howto/map.jpg",
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

  const current = STEPS[step];
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
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-space-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-video w-full bg-space-950">
          <img src={current.image} alt={current.title} className="h-full w-full object-cover" />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white/80 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          <h2 className="text-lg font-bold text-white">{current.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-white/55">{current.body}</p>

          <div className="mt-5 flex items-center justify-between">
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
    </div>
  );
}
