"use client";

import { useEffect, useState } from "react";
import type { Marker } from "@/components/useChatStore";

export function useMapillaryImages(markers: Marker[], currentMarker: number) {
  const [mapillaryImages, setMapillaryImages] = useState<
    Record<number, string[]>
  >({});
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>(
    {},
  );

  useEffect(() => {
    const fetchMapillaryImages = async () => {
      if (markers.length === 0 || currentMarker >= markers.length) return;

      const marker = markers[currentMarker];

      if (mapillaryImages[currentMarker] || marker.mapillary_images) {
        if (marker.mapillary_images) {
          setMapillaryImages((prev) => ({
            ...prev,
            [currentMarker]: marker.mapillary_images || [],
          }));
        }
        return;
      }

      if (loadingImages[currentMarker]) return;

      setLoadingImages((prev) => ({ ...prev, [currentMarker]: true }));

      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
        const response = await fetch(`${backendUrl}/api/mapillary-images`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            latitude: marker.latitude,
            longitude: marker.longitude,
            radius: 0.003,
            limit: 5,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setMapillaryImages((prev) => ({
            ...prev,
            [currentMarker]: data.images || [],
          }));
        } else {
          setMapillaryImages((prev) => ({
            ...prev,
            [currentMarker]: [],
          }));
        }
      } catch (error) {
        console.error("Error fetching Mapillary images:", error);
        setMapillaryImages((prev) => ({
          ...prev,
          [currentMarker]: [],
        }));
      } finally {
        setLoadingImages((prev) => ({ ...prev, [currentMarker]: false }));
      }
    };

    fetchMapillaryImages();
  }, [currentMarker, markers]);

  return { mapillaryImages, loadingImages };
}
