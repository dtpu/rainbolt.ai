"use client";

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
    <div className="absolute bottom-8 left-[40%] transform flex items-center gap-4 bg-black/80 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20 z-10">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPrevious();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="text-white hover:text-blue-400 transition-colors p-2 hover:bg-white/10 rounded-full"
        aria-label="Previous marker"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
      <div className="text-white font-medium text-sm">
        {currentMarker + 1} / {markersCount}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="text-white hover:text-blue-400 transition-colors p-2 hover:bg-white/10 rounded-full"
        aria-label="Next marker"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}
