"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const STEPS = [
  {
    title: "Upload a photo",
    body: "Drop in any photo and the model guesses where on Earth it was taken.",
    image: "/howto/upload.jpg",
  },
  {
    title: "See it reason",
    body: "It reads the clues — road lines, signage, plates, vegetation — and streams its thinking live.",
    image: "/howto/reason.jpg",
  },
  {
    title: "Explore your map",
    body: "Every guess becomes a pin you can revisit, link to others, and dig into.",
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
      className="fixed left-5 top-[6.75rem] z-[120] w-[340px] animate-in fade-in slide-in-from-left-2 duration-300"
      role="dialog"
      aria-label="How rainbolt.ai works"
    >
      <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-space-900/95 shadow-2xl backdrop-blur-md">
        <div className="relative aspect-video w-full bg-space-950">
          <img src={current.image} alt="" className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-space-900/80 to-transparent" />
          <button
            onClick={onClose}
            aria-label="Dismiss"
            className="absolute right-2.5 top-2.5 rounded-full bg-black/50 p-1.5 text-white/70 backdrop-blur-sm transition-colors hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-fg-muted/50">
            Getting started · {step + 1} of {STEPS.length}
          </div>
          <h2 className="text-base font-semibold text-fg">{current.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{current.body}</p>

          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={isFirst}
              aria-label="Previous"
              className="rounded-md p-1 text-fg-muted transition-colors enabled:hover:text-fg disabled:opacity-20"
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
                    i === step ? "w-5 bg-fg" : "w-1.5 bg-white/20 hover:bg-white/35"
                  }`}
                />
              ))}
            </div>

            {isLast ? (
              <button
                onClick={onClose}
                className="rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-space-950 transition-colors hover:bg-white/90"
              >
                Got it
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                aria-label="Next"
                className="rounded-md p-1 text-fg-muted transition-colors hover:text-fg"
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
