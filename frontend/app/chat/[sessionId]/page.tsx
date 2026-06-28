"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import SimpleGlobe from "@/components/globe/SimpleGlobe";
import { ChatHistory } from "@/components/chat/ChatHistory";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { LocationFactsPanel } from "@/components/chat/LocationFactsPanel";
import { MarkerNav } from "@/components/chat/MarkerNav";
import { SpaceBackdrop } from "@/components/SpaceBackdrop";
import { DecorLayer } from "@/components/decor/DecorLayer";
import { CHAT_DECOR } from "@/lib/decor/layouts";
import { DesktopOnlyNotice } from "@/components/chat/DesktopOnlyNotice";
import { useChatStore } from "@/components/useChatStore";
import { useChatSession } from "@/hooks/useChatSession";
import { useMapillaryImages } from "@/hooks/useMapillaryImages";

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
  const deleteMarker     = useChatStore((s) => s.deleteMarker);

  const [isLocked, setIsLocked] = useState(false);
  const hasLockedRef = useRef(false);

  useChatSession(sessionId);

  const { mapillaryImages, loadingImages } = useMapillaryImages(markers, currentMarker);

  useEffect(() => {
    if (markers.length > 0) {
      if (!hasLockedRef.current) { setIsLocked(true); hasLockedRef.current = true; }
    } else {
      setIsLocked(false);
      hasLockedRef.current = false;
    }
  }, [markers.length]);

  const globeMarkers = markers.map((m) => ({
    lat: m.latitude,
    long: m.longitude,
    confidence: m.accuracy * 100,
  }));

  const currentMarkerData =
    markers.length > 0 && currentMarker < markers.length ? markers[currentMarker] : null;

  const handleBack = () => {
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as Document & { startViewTransition: (cb: () => void) => void })
        .startViewTransition(() => router.back());
    } else {
      router.back();
    }
  };

  return (
    <div className="flex h-screen bg-space-950">
      {/* Left: Globe area (with optional side panel) */}
      <div
        className="relative min-w-0 flex-1 overflow-hidden"
        style={{ viewTransitionName: "main-globe" }}
      >
        <div className="flex h-full">
          {/* Location panel — real flex child so globe centers in remaining space */}
          {isLocked && currentMarkerData && (
            <div className="relative z-10 flex w-[272px] shrink-0 items-center justify-center p-5">
              <LocationFactsPanel
                marker={currentMarkerData}
                images={mapillaryImages[currentMarker]}
                isLoadingImages={!!loadingImages[currentMarker]}
                onDelete={() => {
                  deleteMarker(currentMarker);
                  if (markers.length <= 1) setIsLocked(false);
                }}
              />
            </div>
          )}

          {/* Globe fills remaining space */}
          <div className="relative flex-1">
            <SpaceBackdrop />
            <SimpleGlobe
              markers={globeMarkers}
              targetMarkerIndex={currentMarker}
              isLocked={isLocked}
              onUnlock={() => setIsLocked(false)}
              onLock={() => setIsLocked(true)}
              onMarkerClick={(i) => { setCurrentMarker(i); setIsLocked(true); }}
            />
            <DecorLayer items={CHAT_DECOR} storageKey="chat" />
          </div>
        </div>

        {markers.length > 1 && (
          <MarkerNav
            currentMarker={currentMarker}
            markersCount={markers.length}
            onPrevious={() => { setIsLocked(true); previousMarker(); }}
            onNext={() => { setIsLocked(true); nextMarker(); }}
          />
        )}
      </div>

      {/* Right: Chat panel */}
      <aside className="flex w-[340px] shrink-0 flex-col border-l border-white/[0.08] bg-space-950">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-3 py-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <Link
            href="/"
            className="rounded-md p-1.5 text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/70"
          >
            <Home className="h-4 w-4" />
          </Link>
        </div>

        {/* Uploaded image preview */}
        {uploadedImageUrl && (
          <div className="shrink-0 border-b border-white/[0.07] p-3">
            <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-space-900">
              <img
                src={uploadedImageUrl}
                alt="Uploaded"
                className="h-28 w-full object-cover"
              />
            </div>
          </div>
        )}

        <ChatHistory />
        <ChatComposer />
      </aside>

      <DesktopOnlyNotice />
    </div>
  );
}
