"use client";

import React from "react";
import { SessionLink } from "@/lib/globe-database";
import { ConstellationNode, nodeCenter } from "./types";

export function ConstellationLines({
  links,
  nodes,
  hoveredNodeId,
  hoveredLinkId,
  selectedLinkId,
  onCanvasClear,
  onHoverLink,
  onSelectLink,
  onDeleteLink,
}: {
  links: SessionLink[];
  nodes: ConstellationNode[];
  hoveredNodeId: string | null;
  hoveredLinkId: string | null;
  selectedLinkId: string | null;
  onCanvasClear: () => void;
  onHoverLink: (linkId: string | null) => void;
  onSelectLink: (linkId: string | null) => void;
  onDeleteLink: (linkId: string) => void;
}) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      style={{ zIndex: 1 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCanvasClear();
      }}
    >
      {links.map((link) => {
        const fromNode = nodes.find((n) => n.id === link.fromSessionId);
        const toNode = nodes.find((n) => n.id === link.toSessionId);
        if (!fromNode || !toNode) return null;

        const from = nodeCenter(fromNode);
        const to = nodeCenter(toNode);
        const isActive =
          hoveredNodeId === link.fromSessionId ||
          hoveredNodeId === link.toSessionId ||
          hoveredLinkId === link.id ||
          selectedLinkId === link.id;

        return (
          <g key={link.id}>
            {/* Fat invisible hitbox */}
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="transparent"
              strokeWidth="18"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => onHoverLink(link.id)}
              onMouseLeave={() => onHoverLink(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectLink(selectedLinkId === link.id ? null : link.id);
              }}
            />
            {/* The line itself: thin, like a constellation chart */}
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={
                isActive
                  ? "rgba(143, 184, 216, 0.9)"
                  : "rgba(143, 184, 216, 0.3)"
              }
              strokeWidth={isActive ? 2 : 1.5}
              style={{
                transition: "stroke 0.3s ease-in-out",
                pointerEvents: "none",
              }}
            />
            {/* Midpoint star */}
            <circle
              cx={(from.x + to.x) / 2}
              cy={(from.y + to.y) / 2}
              r={isActive ? 3 : 2}
              fill={isActive ? "#ffffff" : "rgba(255, 255, 255, 0.55)"}
              style={{
                transition: "fill 0.3s ease-in-out",
                pointerEvents: "none",
              }}
            />
            {/* Delete affordance when selected */}
            {selectedLinkId === link.id && (
              <g
                transform={`translate(${(from.x + to.x) / 2}, ${(from.y + to.y) / 2 - 18})`}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteLink(link.id);
                }}
              >
                <circle r="10" fill="rgba(229, 72, 77, 0.9)" />
                <path
                  d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function LinkingThread({
  fromPosition,
  mousePosition,
}: {
  fromPosition: { x: number; y: number };
  mousePosition: { x: number; y: number };
}) {
  return (
    <svg
      className="pointer-events-none fixed inset-0 h-screen w-screen"
      style={{ zIndex: 999 }}
    >
      <line
        x1={fromPosition.x}
        y1={fromPosition.y}
        x2={mousePosition.x}
        y2={mousePosition.y}
        stroke="rgba(56, 189, 248, 0.8)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <circle cx={mousePosition.x} cy={mousePosition.y} r="3" fill="#ffffff" />
    </svg>
  );
}
