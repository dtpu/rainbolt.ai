/**
 * A subtle nebula wash that sits behind the WebGL globe so the planet reads as
 * floating in deep space rather than pasted on a flat panel. Pure CSS, no cost.
 */
export function SpaceBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(110% 80% at 28% 18%, rgba(107,156,196,0.12), transparent 58%)," +
            "radial-gradient(90% 70% at 82% 88%, rgba(232,180,79,0.06), transparent 55%)," +
            "radial-gradient(140% 120% at 50% 50%, transparent 60%, rgba(5,7,15,0.7) 100%)",
        }}
      />
    </div>
  );
}
