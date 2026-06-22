"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth0Firebase } from "@/hooks/useAuth0Firebase";
import StarryNightBackground from "@/components/ui/starry-night-background";
import { ArrowRight, Github, Star } from "lucide-react";

// Auth0 social connection identifiers. Adjust if the tenant names them differently.
const GOOGLE_CONNECTION = "google-oauth2";
const GITHUB_CONNECTION = "github";

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

// A layered, gently twinkling constellation that echoes the /learning canvas:
// soft glows, varied star sizes, sky-tinted links. Purely decorative.
function ConstellationMotif() {
  const stars = [
    { x: 40, y: 54, r: 2.4, glow: 10 },
    { x: 92, y: 30, r: 1.7, glow: 7 },
    { x: 150, y: 60, r: 3.4, glow: 15 }, // anchor
    { x: 208, y: 38, r: 1.6, glow: 7 },
    { x: 200, y: 100, r: 2.2, glow: 9 },
    { x: 126, y: 110, r: 2.7, glow: 11 },
    { x: 70, y: 92, r: 1.6, glow: 7 },
  ];
  const links = [
    [0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6], [6, 0], [5, 2],
  ];
  // A scatter of faint background stars for depth.
  const dust = [
    { x: 24, y: 22 }, { x: 232, y: 70 }, { x: 60, y: 124 }, { x: 178, y: 18 },
    { x: 110, y: 70 }, { x: 244, y: 120 }, { x: 14, y: 86 }, { x: 156, y: 128 },
  ];
  const twinkle = [1, 4, 6]; // which stars pulse

  return (
    <svg width="248" height="148" viewBox="0 0 248 148" aria-hidden="true">
      <defs>
        <radialGradient id="cm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="40%" stopColor="#bcdcff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#bcdcff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cm-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {/* connecting lines */}
      <g stroke="url(#cm-line)" strokeWidth="1" strokeLinecap="round">
        {links.map(([a, b], i) => (
          <line key={i} x1={stars[a].x} y1={stars[a].y} x2={stars[b].x} y2={stars[b].y} />
        ))}
      </g>

      {/* background dust */}
      {dust.map((d, i) => (
        <circle key={`d-${i}`} cx={d.x} cy={d.y} r="0.9" fill="#ffffff" fillOpacity="0.35" />
      ))}

      {/* soft glows */}
      {stars.map((s, i) => (
        <circle key={`g-${i}`} cx={s.x} cy={s.y} r={s.glow} fill="url(#cm-glow)" />
      ))}

      {/* star cores */}
      {stars.map((s, i) => (
        <circle key={`c-${i}`} cx={s.x} cy={s.y} r={s.r} fill="#ffffff">
          {twinkle.includes(i) && (
            <animate
              attributeName="opacity"
              values="1;0.4;1"
              dur={`${2.6 + i * 0.5}s`}
              begin={`${i * 0.4}s`}
              repeatCount="indefinite"
            />
          )}
        </circle>
      ))}
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth0Firebase();
  const [email, setEmail] = useState("");

  // Already signed in, go straight to the constellation.
  React.useEffect(() => {
    if (!isLoading && user) router.replace("/learning");
  }, [isLoading, user, router]);

  // /auth/login is handled server-side by the Auth0 middleware, so use a full
  // navigation (not the client router) and forward the typed email as a hint.
  const continueWithEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const hint = email.trim() ? `?login_hint=${encodeURIComponent(email.trim())}` : "";
    window.location.href = `/auth/login${hint}`;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-space-950 text-fg">
      <div className="absolute inset-0">
        <StarryNightBackground numStars={2200} />
      </div>

      {/* Brand */}
      <header className="relative z-10 px-6 py-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-white transition-opacity hover:opacity-80">
          <img
            src="/rainbolt-face.png"
            alt=""
            className="h-8 w-8 rounded-full object-cover ring-1 ring-white/15"
            style={{ objectPosition: "center 28%" }}
          />
          rainbolt.ai
        </Link>
      </header>

      {/* Auth panel */}
      <main className="relative z-10 flex min-h-[calc(100vh-5.5rem)] items-center justify-center px-6 pb-12">
        <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-space-900/75 shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="relative grid md:grid-cols-2">
            {/* Divider + "or" chip */}
            <div className="pointer-events-none absolute inset-x-8 top-1/2 hidden h-px -translate-y-1/2 bg-white/10 md:left-1/2 md:right-auto md:top-8 md:bottom-8 md:h-auto md:w-px md:translate-y-0 md:bg-white/10 md:[inset-inline:auto]" />
            <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-space-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-white/40 md:inline-flex">
              or
            </span>

            {/* LEFT: Sign in */}
            <section className="flex flex-col gap-5 p-8 sm:p-10">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Sign in</p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Welcome back</h1>
                <p className="mt-1.5 text-sm text-fg-muted">
                  Pick up where you left off and keep mapping your constellation.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <a
                  href={`/auth/login?connection=${GOOGLE_CONNECTION}`}
                  className="flex h-11 items-center justify-center gap-3 rounded-md border border-white/10 bg-white/[0.04] text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-white/[0.08]"
                >
                  <GoogleGlyph />
                  Continue with Google
                </a>
                <a
                  href={`/auth/login?connection=${GITHUB_CONNECTION}`}
                  className="flex h-11 items-center justify-center gap-3 rounded-md border border-white/10 bg-white/[0.04] text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-white/[0.08]"
                >
                  <Github className="h-[18px] w-[18px]" />
                  Continue with GitHub
                </a>
              </div>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] uppercase tracking-wider text-white/40">or with email</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={continueWithEmail} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-fg-muted">Email</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="h-11 w-full rounded-md border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white outline-none transition-colors placeholder:text-fg-muted/60 focus:border-sky-400/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-sky-400/15"
                  />
                </label>
                <button
                  type="submit"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-sky-400/40 bg-sky-500/15 text-sm font-semibold text-white shadow-[0_0_18px_-8px_rgba(56,189,248,0.6)] transition-all hover:border-sky-300/70 hover:bg-sky-500/25"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <p className="text-xs text-fg-muted/80">
                New here? Your account is created automatically the first time you sign in.
              </p>
            </section>

            {/* RIGHT: Guest mode */}
            <section className="flex flex-col gap-5 border-t border-white/10 p-8 sm:p-10 md:border-l md:border-t-0">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">No account needed</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Just exploring?</h2>
                <p className="mt-1.5 text-sm text-fg-muted">
                  Jump straight into a live demo constellation. Drag sessions around, trace the links between
                  them, and see how it all connects. No sign-up, no email.
                </p>
              </div>

              <div className="flex flex-1 items-center justify-center py-2">
                <ConstellationMotif />
              </div>

              <button
                onClick={() => router.push("/learning")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-transparent text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
              >
                <Star className="h-4 w-4 text-white/70" />
                Continue as guest
                <ArrowRight className="h-4 w-4 text-fg-muted" />
              </button>

              <p className="text-xs text-fg-muted/80">
                Guest sessions are a read-only preview. Sign in to create and save your own.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
