"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth0Firebase } from "@/hooks/useAuth0Firebase";
import { useGlobeSessions } from "@/hooks/useGlobeSessions";
import { useSessionLinks } from "@/hooks/useSessionLinks";
import { useConstellationDrag } from "@/hooks/useConstellationDrag";
import { useSessionLinking } from "@/hooks/useSessionLinking";
import {
  useOverscrollPrevention,
  useGlobalCanvasClick,
} from "@/hooks/useCanvasGestures";
import { Navbar } from "@/components/ui/Navbar";
import StarryNightBackground from "@/components/globe/StarryNightBackground";
import { HowItWorks } from "@/components/HowItWorks";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ConstellationNodeCard } from "@/components/constellation/ConstellationNodeCard";
import { CenteredState } from "@/components/constellation/CenteredState";
import {
  ConstellationLines,
  LinkingThread,
} from "@/components/constellation/ConstellationLinks";
import {
  ConstellationNode,
  spiralPosition,
} from "@/components/constellation/types";
import { deleteSessionLinks } from "@/lib/globe-database";
import { DEMO_SESSIONS, DEMO_LINKS } from "@/lib/demo-constellation";
import { UploadModal } from "@/components/chat/UploadModal";
import { useChatStore } from "@/components/useChatStore";

import { HelpCircle, Plus, Star } from "lucide-react";

export default function LearningPage() {
  const router = useRouter();
  const { user, firebaseUserId, isLoading } = useAuth0Firebase();
  const {
    sessions,
    loading: sessionsLoading,
    createNewSession: createSession,
    deleteSession,
  } = useGlobeSessions();
  const { links, createLink, removeLink, reloadLinks } = useSessionLinks();

  // Guest demo mode: once auth has resolved and there's no signed-in user, show
  // a populated demo constellation (read-only) instead of a login wall, so the
  // feature is visible to visitors. Sign-in stays available in the navbar.
  const isGuest = !isLoading && !user;
  // Guests get the full app (create / upload / chat under a per-browser id) plus
  // the seeded demo examples to explore. Only the `demo-` nodes are read-only.
  // Memoized so their references stay stable between renders; otherwise the
  // spread creates a new array every render and the layout effect below
  // (which depends on displaySessions) loops infinitely.
  const displaySessions = useMemo(
    () => (isGuest ? [...DEMO_SESSIONS, ...sessions] : sessions),
    [isGuest, sessions],
  );
  const displayLinks = useMemo(
    () => (isGuest ? [...DEMO_LINKS, ...links] : links),
    [isGuest, links],
  );

  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [settingsOpenNodeId, setSettingsOpenNodeId] = useState<string | null>(
    null,
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    sessionId: string;
    sessionTitle: string;
  }>({ isOpen: false, sessionId: "", sessionTitle: "" });
  const [linkDeleteConfirmation, setLinkDeleteConfirmation] = useState<{
    isOpen: boolean;
    linkId: string;
    fromSessionTitle: string;
    toSessionTitle: string;
  }>({ isOpen: false, linkId: "", fromSessionTitle: "", toSessionTitle: "" });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<ConstellationNode[]>([]);

  const getNode = useCallback(
    (sessionId: string) => nodesRef.current.find((n) => n.id === sessionId),
    [],
  );

  const {
    isLinking,
    linkingFromNodeId,
    mousePosition,
    setMousePosition,
    linkingFromPosition,
    startLinking,
    completeLink,
    cancelLinking,
  } = useSessionLinking({
    getNode,
    canvasRef,
    createLink,
    onStartLinking: () => setSettingsOpenNodeId(null),
  });

  const openNode = useCallback(
    (nodeId: string) => {
      useChatStore.getState().clear();
      router.push(`/chat/${nodeId}`);
    },
    [router],
  );

  const { nodes, setNodes, handleMouseDown, handleMouseMove, handleMouseUp } =
    useConstellationDrag({
      canvasRef,
      isLinking,
      linkingFromNodeId,
      setLinkingMousePosition: setMousePosition,
      completeLink,
      onCloseSettings: () => setSettingsOpenNodeId(null),
      onOpenNode: openNode,
    });

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useOverscrollPrevention();

  useGlobalCanvasClick({
    isLinking,
    selectedLinkId,
    cancelLinking,
    clearSelectedLink: () => setSelectedLinkId(null),
  });

  // Lay out nodes only when the actual set of sessions changes. The signature
  // guard makes this impossible to loop even if a dependency (e.g. the Auth0
  // user object) churns a new reference on every render: setNodes runs once per
  // real change, never repeatedly.
  const layoutKeyRef = useRef<string>("");
  useEffect(() => {
    const layoutKey = displaySessions.map((s) => s.id).join("|");
    if (layoutKey !== layoutKeyRef.current) {
      layoutKeyRef.current = layoutKey;

      if (displaySessions.length > 0) {
        const rect = canvasRef.current?.getBoundingClientRect();
        const width = rect?.width || window.innerWidth;
        const height = rect?.height || window.innerHeight;

        setNodes(
          displaySessions.map((session, index) => ({
            id: session.id,
            session,
            position: spiralPosition(index, width, height),
            isDragging: false,
          })),
        );

        // Reload links once nodes exist so the lines can resolve endpoints
        setTimeout(() => reloadLinks(), 100);
      } else {
        setNodes([]);
      }
    }

    if (!sessionsLoading && !isLoading) {
      setInitialLoadComplete(true);
    }
  }, [displaySessions, sessionsLoading, isLoading]);

  // Show the walkthrough on a visitor's first arrival, or whenever the URL
  // carries ?tour (a shareable link that always opens it).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const forced = new URLSearchParams(window.location.search).has("tour");
    const firstVisit = !localStorage.getItem("rainbolt-howto-seen");
    if (forced || firstVisit) {
      setShowHowTo(true);
      if (firstVisit) localStorage.setItem("rainbolt-howto-seen", "1");
    }
  }, []);

  const openUploadModal = () => setShowUploadModal(true);

  const handleCreateSessionFromUpload = async (title: string) => {
    if (!firebaseUserId) {
      throw new Error("Please make sure you are logged in");
    }
    return createSession(title);
  };

  const handleToggleSettings = (nodeId: string) => {
    setSettingsOpenNodeId((prev) => (prev === nodeId ? null : nodeId));
  };

  const handleDeleteLink = (linkId: string) => {
    if (linkId.startsWith("demo-")) return; // demo links are read-only
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
      console.error("Failed to delete link:", error);
    }
    setLinkDeleteConfirmation({
      isOpen: false,
      linkId: "",
      fromSessionTitle: "",
      toSessionTitle: "",
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    if (sessionId.startsWith("demo-")) return; // demo examples are read-only
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setDeleteConfirmation({
        isOpen: true,
        sessionId,
        sessionTitle: session.title,
      });
    }
  };

  const confirmDeleteSession = async () => {
    try {
      await Promise.all([
        deleteSession(deleteConfirmation.sessionId),
        deleteSessionLinks(deleteConfirmation.sessionId),
      ]);
      setNodes((prev) =>
        prev.filter((node) => node.id !== deleteConfirmation.sessionId),
      );
      setSettingsOpenNodeId(null);
      setDeleteConfirmation({ isOpen: false, sessionId: "", sessionTitle: "" });
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const cancelDeleteSession = () => {
    setDeleteConfirmation({ isOpen: false, sessionId: "", sessionTitle: "" });
  };

  // ESC closes confirmation modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (deleteConfirmation.isOpen) cancelDeleteSession();
      else if (linkDeleteConfirmation.isOpen) {
        setLinkDeleteConfirmation({
          isOpen: false,
          linkId: "",
          fromSessionTitle: "",
          toSessionTitle: "",
        });
      }
    };

    if (deleteConfirmation.isOpen || linkDeleteConfirmation.isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [deleteConfirmation.isOpen, linkDeleteConfirmation.isOpen]);

  if (!initialLoadComplete || sessionsLoading || isLoading) {
    return (
      <CenteredState>
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky-400/20 border-t-sky-400" />
        <h1 className="mt-5 text-2xl font-bold text-fg">
          Loading your constellation…
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Gathering your globe sessions from the stars.
        </p>
      </CenteredState>
    );
  }

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
        style={{ cursor: isLinking ? "crosshair" : "default" }}
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
            {isGuest
              ? "Guest Constellation"
              : `${user?.displayName || user?.email?.split("@")[0] || "Your"}'s Constellation`}
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            {isGuest
              ? "Open an example, or create your own session. No sign-in needed."
              : "Drag sessions to arrange them · click one to open it"}
          </p>
        </div>

        {/* New session */}
        <div className="absolute right-6 top-28 z-20 sm:right-8">
          <button
            onClick={openUploadModal}
            className="inline-flex items-center gap-2 rounded-md border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm font-medium text-white shadow-[0_0_18px_-8px_rgba(56,189,248,0.6)] transition-all hover:border-sky-300/70 hover:bg-sky-500/25"
          >
            <Plus className="h-4 w-4" />
            New Session
          </button>
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
            onCreateLink={() => {
              if (node.id.startsWith("demo-")) return; // demo examples are read-only
              startLinking(node.id);
            }}
            isSettingsOpen={settingsOpenNodeId === node.id}
            onToggleSettings={() => handleToggleSettings(node.id)}
            linkCopied={false}
            isLinking={isLinking}
            isLinkingFrom={linkingFromNodeId === node.id}
            isHovered={hoveredNodeId === node.id}
          />
        ))}

        {/* Empty state */}
        {displaySessions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="max-w-md rounded-xl border border-white/10 bg-space-900/75 p-10 text-center backdrop-blur-md">
              <Star className="mx-auto h-10 w-10 text-white drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]" />
              <h2 className="mt-5 text-xl font-bold text-fg">
                Your constellation awaits
              </h2>
              <p className="mt-2 text-sm text-fg-muted">
                Create your first globe session to begin exploring the world.
              </p>
              <button
                className="mt-7 inline-flex items-center gap-2 rounded-md border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm font-medium text-white shadow-[0_0_18px_-8px_rgba(56,189,248,0.6)] transition-all hover:border-sky-300/70 hover:bg-sky-500/25"
                onClick={(e) => {
                  e.stopPropagation();
                  openUploadModal();
                }}
              >
                <Plus className="h-4 w-4" />
                Create First Session
              </button>
            </div>
          </div>
        )}

        {/* Constellation lines */}
        <ConstellationLines
          links={displayLinks}
          nodes={nodes}
          hoveredNodeId={hoveredNodeId}
          hoveredLinkId={hoveredLinkId}
          selectedLinkId={selectedLinkId}
          onCanvasClear={() => {
            setSelectedLinkId(null);
            if (isLinking) cancelLinking();
          }}
          onHoverLink={setHoveredLinkId}
          onSelectLink={setSelectedLinkId}
          onDeleteLink={handleDeleteLink}
        />
      </div>

      {/* Linking thread */}
      {isLinking && (
        <LinkingThread
          fromPosition={linkingFromPosition}
          mousePosition={mousePosition}
        />
      )}

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onCreateSession={handleCreateSessionFromUpload}
      />

      <button
        onClick={() => setShowHowTo(true)}
        aria-label="How to use rainbolt.ai"
        className="fixed bottom-5 right-5 z-[150] flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-space-900/80 text-white/80 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      <HowItWorks open={showHowTo} onClose={() => setShowHowTo(false)} />

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
            This cannot be undone. All globe images and chat history will be
            permanently lost.
          </p>
        </ConfirmDialog>
      )}

      {/* Delete link confirmation */}
      {linkDeleteConfirmation.isOpen && (
        <ConfirmDialog
          title="Delete Connection"
          confirmLabel="Delete Link"
          onCancel={() =>
            setLinkDeleteConfirmation({
              isOpen: false,
              linkId: "",
              fromSessionTitle: "",
              toSessionTitle: "",
            })
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
          <p className="mt-4 text-sm text-destructive/90">
            This cannot be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
