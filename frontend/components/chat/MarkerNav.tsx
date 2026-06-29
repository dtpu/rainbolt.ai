"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type MarkerNavProps = {
  currentMarker: number;
  markersCount: number;
  onPrevious: () => void;
  onNext: () => void;
};

export function MarkerNav({
  currentMarker,
  markersCount,
  onPrevious,
  onNext,
}: MarkerNavProps) {
  return (
    <div className="pointer-events-auto absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/[0.08] bg-black/60 px-2 py-1.5 backdrop-blur-md">
      <button
        onClick={(e) => { e.stopPropagation(); onPrevious(); }}
        onMouseDown={(e) => e.stopPropagation()}
        className="rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white"
        aria-label="Previous marker"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[3rem] text-center text-xs font-medium tabular-nums text-white/70">
        {currentMarker + 1} / {markersCount}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        onMouseDown={(e) => e.stopPropagation()}
        className="rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white"
        aria-label="Next marker"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
