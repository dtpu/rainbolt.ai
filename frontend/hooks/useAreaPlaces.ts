"use client";

import { useEffect, useState } from "react";
import type { PlaceLabel } from "@/lib/globe/store";

interface GeoResult {
  title: string;
  lat: number;
  lon: number;
  dist: number;
}

/**
 * Real named places / landmarks near a coordinate, via Wikipedia geosearch
 * (keyless, CORS-enabled). Results come back ordered by distance, so closer
 * places get a lower rank and surface first as you zoom in - map-style LOD.
 */
export function useAreaPlaces(lat?: number, lng?: number, radius = 10000, limit = 16) {
  const [places, setPlaces] = useState<PlaceLabel[]>([]);

  useEffect(() => {
    if (lat == null || lng == null) {
      setPlaces([]);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();

    const url =
      `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&list=geosearch&gscoord=${lat}|${lng}&gsradius=${radius}&gslimit=${limit}`;

    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const results: GeoResult[] = d?.query?.geosearch ?? [];
        const n = Math.max(1, results.length);
        setPlaces(
          results.map((g, i) => ({
            name: g.title,
            lat: g.lat,
            lng: g.lon,
            rank: i / n, // closest (most relevant) appears first
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setPlaces([]);
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [lat, lng, radius, limit]);

  return places;
}
