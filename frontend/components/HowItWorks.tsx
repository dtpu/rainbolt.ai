"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronLeft } from "lucide-react";

const STEPS = [
  {
    title: "Upload a photo",
    body: "Drop in any photo and rainbolt.ai guesses where on Earth it was taken, no location data needed.",
    image: "/howto/upload.jpg",
  },
  {
    title: "Watch it reason",
    body: "It reads the clues (road lines, signage, license plates, vegetation, architecture) and streams its thinking live.",
    image: "/howto/reason.jpg",
  },
  {
    title: "Explore your world",
    body: "Every photo lands as a pin on your globe. Open one to see ranked guesses, compare street-level matches, and ask follow-ups.",
    image: "/howto/map.jpg",
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

// Sliding "page": direction-aware enter/exit.
const page = {
  enter: (d: number) => ({ x: d >= 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d >= 0 ? -48 : 48, opacity: 0 }),
};

export function HowItWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(0);

  useEffect(() => {
    if (open) {
      setStep(0);
      setDir(0);
    }
  }, [open]);

  const go = (to: number) => {
    const t = Math.max(0, Math.min(STEPS.length - 1, to));
    if (t === step) return;
    setDir(Math.sign(t - step));
    setStep(t);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(step + 1);
      else if (e.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="howto-backdrop"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <motion.div
            key="howto-card"
            className="w-full max-w-[540px] overflow-hidden rounded-2xl border border-white/10 bg-space-900 shadow-2xl"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {/* Sliding page (image + copy) */}
            <div className="relative overflow-hidden">
              <AnimatePresence custom={dir} mode="wait" initial={false}>
                <motion.div
                  key={step}
                  custom={dir}
                  variants={page}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: EASE }}
                >
                  <div className="relative aspect-[16/9] w-full bg-space-950">
                    <img src={current.image} alt="" className="h-full w-full object-cover" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-space-900 via-space-900/20 to-transparent" />
                  </div>
                  <div className="px-7 pt-5">
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-muted/50">
                      Getting started · {step + 1} of {STEPS.length}
                    </div>
                    <div className="min-h-[112px]">
                      <h2 className="text-2xl font-semibold tracking-tight text-fg">{current.title}</h2>
                      <p className="mt-2.5 text-[15px] leading-relaxed text-fg-muted">{current.body}</p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Skip stays put while pages slide underneath */}
              <motion.button
                onClick={onClose}
                whileTap={{ scale: 0.95 }}
                className="absolute right-3.5 top-3.5 rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm transition-colors hover:text-white"
              >
                Skip
              </motion.button>
            </div>

            {/* Footer chrome (static while pages slide) */}
            <div className="flex items-center justify-between px-7 pb-7 pt-1">
              <button
                onClick={() => go(step - 1)}
                disabled={isFirst}
                className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-fg-muted transition-colors enabled:hover:text-fg disabled:pointer-events-none disabled:opacity-0"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              <div className="flex gap-1.5">
                {STEPS.map((s, i) => (
                  <button key={s.title} onClick={() => go(i)} aria-label={`Step ${i + 1}`} className="py-2">
                    <motion.span
                      className="block h-1.5 rounded-full bg-white"
                      animate={{ width: i === step ? 24 : 6, opacity: i === step ? 1 : 0.25 }}
                      transition={{ duration: 0.3, ease: EASE }}
                    />
                  </button>
                ))}
              </div>

              {isLast ? (
                <motion.button
                  onClick={onClose}
                  whileTap={{ scale: 0.96 }}
                  className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-space-950 transition-colors hover:bg-white/90"
                >
                  Get started
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => go(step + 1)}
                  whileTap={{ scale: 0.96 }}
                  className="group flex items-center gap-1.5 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-space-950 transition-colors hover:bg-white/90"
                >
                  Next
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
