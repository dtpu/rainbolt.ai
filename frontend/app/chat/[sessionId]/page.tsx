"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import SimpleGlobe from "@/components/ui/SimpleGlobe";
import { ChatHistory } from "@/components/ChatHistory";
import { ChatComposer } from "@/components/ChatComposer";
import { useChatStore } from "@/components/useChatStore";
import { useChatSession } from "@/hooks/useChatSession";
import { useMapillaryImages } from "@/hooks/useMapillaryImages";
import { LocationFactsPanel } from "@/components/chat/LocationFactsPanel";
import { MarkerNav } from "@/components/chat/MarkerNav";
import { DesktopOnlyNotice } from "@/components/chat/DesktopOnlyNotice";

export default function ChatPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const isDemo = sessionId?.startsWith("demo-") ?? false;
  const uploadedImageUrl = useChatStore((state) => state.uploadedImageUrl);
  const markers = useChatStore((state) => state.markers);
  const currentMarker = useChatStore((state) => state.currentMarker);
  const setCurrentMarker = useChatStore((state) => state.setCurrentMarker);
  const nextMarker = useChatStore((state) => state.nextMarker);
  const previousMarker = useChatStore((state) => state.previousMarker);
  const deleteMarker = useChatStore((state) => state.deleteMarker);
  const [isLocked, setIsLocked] = useState(false);
  const hasLockedRef = useRef(false);

  useChatSession(sessionId);

  const { mapillaryImages, loadingImages } = useMapillaryImages(markers, currentMarker);

  useEffect(() => {
    if (markers.length > 0) {
      if (!hasLockedRef.current) {
        setIsLocked(true);
        hasLockedRef.current = true;
      }
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

  const handleMarkerClick = (index: number) => {
    setCurrentMarker(index);
    setIsLocked(true);
  };

  const currentMarkerData =
    markers.length > 0 && currentMarker < markers.length ? markers[currentMarker] : null;

  return (
    <div className="relative h-screen w-screen bg-black flex">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div className="w-full h-full">
          <SimpleGlobe
            markers={globeMarkers}
            targetMarkerIndex={currentMarker}
            isLocked={isLocked}
            onUnlock={() => setIsLocked(false)}
            onLock={() => setIsLocked(true)}
            onMarkerClick={handleMarkerClick}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/80 pointer-events-none" />

        {isLocked && currentMarkerData && (
          <LocationFactsPanel
            marker={currentMarkerData}
            images={mapillaryImages[currentMarker]}
            isLoadingImages={!!loadingImages[currentMarker]}
            onDelete={() => {
              deleteMarker(currentMarker);
              if (markers.length <= 1) {
                setIsLocked(false);
              }
            }}
          />
        )}

        {markers.length > 1 && (
          <MarkerNav
            currentMarker={currentMarker}
            markersCount={markers.length}
            onPrevious={() => {
              setIsLocked(true);
              previousMarker();
            }}
            onNext={() => {
              setIsLocked(true);
              nextMarker();
            }}
          />
        )}
      </div>

      <div className="fixed top-0 right-0 bottom-0 w-[420px] flex flex-col bg-black/95 border-l border-white/10 shadow-2xl">
        <div className="flex-shrink-0 border-b border-white/20 p-4 bg-black/60">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className={`w-2 h-2 rounded-full ${isDemo ? "bg-sky-400" : "bg-green-500 animate-pulse"}`} />
              {!isDemo && <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping" />}
            </div>
            <h2 className="text-white font-medium text-base">Rainbolt AI</h2>
            {isDemo && (
              <span className="ml-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-300">
                Demo
              </span>
            )}
          </div>
        </div>

        {uploadedImageUrl && (
          <div className="flex-shrink-0 p-4 border-b border-white/10">
            <div className="relative rounded-lg overflow-hidden bg-black/50">
              <img
                src={uploadedImageUrl}
                alt="Uploaded image"
                className="w-full h-32 object-cover"
              />
            </div>
          </div>
        )}

        <ChatHistory />
        <ChatComposer />
      </div>

      <DesktopOnlyNotice />
    </div>
  );
}
