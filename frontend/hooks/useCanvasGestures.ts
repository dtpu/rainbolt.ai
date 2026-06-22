import { useEffect } from "react";

// Prevent overscroll rubber-banding while panning the canvas.
export function useOverscrollPrevention() {
  useEffect(() => {
    const prevOverscroll = document.documentElement.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = "none";

    let startY = 0;
    function onTouchStart(e: TouchEvent) {
      if (e.touches && e.touches.length > 0) startY = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (!e.touches || e.touches.length === 0) return;
      const diff = e.touches[0].clientY - startY;
      const scroller = document.scrollingElement || document.documentElement;
      const { scrollTop, scrollHeight } = scroller;
      const clientHeight = document.documentElement.clientHeight;

      if (scrollTop === 0 && diff > 0) e.preventDefault();
      if (scrollTop + clientHeight >= scrollHeight && diff < 0) e.preventDefault();
    }

    function onWheel(e: WheelEvent) {
      const scroller = document.scrollingElement || document.documentElement;
      const { scrollTop, scrollHeight } = scroller;
      const clientHeight = document.documentElement.clientHeight;

      if (e.deltaY < 0 && scrollTop === 0) e.preventDefault();
      if (e.deltaY > 0 && scrollTop + clientHeight >= scrollHeight) e.preventDefault();
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false } as AddEventListenerOptions);
    window.addEventListener("wheel", onWheel, { passive: false } as AddEventListenerOptions);

    return () => {
      document.documentElement.style.overscrollBehavior = prevOverscroll || "";
      window.removeEventListener("touchstart", onTouchStart as EventListener);
      window.removeEventListener("touchmove", onTouchMove as EventListener);
      window.removeEventListener("wheel", onWheel as EventListener);
    };
  }, []);
}

// Clicking outside nodes cancels linking and deselects links.
export function useGlobalCanvasClick({
  isLinking,
  selectedLinkId,
  cancelLinking,
  clearSelectedLink,
}: {
  isLinking: boolean;
  selectedLinkId: string | null;
  cancelLinking: () => void;
  clearSelectedLink: () => void;
}) {
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isNodeClick = target.closest("[data-node-id]");
      const isSVGClick = target.closest("svg");

      if (isLinking && !isNodeClick) cancelLinking();
      if (!isSVGClick && selectedLinkId) clearSelectedLink();
    };

    document.addEventListener("click", handleGlobalClick, true);
    return () => document.removeEventListener("click", handleGlobalClick, true);
  }, [isLinking, selectedLinkId, cancelLinking, clearSelectedLink]);
}
