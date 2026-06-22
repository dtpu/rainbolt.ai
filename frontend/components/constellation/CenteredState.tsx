"use client";

import React from "react";
import { Navbar } from "@/components/ui/Navbar";
import StarryNightBackground from "@/components/ui/starry-night-background";

// Full-screen starfield with a centered glass panel, shared by loading/auth states.
export function CenteredState({ children }: { children: React.ReactNode }) {
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
