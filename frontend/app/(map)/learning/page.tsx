"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { useAuth0Firebase } from "@/hooks/useAuth0Firebase";
import { useGlobeSessions } from "@/hooks/useGlobeSessions";
import { useSessionLinks } from "@/hooks/useSessionLinks";
import { UploadModal } from "@/components/chat/UploadModal";
import { HowItWorks } from "@/components/HowItWorks";
import { useChatStore } from "@/components/useChatStore";
import { DEMO_SESSIONS, DEMO_LINKS } from "@/lib/demo-constellation";
import { GlobeRail } from "@/components/constellation/GlobeRail";

export default function LearningPage() {
  const router = useRouter();
  const { user, firebaseUserId, isLoading } = useAuth0Firebase();
  const { sessions, loading: sessionsLoading, createNewSession } =
    useGlobeSessions();
  const { links } = useSessionLinks();

  const [showUpload, setShowUpload] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const tutorialShownRef = useRef(false);

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
    if (isLoading) return;
    if (typeof window !== "undefined") {
      const tour = new URLSearchParams(window.location.search).get("tour");
      if (tour === "off") return; // escape hatch (e.g. screenshots / previews)
      if (tour !== null) {
        setShowHowTo(true);
        return;
      }
    }
    if (isGuest) {
      // Always show for guests on every landing.
      if (!tutorialShownRef.current) {
        tutorialShownRef.current = true;
        setShowHowTo(true);
      }
    } else if (firebaseUserId) {
      // Show once per account; afterwards the bottom-right icon reopens it.
      const key = `rainbolt-howto-seen-${firebaseUserId}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        setShowHowTo(true);
      }
    }
  }, [isGuest, isLoading, firebaseUserId]);

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
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden text-white">
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

      <HowItWorks open={showHowTo} onClose={() => setShowHowTo(false)} />

      {/* Persistent help icon - reopens the tutorial. Fades in once the
          tutorial has finished closing so it never pops mid-animation. */}
      <motion.button
        onClick={() => setShowHowTo(true)}
        title="How it works"
        aria-label="How it works"
        initial={false}
        animate={{
          opacity: showHowTo ? 0 : 1,
          scale: showHowTo ? 0.8 : 1,
        }}
        transition={{ duration: 0.25, ease: "easeOut", delay: showHowTo ? 0 : 0.25 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        style={{ pointerEvents: showHowTo ? "none" : "auto" }}
        className="fixed bottom-5 right-5 z-[60] flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-space-900/90 text-fg-muted shadow-lg backdrop-blur-sm hover:border-white/20 hover:text-fg"
      >
        <HelpCircle className="h-[18px] w-[18px]" />
      </motion.button>
    </div>
  );
}
