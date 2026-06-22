"use client";

import React from "react";
import { X, Trash2, Settings, Link, ArrowRight } from "lucide-react";
import { ConstellationNode, NODE_W } from "./types";

// A small celestial star: a bright white core with a soft sky-blue halo, so each
// session reads as a star in the constellation rather than a flat icon.
function StarNode({ active }: { active: boolean }) {
  return (
    <span className="relative inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">
      <span
        className={`absolute inset-0 rounded-full blur-[5px] transition-opacity ${
          active ? "bg-sky-300/50" : "bg-sky-400/20"
        }`}
      />
      <svg viewBox="0 0 24 24" className="relative h-3.5 w-3.5">
        {/* 4-point sparkle reads more "star/constellation" than a chunky 5-point */}
        <path
          d="M12 1.5c.5 5.2 3.3 8 8.5 8.5-5.2.5-8 3.3-8.5 8.5-.5-5.2-3.3-8-8.5-8.5 5.2-.5 8-3.3 8.5-8.5z"
          fill="#ffffff"
        />
      </svg>
    </span>
  );
}

export const ConstellationNodeCard: React.FC<{
  node: ConstellationNode;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onDelete: () => void;
  onCreateLink: () => void;
  isSettingsOpen: boolean;
  onToggleSettings: () => void;
  linkCopied: boolean;
  isLinking: boolean;
  isLinkingFrom: boolean;
  isHovered?: boolean;
}> = React.memo(({ node, onMouseDown, onMouseEnter, onMouseLeave, onDelete, onCreateLink, isSettingsOpen, onToggleSettings, linkCopied, isLinking, isLinkingFrom, isHovered }) => {
  const active = node.session.status === "active";
  const borderClass = isLinkingFrom
    ? "border-sky-400/70 shadow-[0_0_28px_rgba(56,189,248,0.3)]"
    : isLinking
    ? "border-sky-400/45 shadow-[0_0_22px_rgba(56,189,248,0.18)]"
    : isHovered
    ? "border-white/25 shadow-[0_0_22px_rgba(255,255,255,0.1)]"
    : "border-white/10";

  return (
    <div
      data-node-id={node.id}
      className={`absolute select-none ${node.isDragging ? "z-50 cursor-grabbing" : "z-10 cursor-grab"} ${
        isLinking && !isLinkingFrom ? "cursor-pointer" : ""
      }`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: NODE_W,
        transform: node.isDragging ? "scale(1.02)" : "scale(1)",
        transition: node.isDragging ? "none" : "transform 0.1s ease-out",
        willChange: node.isDragging ? "transform" : "auto",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
    >
      <div className={`group relative rounded-xl border bg-space-900/80 p-4 backdrop-blur-md transition-[border-color,box-shadow] duration-300 ${borderClass}`}>
        {/* Status: bright glowing dot when active, dim otherwise */}
        <span
          className={`absolute right-3 top-3 h-1.5 w-1.5 rounded-full ${
            active ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "bg-white/25"
          }`}
          title={active ? "Active" : "Completed"}
        />

        {/* Settings */}
        <div className="absolute right-1.5 bottom-1.5">
          {!isSettingsOpen ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSettings();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="rounded p-1 text-fg-muted/60 opacity-0 transition-opacity hover:bg-white/10 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
              title="Settings"
              aria-label="Session settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-space-800 p-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="rounded p-1 text-fg-muted transition-colors hover:bg-destructive/20 hover:text-destructive"
                title="Delete session"
                aria-label="Delete session"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateLink();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="rounded p-1 text-fg-muted transition-colors hover:bg-sky-400/20 hover:text-sky-300"
                title={linkCopied ? "Link copied!" : "Link to another session"}
                aria-label={linkCopied ? "Link copied" : "Link to another session"}
              >
                <Link className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSettings();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="rounded p-1 text-fg-muted transition-colors hover:bg-white/10 hover:text-fg"
                title="Close"
                aria-label="Close settings"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Star + label */}
        <div className="flex items-center gap-2">
          <StarNode active={active} />
          <span className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">
            Session
          </span>
        </div>

        <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-fg">{node.session.title}</h3>

        <p className="mt-2 text-xs text-fg-muted">
          {node.session.data?.globeImages?.length || 0} images ·{" "}
          {node.session.data?.chatHistory?.length || 0} chats
        </p>
        <p className="mt-1 text-[11px] text-fg-muted/70">
          {node.session.lastAccessedAt
            ? new Date(node.session.lastAccessedAt).toLocaleDateString()
            : "Never accessed"}
        </p>

        {/* Affordance: clicking the star opens the session view */}
        <div className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-fg-muted/55 transition-colors group-hover:text-sky-300">
          Click to view
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  );
});
ConstellationNodeCard.displayName = "ConstellationNodeCard";
