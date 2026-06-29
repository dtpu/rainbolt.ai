import WorldGlobe from "@/components/globe/WorldGlobe";

/**
 * Shared layout for the learning + location pages. The globe is mounted here
 * once and persists across navigation between the two routes, so moving from a
 * session card into its location page is a continuation of the same globe
 * (the camera flies) rather than a remount. Pages render their panels as
 * overlays on top and drive the globe through the globe store.
 */
export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-space-950 text-white">
      <div className="absolute inset-0">
        <WorldGlobe />
      </div>
      {children}
    </div>
  );
}
