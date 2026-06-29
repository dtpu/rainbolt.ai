import { create } from "zustand";

export interface WorldMarker {
  id: string;
  lat: number;
  lng: number;
  /** 0-100; drives pin height/colour when present. */
  confidence?: number;
}

export interface WorldArc {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}

export interface PlaceLabel {
  name: string;
  lat: number;
  lng: number;
  /** 0 = major (appears when slightly zoomed) .. 1 = minor (appears when close). */
  rank?: number;
}

/**
 * Drives the single persistent globe shared by the learning and location
 * pages. Each page pushes its data + interaction handlers here on mount; the
 * globe (mounted once in the (map) route-group layout) renders from this store,
 * so navigating between pages is a continuation of the same globe rather than a
 * remount.
 */
interface GlobeStore {
  markers: WorldMarker[];
  arcs: WorldArc[];
  /** Place/landmark labels that fade in as you zoom (map-style LOD). */
  labels: PlaceLabel[];
  /** True when the globe is zoomed in close (used to nudge users to the Map). */
  zoomedIn: boolean;
  /** Index of the marker to centre/zoom; null = free idle orbit. */
  focusIndex: number | null;
  /** Highlighted marker id (hover/selection). */
  activeId: string | null;
  /** "constellation": many pins + arcs, free orbit + hover. "located": zoom to one. */
  mode: "constellation" | "located";
  /** Horizontal fraction (0-1) the focused marker should sit at on screen, to
   *  account for side panels (0.5 = centre). */
  focusBiasX: number;

  onPick?: (id: string, index: number) => void;
  onHover?: (id: string | null) => void;

  configure: (cfg: Partial<Omit<GlobeStore, "configure" | "reset">>) => void;
  reset: () => void;
}

const INITIAL = {
  markers: [] as WorldMarker[],
  arcs: [] as WorldArc[],
  labels: [] as PlaceLabel[],
  zoomedIn: false,
  focusIndex: null as number | null,
  activeId: null as string | null,
  mode: "constellation" as const,
  focusBiasX: 0.5,
  onPick: undefined,
  onHover: undefined,
};

export const useGlobeStore = create<GlobeStore>((set) => ({
  ...INITIAL,
  configure: (cfg) => set(cfg),
  reset: () => set(INITIAL),
}));
