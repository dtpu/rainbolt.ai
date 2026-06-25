"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

type Step = { title: string; body: string; image: string };

const STEPS: Step[] = [
  {
    title: "Upload a photo",
    body: "Drop in any photo and rainbolt.ai predicts where on Earth it was taken.",
    image: "/howto/upload.jpg",
  },
  {
    title: "Watch it reason",
    body: "It works through GeoGuessr-style clues (road lines, signage, vegetation, license plates) and streams its thinking live.",
    image: "/howto/reason.jpg",
  },
  {
    title: "Explore your map",
    body: "Every guess becomes a star. Drag the cards around, link related sessions together, and click any card to revisit it.",
    image: "/howto/constellation.jpg",
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
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How to use rainbolt.ai"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-space-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/9] w-full bg-space-950">
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
          <p className="text-xs font-medium uppercase tracking-wider text-sky-400">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{current.body}</p>

          <div className="mt-5 flex items-center justify-between">
            <div className="flex gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={s.title}
                  onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-5 bg-sky-400" : "w-1.5 bg-white/25 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm text-white/70 transition-colors hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              )}
              {isLast ? (
                <button
                  onClick={onClose}
                  className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90"
                >
                  Get started
                </button>
              ) : (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-white/40">
            Exploring in guest mode, no sign-in needed. Sign in anytime to save your sessions.
          </p>
        </div>
      </div>
    </div>
  );
}
