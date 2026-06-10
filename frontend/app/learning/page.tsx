'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth0Firebase } from '@/hooks/useAuth0Firebase';
import { useGlobeSessions } from '@/hooks/useGlobeSessions';
import { useSessionLinks } from '@/hooks/useSessionLinks';
import { Button } from '@/components/ui/Button';
import { Navbar } from '@/components/ui/Navbar';
import StarryNightBackground from '@/components/ui/starry-night-background';
import { GlobeSessionWithData, deleteSessionLinks } from '@/lib/globe-database';
import { UploadModal } from '@/components/UploadModal';
import { useChatStore } from '@/components/useChatStore';

import { Plus, Star, X, Trash2, Settings, Link } from 'lucide-react';

// Card geometry — link endpoints are computed from these.
const NODE_W = 176;
const NODE_H = 150;

interface ConstellationNode {
  id: string;
  session: GlobeSessionWithData;
  position: { x: number; y: number };
  isDragging: boolean;
}

/** Deterministic golden-angle spiral around the canvas center. */
function spiralPosition(index: number, width: number, height: number) {
  const cx = width / 2 - NODE_W / 2;
  const cy = height / 2 - NODE_H / 2;
  if (index === 0) return { x: cx, y: cy };
  const angle = index * 2.4;
  const radius = 150 + 85 * Math.sqrt(index);
  return {
    x: Math.max(16, Math.min(cx + radius * Math.cos(angle), width - NODE_W - 16)),
    y: Math.max(96, Math.min(cy + radius * Math.sin(angle) * 0.75, height - NODE_H - 16)),
  };
}

const ConstellationNodeCard: React.FC<{
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
  const borderClass = isLinkingFrom
    ? 'border-star-400/60 shadow-[0_0_24px_rgba(232,180,79,0.25)]'
    : isLinking
    ? 'border-ice-400/50 shadow-[0_0_24px_rgba(143,184,216,0.2)]'
    : isHovered
    ? 'border-ice-400/40 shadow-[0_0_20px_rgba(143,184,216,0.15)]'
    : 'border-white/10';

  return (
    <div
      data-node-id={node.id}
      className={`absolute select-none ${node.isDragging ? 'z-50 cursor-grabbing' : 'z-10 cursor-grab'} ${
        isLinking && !isLinkingFrom ? 'cursor-pointer' : ''
      }`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: NODE_W,
        transform: node.isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: node.isDragging ? 'none' : 'transform 0.1s ease-out',
        willChange: node.isDragging ? 'transform' : 'auto',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
    >
      <div className={`group relative rounded-xl border bg-space-900/75 p-4 backdrop-blur-md transition-[border-color,box-shadow] duration-300 ${borderClass}`}>
        {/* Status */}
        <span
          className={`absolute right-3 top-3 h-1.5 w-1.5 rounded-full ${
            node.session.status === 'active' ? 'bg-star-400' : 'bg-ice-500'
          }`}
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
              className="rounded p-1 text-fg-muted/60 opacity-0 transition-opacity hover:bg-white/10 hover:text-fg group-hover:opacity-100"
              title="Settings"
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
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateLink();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="rounded p-1 text-fg-muted transition-colors hover:bg-star-400/20 hover:text-star-300"
                title={linkCopied ? 'Link copied!' : 'Link to another session'}
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
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Star + label */}
        <div className="flex items-center gap-2">
          <Star className="h-3.5 w-3.5 fill-star-400 text-star-400" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">
            Session
          </span>
        </div>

        <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-fg">{node.session.title}</h3>

        <p className="mt-2 text-xs text-fg-muted">
          {node.session.data?.globeImages?.length || 0} images ·{' '}
          {node.session.data?.chatHistory?.length || 0} chats
        </p>
        <p className="mt-1 text-[11px] text-fg-muted/70">
          {node.session.lastAccessedAt
            ? new Date(node.session.lastAccessedAt).toLocaleDateString()
            : 'Never accessed'}
        </p>
      </div>
    </div>
  );
});
ConstellationNodeCard.displayName = 'ConstellationNodeCard';

/** Full-screen starfield with a centered glass panel — shared by loading/auth states. */
function CenteredState({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-hidden bg-space-950 text-fg">
      <Navbar currentSection={0} variant="learning" />
      <div className="absolute inset-0">
        <StarryNightBackground numStars={3000} />
      </div>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-space-900/75 p-10 text-center backdrop-blur-md">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function LearningPage() {
  const router = useRouter();
  const { user, firebaseUserId, isLoading } = useAuth0Firebase();
  const { sessions, loading: sessionsLoading, createNewSession: createSession, deleteSession, updateSessionData, updateSessionDataKey } = useGlobeSessions();
  const { links, createLink, removeLink, reloadLinks } = useSessionLinks();

  const [nodes, setNodes] = useState<ConstellationNode[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [selectedSession, setSelectedSession] = useState<GlobeSessionWithData | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [settingsOpenNodeId, setSettingsOpenNodeId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    sessionId: string;
    sessionTitle: string;
  }>({ isOpen: false, sessionId: '', sessionTitle: '' });
  const [linkDeleteConfirmation, setLinkDeleteConfirmation] = useState<{
    isOpen: boolean;
    linkId: string;
    fromSessionTitle: string;
    toSessionTitle: string;
  }>({ isOpen: false, linkId: '', fromSessionTitle: '', toSessionTitle: '' });
  const [linkCopiedId] = useState<string | null>(null);

  // Visual linking
  const [isLinking, setIsLinking] = useState(false);
  const [linkingFromNodeId, setLinkingFromNodeId] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [linkingFromPosition, setLinkingFromPosition] = useState({ x: 0, y: 0 });

  // Hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragMovedRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<ConstellationNode[]>([]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Prevent overscroll rubber-banding while panning the canvas
  useEffect(() => {
    const prevOverscroll = document.documentElement.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = 'none';

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

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false } as AddEventListenerOptions);
    window.addEventListener('wheel', onWheel, { passive: false } as AddEventListenerOptions);

    return () => {
      document.documentElement.style.overscrollBehavior = prevOverscroll || '';
      window.removeEventListener('touchstart', onTouchStart as EventListener);
      window.removeEventListener('touchmove', onTouchMove as EventListener);
      window.removeEventListener('wheel', onWheel as EventListener);
    };
  }, []);

  // ESC cancels linking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLinking) cancelLinking();
    };
    if (isLinking) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLinking]);

  // Clicking outside nodes cancels linking / deselects links
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isNodeClick = target.closest('[data-node-id]');
      const isSVGClick = target.closest('svg');

      if (isLinking && !isNodeClick) cancelLinking();
      if (!isSVGClick && selectedLinkId) setSelectedLinkId(null);
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, [isLinking, selectedLinkId]);

  // Lay out nodes when sessions load
  useEffect(() => {
    if (sessions.length > 0) {
      const rect = canvasRef.current?.getBoundingClientRect();
      const width = rect?.width || window.innerWidth;
      const height = rect?.height || window.innerHeight;

      setNodes(
        sessions.map((session, index) => ({
          id: session.id,
          session,
          position: spiralPosition(index, width, height),
          isDragging: false,
        }))
      );

      // Reload links once nodes exist so the lines can resolve endpoints
      setTimeout(() => reloadLinks(), 100);
    } else {
      setNodes([]);
    }

    if (!sessionsLoading && !isLoading) {
      setInitialLoadComplete(true);
    }
  }, [sessions, sessionsLoading, isLoading]);

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    setSettingsOpenNodeId(null);

    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;

    setDragOffset({
      x: e.clientX - rect.left - node.position.x,
      y: e.clientY - rect.top - node.position.y,
    });
    setDraggingNodeId(nodeId);
    dragMovedRef.current = false;

    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, isDragging: true } : n)));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (isLinking) {
      setMousePosition({ x: e.clientX, y: e.clientY });
    }

    if (!draggingNodeId) return;

    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top - dragOffset.y;
    const constrainedX = Math.max(0, Math.min(newX, rect.width - NODE_W));
    const constrainedY = Math.max(0, Math.min(newY, rect.height - NODE_H));

    dragMovedRef.current = true;

    setNodes((prev) =>
      prev.map((n) =>
        n.id === draggingNodeId ? { ...n, position: { x: constrainedX, y: constrainedY } } : n
      )
    );
  };

  const handleMouseUp = () => {
    if (!draggingNodeId) return;
    const nodeId = draggingNodeId;

    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, isDragging: false } : n)));
    setDraggingNodeId(null);

    // A press without movement is a click: open the session (or complete a link)
    if (!dragMovedRef.current) {
      if (isLinking && linkingFromNodeId !== nodeId) {
        completeLink(nodeId);
      } else if (!isLinking) {
        useChatStore.getState().clear();
        router.push(`/chat/${nodeId}`);
      }
    }
  };

  const openUploadModal = () => setShowUploadModal(true);

  const handleCreateSessionFromUpload = async (title: string) => {
    if (!firebaseUserId) {
      throw new Error('Please make sure you are logged in');
    }
    return createSession(title);
  };

  const handleToggleSettings = (nodeId: string) => {
    setSettingsOpenNodeId((prev) => (prev === nodeId ? null : nodeId));
  };

  const startLinking = (sessionId: string) => {
    const node = nodes.find((n) => n.id === sessionId);
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
    setSettingsOpenNodeId(null);
  };

  const completeLink = async (targetSessionId: string) => {
    if (!isLinking || !linkingFromNodeId || linkingFromNodeId === targetSessionId) return;

    try {
      await createLink(linkingFromNodeId, targetSessionId, 'related');
    } catch {
      // Linking is best-effort; a duplicate link error is fine to ignore.
    }

    cancelLinking();
  };

  const cancelLinking = () => {
    setIsLinking(false);
    setLinkingFromNodeId(null);
    setLinkingFromPosition({ x: 0, y: 0 });
  };

  const handleDeleteLink = (linkId: string) => {
    const link = links.find((l) => l.id === linkId);
    if (!link) return;

    const fromSession = sessions.find((s) => s.id === link.fromSessionId);
    const toSession = sessions.find((s) => s.id === link.toSessionId);
    if (!fromSession || !toSession) return;

    setLinkDeleteConfirmation({
      isOpen: true,
      linkId,
      fromSessionTitle: fromSession.title,
      toSessionTitle: toSession.title,
    });
    setSelectedLinkId(null);
  };

  const confirmDeleteLink = async () => {
    try {
      await removeLink(linkDeleteConfirmation.linkId);
    } catch (error) {
      console.error('Failed to delete link:', error);
    }
    setLinkDeleteConfirmation({ isOpen: false, linkId: '', fromSessionTitle: '', toSessionTitle: '' });
  };

  const handleDeleteSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setDeleteConfirmation({ isOpen: true, sessionId, sessionTitle: session.title });
    }
  };

  const confirmDeleteSession = async () => {
    try {
      await Promise.all([
        deleteSession(deleteConfirmation.sessionId),
        deleteSessionLinks(deleteConfirmation.sessionId),
      ]);
      setNodes((prev) => prev.filter((node) => node.id !== deleteConfirmation.sessionId));
      setSettingsOpenNodeId(null);
      setDeleteConfirmation({ isOpen: false, sessionId: '', sessionTitle: '' });
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const cancelDeleteSession = () => {
    setDeleteConfirmation({ isOpen: false, sessionId: '', sessionTitle: '' });
  };

  // ESC closes confirmation modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteConfirmation.isOpen) cancelDeleteSession();
      else if (linkDeleteConfirmation.isOpen) {
        setLinkDeleteConfirmation({ isOpen: false, linkId: '', fromSessionTitle: '', toSessionTitle: '' });
      }
    };

    if (deleteConfirmation.isOpen || linkDeleteConfirmation.isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [deleteConfirmation.isOpen, linkDeleteConfirmation.isOpen]);

  if (!user) {
    return (
      <CenteredState>
        <Star className="mx-auto h-10 w-10 text-star-400" />
        <h1 className="mt-5 text-2xl font-bold text-fg">Your constellation awaits</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Sign in to create globe sessions and map your learning universe.
        </p>
        <Button className="mt-7" size="lg" asChild>
          <a href="/auth/login">Log In</a>
        </Button>
      </CenteredState>
    );
  }

  if (!initialLoadComplete || sessionsLoading || isLoading) {
    return (
      <CenteredState>
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-star-400/20 border-t-star-400" />
        <h1 className="mt-5 text-2xl font-bold text-fg">Loading your constellation…</h1>
        <p className="mt-2 text-sm text-fg-muted">Gathering your globe sessions from the stars.</p>
      </CenteredState>
    );
  }

  const nodeCenter = (node: ConstellationNode) => ({
    x: node.position.x + NODE_W / 2,
    y: node.position.y + NODE_H / 2,
  });

  return (
    <div className="min-h-screen overflow-hidden bg-space-950 text-fg">
      <Navbar currentSection={0} variant="learning" />

      {/* Constellation canvas */}
      <div
        ref={canvasRef}
        className="relative h-screen w-full"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setSettingsOpenNodeId(null);
            if (isLinking) cancelLinking();
          }
        }}
        style={{ cursor: isLinking ? 'crosshair' : 'default' }}
      >
        {/* Starfield */}
        <div
          className="absolute inset-0 overflow-hidden"
          onClick={() => {
            if (isLinking) cancelLinking();
            setSettingsOpenNodeId(null);
          }}
        >
          <StarryNightBackground numStars={4500} />
        </div>

        {/* Header */}
        <div className="pointer-events-none absolute left-0 right-0 top-24 z-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-fg">
            {user?.displayName || user?.email?.split('@')[0] || 'Your'}&apos;s Constellation
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            Drag sessions to arrange them · click one to open it
          </p>
        </div>

        {/* New session */}
        <div className="absolute right-6 top-28 z-20 sm:right-8">
          <Button onClick={openUploadModal}>
            <Plus className="h-4 w-4" />
            New Session
          </Button>
        </div>

        {/* Nodes */}
        {nodes.map((node) => (
          <ConstellationNodeCard
            key={node.id}
            node={node}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onMouseEnter={() => setHoveredNodeId(node.id)}
            onMouseLeave={() => setHoveredNodeId(null)}
            onDelete={() => handleDeleteSession(node.id)}
            onCreateLink={() => startLinking(node.id)}
            isSettingsOpen={settingsOpenNodeId === node.id}
            onToggleSettings={() => handleToggleSettings(node.id)}
            linkCopied={linkCopiedId === node.id}
            isLinking={isLinking}
            isLinkingFrom={linkingFromNodeId === node.id}
            isHovered={hoveredNodeId === node.id}
          />
        ))}

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="max-w-md rounded-xl border border-white/10 bg-space-900/75 p-10 text-center backdrop-blur-md">
              <Star className="mx-auto h-10 w-10 text-star-400" />
              <h2 className="mt-5 text-xl font-bold text-fg">Your constellation awaits</h2>
              <p className="mt-2 text-sm text-fg-muted">
                Create your first globe session to begin exploring the world.
              </p>
              <Button
                className="mt-7"
                onClick={(e) => {
                  e.stopPropagation();
                  openUploadModal();
                }}
              >
                <Plus className="h-4 w-4" />
                Create First Session
              </Button>
            </div>
          </div>
        )}

        {/* Constellation lines */}
        <svg
          className="absolute inset-0 h-full w-full"
          style={{ zIndex: 1 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedSession(null);
              setSelectedLinkId(null);
              if (isLinking) cancelLinking();
            }
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
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredLinkId(link.id)}
                  onMouseLeave={() => setHoveredLinkId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLinkId(selectedLinkId === link.id ? null : link.id);
                  }}
                />
                {/* The line itself — thin, like a constellation chart */}
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={isActive ? 'rgba(143, 184, 216, 0.9)' : 'rgba(143, 184, 216, 0.3)'}
                  strokeWidth={isActive ? 2 : 1.5}
                  style={{ transition: 'stroke 0.3s ease-in-out', pointerEvents: 'none' }}
                />
                {/* Midpoint star */}
                <circle
                  cx={(from.x + to.x) / 2}
                  cy={(from.y + to.y) / 2}
                  r={isActive ? 3 : 2}
                  fill={isActive ? '#e8b44f' : 'rgba(232, 180, 79, 0.6)'}
                  style={{ transition: 'fill 0.3s ease-in-out', pointerEvents: 'none' }}
                />
                {/* Delete affordance when selected */}
                {selectedLinkId === link.id && (
                  <g
                    transform={`translate(${(from.x + to.x) / 2}, ${(from.y + to.y) / 2 - 18})`}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLink(link.id);
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
      </div>

      {/* Linking thread */}
      {isLinking && (
        <svg
          className="pointer-events-none fixed inset-0 h-screen w-screen"
          style={{ zIndex: 999 }}
        >
          <line
            x1={linkingFromPosition.x}
            y1={linkingFromPosition.y}
            x2={mousePosition.x}
            y2={mousePosition.y}
            stroke="rgba(232, 180, 79, 0.8)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <circle cx={mousePosition.x} cy={mousePosition.y} r="3" fill="#e8b44f" />
        </svg>
      )}

      {/* Session detail */}
      {selectedSession && (
        <SessionDetailModal session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onCreateSession={handleCreateSessionFromUpload}
      />

      {/* Delete session confirmation */}
      {deleteConfirmation.isOpen && (
        <ConfirmDialog
          title="Delete Session"
          confirmLabel="Delete Forever"
          onCancel={cancelDeleteSession}
          onConfirm={confirmDeleteSession}
        >
          <p className="text-fg-muted">Are you sure you want to delete</p>
          <p className="mt-1 break-words font-semibold text-fg">
            &ldquo;{deleteConfirmation.sessionTitle}&rdquo;?
          </p>
          <p className="mt-4 text-sm text-destructive/90">
            This cannot be undone. All globe images and chat history will be permanently lost.
          </p>
        </ConfirmDialog>
      )}

      {/* Delete link confirmation */}
      {linkDeleteConfirmation.isOpen && (
        <ConfirmDialog
          title="Delete Connection"
          confirmLabel="Delete Link"
          onCancel={() =>
            setLinkDeleteConfirmation({ isOpen: false, linkId: '', fromSessionTitle: '', toSessionTitle: '' })
          }
          onConfirm={confirmDeleteLink}
        >
          <p className="text-fg-muted">Remove the link between</p>
          <p className="mt-1 break-words font-semibold text-fg">
            &ldquo;{linkDeleteConfirmation.fromSessionTitle}&rdquo;
          </p>
          <p className="text-fg-muted">and</p>
          <p className="break-words font-semibold text-fg">
            &ldquo;{linkDeleteConfirmation.toSessionTitle}&rdquo;?
          </p>
          <p className="mt-4 text-sm text-destructive/90">This cannot be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function ConfirmDialog({
  title,
  confirmLabel,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-space-950/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="mx-4 w-full max-w-md rounded-xl border border-white/10 bg-space-900 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
            <Trash2 className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="mt-5 text-xl font-bold text-fg">{title}</h3>
          <div className="mt-3">{children}</div>
          <div className="mt-8 flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1 border-white/15 bg-transparent text-fg hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 bg-destructive text-white hover:bg-destructive/85"
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionDetailModal({ session, onClose }: { session: GlobeSessionWithData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-space-950/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-space-900">
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <h2 className="text-2xl font-bold text-fg">{session.title}</h2>
          <Button
            onClick={onClose}
            variant="outline"
            className="border-white/15 bg-transparent text-fg hover:bg-white/10"
          >
            Close
          </Button>
        </div>

        <div className="grid h-[70vh] md:grid-cols-2">
          <div className="overflow-y-auto border-r border-white/10 p-6">
            <h3 className="text-lg font-semibold text-fg">Globe Exploration</h3>
            <div className="mt-4 space-y-4">
              {session.data?.globeImages?.map((image: any) => (
                <div key={image.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex h-40 w-full items-center justify-center rounded-lg bg-space-800 text-center text-sm text-fg-muted">
                    {image.locationName}
                  </div>
                  <div className="mt-3 text-sm">
                    <p className="font-medium text-fg">{image.locationName}</p>
                    <p className="text-fg-muted">
                      {image.location.lat.toFixed(4)}, {image.location.lng.toFixed(4)}
                    </p>
                    {image.userNote && (
                      <p className="mt-2 italic text-fg-muted">&ldquo;{image.userNote}&rdquo;</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-fg">AI Conversation</h3>
            <div className="mt-4 space-y-3">
              {session.data?.chatHistory?.map((chat: any) => (
                <div
                  key={chat.id}
                  className={`rounded-lg p-3 text-sm ${
                    chat.role === 'user'
                      ? 'ml-8 bg-ice-500/15 text-ice-300'
                      : 'mr-8 bg-white/5 text-fg'
                  }`}
                >
                  <div className="font-medium">{chat.role === 'user' ? 'You' : 'AI Assistant'}</div>
                  <div className="mt-1">{chat.message}</div>
                  <div className="mt-2 text-xs text-fg-muted">
                    {chat.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
