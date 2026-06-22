"use client";

export function DesktopOnlyNotice() {
  return (
    <div className="md:hidden fixed inset-0 bg-black flex items-center justify-center p-4 z-50">
      <div className="text-center">
        <h2 className="text-white text-2xl font-bold mb-4">Desktop Only</h2>
        <p className="text-white/70">
          The chat interface is optimized for desktop viewing. Please visit this page on a larger screen.
        </p>
      </div>
    </div>
  );
}
