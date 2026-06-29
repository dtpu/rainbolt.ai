"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { pinColor } from "@/lib/globe/palette";

export interface MapCandidate { name: string; lat: number; lng: number; index: number }
export interface MapReference { lat: number; lng: number; thumb: string; title: string }

interface Props {
  candidates: MapCandidate[];
  references: MapReference[];
  activeIndex: number;
  picked: { lat: number; lng: number } | null;
  onSelectCandidate: (i: number) => void;
  onPickPoint: (lat: number, lng: number) => void;
}

/**
 * Interactive evidence map: candidate guesses (colour-matched to the globe
 * pins) + nearby geo-referenced photos, all on one real map. Clicking anywhere
 * drops you into Street View at that exact spot - the useful, explorable
 * counterpart to the macro globe.
 */
export function EvidenceMap({ candidates, references, activeIndex, picked, onSelectCandidate, onPickPoint }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dataRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef<L.LayerGroup | null>(null);
  const pickCb = useRef(onPickPoint); pickCb.current = onPickPoint;
  const selCb = useRef(onSelectCandidate); selCb.current = onSelectCandidate;
  const lastActive = useRef<number>(-1);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const el = elRef.current;
    const map = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd", attribution: "&copy; OpenStreetMap &copy; CARTO",
    }).addTo(map);
    map.setView([20, 0], 2);
    dataRef.current = L.layerGroup().addTo(map);
    pickRef.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => pickCb.current(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    // Leaflet renders grey tiles if it measured the container before it had a
    // size (it lives in an aspect-ratio box). Re-measure once and on resize.
    const fix = () => map.invalidateSize();
    const t = setTimeout(fix, 150);
    const ro = new ResizeObserver(fix);
    ro.observe(el);
    return () => { clearTimeout(t); ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // candidates + references
  useEffect(() => {
    const map = mapRef.current, lg = dataRef.current;
    if (!map || !lg) return;
    map.invalidateSize();
    lg.clearLayers();
    for (const r of references) {
      if (r.lat == null || r.lng == null) continue;
      L.circleMarker([r.lat, r.lng], { radius: 4, color: "#e8b44f", weight: 1, fillColor: "#e8b44f", fillOpacity: 0.45 })
        .bindPopup(`<img src="${r.thumb}" style="width:130px;display:block;border-radius:4px"/><div style="font:500 11px/1.3 sans-serif;margin-top:4px;max-width:130px">${r.title}</div>`)
        .addTo(lg);
    }
    candidates.forEach((c) => {
      const col = pinColor(c.index);
      const on = c.index === activeIndex;
      L.circleMarker([c.lat, c.lng], { radius: on ? 9 : 6, color: "#0b0e17", weight: 1.5, fillColor: col, fillOpacity: 0.95 })
        .bindTooltip(`${c.index + 1}. ${c.name}`, { direction: "top", offset: [0, -6] })
        .on("click", (e) => { L.DomEvent.stopPropagation(e); selCb.current(c.index); })
        .addTo(lg);
    });
  }, [candidates, references, activeIndex]);

  // Centre on the active candidate (recenter when it changes), after a frame so
  // the container is measured.
  useEffect(() => {
    const map = mapRef.current;
    const a = candidates[activeIndex];
    if (!map || !a || lastActive.current === activeIndex) return;
    const animate = lastActive.current !== -1;
    const id = requestAnimationFrame(() => {
      lastActive.current = activeIndex; // mark done only once it actually runs
      map.invalidateSize();
      map.setView([a.lat, a.lng], 13, { animate });
    });
    return () => cancelAnimationFrame(id);
  }, [activeIndex, candidates]);

  // picked-point marker (where Street View is showing)
  useEffect(() => {
    const lg = pickRef.current;
    if (!lg) return;
    lg.clearLayers();
    if (picked) {
      L.marker([picked.lat, picked.lng]).bindTooltip("Street View here", { permanent: false }).addTo(lg);
    }
  }, [picked]);

  return <div ref={elRef} className="h-full w-full" />;
}
