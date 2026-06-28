import Link from "next/link";
import { useState } from "react";
import { Menu, X, Plus } from "lucide-react";
import LoginComponent from "./LoginComponent";

interface NavbarProps {
  currentSection?: number;
  variant?: "default" | "learning";
  // When provided (constellation view), renders a "New Session" action to the
  // right of the sign-in controls so the top bar reads as one unbroken row.
  onNewSession?: () => void;
}

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#about", label: "About" },
  { href: "#team", label: "Team" },
  { href: "#contact", label: "Technology" },
  { href: "/learning", label: "Learning" },
];

export function Navbar({ variant = "default", onNewSession }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100]">
      <div className="container mx-auto grid grid-cols-3 items-center px-4 py-6">
        <Link
          href="/"
          className="col-start-1 flex items-center gap-2.5 justify-self-start text-white transition-opacity hover:opacity-80"
        >
          <img
            src="/rainbolt_logo.png"
            alt="rainbolt.ai"
            className="h-14 w-auto object-contain"
          />
          <span className="text-3xl font-bold tracking-tight">rainbolt.ai</span>
        </Link>

        {variant !== "learning" && (
          <div className="col-start-2 hidden items-center justify-self-center gap-10 md:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[1.0625rem] font-medium text-white/75 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}

        <div className="col-start-3 flex items-center justify-self-end gap-3">
          <LoginComponent />
          {onNewSession && (
            <button
              onClick={onNewSession}
              className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2.5 text-base font-medium text-white transition-all hover:border-sky-300/70 hover:bg-sky-500/25"
            >
              <Plus className="h-4 w-4" />
              New Session
            </button>
          )}
          {variant !== "learning" && (
            <button
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-md p-2.5 text-white/70 transition-colors hover:text-white md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          )}
        </div>
      </div>

      {variant !== "learning" && menuOpen && (
        <div className="border-b border-white/10 bg-space-900/95 px-6 py-4 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-4">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-[1.0625rem] font-medium text-white/75 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
