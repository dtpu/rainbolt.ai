import { GlobeSessionWithData } from "@/lib/globe-database";

// A resolved geolocation guess for a session: where it landed on Earth, plus
// the place name and a street-level thumbnail when we have them. Sessions that
// have not been analyzed yet return null (no guess to plot on the globe).
export interface SessionPlace {
  lat: number;
  lng: number;
  name?: string;
  thumb?: string;
}

interface GlobeImage {
  location?: { lat?: number; lng?: number };
  locationName?: string;
  imageUrl?: string;
}

// Pull the representative guess out of a session. We use the first globe image
// that carries coordinates; both real sessions (written by addGlobeImage) and
// the seeded demo sessions store the guess in that shape.
export function sessionPlace(session: GlobeSessionWithData): SessionPlace | null {
  const images: GlobeImage[] = Array.isArray(session.data?.globeImages)
    ? session.data.globeImages
    : [];
  const withCoords = images.find(
    (img) =>
      img &&
      img.location &&
      typeof img.location.lat === "number" &&
      typeof img.location.lng === "number",
  );
  if (!withCoords || !withCoords.location) return null;
  return {
    lat: withCoords.location.lat as number,
    lng: withCoords.location.lng as number,
    name: withCoords.locationName,
    thumb: withCoords.imageUrl,
  };
}

export function imageCount(session: GlobeSessionWithData): number {
  return Array.isArray(session.data?.globeImages)
    ? session.data.globeImages.length
    : 0;
}

export function chatCount(session: GlobeSessionWithData): number {
  return Array.isArray(session.data?.chatHistory)
    ? session.data.chatHistory.length
    : 0;
}
