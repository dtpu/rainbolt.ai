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
  /** Render as a dark, faint background silhouette (0-1 = how visible). */
  dim?: number;
}

// Small props tucked into the corners so they frame the globe without crowding
// it. (The decor layer lives inside the globe area, so its right edge already
// stops at the rail.)
export const LEARNING_DECOR: DecorItem[] = [
  { id: "planet-tl", shape: "planet", position: [-2.08, 1.24, -0.3], scale: 0.4, spin: 0.1, bob: 0.06 },
  { id: "aster-bl", shape: "asteroid", position: [-2.22, -0.96, -0.2], scale: 0.3, spin: 0.25, bob: 0.07 },
  { id: "star-ml", shape: "star", position: [-1.85, -0.18, 0.1], scale: 0.371, spin: 0.12, bob: 0.05 },
  { id: "ufo-tr", model: "/models/ufo.glb", position: [1.94, 1.26, -0.3], scale: 0.4, rotation: [0.4, 0, 0.15], spin: 0.3, bob: 0.07 },
  { id: "ringplanet-br", shape: "ringplanet", position: [2.05, -1, -0.4], scale: 0.32, rotation: [0.3, 0, 0.1], spin: 0.14, bob: 0.05 },
  { id: "dodeca-9975", shape: "dodeca", position: [1.75, 0.53, -0.22], scale: 0.158, spin: 0.18, bob: 0.05 },
  { id: "knot-21975", shape: "knot", position: [2.3, 0.06, -0.22], scale: 0.359, spin: 0.2, bob: 0.06 },
  { id: "tetra-38115", shape: "tetra", position: [-1.19, -1.42, -0.22], scale: 0.257, spin: 0.22, bob: 0.06 },
  { id: "ring-49548", shape: "ring", position: [-0.83, 1.73, -0.22], scale: 0.209, spin: 0.16, bob: 0.05 },
  { id: "star-60614", shape: "star", position: [1.15, 1.5, -0.22], scale: 0.185, spin: 0.12, bob: 0.05 },
  { id: "diamond-72947", shape: "diamond", position: [0.87, -1.41, -0.22], scale: 0.17, spin: 0.2, bob: 0.06 },
  { id: "cube-90047", shape: "cube", position: [-2.4, 0.53, -0.22], scale: 0.183, spin: 0.18, bob: 0.06 },
];

// Landing hero - a few prominent props in the EarthScene's world space (globe
// near x = -6) so they share the rainbolt model's 3D space and parallax with
// the camera on scroll. Kept light on purpose.
export const LANDING_DECOR: DecorItem[] = [
  { id: "ufo-tr", model: "/models/ufo.glb", position: [-5.86, 0.74, -1.23], scale: 0.55, rotation: [0.4, 0, 0.15], spin: 0.3, bob: 0.07 },
  { id: "star-tl", shape: "star", position: [-5.85, -0.64, -1.25], scale: 0.255, spin: 0.12, bob: 0.05 },
  { id: "star-bl", shape: "star", position: [-6.77, -0.67, 2.12], scale: 0.201, spin: 0.16, bob: 0.05 },
  { id: "aster-br", shape: "asteroid", position: [-6.79, 0.63, 2.2], scale: 0.147, spin: 0.25, bob: 0.07 },
  // Faint silhouettes sunk deep behind the scene - shapes in the dark, not props.
  { id: "ufo-bg", model: "/models/ufo.glb", position: [-7.15, 1.45, -4.4], scale: 1.5, rotation: [0.35, -0.5, 0.1], spin: 0.06, bob: 0.03, dim: 0.4 },
  { id: "rocket-bg", model: "/models/rocket.glb", position: [-7.4, -1.15, -4.6], scale: 1.35, rotation: [0.2, 0.7, -0.35], spin: 0.05, bob: 0.03, dim: 0.32 },
];
