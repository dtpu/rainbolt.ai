/**
 * The global hand-drawn "wobble" — an SVG turbulence + displacement filter,
 * ported from the gacha prototype. Applied to the decor canvas via
 * `filter: url(#decor-sketch)` so every drawn edge wobbles together. The
 * turbulence is reseeded a few times a second by DecorLayer for a live "boil".
 */
export function SketchFilter() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <filter
          id="decor-sketch"
          x="-8%"
          y="-8%"
          width="116%"
          height="116%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            id="decor-sketch-noise"
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="2"
            seed="1"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="11"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
