import { useCallback, useEffect, useState } from "react";
import {
  ConstellationNode,
  NODE_W,
  NODE_H,
} from "@/components/constellation/types";

interface UseSessionLinkingArgs {
  getNode: (sessionId: string) => ConstellationNode | undefined;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  createLink: (
    fromSessionId: string,
    toSessionId: string,
    linkType?: "related" | "sequential" | "reference",
    description?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onStartLinking?: () => void;
}

export function useSessionLinking({
  getNode,
  canvasRef,
  createLink,
  onStartLinking,
}: UseSessionLinkingArgs) {
  const [isLinking, setIsLinking] = useState(false);
  const [linkingFromNodeId, setLinkingFromNodeId] = useState<string | null>(
    null,
  );
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [linkingFromPosition, setLinkingFromPosition] = useState({
    x: 0,
    y: 0,
  });

  const cancelLinking = useCallback(() => {
    setIsLinking(false);
    setLinkingFromNodeId(null);
    setLinkingFromPosition({ x: 0, y: 0 });
  }, []);

  const startLinking = useCallback(
    (sessionId: string) => {
      const node = getNode(sessionId);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!node || !rect) return;

      const nodePosition = {
        x: rect.left + node.position.x + NODE_W / 2,
        y: rect.top + node.position.y + NODE_H / 2,
      };

      setIsLinking(true);
      setLinkingFromNodeId(sessionId);
      setLinkingFromPosition(nodePosition);
      setMousePosition(nodePosition);
      onStartLinking?.();
    },
    [getNode, canvasRef, onStartLinking],
  );

  const completeLink = useCallback(
    async (targetSessionId: string) => {
      if (
        !isLinking ||
        !linkingFromNodeId ||
        linkingFromNodeId === targetSessionId
      )
        return;

      try {
        await createLink(linkingFromNodeId, targetSessionId, "related");
      } catch {
        // Linking is best-effort; a duplicate link error is fine to ignore.
      }

      cancelLinking();
    },
    [isLinking, linkingFromNodeId, createLink, cancelLinking],
  );

  // ESC cancels linking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isLinking) cancelLinking();
    };
    if (isLinking) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLinking, cancelLinking]);

  return {
    isLinking,
    linkingFromNodeId,
    mousePosition,
    setMousePosition,
    linkingFromPosition,
    startLinking,
    completeLink,
    cancelLinking,
  };
}
