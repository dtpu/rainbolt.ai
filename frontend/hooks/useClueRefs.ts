"use client";

import { useEffect, useState } from "react";
import type { AreaPhoto } from "./useAreaPhotos";

interface CommonsImageInfo {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  mime?: string;
}
interface CommonsPage {
  title?: string;
  imageinfo?: CommonsImageInfo[];
}

// Clue cards reopen often; don't hammer the API for the same query.
const cache = new Map<string, AreaPhoto[]>();

async function searchCommons(query: string, limit: number, signal: AbortSignal): Promise<AreaPhoto[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(`filetype:bitmap ${query}`)}` +
    `&gsrnamespace=6&gsrlimit=${limit + 3}&prop=imageinfo&iiprop=url|mime&iiurlwidth=240`;
  const d = await fetch(url, { signal }).then((r) => r.json());
  const pages: CommonsPage[] = d?.query?.pages ? Object.values(d.query.pages) : [];
  return pages
    .map((p) => ({ ii: p.imageinfo?.[0], title: p.title ?? "" }))
    .filter(
      (x): x is { ii: CommonsImageInfo; title: string } =>
        !!x.ii?.thumburl && !!x.ii.mime?.startsWith("image/") && !x.ii.mime.includes("svg"),
    )
    .map((x) => ({
      thumb: x.ii.thumburl!,
      full: x.ii.descriptionurl || x.ii.url || x.ii.thumburl!,
      title: x.title.replace(/^File:/, "").replace(/\.\w+$/, ""),
    }));
}

/**
 * Reference imagery for a single visual clue ("red paper lanterns Shibuya"),
 * via Wikimedia Commons full-text search. Keyless + CORS-enabled; every
 * thumbnail links back to its Commons page, so each image is also the source
 * reference for what the clue looks like. If the place-scoped query is too
 * narrow, it broadens to the clue alone.
 */
export function useClueRefs(query: string | null, broadQuery?: string | null, limit = 3) {
  const [photos, setPhotos] = useState<AreaPhoto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setPhotos([]);
      return;
    }
    const hit = cache.get(query);
    if (hit) {
      setPhotos(hit);
      setLoading(false); // a superseded in-flight request may have left it on
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    setPhotos([]);

    (async () => {
      let imgs = await searchCommons(query, limit, ctrl.signal);
      if (imgs.length < limit && broadQuery && broadQuery !== query) {
        const broad = await searchCommons(broadQuery, limit, ctrl.signal);
        const seen = new Set(imgs.map((p) => p.thumb));
        imgs = [...imgs, ...broad.filter((p) => !seen.has(p.thumb))];
      }
      imgs = imgs.slice(0, limit);
      if (!cancelled) {
        cache.set(query, imgs);
        setPhotos(imgs);
      }
    })()
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
  }, [query, broadQuery, limit]);

  return { photos, loading };
}
