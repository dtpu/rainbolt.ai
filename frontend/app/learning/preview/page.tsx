"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth0Firebase } from "@/hooks/useAuth0Firebase";
import { useGlobeSessions } from "@/hooks/useGlobeSessions";
import { useSessionLinks } from "@/hooks/useSessionLinks";
import { Navbar } from "@/components/ui/Navbar";
import { UploadModal } from "@/components/chat/UploadModal";
import { useChatStore } from "@/components/useChatStore";
import { DEMO_SESSIONS, DEMO_LINKS } from "@/lib/demo-constellation";
import { GlobeRail } from "@/components/constellation/GlobeRail";

export default function ConstellationPreviewPage() {
  const router = useRouter();
  const { user, firebaseUserId, isLoading } = useAuth0Firebase();
  const { sessions, loading: sessionsLoading, createNewSession } =
    useGlobeSessions();
  const { links } = useSessionLinks();

  const [showUpload, setShowUpload] = useState(false);

  const isGuest = !isLoading && !user;

  const displaySessions = useMemo(
    () => (isGuest ? [...DEMO_SESSIONS, ...sessions] : sessions),
    [isGuest, sessions],
  );
  const displayLinks = useMemo(
    () => (isGuest ? [...DEMO_LINKS, ...links] : links),
    [isGuest, links],
  );

  useEffect(() => {
    router.prefetch("/chat/preview");
  }, [router]);

  const openNode = (id: string) => {
    useChatStore.getState().clear();
    router.push(`/chat/${id}`);
  };

  const title = isGuest
    ? "Guest world"
    : `${user?.displayName || user?.email?.split("@")[0] || "Your"}'s world`;

  if (isLoading || sessionsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-space-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-400/20 border-t-sky-400" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-space-950 text-white">
      <Navbar
        currentSection={0}
        variant="learning"
        onNewSession={() => setShowUpload(true)}
      />

      <GlobeRail
        sessions={displaySessions}
        links={displayLinks}
        title={title}
        onOpen={openNode}
        onNewSession={() => setShowUpload(true)}
      />

      <UploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onCreateSession={async (t: string) => {
          if (!firebaseUserId) throw new Error("Please sign in first");
          return createNewSession(t);
        }}
      />
    </div>
  );
}
