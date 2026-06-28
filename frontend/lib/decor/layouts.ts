import type { BodyType } from "./makeBody";

/**
 * A single decorative prop. Either a procedural `shape` or a GLB `model` url.
 * Coordinates are in the decor layer's own space (a perspective camera at
 * z = 4 looking down -z), so x is right, y is up, z is toward the viewer.
 * Props sit still and animate in place (slow self-spin + a small bob).
 */
export interface DecorItem {
  id: string;
  shape?: BodyType;
  model?: string;
  position: [number, number, number];
  scale: number;
  rotation?: [number, number, number];
  /** Self-spin speed, radians/sec (default 0.15). */
  spin?: number;
  /** Gentle in-place bob amplitude (default 0.05). */
  bob?: number;
}

// Small props tucked into the corners so they frame the globe without crowding
// it. (The decor layer lives inside the globe area, so its right edge already
// stops at the rail.)
export const LEARNING_DECOR: DecorItem[] = [
  { id: "planet-tl", shape: "planet", position: [-1.85, 1.3, -0.3], scale: 0.4, spin: 0.1, bob: 0.06 },
  { id: "aster-bl", shape: "asteroid", position: [-1.95, -1.2, -0.2], scale: 0.3, spin: 0.25, bob: 0.07 },
  { id: "star-ml", shape: "star", position: [-2.05, 0.05, 0.1], scale: 0.24, spin: 0.12, bob: 0.05 },
  { id: "ufo-tr", model: "/models/ufo.glb", position: [1.95, 1.3, -0.3], scale: 0.4, rotation: [0.4, 0, 0.15], spin: 0.3, bob: 0.07 },
  { id: "ringplanet-br", shape: "ringplanet", position: [1.95, -1.2, -0.4], scale: 0.32, rotation: [0.3, 0, 0.1], spin: 0.14, bob: 0.05 },
];

// Calmer set for the chat / location page — three small props, well clear of
// the location panel (left) and the chat panel (right).
export const CHAT_DECOR: DecorItem[] = [
  { id: "planet-tl", shape: "planet", position: [-1.7, 1.3, -0.4], scale: 0.3, spin: 0.1, bob: 0.05 },
  { id: "star-bl", shape: "star", position: [-1.8, -1.25, 0.0], scale: 0.22, spin: 0.12, bob: 0.05 },
  { id: "aster-tr", shape: "asteroid", position: [1.85, 1.3, -0.3], scale: 0.26, spin: 0.22, bob: 0.06 },
];
