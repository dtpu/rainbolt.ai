"use client";

import { useEffect, useState } from "react";

export interface AreaPhoto {
  thumb: string;
  full: string;
  title: string;
  lat?: number;
  lng?: number;
}

interface CommonsImageInfo {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  mime?: string;
}
interface CommonsCoord {
  lat?: number;
  lon?: number;
}
interface CommonsPage {
  title?: string;
  imageinfo?: CommonsImageInfo[];
  coordinates?: CommonsCoord[];
}

/**
 * Real photos taken near a coordinate, via Wikimedia Commons geosearch. Keyless
 * and CORS-enabled, so it works client-side for guest demos. Returns nearby
 * freely-licensed images of the area (best-effort; coverage varies).
 */
export function useAreaPhotos(lat?: number, lng?: number, limit = 8) {
  const [photos, setPhotos] = useState<AreaPhoto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null) {
      setPhotos([]);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);

    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=10000&ggslimit=${limit}` +
      `&ggsnamespace=6&prop=imageinfo|coordinates&iiprop=url|mime&iiurlwidth=320`;

    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const pages: CommonsPage[] = d?.query?.pages ? Object.values(d.query.pages) : [];
        const imgs = pages
          .map((p) => ({ ii: p.imageinfo?.[0], title: p.title ?? "", co: p.coordinates?.[0] }))
          .filter(
            (x): x is { ii: CommonsImageInfo; title: string; co: CommonsCoord | undefined } =>
              !!x.ii?.thumburl &&
              !!x.ii.mime?.startsWith("image/") &&
              !x.ii.mime.includes("svg"),
          )
          .map((x) => ({
            thumb: x.ii.thumburl!,
            full: x.ii.descriptionurl || x.ii.url || x.ii.thumburl!,
            title: x.title.replace(/^File:/, "").replace(/\.\w+$/, ""),
            lat: x.co?.lat,
            lng: x.co?.lon,
          }));
        setPhotos(imgs);
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [lat, lng, limit]);

  return { photos, loading };
}
