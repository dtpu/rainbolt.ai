"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import type { Marker } from "@/components/useChatStore";

type LocationFactsPanelProps = {
  marker: Marker;
  images: string[] | undefined;
  isLoadingImages: boolean;
  onDelete: () => void;
};

export function LocationFactsPanel({
  marker,
  images,
  isLoadingImages,
  onDelete,
}: LocationFactsPanelProps) {
  const pct = Math.round(marker.accuracy * 100);
  const barColor =
    pct >= 75 ? "#4ade80"
    : pct >= 50 ? "#E8B44F"
    : "#e5373e";
  const latLabel = `${Math.abs(marker.latitude).toFixed(3)}°${marker.latitude >= 0 ? "N" : "S"}`;
  const lngLabel = `${Math.abs(marker.longitude).toFixed(3)}°${marker.longitude >= 0 ? "E" : "W"}`;

  return (
    <div
      className="flex w-64 flex-col rounded-xl border border-white/[0.09] bg-black/70 shadow-2xl backdrop-blur-xl max-h-[calc(100vh-120px)]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white leading-snug">{marker.name}</h3>
            <p className="mt-0.5 text-[11px] text-white/40 tabular-nums">
              {latLabel}&ensp;{lngLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 -mt-0.5">
            <a
              href={`https://www.google.com/maps/place/${marker.latitude},${marker.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1.5 text-white/30 transition-colors hover:text-white/70"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm("Delete this location?")) onDelete();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="rounded p-1.5 text-white/30 transition-colors hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Confidence bar — no label, just bar + percentage */}
        <div className="mt-3 flex items-center gap-2.5">
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-medium tabular-nums" style={{ color: barColor }}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Analysis text — no heading */}
      {marker.facts && (
        <div className="shrink-0 border-t border-white/[0.06] px-4 py-3">
          <p className="text-[12px] leading-relaxed text-white/55">{marker.facts}</p>
        </div>
      )}

      {/* Street view images — no heading */}
      {(isLoadingImages || (images && images.length > 0)) && (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/[0.06] px-4 py-3">
          {isLoadingImages ? (
            <div className="flex h-20 items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border border-white/20 border-t-white/60" />
            </div>
          ) : (
            <div className="space-y-2 pb-1">
              {images!.map((url, i) => (
                <div key={i} className="overflow-hidden rounded-lg bg-white/[0.04]">
                  <img
                    src={url}
                    alt=""
                    className="h-32 w-full object-cover"
                    onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
