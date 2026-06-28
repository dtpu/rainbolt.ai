"use client";

import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, MapPin } from "lucide-react";
import { Plus } from "lucide-react";
import { GlobeSessionWithData, SessionLink } from "@/lib/globe-database";
import { sessionPlace, SessionPlace } from "@/lib/session-place";
import { DEMO_SESSION_CONTENT } from "@/lib/demo-constellation";
import { SpaceBackdrop } from "@/components/SpaceBackdrop";
import { DecorLayer } from "@/components/decor/DecorLayer";
import { LEARNING_DECOR } from "@/lib/decor/layouts";
import ConstellationGlobe, {
  ConstellationGlobeHandle,
  GlobeMarker,
  GlobeArc,
} from "./ConstellationGlobe";

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

  const globeRef = useRef<ConstellationGlobeHandle>(null);
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

  const markers = useMemo<GlobeMarker[]>(
    () => placed.map(p => ({ id: p.session.id, lat: p.place.lat, lng: p.place.lng })),
    [placed],
  );

  const arcs = useMemo<GlobeArc[]>(() => {
    const byId = new Map(placed.map(p => [p.session.id, p.place]));
    return links.flatMap(l => {
      const a = byId.get(l.fromSessionId), b = byId.get(l.toSessionId);
      return a && b ? [{ fromLat: a.lat, fromLng: a.lng, toLat: b.lat, toLng: b.lng }] : [];
    });
  }, [links, placed]);

  // Hover: rotate globe toward pin. Don't move globe while a preview is open.
  const handleHover = useCallback((id: string | null) => {
    if (pendingOpenId || selectedId) return;
    setActiveId(id);
    if (id) {
      railRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const place = placed.find(p => p.session.id === id)?.place;
      if (place) globeRef.current?.rotateTo(place.lat, place.lng);
    } else {
      globeRef.current?.cancelRotation();
    }
  }, [pendingOpenId, selectedId, placed]);

  // Select: show the preview panel (no navigation yet).
  const handleSelect = useCallback((id: string, place?: SessionPlace) => {
    if (pendingOpenId) return;
    setSelectedId(id);
    setActiveId(id);
    globeRef.current?.cancelRotation();
    if (place) globeRef.current?.rotateTo(place.lat, place.lng);
  }, [pendingOpenId]);

  // Open: fly-to then navigate (called from preview "Open session" button).
  const handleOpen = useCallback((id: string, place?: SessionPlace) => {
    if (pendingOpenId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingOpenId(id);
    setActiveId(id);
    globeRef.current?.cancelRotation();
    if (place) globeRef.current?.flyTo(place.lat, place.lng);

    timerRef.current = setTimeout(() => {
      if (typeof document !== "undefined" && "startViewTransition" in document) {
        (document as Document & { startViewTransition: (cb: () => void) => void })
          .startViewTransition(() => onOpen(id));
      } else {
        onOpen(id);
      }
    }, place ? 220 : 60);
  }, [pendingOpenId, onOpen]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useLayoutEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const selectedEntry = selectedId ? placed.find(p => p.session.id === selectedId) : null;

  return (
    <div className="flex h-screen w-full bg-space-950 pt-20">
      {/* Globe */}
      <div className="relative min-w-0 flex-1" style={{ viewTransitionName: "main-globe" }}>
        <SpaceBackdrop />
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
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-star-400" />
            {placed.length} {placed.length === 1 ? "place" : "places"}
            {pending.length > 0 && <span className="text-fg-muted/50">· {pending.length} analyzing</span>}
          </p>
        </div>

        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: entered ? 1 : 0 }}
        >
          <ConstellationGlobe
            ref={globeRef}
            markers={markers}
            arcs={arcs}
            activeId={pendingOpenId ?? activeId}
            onHover={id => { if (id) handleHover(id); else handleHover(null); }}
            onOpen={id => {
              const place = placed.find(p => p.session.id === id)?.place;
              handleSelect(id, place);
            }}
          />
        </div>

        <DecorLayer items={LEARNING_DECOR} storageKey="learning" />
      </div>

      {/* Rail */}
      <aside
        className="flex w-[340px] shrink-0 flex-col border-l border-white/[0.08] bg-space-950 transition-all duration-500"
        style={{ opacity: entered ? 1 : 0, transform: entered ? "translateX(0)" : "translateX(16px)" }}
      >
        {selectedEntry && !pendingOpenId ? (
          <SessionPreview
            session={selectedEntry.session}
            place={selectedEntry.place}
            onBack={() => { setSelectedId(null); setActiveId(null); globeRef.current?.cancelRotation(); }}
            onOpen={() => handleOpen(selectedEntry.session.id, selectedEntry.place)}
          />
        ) : (
          <>
            {/* New session */}
            <div className="shrink-0 px-3 py-3">
              <button
                onClick={onNewSession}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-star-400 px-3 py-2.5 text-sm font-semibold text-space-950 transition-colors hover:bg-star-300"
              >
                <Plus className="h-4 w-4" />
                New session
              </button>
            </div>
            <div className="px-3 pb-1">
              <p className="px-1 text-[11px] font-medium uppercase tracking-wider text-fg-muted/40">
                Sessions
              </p>
            </div>

            {/* Card list */}
            <div className="flex-1 overflow-y-auto px-3 py-1">
              {placed.map(({ session, place }, i) => (
                <RailCard
                  key={session.id}
                  ref={el => { railRefs.current[session.id] = el; }}
                  session={session}
                  place={place}
                  active={activeId === session.id}
                  navigating={pendingOpenId === session.id}
                  entered={entered}
                  index={i}
                  onEnter={() => handleHover(session.id)}
                  onLeave={() => handleHover(null)}
                  onClick={() => handleSelect(session.id, place)}
                />
              ))}

              {pending.length > 0 && (
                <div className="mt-3">
                  <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-muted/40">
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
                  No sessions yet — start one to drop your first pin.
                </p>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

// ─── Session preview panel ────────────────────────────────────────────────────

function SessionPreview({
  session,
  place,
  onBack,
  onOpen,
}: {
  session: GlobeSessionWithData;
  place: SessionPlace;
  onBack: () => void;
  onOpen: () => void;
}) {
  const demo  = DEMO_SESSION_CONTENT[session.id];
  const marker = demo?.markers[0];
  const pct   = marker ? Math.round(marker.accuracy * 100) : null;
  const barColor =
    pct === null ? null
    : pct >= 75 ? "#4ade80"
    : pct >= 50 ? "#E8B44F"
    : "#e5373e";

  return (
    <div className="flex h-full flex-col">
      {/* Back */}
      <div className="shrink-0 border-b border-white/[0.06] px-2 py-2">
        <button
          onClick={onBack}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-fg-muted transition-colors hover:bg-white/[0.04] hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          All sessions
        </button>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Hero image */}
        {place.thumb && (
          <div className="aspect-video w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={place.thumb}
              alt={place.name || session.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="px-4 py-4">
          <h2 className="text-sm font-semibold text-fg leading-snug">
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
            <p className="mt-3 line-clamp-5 text-xs leading-relaxed text-fg/60">
              {marker.facts}
            </p>
          )}
        </div>
      </div>

      {/* Open button */}
      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <button
          onClick={onOpen}
          className="group flex w-full items-center justify-center gap-2 rounded-lg bg-star-400 py-3 text-sm font-semibold text-space-950 transition-colors hover:bg-star-300"
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
  return (
    <button
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={`group relative mb-0.5 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-100 ${
        navigating || active ? "bg-white/[0.06]" : "hover:bg-white/[0.035]"
      }`}
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(6px)",
        transition: `opacity 350ms ${100 + index * 45}ms, transform 350ms ${100 + index * 45}ms, background 100ms`,
      }}
    >
      {/* Gold active indicator */}
      <span
        className={`absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-star-400 transition-opacity ${
          active || navigating ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-space-900">
        {place.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.thumb}
            alt={place.name || session.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MapPin className="h-4 w-4 text-fg-muted/20" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-fg">{session.title}</h3>
        <p className="mt-0.5 truncate text-xs text-fg-muted">
          {place.name || `${place.lat.toFixed(1)}, ${place.lng.toFixed(1)}`}
        </p>
      </div>
    </button>
  );
});

function PendingCard({ session, onClick }: { session: GlobeSessionWithData; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-0.5 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-space-900">
        <Loader2 className="h-4 w-4 animate-spin text-fg-muted/30" />
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium text-fg/60">{session.title}</h3>
        <p className="mt-0.5 text-xs italic text-fg-muted/40">Locating…</p>
      </div>
    </button>
  );
}
