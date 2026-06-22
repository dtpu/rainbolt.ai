import { GlobeSessionWithData } from "@/lib/globe-database";

// Card geometry. Link endpoints are computed from these.
export const NODE_W = 176;
export const NODE_H = 150;

export interface ConstellationNode {
  id: string;
  session: GlobeSessionWithData;
  position: { x: number; y: number };
  isDragging: boolean;
}

// Deterministic golden-angle spiral around the canvas center.
export function spiralPosition(index: number, width: number, height: number) {
  const cx = width / 2 - NODE_W / 2;
  const cy = height / 2 - NODE_H / 2;
  if (index === 0) return { x: cx, y: cy };
  const angle = index * 2.4;
  const radius = 150 + 85 * Math.sqrt(index);
  return {
    x: Math.max(16, Math.min(cx + radius * Math.cos(angle), width - NODE_W - 16)),
    y: Math.max(96, Math.min(cy + radius * Math.sin(angle) * 0.75, height - NODE_H - 16)),
  };
}

export function nodeCenter(node: ConstellationNode) {
  return {
    x: node.position.x + NODE_W / 2,
    y: node.position.y + NODE_H / 2,
  };
}
