import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConstellationNode,
  NODE_W,
  NODE_H,
} from "@/components/constellation/types";

interface UseConstellationDragArgs {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  isLinking: boolean;
  linkingFromNodeId: string | null;
  setLinkingMousePosition: (pos: { x: number; y: number }) => void;
  completeLink: (targetSessionId: string) => void;
  onCloseSettings: () => void;
  onOpenNode: (nodeId: string) => void;
}

export function useConstellationDrag({
  canvasRef,
  isLinking,
  linkingFromNodeId,
  setLinkingMousePosition,
  completeLink,
  onCloseSettings,
  onOpenNode,
}: UseConstellationDragArgs) {
  const [nodes, setNodes] = useState<ConstellationNode[]>([]);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragMovedRef = useRef(false);
  const nodesRef = useRef<ConstellationNode[]>([]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      onCloseSettings();

      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;

      setDragOffset({
        x: e.clientX - rect.left - node.position.x,
        y: e.clientY - rect.top - node.position.y,
      });
      setDraggingNodeId(nodeId);
      dragMovedRef.current = false;

      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, isDragging: true } : n)),
      );
    },
    [canvasRef, onCloseSettings],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (isLinking) {
        setLinkingMousePosition({ x: e.clientX, y: e.clientY });
      }

      if (!draggingNodeId) return;

      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;
      const constrainedX = Math.max(0, Math.min(newX, rect.width - NODE_W));
      const constrainedY = Math.max(0, Math.min(newY, rect.height - NODE_H));

      dragMovedRef.current = true;

      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNodeId
            ? { ...n, position: { x: constrainedX, y: constrainedY } }
            : n,
        ),
      );
    },
    [canvasRef, isLinking, setLinkingMousePosition, draggingNodeId, dragOffset],
  );

  const handleMouseUp = useCallback(() => {
    if (!draggingNodeId) return;
    const nodeId = draggingNodeId;

    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, isDragging: false } : n)),
    );
    setDraggingNodeId(null);

    // A press without movement is a click: open the session (or complete a link)
    if (!dragMovedRef.current) {
      if (isLinking && linkingFromNodeId !== nodeId) {
        completeLink(nodeId);
      } else if (!isLinking) {
        onOpenNode(nodeId);
      }
    }
  }, [draggingNodeId, isLinking, linkingFromNodeId, completeLink, onOpenNode]);

  return {
    nodes,
    setNodes,
    draggingNodeId,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
