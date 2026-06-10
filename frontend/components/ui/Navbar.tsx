import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import LoginComponent from "./LoginComponent";

interface NavbarProps {
  currentSection: number;
  variant?: "default" | "learning";
}

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#about", label: "About" },
  { href: "#team", label: "Team" },
  { href: "#contact", label: "Technology" },
  { href: "/learning", label: "Learning" },
];

export function Navbar({ currentSection, variant = "default" }: NavbarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [prevSection, setPrevSection] = useState(currentSection);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (currentSection === 0) {
      setIsVisible(true);
    } else if (currentSection !== prevSection) {
      const isScrollingDown = currentSection > prevSection;
      setIsVisible(!isScrollingDown);
    }
    setPrevSection(currentSection);
  }, [currentSection, prevSection]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] transform transition-all duration-200 ease-out ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-fg transition-opacity hover:opacity-80"
        >
          <img src="/rainbolt_ai_logo.png" alt="Rainbolt Logo" className="h-9 w-9 object-contain" />
          <span className="text-lg font-semibold tracking-tight">rainbolt.ai</span>
        </Link>

        {variant !== "learning" && (
          <div className="hidden items-center gap-8 md:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-fg-muted transition-colors hover:text-fg"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <LoginComponent />
          {variant !== "learning" && (
            <button
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-md p-2 text-fg-muted transition-colors hover:text-fg md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
                className="text-sm text-fg-muted transition-colors hover:text-fg"
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
