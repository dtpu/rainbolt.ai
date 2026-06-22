"use client";

import type { Marker } from "@/components/useChatStore";

type LocationFactsPanelProps = {
  marker: Marker;
  images: string[] | undefined;
  isLoadingImages: boolean;
  onDelete: () => void;
};

export function LocationFactsPanel({
  marker,
  images,
  isLoadingImages,
  onDelete,
}: LocationFactsPanelProps) {
  return (
    <div
      className="absolute left-8 top-1/2 transform -translate-y-1/2 w-80 bg-black/90 backdrop-blur-md rounded-lg border border-white/20 shadow-2xl z-10 pointer-events-auto max-h-[80vh] flex flex-col"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex-shrink-0 p-6 pb-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-white font-semibold text-lg">{marker.name}</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Are you sure you want to delete this location?")) {
                      onDelete();
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="text-white/60 hover:text-red-400 transition-colors p-1.5 hover:bg-red-500/10 rounded"
                  title="Delete location"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <a
                  href={`https://www.google.com/maps/place/${marker.latitude},${marker.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-blue-400 transition-colors p-1.5 hover:bg-white/10 rounded"
                  title="Open in Google Maps"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <span>{marker.latitude.toFixed(4)}°N</span>
              <span>•</span>
              <span>{marker.longitude.toFixed(4)}°E</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white/50 text-xs uppercase tracking-wider">Accuracy</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${marker.accuracy * 100}%` }}
                ></div>
              </div>
              <span className="text-white font-medium text-sm">{(marker.accuracy * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white/50 text-xs uppercase tracking-wider">Analysis</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>
            <p className="text-white/80 text-sm leading-relaxed max-h-30 overflow-y-auto">
              {marker.facts}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden border-t border-white/10">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-white/50 text-xs uppercase tracking-wider">Street View Images</span>
            <div className="flex-1 h-px bg-white/10"></div>
            {isLoadingImages && (
              <div className="animate-spin h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full"></div>
            )}
          </div>
        </div>
        <div className="overflow-y-auto px-4 space-y-3 pb-6" style={{ maxHeight: "calc(80vh - 320px)" }}>
          {isLoadingImages ? (
            <div className="text-white/50 text-sm text-center py-8">
              Loading street view images...
            </div>
          ) : images && images.length > 0 ? (
            images.map((imageUrl, index) => (
              <div key={index} className="relative rounded-lg overflow-hidden bg-black/50 border border-white/10 hover:border-blue-400/50 transition-all group">
                <img
                  src={imageUrl}
                  alt={`Street view ${index + 1}`}
                  className="w-full h-40 object-cover"
                  onError={(e) => {
                    e.currentTarget.parentElement!.style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <span className="text-white text-xs">Image {index + 1}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-white/50 text-sm text-center py-8">
              No street view images available for this location
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
