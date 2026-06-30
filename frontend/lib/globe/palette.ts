// Distinct pin colours so overlapping candidates stay tellable apart, on the
// globe and in the result panel. Tuned to the observatory palette (warm gold +
// ice + a few muted accents), readable on the deep-space background.
export const PIN_COLORS = [
  "#e8b44f", // gold
  "#8fb8d8", // ice blue
  "#7ed3a2", // mint
  "#e0728f", // rose
  "#b89cf0", // violet
  "#f0a868", // amber
  "#6fd0d6", // teal
  "#d9d36b", // chartreuse
];

export const pinColor = (i: number) => PIN_COLORS[i % PIN_COLORS.length];

// Confidence -> semantic colour (green / amber / red). One source of truth.
export const confColor = (acc: number) =>
  acc >= 0.75 ? "#4ade80" : acc >= 0.5 ? "#e8b44f" : "#e5373e";
