"use client";

import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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
  // page just keeps flying - a continuation, not a remount).
  const handleOpen = useCallback((id: string) => {
    if (pendingOpenId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingOpenId(id);
    setActiveId(id);
    // Long enough for the page chrome (preview, rail, titles) to animate out
    // while the globe keeps flying - the route swap lands on a quiet frame.
    timerRef.current = setTimeout(() => onOpen(id), 420);
  }, [pendingOpenId, onOpen]);

  // Keep latest handlers reachable from the (stable) store callbacks.
  const hoverRef = useRef(handleHover); hoverRef.current = handleHover;
  const selectRef = useRef(handleSelect); selectRef.current = handleSelect;

  // Push this page's data + interaction handlers into the shared globe.
  useEffect(() => {
    // Phones: the rail is a bottom sheet, not a side panel, so the globe
    // keeps the full width and doesn't need a horizontal offset.
    const railAside = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
    useGlobeStore.getState().configure({
      markers,
      arcs,
      labels: placed.map((p) => ({ name: p.place.name || p.session.title, lat: p.place.lat, lng: p.place.lng, rank: 0 })),
      panLeft: 0,
      panRight: railAside ? 340 : 0, // the rail
      panBottom: railAside ? 0 : Math.round(window.innerHeight * 0.46), // the bottom sheet
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
  // Opening a session: fade this page's chrome out before the route swaps.
  const leaving = !!pendingOpenId;

  return (
    // Phones stack: globe on top, the rail as a full-width bottom sheet.
    <div className="pointer-events-none relative z-10 flex h-screen w-full flex-col overflow-hidden md:flex-row">
      {/* Globe area - transparent + click-through so the globe behind is interactive */}
      <div className="pointer-events-none relative min-w-0 flex-1 overflow-hidden">
        <Link
          href="/"
          className="pointer-events-auto absolute left-6 top-5 z-20 flex items-center gap-2 text-fg transition-opacity duration-300 hover:opacity-80"
          style={{ textShadow: "0 2px 16px rgba(5,7,15,0.95)", opacity: leaving ? 0 : 1 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rainbolt_logo.png" alt="" className="h-8 w-auto object-contain" />
          <span className="text-lg font-semibold tracking-tight">rainbolt.ai</span>
        </Link>
        <div
          className="pointer-events-none absolute bottom-4 left-6 z-20 transition-all md:bottom-8 md:left-8"
          style={{
            textShadow: "0 2px 16px rgba(5,7,15,0.95)",
            transitionDuration: leaving ? "300ms" : "700ms",
            opacity: entered && !leaving ? 1 : 0,
            transform: entered && !leaving ? "translateY(0)" : "translateY(10px)",
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

        {/* Decor assumes a wide sky; skip it (and its WebGL cost) on phones. */}
        <div className="hidden md:block">
          <DecorLayer items={LEARNING_DECOR} storageKey="learning" />
        </div>

        {/* Floating session preview - opens to the left of the globe */}
        <AnimatePresence>
          {selectedEntry && !pendingOpenId && (
            <SessionPreview
              key={selectedEntry.session.id}
              session={selectedEntry.session}
              place={selectedEntry.place}
              onClose={() => { setSelectedId(null); setActiveId(null); }}
              onOpen={() => handleOpen(selectedEntry.session.id)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Rail */}
      <aside
        className="pointer-events-auto flex h-[46%] w-full shrink-0 flex-col overflow-hidden rounded-t-2xl border-t border-white/[0.08] bg-space-950 transition-all duration-500 md:h-auto md:w-[340px] md:rounded-none md:border-l md:border-t-0"
        style={{
          transitionDuration: leaving ? "320ms" : "500ms",
          opacity: entered && !leaving ? 1 : 0,
          transform: entered && !leaving ? "translateX(0)" : "translateX(16px)",
        }}
      >
        {/* Account header */}
        <div className="flex h-14 shrink-0 items-center justify-end border-b border-white/[0.06] px-4 md:h-[68px]">
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
    <motion.div
      initial={{ opacity: 0, x: -14, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.97 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto absolute left-1/2 top-1/2 z-30 w-[calc(100%-2.5rem)] max-w-[380px] -translate-x-1/2 -translate-y-1/2 md:left-8 md:w-[380px] md:translate-x-0"
    >
      {/* Whole card opens the session - mirrors the dossier header on the
          session page: verdict overlaid on the photo, quiet footer row. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
        className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-white/[0.09] bg-space-900 shadow-[0_16px_48px_rgba(0,0,0,0.6)] transition-colors hover:border-white/20"
      >
        {place.thumb && (
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-space-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={place.thumb}
              alt={place.name || session.title}
              className="h-full w-full object-cover"
            />
            <Reticle />
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              aria-label="Close"
              className="absolute right-2.5 top-2.5 rounded-full bg-black/50 p-1.5 text-white/70 backdrop-blur-sm transition-colors hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-space-900 via-space-900/70 to-transparent px-4 pb-3 pt-12">
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/70">Best guess</p>
              <h2 className="mt-0.5 text-base font-semibold leading-snug text-fg">
                {place.name || session.title}
              </h2>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span className="font-mono text-[11px] tabular-nums text-fg-muted">
                  {Math.abs(place.lat).toFixed(3)}°{place.lat >= 0 ? "N" : "S"} {Math.abs(place.lng).toFixed(3)}°{place.lng >= 0 ? "E" : "W"}
                </span>
                {pct !== null && barColor && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="h-[3px] w-14 overflow-hidden rounded-full bg-white/[0.14]">
                      <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                    </span>
                    <span className="text-xs font-medium tabular-nums" style={{ color: barColor }}>
                      {pct}%
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {marker?.facts && (
          <p className="line-clamp-3 px-4 pt-3 text-[13px] leading-relaxed text-fg-muted">
            {marker.facts}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-[13px] font-medium text-fg">
          Open session
          <ArrowRight className="h-4 w-4 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
        </div>
      </div>
    </motion.div>
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
