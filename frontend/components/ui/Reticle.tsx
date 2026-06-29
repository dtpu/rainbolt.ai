/**
 * Viewfinder corner ticks — a recurring "instrument / observatory" motif used
 * over imagery across the app. Drop inside a `relative` container.
 */
export function Reticle({ inset = 8 }: { inset?: number }) {
  const base: React.CSSProperties = { position: "absolute", height: 10, width: 10 };
  const line = "border-white/30";
  return (
    <>
      <span className={`pointer-events-none border-l border-t ${line}`} style={{ ...base, left: inset, top: inset }} />
      <span className={`pointer-events-none border-r border-t ${line}`} style={{ ...base, right: inset, top: inset }} />
      <span className={`pointer-events-none border-b border-l ${line}`} style={{ ...base, left: inset, bottom: inset }} />
      <span className={`pointer-events-none border-b border-r ${line}`} style={{ ...base, right: inset, bottom: inset }} />
    </>
  );
}
