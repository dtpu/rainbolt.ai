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
  onSelectCandidate: (i: number) => void;
}

const panoUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

/**
 * Interactive 2D evidence map:
 *  - candidate guesses (colour-matched to globe pins); fit-bounds spreads
 *    same-city candidates into distinct, clickable points (the overlap fix);
 *  - nearby geo-referenced photos with faint lines converging on the active
 *    guess - a visual of retrieval/triangulation (the RAG-style visual);
 *  - click anywhere to zoom the 2D map into that exact spot, with a Street View
 *    link for the point.
 */
export function EvidenceMap({ candidates, references, activeIndex, onSelectCandidate }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dataRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef<L.LayerGroup | null>(null);
  const selCb = useRef(onSelectCandidate); selCb.current = onSelectCandidate;
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
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const pg = pickRef.current!;
      pg.clearLayers();
      L.circleMarker([lat, lng], { radius: 6, color: "#ffffff", weight: 2, fillColor: "#ffffff", fillOpacity: 0.25 }).addTo(pg);
      map.setView([lat, lng], Math.min(map.getZoom() + 2, 17), { animate: true });
      L.popup({ offset: [0, -2], closeButton: true })
        .setLatLng([lat, lng])
        .setContent(`<a href="${panoUrl(lat, lng)}" target="_blank" rel="noopener noreferrer" style="font:600 12px/1.2 ui-sans-serif,system-ui,sans-serif;color:#2b6cb0;text-decoration:none">Open Street View here &#8599;</a>`)
        .openOn(map);
    });
    mapRef.current = map;
    const fix = () => map.invalidateSize();
    const t = setTimeout(fix, 150);
    const ro = new ResizeObserver(fix);
    ro.observe(el);
    return () => { clearTimeout(t); ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // markers + convergence lines
  useEffect(() => {
    const map = mapRef.current, lg = dataRef.current;
    if (!map || !lg) return;
    map.invalidateSize();
    lg.clearLayers();
    const active = candidates[activeIndex];

    // references + faint lines converging on the active guess
    for (const r of references) {
      if (r.lat == null || r.lng == null) continue;
      if (active) {
        L.polyline([[r.lat, r.lng], [active.lat, active.lng]], { color: "#e8b44f", weight: 1, opacity: 0.18 }).addTo(lg);
      }
      L.circleMarker([r.lat, r.lng], { radius: 4, color: "#e8b44f", weight: 1, fillColor: "#e8b44f", fillOpacity: 0.5 })
        .bindPopup(`<img src="${r.thumb}" style="width:130px;display:block;border-radius:4px"/><div style="font:500 11px/1.3 sans-serif;margin-top:4px;max-width:130px">${r.title}</div>`)
        .addTo(lg);
    }
    candidates.forEach((c) => {
      const col = pinColor(c.index);
      const on = c.index === activeIndex;
      L.circleMarker([c.lat, c.lng], { radius: on ? 10 : 7, color: "#0b0e17", weight: 2, fillColor: col, fillOpacity: 0.97 })
        .bindTooltip(`${c.index + 1}. ${c.name}`, { direction: "top", offset: [0, -6] })
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
    const id = requestAnimationFrame(() => {
      sigRef.current = sig; // mark done only once it actually runs (survives re-render churn)
      map.invalidateSize();
      if (candidates.length > 1) {
        map.fitBounds(L.latLngBounds(candidates.map((c) => [c.lat, c.lng] as [number, number])).pad(0.5), { maxZoom: 14, animate: false });
      } else {
        map.setView([candidates[0].lat, candidates[0].lng], 13, { animate: false });
      }
      lastActive.current = activeIndex;
    });
    return () => cancelAnimationFrame(id);
  }, [candidates]);

  // pan to the active candidate when it changes (keep zoom)
  useEffect(() => {
    const map = mapRef.current, a = candidates[activeIndex];
    if (!map || !a || lastActive.current === activeIndex) return;
    lastActive.current = activeIndex;
    const id = requestAnimationFrame(() => map.panTo([a.lat, a.lng], { animate: true }));
    return () => cancelAnimationFrame(id);
  }, [activeIndex, candidates]);

  return <div ref={elRef} className="h-full w-full" />;
}
