import Link from "next/link";
import { useEffect, useState } from "react";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/NavigationMenu";
import LoginComponent from "./LoginComponent";



interface NavbarProps {
  currentSection: number;
  variant?: 'default' | 'learning';
}

export function Navbar({ currentSection, variant = 'default' }: NavbarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [prevSection, setPrevSection] = useState(currentSection);

  useEffect(() => {
    if (currentSection === 0) {
      // Always show navbar in first section
      setIsVisible(true);
    } else if (currentSection !== prevSection) {
      // Only update visibility when actually changing sections
      const isScrollingDown = currentSection > prevSection;
      setIsVisible(!isScrollingDown);
    }

    // Always update previous section
    setPrevSection(currentSection);
  }, [currentSection, prevSection]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-200 ease-out transform ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
    >
      <div className="container relative mx-auto px-4 py-6">
        <div className="flex items-center justify-between">

          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center gap-3 text-white text-2xl font-bold hover:text-white/90 transition-colors cursor-pointer">
              <img src="/rainbolt_ai_logo.png" alt="Rainbolt Logo" className="w-15 h-15 object-contain bg-transparent" />
        <span style={{ position: "relative", top: "-0.23rem" }}>rainbolt.ai</span>
            </Link>
            <div className="fixed top-6 right-10 z-[999]">
              <LoginComponent />
            </div>
            {variant !== 'learning' && (
              <NavigationMenu>
                <NavigationMenuList className="flex gap-8">
                  <NavigationMenuItem>
                    <Link href="#features" className="text-white/80 hover:text-white transition-colors" style={{ position: "relative", top: "-0.2rem" }}>
                      Features
                    </Link>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <Link href="#about" className="text-white/80 hover:text-white transition-colors" style={{ position: "relative", top: "-0.2rem" }}>
                      About
                    </Link>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <Link href="#team" className="text-white/80 hover:text-white transition-colors" style={{ position: "relative", top: "-0.2rem" }}>
                      Team
                    </Link>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <Link href="#contact" className="text-white/80 hover:text-white transition-colors" style={{ position: "relative", top: "-0.2rem" }}>
                      Technology
                    </Link>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <Link href="/learning" className="text-white/80 hover:text-white transition-colors" style={{ position: "relative", top: "-0.2rem" }}>
                      Learning
                    </Link>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}