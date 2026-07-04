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
  /** Axis for the self-spin. Default "y" (with the legacy gentle x-wobble);
   *  "none" pins the prop so only the bob moves it. */
  spinAxis?: "x" | "y" | "z" | "none";
  /** Gentle in-place bob amplitude (default 0.05). */
  bob?: number;
  /** Render as a dark, faint background silhouette (0-1 = how visible). */
  dim?: number;
}

// Small props tucked into the corners so they frame the globe without crowding
// it. (The decor layer lives inside the globe area, so its right edge already
// stops at the rail.)
// Composed in three layers so it reads rich but not busy: four corner
// anchors, three small accents, and two faint far-background silhouettes.
export const LEARNING_DECOR: DecorItem[] = [
  // anchors
  { id: "planet-tl", shape: "planet", position: [-2.15, 0.82, -0.3], scale: 0.3, spin: 0.1, bob: 0.06 },
  { id: "aster-bl", shape: "asteroid", position: [-1.95, -1.08, -0.2], scale: 0.27, spin: 0.25, bob: 0.07 },
  { id: "ufo-tr", model: "/models/ufo.glb", position: [1.94, 1.26, -0.3], scale: 0.4, rotation: [0.4, 0, 0.15], spin: 0.3, bob: 0.07 },
  { id: "ringplanet-br", shape: "ringplanet", position: [2.28, -1.16, -0.4], scale: 0.24, rotation: [0.3, 0, 0.1], spin: 0.14, bob: 0.05 },
  // accents
  { id: "star-ml", shape: "star", position: [-1.72, -0.32, 0.1], scale: 0.22, spin: 0.12, bob: 0.05 },
  { id: "dodeca-tr", shape: "dodeca", position: [1.7, 0.5, -0.22], scale: 0.13, spin: 0.18, bob: 0.05 },
  { id: "diamond-bm", shape: "diamond", position: [0.95, -1.24, -0.22], scale: 0.14, spin: 0.2, bob: 0.06 },
];

// Landing hero - a few prominent props in the EarthScene's world space (globe
// near x = -6) so they share the rainbolt model's 3D space and parallax with
// the camera on scroll. Kept light on purpose.
// Landing props sit still (spinAxis "none", bob only): the camera-synced view
// turned the shared y-spin + wobble into a roll that made shapes unreadable.
// Re-enable spin per prop in the ?decor editor if a piece calls for it.
export const LANDING_DECOR: DecorItem[] = [
  // Placed via the ?decor sliders; only ghost-ring opts back into a (z) spin.
  { id: "ufo-tr", model: "/models/ufo.glb", position: [-5.86, 0.81, -1.13], scale: 1.516, rotation: [-3.14, -0.07, 3.14], spin: 0.3, spinAxis: "none", bob: 0.07 },
  { id: "star-tl", shape: "star", position: [-5.78, -0.97, -1.5], scale: 0.817, spin: 0.12, spinAxis: "none", bob: 0.05 },
  { id: "star-bl", shape: "star", position: [-6.75, -0.99, 2.04], scale: 0.567, rotation: [-2.54, 0.77, 0], spin: 0.16, spinAxis: "none", bob: 0.05 },
  { id: "aster-br", shape: "asteroid", position: [-6.84, 0.85, 2.38], scale: 0.494, spin: 0.25, spinAxis: "none", bob: 0.07 },
  // Everything off the corners is a see-through ghost prop: same hatched look,
  // just translucent so the centre stays airy.
  { id: "ghost-star", shape: "star", position: [-6.6, 0.75, 1.63], scale: 0.17, rotation: [-3.14, -0.99, 0], spin: 0.1, spinAxis: "none", bob: 0.04, dim: 0.4 },
  { id: "ghost-ring", shape: "ring", position: [-6.58, 1.87, 0.53], scale: 0.948, rotation: [-1.64, -1.1, 0], spin: 0.09, spinAxis: "z", bob: 0.04, dim: 0.3 },
  { id: "ghost-dodeca", shape: "dodeca", position: [-5.94, -1.39, 0.18], scale: 1.128, spin: 0.11, spinAxis: "none", bob: 0.04, dim: 0.3 },
  { id: "ghost-knot", shape: "knot", position: [-6.51, -0.99, 1.21], scale: 0.259, spin: 0.1, spinAxis: "none", bob: 0.04, dim: 0.3 },
];
