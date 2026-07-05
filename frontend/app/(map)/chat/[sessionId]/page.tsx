"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

// Leaflet touches window at import, so load the map client-only.
const EvidenceMap = dynamic(() => import("@/components/chat/EvidenceMap").then((m) => m.EvidenceMap), { ssr: false });
import {
  ArrowLeft, ExternalLink, Home, ImagePlus,
  Loader2, Map as MapIcon, Maximize2, MessageSquare, Target, X,
} from "lucide-react";
import { ChatHistory } from "@/components/chat/ChatHistory";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ImageAnnotator, type PinFocus } from "@/components/chat/ImageAnnotator";
import { MarkerNav } from "@/components/chat/MarkerNav";
import { Reticle } from "@/components/ui/Reticle";
import { useChatStore, type Marker } from "@/components/useChatStore";
import { useChatSession } from "@/hooks/useChatSession";
import { useAreaPhotos, type AreaPhoto } from "@/hooks/useAreaPhotos";
import { useAreaPlaces } from "@/hooks/useAreaPlaces";
import { useGlobeStore } from "@/lib/globe/store";
import { pinColor, confColor } from "@/lib/globe/palette";

const coordLabel = (lat: number, lng: number) =>
  `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;

const mapsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
// Legacy keyless Street View embed - actual on-the-ground Google photos.
const streetEmbed = (lat: number, lng: number) =>
  `https://www.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=12,0,0,0,0&output=svembed`;
const streetViewUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

type Tab = "chat" | "photos" | "places" | "result";

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

  const [tab, setTab] = useState<Tab>("chat");
  const [loadFailed, setLoadFailed] = useState(false);
  // Full-screen viewer for the analyzed photo (openable from chat + dossier).
  const [lightbox, setLightbox] = useState<string | null>(null);
  // Centre stage: the globe, or the analyzed photo with clue annotations.
  const [centerView, setCenterView] = useState<"globe" | "image">("globe");
  useEffect(() => { setCenterView("globe"); }, [sessionId]);

  // Clue links inside chat messages jump here: swap to the photo and pop
  // that pin open (the nonce re-triggers for repeat clicks on the same pin).
  const [pinFocus, setPinFocus] = useState<PinFocus | null>(null);
  useEffect(() => {
    const onOpenPin = (e: Event) => {
      setCenterView("image");
      setPinFocus({ index: (e as CustomEvent<number>).detail, nonce: performance.now() });
    };
    window.addEventListener("rainbolt-open-pin", onOpenPin);
    return () => window.removeEventListener("rainbolt-open-pin", onOpenPin);
  }, []);

  // Phones get a single full-width panel with the dossier as an extra tab;
  // tracked in state (not just CSS) so the dossier (Leaflet map, Street View
  // iframe) is only ever mounted once.
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  // The Result tab only exists on phones; fall back if the viewport grows.
  useEffect(() => {
    if (isDesktop && tab === "result") setTab("chat");
  }, [isDesktop, tab]);

  useChatSession(sessionId);

  // Unknown id / backend down: surface an error instead of an endless spinner.
  useEffect(() => {
    setLoadFailed(false);
    if (markers.length > 0) return;
    const t = setTimeout(() => { if (useChatStore.getState().markers.length === 0) setLoadFailed(true); }, 8000);
    return () => clearTimeout(t);
  }, [sessionId, markers.length]);

  const marker = markers.length > 0 && currentMarker < markers.length ? markers[currentMarker] : null;
  const hasStreetView = marker?.streetView !== false;
  const { photos: areaPhotos, loading: photosLoading } = useAreaPhotos(marker?.latitude, marker?.longitude);
  const areaPlaces = useAreaPlaces(marker?.latitude, marker?.longitude);

  // Stable identities so the Leaflet map doesn't tear down + rebuild every render.
  const mapCandidates = useMemo(
    () => markers.map((m, i) => ({ name: m.name, lat: m.latitude, lng: m.longitude, index: i })),
    [markers],
  );
  const mapReferences = useMemo(
    () => areaPhotos.flatMap((p) => (p.lat != null && p.lng != null ? [{ lat: p.lat, lng: p.lng, thumb: p.thumb, title: p.title }] : [])),
    [areaPhotos],
  );

  // The user's own comparison spots (Places tab), kept per session.
  const [userPlaces, setUserPlaces] = useState<UserPlace[]>([]);
  useEffect(() => {
    try {
      setUserPlaces(JSON.parse(localStorage.getItem(`rainbolt-places-${sessionId}`) ?? "[]"));
    } catch {
      setUserPlaces([]);
    }
  }, [sessionId]);
  const changeUserPlaces = (next: UserPlace[]) => {
    setUserPlaces(next);
    try {
      localStorage.setItem(`rainbolt-places-${sessionId}`, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  // Feed map-style place labels: the candidate names (always) + the user's
  // own places + nearby landmarks.
  useEffect(() => {
    const candidateLabels = markers.map((m) => ({ name: m.name, lat: m.latitude, lng: m.longitude, rank: 0 }));
    const placeLabels = userPlaces.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng, rank: 0 }));
    useGlobeStore.getState().configure({ labels: [...candidateLabels, ...placeLabels, ...areaPlaces] });
  }, [markers, areaPlaces, userPlaces]);

  // Feed this session's candidate guesses into the shared persistent globe.
  const setCurrentRef = useRef(setCurrentMarker);
  setCurrentRef.current = setCurrentMarker;
  useEffect(() => {
    useGlobeStore.getState().configure({
      markers: markers.map((m, i) => ({
        id: String(i), lat: m.latitude, lng: m.longitude, confidence: m.accuracy * 100,
      })),
      arcs: [],
      panLeft: 340,  // result sidebar
      panRight: 360, // chat panel
      mode: "located",
      onHover: undefined,
      onPick: (id) => setCurrentRef.current(Number(id)),
    });
  }, [markers]);
  useEffect(() => {
    useGlobeStore.getState().configure({
      focusIndex: markers.length ? currentMarker : null,
      activeId: markers.length ? String(currentMarker) : null,
    });
  }, [currentMarker, markers.length]);

  // Tee a question up in the composer (never auto-sends): the user finishes
  // typing there and fires it themselves.
  const askInChat = (text: string) => {
    useChatStore.setState({ draft: text });
    setTab("chat");
  };

  // Plain navigation: the globe persists across the (map) group, so going back
  // is a continuation (the camera flies) - no view-transition snapshot needed.
  const handleBack = () => router.back();

  const TABS: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
    ...(isDesktop ? [] : [{ id: "result" as const, label: "Result", icon: Target }]),
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "photos", label: "Photos", icon: ImagePlus },
    { id: "places", label: "Places", icon: MapIcon },
  ];

  const resultPanel = (
    <ResultPanel
      sessionId={sessionId}
      uploadedImageUrl={uploadedImageUrl}
      marker={marker}
      markers={markers}
      currentMarker={currentMarker}
      setCurrentMarker={setCurrentMarker}
      loadFailed={loadFailed}
      hasStreetView={hasStreetView}
      areaPhotos={areaPhotos}
      photosLoading={photosLoading}
      mapCandidates={mapCandidates}
      mapReferences={mapReferences}
      onViewPhoto={setLightbox}
    />
  );

  return (
    <div className="pointer-events-none relative z-10 flex h-screen text-fg">
      {/* ── Left: result + ranked guesses (desktop only) ─────────────────── */}
      <aside className="pointer-events-auto hidden w-[340px] shrink-0 flex-col border-r border-white/[0.08] bg-space-950 md:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-white/[0.07] px-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors hover:bg-white/[0.05] hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        {isDesktop && resultPanel}
      </aside>

      {/* ── Center: transparent + click-through so the globe behind is interactive ── */}
      <div className="pointer-events-none relative hidden min-w-0 flex-1 overflow-hidden md:block">
        {/* Globe / annotated-photo switch */}
        {marker && uploadedImageUrl && (
          <div className="pointer-events-auto absolute left-1/2 top-4 z-20 flex -translate-x-1/2 gap-0.5 rounded-lg border border-white/[0.1] bg-space-900/85 p-0.5 text-xs font-medium shadow-lg backdrop-blur-md">
            {([["globe", "Globe"], ["image", "Photo"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setCenterView(k)}
                className={`rounded-md px-4 py-1.5 transition-colors ${
                  centerView === k ? "bg-white/[0.14] text-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {centerView === "image" && uploadedImageUrl ? (
          <div className="pointer-events-auto absolute inset-0 bg-space-950/95">
            <ImageAnnotator
              src={uploadedImageUrl}
              clues={marker?.clues ?? []}
              sessionId={sessionId}
              focus={pinFocus}
            />
          </div>
        ) : (
          markers.length > 1 && (
            <MarkerNav
              currentMarker={currentMarker}
              markersCount={markers.length}
              onPrevious={previousMarker}
              onNext={nextMarker}
            />
          )
        )}
      </div>

      {/* ── Right: tabbed panel (the whole screen on phones) ─────────────── */}
      <aside className="pointer-events-auto flex w-full shrink-0 flex-col bg-space-950 md:w-[360px] md:border-l md:border-white/[0.08]">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
          <span className="flex items-center gap-1 text-sm font-semibold text-fg">
            <button
              onClick={handleBack}
              aria-label="Back"
              className="-ml-2 mr-1 rounded-md p-1.5 text-fg-muted transition-colors hover:bg-white/[0.05] hover:text-fg md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            Rainbolt AI
          </span>
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
        {tab === "result" && !isDesktop && resultPanel}
        {tab === "chat" && (
          <>
            {/* The photo under discussion, one tap away from full screen. */}
            {uploadedImageUrl && (
              <button
                onClick={() => setLightbox(uploadedImageUrl)}
                className="group flex shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-4 py-2 text-left transition-colors hover:bg-white/[0.03]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedImageUrl}
                  alt="Analyzed photo"
                  className="h-8 w-8 rounded-md object-cover ring-1 ring-white/10"
                />
                <span className="flex-1 text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/60">
                  Analyzed photo
                </span>
                <Maximize2 className="h-3.5 w-3.5 text-fg-muted/50 transition-colors group-hover:text-fg" />
              </button>
            )}
            <ChatHistory />
            <ChatComposer />
          </>
        )}
        {tab === "photos" && <PhotosTab analyzed={uploadedImageUrl} />}
        {tab === "places" && (
          <PlacesTab
            markers={markers}
            currentMarker={currentMarker}
            onSelect={setCurrentMarker}
            userPlaces={userPlaces}
            onChangePlaces={changeUserPlaces}
            onAsk={askInChat}
          />
        )}
      </aside>

      {/* Full-screen photo viewer. z sits above Leaflet's internal panes
          (~1000), which escape their container's stacking context. */}
      {lightbox && (
        <div
          className="pointer-events-auto fixed inset-0 z-[1200] flex cursor-zoom-out items-center justify-center bg-black/90 p-4 backdrop-blur-sm md:p-10"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Analyzed photo" className="max-h-full max-w-full rounded-lg shadow-2xl" />
          <button
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Result dossier: analyzed photo, clues, candidates, map/street/photos ──
// One component so the desktop sidebar and the phone "Result" tab render the
// exact same content (only ever mounted in one place at a time).
function ResultPanel({
  sessionId, uploadedImageUrl, marker, markers, currentMarker, setCurrentMarker,
  loadFailed, hasStreetView, areaPhotos, photosLoading, mapCandidates, mapReferences,
  onViewPhoto,
}: {
  sessionId: string;
  uploadedImageUrl: string | null;
  marker: Marker | null;
  markers: Marker[];
  currentMarker: number;
  setCurrentMarker: (i: number) => void;
  loadFailed: boolean;
  hasStreetView: boolean;
  areaPhotos: AreaPhoto[];
  photosLoading: boolean;
  mapCandidates: { name: string; lat: number; lng: number; index: number }[];
  mapReferences: { lat: number; lng: number; thumb: string; title: string }[];
  onViewPhoto: (src: string) => void;
}) {
  const [media, setMedia] = useState<"map" | "street" | "photos">("map");
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);

  // Back to the Map view (clear picked spot) on candidate/session change.
  useEffect(() => { setMedia("map"); setPicked(null); }, [currentMarker, sessionId]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* dossier header: analyzed photo with the verdict overlaid */}
      {uploadedImageUrl && (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-space-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={uploadedImageUrl}
            alt="Analyzed photo"
            onClick={() => onViewPhoto(uploadedImageUrl)}
            className="h-full w-full cursor-zoom-in object-cover"
          />
          <span className="absolute left-2.5 top-2.5 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
            Analyzed photo
          </span>
          <Reticle />
          {marker && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-space-950 via-space-950/70 to-transparent px-4 pb-3 pt-10">
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/70">Best guess</p>
              <h1 className="mt-0.5 text-lg font-semibold leading-snug text-fg">{marker.name}</h1>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span className="font-mono text-[11px] tabular-nums text-fg-muted">
                  {coordLabel(marker.latitude, marker.longitude)}
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="h-[3px] w-14 overflow-hidden rounded-full bg-white/[0.14]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.round(marker.accuracy * 100)}%`, backgroundColor: confColor(marker.accuracy) }}
                    />
                  </span>
                  <span className="text-xs font-medium tabular-nums" style={{ color: confColor(marker.accuracy) }}>
                    {Math.round(marker.accuracy * 100)}%
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {marker ? (
        <div className="px-4 py-4">
          {/* text header when there is no photo to overlay */}
          {!uploadedImageUrl && (
            <div className="mb-5">
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/60">Best guess</p>
              <h1 className="mt-0.5 text-lg font-semibold leading-snug text-fg">{marker.name}</h1>
              <div className="mt-2 flex items-center gap-2.5">
                <span className="font-mono text-[11px] tabular-nums text-fg-muted">
                  {coordLabel(marker.latitude, marker.longitude)}
                </span>
                <span className="ml-auto text-xs font-medium tabular-nums" style={{ color: confColor(marker.accuracy) }}>
                  {Math.round(marker.accuracy * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* key clues / evidence */}
          {marker.clues && marker.clues.length > 0 && (
            <div className="pt-1">
              <p className="mb-2.5 text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/60">
                Key clues
              </p>
              <ul className="space-y-2.5">
                {marker.clues.map((c, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-snug">
                    <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-fg-muted/50" />
                    <span className="min-w-0">
                      <span className="text-fg/85">{c.sign}</span>
                      <span className="px-1 font-mono text-fg-muted/40">→</span>
                      <span className="text-fg-muted">{c.implies}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                    onClick={() => setCurrentMarker(i)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* one media viewer: map / street view / nearby photos */}
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <div className="mb-2.5 flex gap-1 rounded-lg bg-white/[0.04] p-0.5 text-[11px] font-medium">
              {([
                ["map", "Map"],
                ...(hasStreetView ? [["street", "Street view"] as const] : []),
                ["photos", "Photos"],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setMedia(k)}
                  className={`flex-1 rounded-md px-2 py-1 transition-colors ${
                    media === k ? "bg-white/[0.1] text-fg" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {media === "photos" ? (
              photosLoading ? (
                <div className="flex h-28 items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-fg-muted/40" />
                </div>
              ) : areaPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {areaPhotos.slice(0, 6).map((p, i) => (
                    <a
                      key={i}
                      href={p.full}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={p.title}
                      className="group relative aspect-square overflow-hidden rounded-md border border-white/[0.07] bg-space-900"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.thumb}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-fg-muted/50">No nearby photos found</p>
              )
            ) : media === "map" ? (
              <>
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/[0.07] bg-space-900">
                  <EvidenceMap
                    candidates={mapCandidates}
                    references={mapReferences}
                    activeIndex={currentMarker}
                    picked={picked}
                    onSelectCandidate={setCurrentMarker}
                    onPickPoint={(lat, lng) => {
                      if (hasStreetView) { setPicked({ lat, lng }); setMedia("street"); }
                      else window.open(mapsUrl(lat, lng), "_blank", "noopener");
                    }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-fg-muted/65">
                  Click a candidate to compare · click the map to {hasStreetView ? "open Street View there" : "open it in Google Maps"}.
                </p>
              </>
            ) : (
              <>
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/[0.07] bg-space-900">
                  <iframe
                    key={`sv-${picked?.lat ?? marker.latitude},${picked?.lng ?? marker.longitude}`}
                    title={`${marker.name} street view`}
                    src={streetEmbed(picked?.lat ?? marker.latitude, picked?.lng ?? marker.longitude)}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full border-0"
                  />
                </div>
                <button
                  onClick={() => { setPicked(null); setMedia("map"); }}
                  className="mt-2 text-[11px] text-fg-muted/70 underline-offset-2 transition-colors hover:text-fg hover:underline"
                >
                  ← Back to the map
                </button>
              </>
            )}

            <a
              href={media === "street"
                ? streetViewUrl(picked?.lat ?? marker.latitude, picked?.lng ?? marker.longitude)
                : mapsUrl(marker.latitude, marker.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-fg"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {media === "street" ? "Open Street View" : "Open in Google Maps"}
            </a>
          </div>

          {marker.facts && (
            <div className="mt-5 border-t border-white/[0.06] pt-4">
              <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/60">
                Why here
              </p>
              <p className="text-[13px] leading-relaxed text-fg/70">{marker.facts}</p>
            </div>
          )}
        </div>
      ) : loadFailed ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <MapIcon className="h-6 w-6 text-fg-muted/40" />
          <div>
            <p className="text-sm font-medium text-fg">This session couldn&apos;t be loaded</p>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted/60">
              It may have expired, or the analysis service is offline. Try a sample from the globe.
            </p>
          </div>
          <Link
            href="/learning"
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-space-950 transition-colors hover:bg-white/90"
          >
            Back to the globe
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-fg-muted/40" />
          <p className="text-sm text-fg-muted/60">Pinpointing the location…</p>
        </div>
      )}
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
      <span className="w-4 shrink-0 text-center text-xs font-semibold tabular-nums" style={{ color: pinColor(rank - 1) }}>
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

// ── Places tab - the AI's candidates plus the user's own comparison spots ──
type UserPlace = { id: string; name: string; lat: number; lng: number };

// Quiet inline actions under a place row: coords, Maps link, ask-in-chat.
function PlaceRowActions({
  name, lat, lng, onAsk,
}: { name: string; lat: number; lng: number; onAsk: (text: string) => void }) {
  return (
    <div className="mt-1 flex items-center gap-3 text-[11px] text-fg-muted/60">
      <span className="font-mono tabular-nums">{coordLabel(lat, lng)}</span>
      <a
        href={mapsUrl(lat, lng)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 transition-colors hover:text-fg"
      >
        Maps
        <ExternalLink className="h-3 w-3" />
      </a>
      <button
        onClick={() => onAsk(`Could the spot be ${name}?`)}
        className="flex items-center gap-1 font-medium text-sky-300/90 transition-colors hover:text-sky-200"
      >
        <MessageSquare className="h-3 w-3" />
        Ask in chat
      </button>
    </div>
  );
}

function PlacesTab({
  markers, currentMarker, onSelect, userPlaces, onChangePlaces, onAsk,
}: {
  markers: Marker[];
  currentMarker: number;
  onSelect: (i: number) => void;
  userPlaces: UserPlace[];
  onChangePlaces: (next: UserPlace[]) => void;
  onAsk: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Free-text place -> coordinates via OpenStreetMap's public geocoder.
  const addPlace = async () => {
    const q = query.trim();
    if (!q || looking) return;
    setLooking(true);
    setLookupError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
      );
      const hits: { name?: string; lat: string; lon: string }[] = await res.json();
      if (hits.length === 0) {
        setLookupError("No match - try adding the city or country.");
      } else {
        onChangePlaces([
          ...userPlaces,
          { id: `p-${Math.round(performance.now())}`, name: hits[0].name || q, lat: +hits[0].lat, lng: +hits[0].lon },
        ]);
        setQuery("");
      }
    } catch {
      setLookupError("Lookup failed - are you online?");
    }
    setLooking(false);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/60">
        Candidates
      </p>
      {markers.length === 0 ? (
        <p className="py-3 text-xs text-fg-muted/50">No candidate places yet.</p>
      ) : (
        <div>
          {markers.map((m, i) => {
            const active = i === currentMarker;
            return (
              <div
                key={i}
                className={`-mx-2 rounded-lg px-2 py-2.5 transition-colors ${active ? "bg-white/[0.045]" : ""}`}
              >
                <button onClick={() => onSelect(i)} className="flex w-full items-center gap-2.5 text-left">
                  <span className="w-3.5 shrink-0 text-xs font-semibold tabular-nums" style={{ color: pinColor(i) }}>
                    {i + 1}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[13px] ${active ? "font-medium text-fg" : "text-fg/80"}`}>
                    {m.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums" style={{ color: confColor(m.accuracy) }}>
                    {Math.round(m.accuracy * 100)}%
                  </span>
                </button>
                <div className="pl-6">
                  <PlaceRowActions name={m.name} lat={m.latitude} lng={m.longitude} onAsk={onAsk} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.14em] text-fg-muted/60">
          Your places
        </p>
        <p className="text-xs leading-relaxed text-fg-muted/60">
          Have your own hunch? Add it here, then ask the AI to compare.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); addPlace(); }}
          className="mt-3 flex items-center gap-2"
        >
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setLookupError(null); }}
            placeholder="e.g. Golden Gai, Tokyo"
            className="min-w-0 flex-1 rounded-lg bg-white/[0.05] px-3 py-2 text-xs text-fg placeholder:text-fg-muted/40 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <button
            type="submit"
            disabled={!query.trim() || looking}
            className="flex h-8 w-14 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-xs font-medium text-fg transition-colors hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {looking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </button>
        </form>
        {lookupError && <p className="mt-1.5 text-[11px] text-red-400/90">{lookupError}</p>}

        {userPlaces.length > 0 && (
          <div className="mt-2">
            {userPlaces.map((p) => (
              <div key={p.id} className="group -mx-2 rounded-lg px-2 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-star-400/90" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-fg/80">{p.name}</span>
                  <button
                    onClick={() => onChangePlaces(userPlaces.filter((x) => x.id !== p.id))}
                    aria-label={`Remove ${p.name}`}
                    className="shrink-0 text-fg-muted/0 transition-colors group-hover:text-fg-muted/50 hover:!text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="pl-6">
                  <PlaceRowActions name={p.name} lat={p.lat} lng={p.lng} onAsk={onAsk} />
                </div>
              </div>
            ))}
          </div>
        )}
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
