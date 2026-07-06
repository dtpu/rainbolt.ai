"use client";

import { ExternalLink, MapPin } from "lucide-react";
import { useAreaPhotos } from "@/hooks/useAreaPhotos";
import type { Marker } from "@/components/useChatStore";

/**
 * Photo evidence under an assistant message: real, freely-licensed photos
 * taken near the suggested location (Wikimedia Commons geosearch). Each thumb
 * links to its Commons source page, and the footer links the spot on Google
 * Maps, so a claim in chat is checkable without leaving the flow.
 */
export function EvidenceStrip({ marker }: { marker: Marker }) {
  const { photos, loading } = useAreaPhotos(marker.latitude, marker.longitude, 4);
  const shown = photos.slice(0, 3);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${marker.latitude},${marker.longitude}`;

  return (
    <div className="w-[300px] max-w-full">
      {loading ? (
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-md bg-white/[0.05]" />
          ))}
        </div>
      ) : shown.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5">
          {shown.map((p, i) => (
            <a
              key={i}
              href={p.full}
              target="_blank"
              rel="noopener noreferrer"
              title={`${p.title} - source on Wikimedia Commons`}
              className="group relative aspect-square overflow-hidden rounded-md border border-white/[0.08] bg-space-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.thumb}
                alt={p.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
              />
              <ExternalLink className="absolute right-1 top-1 h-3 w-3 text-white/0 drop-shadow transition-colors group-hover:text-white/90" />
            </a>
          ))}
        </div>
      ) : null}

      <p className="mt-1.5 flex flex-wrap items-center gap-x-1 text-[10px] leading-relaxed text-fg-muted/50">
        {shown.length > 0 && (
          <span>Photos near {marker.name} · source: Wikimedia Commons ·</span>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 underline-offset-2 transition-colors hover:text-fg hover:underline"
        >
          <MapPin className="h-2.5 w-2.5" />
          view on Google Maps
        </a>
      </p>
    </div>
  );
}
