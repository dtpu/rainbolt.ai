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
 * Interactive 2D evidence map:
 *  - candidate guesses (colour-matched to the globe pins); fit-bounds spreads
 *    same-city candidates into distinct, clickable points (the overlap fix);
 *  - nearby geotagged photos (Wikimedia Commons) as neutral reference dots;
 *  - click anywhere to open Street View at that exact spot.
 */
export function EvidenceMap({ candidates, references, activeIndex, picked, onSelectCandidate, onPickPoint }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dataRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef<L.LayerGroup | null>(null);
  const selCb = useRef(onSelectCandidate); selCb.current = onSelectCandidate;
  const pickCb = useRef(onPickPoint); pickCb.current = onPickPoint;
  const sigRef = useRef("");
  const lastActive = useRef(-1);

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
    // Click anywhere -> open Street View at that exact spot (handled by the page).
    map.on("click", (e: L.LeafletMouseEvent) => pickCb.current(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    const fix = () => map.invalidateSize();
    const t = setTimeout(fix, 150);
    const ro = new ResizeObserver(fix);
    ro.observe(el);
    return () => { clearTimeout(t); ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // markers (candidates + honest "nearby geotagged photos" references)
  useEffect(() => {
    const map = mapRef.current, lg = dataRef.current;
    if (!map || !lg) return;
    lg.clearLayers();
    pickRef.current?.clearLayers(); // drop a stale "you clicked here" marker
    map.closePopup();

    for (const r of references) {
      if (r.lat == null || r.lng == null) continue;
      const box = document.createElement("div");
      const img = document.createElement("img");
      img.src = r.thumb; img.style.cssText = "width:130px;display:block;border-radius:4px";
      const cap = document.createElement("div");
      cap.textContent = r.title; // textContent => no HTML injection
      cap.style.cssText = "font:500 11px/1.3 sans-serif;margin-top:4px;max-width:130px";
      box.append(img, cap);
      L.circleMarker([r.lat, r.lng], { radius: 4, color: "#0b0e17", weight: 1, fillColor: "#9aa7bd", fillOpacity: 0.6 })
        .bindPopup(box).addTo(lg);
    }
    candidates.forEach((c) => {
      const on = c.index === activeIndex;
      const tip = document.createElement("span");
      tip.textContent = `${c.index + 1}. ${c.name}`;
      L.circleMarker([c.lat, c.lng], { radius: on ? 10 : 7, color: "#0b0e17", weight: 2, fillColor: pinColor(c.index), fillOpacity: 0.97 })
        .bindTooltip(tip, { direction: "top", offset: [0, -6] })
        .on("click", (e) => { L.DomEvent.stopPropagation(e); selCb.current(c.index); })
        .addTo(lg);
    });
  }, [candidates, references, activeIndex]);

  // fit-bounds to all candidates when the set changes (spreads same-city guesses)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || candidates.length === 0) return;
    const sig = candidates.map((c) => `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`).join("|");
    if (sig === sigRef.current) return;
    // Claim the current active synchronously so the pan effect (same commit)
    // doesn't also recenter off the framed all-candidates view.
    lastActive.current = activeIndex;
    const id = requestAnimationFrame(() => {
      sigRef.current = sig; // mark done only once it actually runs (survives re-render churn)
      map.invalidateSize();
      if (candidates.length > 1) {
        map.fitBounds(L.latLngBounds(candidates.map((c) => [c.lat, c.lng] as [number, number])).pad(0.5), { maxZoom: 14, animate: false });
      } else {
        map.setView([candidates[0].lat, candidates[0].lng], 13, { animate: false });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [candidates]);

  // pan to the active candidate when it changes (keep zoom)
  useEffect(() => {
    const map = mapRef.current, a = candidates[activeIndex];
    if (!map || !a || lastActive.current === activeIndex) return;
    const id = requestAnimationFrame(() => {
      lastActive.current = activeIndex; // commit inside rAF so re-render churn can't drop the pan
      map.panTo([a.lat, a.lng], { animate: true });
    });
    return () => cancelAnimationFrame(id);
  }, [activeIndex, candidates]);

  // marker for the spot whose Street View is currently shown
  useEffect(() => {
    const pg = pickRef.current;
    if (!pg) return;
    pg.clearLayers();
    if (picked) {
      L.circleMarker([picked.lat, picked.lng], { radius: 6, color: "#ffffff", weight: 2, fillColor: "#ffffff", fillOpacity: 0.3 }).addTo(pg);
    }
  }, [picked]);

  return <div ref={elRef} className="h-full w-full" />;
}
