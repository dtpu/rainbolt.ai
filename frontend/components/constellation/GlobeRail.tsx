"use client";

import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MapPin, Plus, X } from "lucide-react";
import { GlobeSessionWithData, SessionLink } from "@/lib/globe-database";
import { sessionPlace, SessionPlace } from "@/lib/session-place";
import { DEMO_SESSION_CONTENT } from "@/lib/demo-constellation";
import LoginComponent from "@/components/ui/LoginComponent";
import { Reticle } from "@/components/ui/Reticle";
import { DecorLayer } from "@/components/decor/DecorLayer";
import { LEARNING_DECOR } from "@/lib/decor/layouts";
import { useGlobeStore, type WorldMarker, type WorldArc } from "@/lib/globe/store";
import { confColor } from "@/lib/globe/palette";

interface PlacedSession { session: GlobeSessionWithData; place: SessionPlace; }

interface GlobeRailProps {
  sessions: GlobeSessionWithData[];
  links: SessionLink[];
  title: string;
  onOpen: (id: string) => void;
  onNewSession: () => void;
}

export function GlobeRail({ sessions, links, title, onOpen, onNewSession }: GlobeRailProps) {
  const [activeId,      setActiveId]      = useState<string | null>(null);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null);
  const [entered,       setEntered]       = useState(false);

  const railRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { placed, pending } = useMemo(() => {
    const placed: PlacedSession[] = [], pending: GlobeSessionWithData[] = [];
    for (const session of sessions) {
      const place = sessionPlace(session);
      if (place) placed.push({ session, place }); else pending.push(session);
    }
    return { placed, pending };
  }, [sessions]);

  const markers = useMemo<WorldMarker[]>(
    () => placed.map(p => ({ id: p.session.id, lat: p.place.lat, lng: p.place.lng })),
    [placed],
  );

  const arcs = useMemo<WorldArc[]>(() => {
    const byId = new Map(placed.map(p => [p.session.id, p.place]));
    return links.flatMap(l => {
      const a = byId.get(l.fromSessionId), b = byId.get(l.toSessionId);
      return a && b ? [{ fromLat: a.lat, fromLng: a.lng, toLat: b.lat, toLng: b.lng }] : [];
    });
  }, [links, placed]);

  // Hover a pin/card: highlight it (and scroll the card into view).
  const handleHover = useCallback((id: string | null) => {
    if (pendingOpenId || selectedId) return;
    setActiveId(id);
    if (id) railRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pendingOpenId, selectedId]);

  // Select: show the preview panel; the globe flies via the focus effect below.
  const handleSelect = useCallback((id: string) => {
    if (pendingOpenId) return;
    setSelectedId(id);
    setActiveId(id);
  }, [pendingOpenId]);

  // Open: navigate (the globe is already focused on this session, so the next
  // page just keeps flying — a continuation, not a remount).
  const handleOpen = useCallback((id: string) => {
    if (pendingOpenId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingOpenId(id);
    setActiveId(id);
    timerRef.current = setTimeout(() => onOpen(id), 260);
  }, [pendingOpenId, onOpen]);

  // Keep latest handlers reachable from the (stable) store callbacks.
  const hoverRef = useRef(handleHover); hoverRef.current = handleHover;
  const selectRef = useRef(handleSelect); selectRef.current = handleSelect;

  // Push this page's data + interaction handlers into the shared globe.
  useEffect(() => {
    useGlobeStore.getState().configure({
      markers,
      arcs,
      labels: placed.map((p) => ({ name: p.place.name || p.session.title, lat: p.place.lat, lng: p.place.lng, rank: 0 })),
      mode: "constellation",
      onHover: (id) => hoverRef.current(id),
      onPick: (id) => selectRef.current(id),
    });
  }, [markers, arcs, placed]);

  // Drive focus (fly/zoom) + highlight from the current selection.
  useEffect(() => {
    const focusId = selectedId ?? pendingOpenId;
    const idx = focusId ? markers.findIndex(m => m.id === focusId) : -1;
    useGlobeStore.getState().configure({
      focusIndex: idx >= 0 ? idx : null,
      activeId: pendingOpenId ?? selectedId ?? activeId,
    });
  }, [selectedId, activeId, pendingOpenId, markers]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useLayoutEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const selectedEntry = selectedId ? placed.find(p => p.session.id === selectedId) : null;

  return (
    <div className="pointer-events-none relative z-10 flex h-screen w-full overflow-hidden">
      {/* Globe area - transparent + click-through so the globe behind is interactive */}
      <div className="pointer-events-none relative min-w-0 flex-1 overflow-hidden">
        <Link
          href="/"
          className="pointer-events-auto absolute left-6 top-5 z-20 flex items-center gap-2 text-fg transition-opacity hover:opacity-80"
          style={{ textShadow: "0 2px 16px rgba(5,7,15,0.95)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rainbolt_logo.png" alt="" className="h-8 w-auto object-contain" />
          <span className="text-lg font-semibold tracking-tight">rainbolt.ai</span>
        </Link>
        <div
          className="pointer-events-none absolute bottom-8 left-8 z-20 transition-all duration-700"
          style={{
            textShadow: "0 2px 16px rgba(5,7,15,0.95)",
            opacity: entered ? 1 : 0,
            transform: entered ? "translateY(0)" : "translateY(10px)",
          }}
        >
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-fg-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="font-mono tabular-nums text-fg/80">{placed.length}</span> {placed.length === 1 ? "place" : "places"}
            {pending.length > 0 && (
              <span className="text-fg-muted/50">
                · <span className="font-mono tabular-nums">{pending.length}</span> analyzing
              </span>
            )}
          </p>
        </div>

        <DecorLayer items={LEARNING_DECOR} storageKey="learning" />

        {/* Floating session preview - opens to the left of the globe */}
        {selectedEntry && !pendingOpenId && (
          <SessionPreview
            key={selectedEntry.session.id}
            session={selectedEntry.session}
            place={selectedEntry.place}
            onClose={() => { setSelectedId(null); setActiveId(null); }}
            onOpen={() => handleOpen(selectedEntry.session.id)}
          />
        )}
      </div>

      {/* Rail */}
      <aside
        className="pointer-events-auto flex w-[340px] shrink-0 flex-col overflow-hidden border-l border-white/[0.08] bg-space-950 transition-all duration-500"
        style={{ opacity: entered ? 1 : 0, transform: entered ? "translateX(0)" : "translateX(16px)" }}
      >
        {/* Account header */}
        <div className="flex h-[68px] shrink-0 items-center justify-end border-b border-white/[0.06] px-4">
          <LoginComponent />
        </div>

        {/* New session */}
        <div className="shrink-0 px-3 pt-3 pb-2">
          <button
            onClick={onNewSession}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-space-950 transition-colors hover:bg-white/90"
          >
            <Plus className="h-4 w-4" />
            New session
          </button>
        </div>
        <div className="px-3 pb-1">
          <p className="px-1 text-[11px] font-mono uppercase tracking-[0.14em] text-fg-muted/40">
            Sessions
          </p>
        </div>

        {/* Card list */}
        <div className="flex-1 overflow-y-auto px-3 py-1 pb-16">
          {placed.map(({ session, place }, i) => (
            <RailCard
              key={session.id}
              ref={el => { railRefs.current[session.id] = el; }}
              session={session}
              place={place}
              active={activeId === session.id || selectedId === session.id}
              navigating={pendingOpenId === session.id}
              entered={entered}
              index={i}
              onEnter={() => handleHover(session.id)}
              onLeave={() => handleHover(null)}
              onClick={() => handleSelect(session.id)}
            />
          ))}

          {pending.length > 0 && (
            <div className="mt-3">
              <p className="px-1 pb-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-fg-muted/40">
                Analyzing
              </p>
              {pending.map(session => (
                <PendingCard
                  key={session.id}
                  session={session}
                  onClick={() => handleOpen(session.id)}
                />
              ))}
            </div>
          )}

          {sessions.length === 0 && (
            <p className="px-1 py-10 text-center text-sm text-fg-muted/40">
              No sessions yet. Start one to drop your first pin.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

// ─── Session preview panel ────────────────────────────────────────────────────

function SessionPreview({
  session,
  place,
  onClose,
  onOpen,
}: {
  session: GlobeSessionWithData;
  place: SessionPlace;
  onClose: () => void;
  onOpen: () => void;
}) {
  const demo  = DEMO_SESSION_CONTENT[session.id];
  const marker = demo?.markers[0];
  const pct   = marker ? Math.round(marker.accuracy * 100) : null;
  const barColor =
    pct === null ? null
    : pct >= 75 ? "#4ade80"
    : pct >= 50 ? "#e8b44f"
    : "#e5373e";

  return (
    <div className="pointer-events-auto absolute left-6 top-1/2 z-30 flex w-[300px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-space-900/95 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-left-2 duration-200">
      {/* Hero image */}
      {place.thumb && (
        <div className="relative aspect-video w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={place.thumb}
            alt={place.name || session.title}
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-space-900/70 to-transparent" />
          <Reticle />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2.5 top-2.5 rounded-full bg-black/50 p-1.5 text-white/70 backdrop-blur-sm transition-colors hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="px-4 py-4">
        <div className="mb-1 flex items-center gap-1.5">
          <MapPin className="h-3 w-3 shrink-0 text-fg-muted/60" />
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/60">
            Best guess
          </span>
        </div>
        <h2 className="text-sm font-semibold leading-snug text-fg">
          {place.name || session.title}
        </h2>
        <p className="mt-0.5 text-[11px] tabular-nums text-fg-muted">
          {Math.abs(place.lat).toFixed(3)}°{place.lat >= 0 ? "N" : "S"}
          &ensp;
          {Math.abs(place.lng).toFixed(3)}°{place.lng >= 0 ? "E" : "W"}
        </p>

        {pct !== null && barColor && (
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-medium tabular-nums" style={{ color: barColor }}>
              {pct}%
            </span>
          </div>
        )}

        {marker?.facts && (
          <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-fg/60">
            {marker.facts}
          </p>
        )}

        <button
          onClick={onOpen}
          className="group mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-sm font-semibold text-space-950 transition-colors hover:bg-white/90"
        >
          Open session
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Rail cards ───────────────────────────────────────────────────────────────

const RailCard = forwardRef<
  HTMLButtonElement,
  {
    session: GlobeSessionWithData;
    place: SessionPlace;
    active: boolean;
    navigating: boolean;
    entered: boolean;
    index: number;
    onEnter: () => void;
    onLeave: () => void;
    onClick: () => void;
  }
>(function RailCard({ session, place, active, navigating, entered, index, onEnter, onLeave, onClick }, ref) {
  const on = active || navigating;
  const acc = DEMO_SESSION_CONTENT[session.id]?.markers?.[0]?.accuracy;
  const pct = acc != null ? Math.round(acc * 100) : null;
  const confCol = acc == null ? "" : confColor(acc);
  const lat = `${Math.abs(place.lat).toFixed(2)}°${place.lat >= 0 ? "N" : "S"}`;
  const lng = `${Math.abs(place.lng).toFixed(2)}°${place.lng >= 0 ? "E" : "W"}`;

  // Viewfinder reticle corner ticks - geolocation/observatory flair.
  const corner =
    "pointer-events-none absolute h-2 w-2 border-white/30 transition-colors duration-200 group-hover:border-white/70";

  return (
    <button
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={`group relative mb-1 flex w-full items-center gap-3 rounded-lg border px-2.5 py-2.5 text-left transition-colors duration-150 ${
        on
          ? "border-white/[0.12] bg-white/[0.05]"
          : "border-transparent hover:border-white/[0.07] hover:bg-white/[0.025]"
      }`}
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(6px)",
        transition: `opacity 350ms ${100 + index * 45}ms, transform 350ms ${100 + index * 45}ms, border-color 150ms, background 150ms`,
      }}
    >
      {/* Active indicator */}
      <span
        className={`absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-white transition-opacity ${
          on ? "opacity-90" : "opacity-0"
        }`}
      />

      {/* Thumbnail framed like a viewfinder */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-space-900 ring-1 ring-inset ring-white/[0.08]">
        {place.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.thumb}
            alt={place.name || session.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MapPin className="h-4 w-4 text-fg-muted/20" />
          </div>
        )}
        <span className={`${corner} left-[3px] top-[3px] border-l border-t`} />
        <span className={`${corner} right-[3px] top-[3px] border-r border-t`} />
        <span className={`${corner} bottom-[3px] left-[3px] border-b border-l`} />
        <span className={`${corner} bottom-[3px] right-[3px] border-b border-r`} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-medium text-fg">{session.title}</h3>
          {pct != null && (
            <span className="shrink-0 font-mono text-[10px] tabular-nums" style={{ color: confCol }}>
              {pct}%
            </span>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-fg-muted">
          <MapPin className="h-3 w-3 shrink-0 text-fg-muted/45" />
          <span className="truncate">{place.name || "Unlocated"}</span>
        </p>
        <p className="mt-1 font-mono text-[10px] tabular-nums tracking-tight text-fg-muted/45">
          {lat} &nbsp;{lng}
        </p>
      </div>
    </button>
  );
});

function PendingCard({ session, onClick }: { session: GlobeSessionWithData; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-1 flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition-colors hover:border-white/[0.07] hover:bg-white/[0.025]"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-space-900 ring-1 ring-inset ring-white/[0.08]">
        <Loader2 className="h-4 w-4 animate-spin text-fg-muted/30" />
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium text-fg/60">{session.title}</h3>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted/40">Locating…</p>
      </div>
    </button>
  );
}
