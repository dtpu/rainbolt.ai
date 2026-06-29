"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, ExternalLink, Home, ImagePlus,
  Loader2, Map as MapIcon, MapPin, MessageSquare, Plus, X,
} from "lucide-react";
import SimpleGlobe from "@/components/globe/SimpleGlobe";
import { ChatHistory } from "@/components/chat/ChatHistory";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { MarkerNav } from "@/components/chat/MarkerNav";
import { SpaceBackdrop } from "@/components/SpaceBackdrop";
import { Reticle } from "@/components/ui/Reticle";
import { DesktopOnlyNotice } from "@/components/chat/DesktopOnlyNotice";
import { useChatStore, type Marker } from "@/components/useChatStore";
import { useChatSession } from "@/hooks/useChatSession";

const confColor = (acc: number) =>
  acc >= 0.75 ? "#4ade80" : acc >= 0.5 ? "#e8b44f" : "#e5373e";

const coordLabel = (lat: number, lng: number) =>
  `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;

const mapsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const mapEmbed = (lat: number, lng: number) =>
  `https://www.google.com/maps?q=${lat},${lng}&z=10&output=embed`;

type Tab = "chat" | "photos" | "places";

export default function ChatPage() {
  const params    = useParams();
  const router    = useRouter();
  const sessionId = params.sessionId as string;

  const uploadedImageUrl = useChatStore((s) => s.uploadedImageUrl);
  const markers          = useChatStore((s) => s.markers);
  const currentMarker    = useChatStore((s) => s.currentMarker);
  const setCurrentMarker = useChatStore((s) => s.setCurrentMarker);
  const nextMarker       = useChatStore((s) => s.nextMarker);
  const previousMarker   = useChatStore((s) => s.previousMarker);

  const [isLocked, setIsLocked] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const hasLockedRef = useRef(false);

  useChatSession(sessionId);

  useEffect(() => {
    if (markers.length > 0) {
      if (!hasLockedRef.current) { setIsLocked(true); hasLockedRef.current = true; }
    } else {
      setIsLocked(false);
      hasLockedRef.current = false;
    }
  }, [markers.length]);

  const globeMarkers = markers.map((m) => ({
    lat: m.latitude, long: m.longitude, confidence: m.accuracy * 100,
  }));
  const marker = markers.length > 0 && currentMarker < markers.length ? markers[currentMarker] : null;

  // Drop a reference (text and/or image) into the chat as a comparison prompt.
  const addToChat = (text: string, image?: string) => {
    useChatStore.setState((s) => ({
      messages: [
        ...s.messages,
        {
          id: `ref-${Date.now()}`,
          role: "user" as const,
          text,
          ts: Date.now(),
          type: "normal" as const,
          ...(image ? { image } : {}),
        },
      ],
    }));
    setTab("chat");
  };

  const handleBack = () => {
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as Document & { startViewTransition: (cb: () => void) => void })
        .startViewTransition(() => router.back());
    } else router.back();
  };

  const TABS: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "photos", label: "Photos", icon: ImagePlus },
    { id: "places", label: "Places", icon: MapIcon },
  ];

  return (
    <div className="flex h-screen bg-space-950 text-fg">
      {/* ── Left: result + ranked guesses ──────────────────────────────── */}
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-white/[0.08] bg-space-950">
        <div className="flex h-14 shrink-0 items-center border-b border-white/[0.07] px-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors hover:bg-white/[0.05] hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {uploadedImageUrl && (
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-space-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploadedImageUrl} alt="Analyzed photo" className="h-full w-full object-cover" />
              <span className="absolute left-2.5 top-2.5 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
                Analyzed photo
              </span>
              <Reticle />
            </div>
          )}

          {marker ? (
            <div className="px-4 py-4">
              {/* selected guess header */}
              <div className="mb-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-fg-muted/60" />
                <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/60">
                  Best guess
                </span>
              </div>
              <h1 className="text-lg font-semibold leading-snug text-fg">{marker.name}</h1>
              <p className="mt-0.5 text-xs tabular-nums text-fg-muted">
                {coordLabel(marker.latitude, marker.longitude)}
              </p>
              <div className="mt-3 flex items-center gap-2.5">
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(marker.accuracy * 100)}%`, backgroundColor: confColor(marker.accuracy) }}
                  />
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums" style={{ color: confColor(marker.accuracy) }}>
                  {Math.round(marker.accuracy * 100)}%
                </span>
              </div>

              {/* ranked candidates */}
              {markers.length > 1 && (
                <div className="mt-5">
                  <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/60">
                    {markers.length} candidates
                  </p>
                  <div className="space-y-1">
                    {markers.map((m, i) => (
                      <GuessRow
                        key={i}
                        rank={i + 1}
                        marker={m}
                        active={i === currentMarker}
                        onClick={() => { setCurrentMarker(i); setIsLocked(true); }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {marker.facts && (
                <div className="mt-5 border-t border-white/[0.06] pt-4">
                  <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/60">
                    Why here
                  </p>
                  <p className="text-[13px] leading-relaxed text-fg/70">{marker.facts}</p>
                </div>
              )}

              <a
                href={`https://www.google.com/maps/place/${marker.latitude},${marker.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-fg"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Google Maps
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-fg-muted/40" />
              <p className="text-sm text-fg-muted/60">Pinpointing the location…</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Center: globe ──────────────────────────────────────────────── */}
      <div
        className="relative min-w-0 flex-1 overflow-hidden"
        style={{ viewTransitionName: "main-globe" }}
      >
        <SpaceBackdrop />
        <SimpleGlobe
          markers={globeMarkers}
          targetMarkerIndex={currentMarker}
          isLocked={isLocked}
          onUnlock={() => setIsLocked(false)}
          onLock={() => setIsLocked(true)}
          onMarkerClick={(i) => { setCurrentMarker(i); setIsLocked(true); }}
        />
        {markers.length > 1 && (
          <MarkerNav
            currentMarker={currentMarker}
            markersCount={markers.length}
            onPrevious={() => { setIsLocked(true); previousMarker(); }}
            onNext={() => { setIsLocked(true); nextMarker(); }}
          />
        )}
      </div>

      {/* ── Right: tabbed panel ────────────────────────────────────────── */}
      <aside className="flex w-[360px] shrink-0 flex-col border-l border-white/[0.08] bg-space-950">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
          <span className="text-sm font-semibold text-fg">Rainbolt AI</span>
          <Link
            href="/"
            className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-white/[0.05] hover:text-fg"
          >
            <Home className="h-4 w-4" />
          </Link>
        </div>

        {/* tab bar */}
        <div className="flex shrink-0 border-b border-white/[0.07]">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                  on ? "text-fg" : "text-fg-muted hover:text-fg/80"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {on && (
                  <motion.span
                    layoutId="chat-tab-underline"
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-fg"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* tab content */}
        {tab === "chat" && (
          <>
            <ChatHistory />
            <ChatComposer />
          </>
        )}
        {tab === "photos" && <PhotosTab analyzed={uploadedImageUrl} />}
        {tab === "places" && (
          <PlacesTab markers={markers} onAdd={addToChat} />
        )}
      </aside>

      <DesktopOnlyNotice />
    </div>
  );
}

// ── Ranked candidate row ───────────────────────────────────────────────
function GuessRow({
  rank, marker, active, onClick,
}: { rank: number; marker: Marker; active: boolean; onClick: () => void }) {
  const pct = Math.round(marker.accuracy * 100);
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
        active ? "bg-white/[0.06]" : "hover:bg-white/[0.035]"
      }`}
    >
      <span className={`w-4 shrink-0 text-center text-xs font-semibold tabular-nums ${active ? "text-fg" : "text-fg-muted/50"}`}>
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] ${active ? "font-medium text-fg" : "text-fg/80"}`}>{marker.name}</p>
        <div className="mt-1 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: confColor(marker.accuracy) }} />
        </div>
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-fg-muted">{pct}%</span>
    </button>
  );
}

// ── Places tab - each candidate location, mapped + linkable ────────────
function PlacesTab({
  markers, onAdd,
}: {
  markers: Marker[];
  onAdd: (text: string, image?: string) => void;
}) {
  if (markers.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <MapIcon className="h-5 w-5 text-fg-muted/40" />
        <p className="text-sm text-fg-muted/60">No candidate places yet</p>
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <p className="mb-3 px-1 text-xs text-fg-muted/60">
        {markers.length} candidate {markers.length === 1 ? "place" : "places"}. Open any in Google Maps
        or add it to the chat to compare.
      </p>
      <div className="space-y-3">
        {markers.map((m, i) => {
          const pct = Math.round(m.accuracy * 100);
          return (
            <div key={i} className="overflow-hidden rounded-xl border border-white/[0.07] bg-space-900">
              <div className="relative aspect-video w-full bg-space-950">
                <iframe
                  title={m.name}
                  src={mapEmbed(m.latitude, m.longitude)}
                  loading="lazy"
                  className="h-full w-full border-0"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white/80 backdrop-blur-sm">
                  #{i + 1}
                </span>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-medium text-fg">{m.name}</h3>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color: confColor(m.accuracy) }}>
                    {pct}%
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[10px] tabular-nums text-fg-muted/50">
                  {coordLabel(m.latitude, m.longitude)}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <a
                    href={mapsUrl(m.latitude, m.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] py-2 text-xs font-medium text-fg transition-colors hover:bg-white/[0.08]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Google Maps
                  </a>
                  <button
                    onClick={() => onAdd(`Could the spot be ${m.name}? ${mapsUrl(m.latitude, m.longitude)}`)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-xs font-semibold text-space-950 transition-colors hover:bg-white/90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add to chat
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Photos tab ─────────────────────────────────────────────────────────
function PhotosTab({ analyzed }: { analyzed: string | null }) {
  const [extra, setExtra] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 4).forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setExtra((p) => [...p, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      {analyzed && (
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/60">Analyzed</p>
          <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-space-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={analyzed} alt="Analyzed" className="w-full object-cover" />
          </div>
        </div>
      )}

      {extra.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {extra.map((src, i) => (
            <div key={i} className="group relative overflow-hidden rounded-lg border border-white/[0.06] bg-space-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="aspect-square w-full object-cover" />
              <button
                onClick={() => setExtra((p) => p.filter((_, j) => j !== i))}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] py-8 text-center transition-colors hover:border-white/25 hover:bg-white/[0.02]"
      >
        <ImagePlus className="h-5 w-5 text-fg-muted/60" />
        <span className="text-sm text-fg">Add another angle</span>
        <span className="text-xs text-fg-muted/50">Compare more photos of the same place</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}

