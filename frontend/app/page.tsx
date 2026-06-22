"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowRight, Play } from "lucide-react";
import { Navbar } from "@/components/ui/Navbar";
import EarthScene from "@/components/ui/Globe";

import "./glow.css";

export default function Home() {
  const [currentSection, setCurrentSection] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const heroSectionRef = useRef<HTMLElement>(null);

  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const sectionId = parseInt(entry.target.getAttribute('data-section-id') || '0');
        setCurrentSection(sectionId);

        // Trigger counting animation when hero section is in view
        if (sectionId === 0 && !hasAnimated) {
          setHasAnimated(true);
          animateCount();
        }
      }
    });
  };

  // Detect initial section on mount/remount
  useEffect(() => {
    const detectCurrentSection = () => {
      const sections = document.querySelectorAll('section[data-section-id]');
      const windowHeight = window.innerHeight;

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const sectionMiddle = rect.top + rect.height / 2;

        // Check if section middle is in viewport center area
        if (sectionMiddle >= 0 && sectionMiddle <= windowHeight) {
          const sectionId = parseInt(section.getAttribute('data-section-id') || '0');
          setCurrentSection(sectionId);
        }
      });
    };

    // Run detection after a short delay to ensure DOM is ready
    const timer = setTimeout(detectCurrentSection, 100);

    return () => clearTimeout(timer);
  }, []); // Only run on mount

  const animateCount = () => {
    const targetNumber = 955199;
    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = targetNumber / steps;
    let currentCount = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      currentCount = Math.min(Math.floor(increment * step), targetNumber);
      setPhotoCount(currentCount);

      if (step >= steps) {
        clearInterval(timer);
        setPhotoCount(targetNumber);
      }
    }, duration / steps);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.3, // Trigger when section is 30% visible
      rootMargin: '-80px 0px' // Adjust for navbar height
    });

    // Observe all sections
    document.querySelectorAll('section[data-section-id]').forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, [hasAnimated]); // Include hasAnimated to prevent stale closure

  return (
    <div className="relative h-screen overflow-y-auto snap-y snap-mandatory scroll-smooth">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0">
        <EarthScene
          markers={[]}
          currentSection={currentSection}
        />
        {/* Vignette Effect */}
        <div className="vignette" />
      </div>

      {/* Navigation */}
      <Navbar currentSection={currentSection} />

      {/* Hero Section with Earth */}
      <section ref={heroSectionRef} data-section-id="0" className="relative h-screen snap-start">
        <div className="absolute inset-0 pointer-events-none" />
        <div className="absolute inset-0 flex items-center z-[60]">
          <div className="container mx-auto">
            <div className="max-w-3xl px-4">
              <h1 className="text-6xl md:text-7xl font-bold mb-8 leading-[1.05] tracking-tight text-left text-white">
                Bolt around the world with{" "}
                <span className="bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 bg-clip-text text-transparent">
                  rainbolt.ai
                </span>
              </h1>
              <p className="text-[1.4rem] text-white/80 text-left max-w-xl">
                Powered by <span className="text-[1.6rem] font-bold text-white">{formatNumber(photoCount)}</span> geotagged photos and expert geolocation strategies, we turn visual curiosity into global understanding.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {/* Primary: glassy pill with a blue glow that echoes the hero text */}
                <a
                  href="/learning"
                  className="group relative inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/10 px-7 py-3 text-base font-semibold text-white backdrop-blur-md shadow-[0_0_18px_-6px_rgba(56,189,248,0.55)] transition-all duration-300 hover:border-sky-300/70 hover:bg-sky-500/20 hover:shadow-[0_0_30px_-4px_rgba(56,189,248,0.8)]"
                >
                  Try Rainbolt AI
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </a>
                {/* Secondary: quiet ghost so the hierarchy reads clearly */}
                <a
                  href="https://devpost.com/software/rainbolt-ai?ref_content=my-projects-tab&ref_feature=my_projects"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-base font-medium text-white/70 backdrop-blur-sm transition-all duration-300 hover:border-white/30 hover:text-white"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Watch Demo
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" data-section-id="1" className="relative h-screen snap-start">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-white mb-16 text-center [text-shadow:0_0_5px_rgba(255,255,255,0.3)]">
              Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {/* Comprehensive Reasoning */}
              <div className="flex flex-col bg-white/5 rounded-lg backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all p-8">
                <h3 className="text-2xl font-bold mb-4 text-white text-center">Comprehensive Reasoning</h3>
                <p className="text-base text-white/80 leading-relaxed text-center mb-6">
                  We provide AI-powered analysis of visual markers, architecture, and environmental clues to determine precise locations with expert-level reasoning thanks to our unique approach to training.
                </p>
                <div className="w-full flex items-center justify-center mt-auto">
                  <div className="w-full aspect-[4/3] overflow-hidden rounded-lg">
                    <img src="/img1.jpg" alt="Comprehensive Reasoning" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>

              {/* Precise Geolocation */}
              <div className="flex flex-col bg-white/5 rounded-lg backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all p-8">
                <h3 className="text-2xl font-bold mb-4 text-white text-center">Precise Geolocation</h3>
                <p className="text-base text-white/80 leading-relaxed text-center mb-6">
                  Upload any image and receive exact coordinates with up to 95%+ confidence scores in seconds. Our images are backed by countless references thanks to our queries using expansive databases.
                </p>
                <div className="w-full flex items-center justify-center mt-auto">
                  <div className="w-full aspect-[4/3] overflow-hidden rounded-lg">
                    <img src="/img2.png" alt="Precise Geolocation" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>

              {/* Learning Mode */}
              <div className="flex flex-col bg-white/5 rounded-lg backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all p-8">
                <h3 className="text-2xl font-bold mb-4 text-white text-center">Learning Mode</h3>
                <p className="text-base text-white/80 leading-relaxed text-center mb-6">
                  Master geographic patterns through AI-guided training. Learn about the world while improving your geographical skills, but most importantly, explore cultures and fun facts along the way!
                </p>
                <div className="w-full flex items-center justify-center mt-auto">
                  <div className="w-full aspect-[4/3] overflow-hidden rounded-lg">
                    <img src="/img3.png" alt="Learning Mode" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" data-section-id="2" className="relative h-screen snap-start">
        <div className="absolute inset-0 flex items-center justify-end pr-12">
          <div className="max-w-2xl bg-white/10 backdrop-blur-md rounded-lg p-8 border border-white/20 space-y-4 overflow-y-auto max-h-[80vh]">
            <h2 className="text-2xl font-bold text-white mb-4">
              About <span className="bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 bg-clip-text text-transparent">rainbolt.ai</span>
            </h2>

            {/* The Global Literacy Crisis */}
            <div>
              <h3 className="text-lg font-bold text-white mb-2">
                Geographic Illiteracy Crisis
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                Billions navigate our world yet remain geographically blind, recognizing brands and memes, but not the landscapes and cultures that define our planet.
              </p>
            </div>

            {/* Our Mission */}
            <div>
              <h3 className="text-lg font-bold text-white mb-2">
                Our Mission
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                We democratize geographic intelligence through AI that combines millions of geotagged images with expert geolocation strategies. Not just guessing locations, but understanding them.
              </p>
            </div>

            {/* Why It Matters */}
            <div>
              <h3 className="text-lg font-bold text-white mb-2">
                Why It Matters
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                Transform passive image viewing into active discovery. We're building geographic literacy one image at a time for travelers, educators, researchers, and the curious.
              </p>
            </div>

            <div className="flex gap-4 mt-8">
              <div className="flex-1">
                <img
                  src="/rainbolt_cool.webp"
                  alt="Rainbolt Cool"
                  className="w-full h-32 object-cover rounded-lg bg-white/10"
                />
                <p className="text-white/60 text-sm mt-2 text-center">Trevor Rainbolt</p>
              </div>
              <div className="flex-1">
                <img
                  src="/rainbolt_staring.webp"
                  alt="Rainbolt Staring"
                  className="w-full h-32 object-cover rounded-lg bg-white/10"
                />
                <p className="text-white/60 text-sm mt-2 text-center">Rainbolt Focused</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" data-section-id="3" className="relative h-screen snap-start">
        <div className="absolute inset-0 flex items-center justify-start pl-16 w-full">
          <div className="flex flex-col items-start w-full">
            <h2 className="text-5xl font-bold text-white mb-12">
              Meet Our Team
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-white/5 rounded-lg backdrop-blur-sm text-center w-52">
                <div className="w-20 h-20 rounded-full bg-white/10 mx-auto mb-4 overflow-hidden">
                  <img src="/IMG_0628.jpg" alt="Daniel Pu" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Daniel Pu</h3>
                <p className="text-white/80">UW CS</p>
              </div>
              <div className="p-6 bg-white/5 rounded-lg backdrop-blur-sm text-center">
                <div className="w-20 h-20 rounded-full bg-white/10 mx-auto mb-4 overflow-hidden">
                  <img src="/IMG_0623.jpg" alt="Evan Yang" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Evan Yang</h3>
                <p className="text-white/80">UW SYDE</p>
              </div>
              <div className="p-6 bg-white/5 rounded-lg backdrop-blur-sm text-center">
                <div className="w-20 h-20 rounded-full bg-white/10 mx-auto mb-4 overflow-hidden">
                  <img src="/IMG_0627.jpg" alt="Daniel Liu" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Daniel Liu</h3>
                <p className="text-white/80">UW CFM</p>
              </div>
              <div className="p-6 bg-white/5 rounded-lg backdrop-blur-sm text-center">
                <div className="w-20 h-20 rounded-full bg-white/10 mx-auto mb-4 overflow-hidden">
                  <img src="/IMG_0625.jpg" alt="Justin Wang" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Justin Wang</h3>
                <p className="text-white/80">UW MGTE</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" data-section-id="4" className="relative h-screen snap-start">
        {/* Star Constellations Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Constellation 1 - Top Left */}
            <g opacity="0.6">
              <line x1="10%" y1="15%" x2="15%" y2="20%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="15%" y1="20%" x2="12%" y2="25%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="12%" y1="25%" x2="18%" y2="28%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <circle cx="10%" cy="15%" r="2" fill="white" opacity="0.8" />
              <circle cx="15%" cy="20%" r="2.5" fill="white" opacity="0.9" />
              <circle cx="12%" cy="25%" r="2" fill="white" opacity="0.7" />
              <circle cx="18%" cy="28%" r="2" fill="white" opacity="0.8" />
            </g>

            {/* Constellation 2 - Top Right */}
            <g opacity="0.6">
              <line x1="85%" y1="12%" x2="88%" y2="18%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="88%" y1="18%" x2="92%" y2="15%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="88%" y1="18%" x2="90%" y2="23%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <circle cx="85%" cy="12%" r="2" fill="white" opacity="0.8" />
              <circle cx="88%" cy="18%" r="2.5" fill="white" opacity="0.9" />
              <circle cx="92%" cy="15%" r="2" fill="white" opacity="0.7" />
              <circle cx="90%" cy="23%" r="2" fill="white" opacity="0.8" />
            </g>

            {/* Constellation 3 - Bottom Left */}
            <g opacity="0.6">
              <line x1="8%" y1="75%" x2="13%" y2="78%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="13%" y1="78%" x2="16%" y2="82%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="16%" y1="82%" x2="12%" y2="85%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <circle cx="8%" cy="75%" r="2" fill="white" opacity="0.8" />
              <circle cx="13%" cy="78%" r="2.5" fill="white" opacity="0.9" />
              <circle cx="16%" cy="82%" r="2" fill="white" opacity="0.7" />
              <circle cx="12%" cy="85%" r="2" fill="white" opacity="0.8" />
            </g>

            {/* Constellation 4 - Bottom Right */}
            <g opacity="0.6">
              <line x1="88%" y1="80%" x2="92%" y2="77%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="92%" y1="77%" x2="90%" y2="72%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <line x1="88%" y1="80%" x2="85%" y2="83%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <circle cx="88%" cy="80%" r="2" fill="white" opacity="0.8" />
              <circle cx="92%" cy="77%" r="2.5" fill="white" opacity="0.9" />
              <circle cx="90%" cy="72%" r="2" fill="white" opacity="0.7" />
              <circle cx="85%" cy="83%" r="2" fill="white" opacity="0.8" />
            </g>

            {/* Small accent stars */}
            <circle cx="25%" cy="30%" r="1.5" fill="white" opacity="0.5" />
            <circle cx="70%" cy="40%" r="1.5" fill="white" opacity="0.6" />
            <circle cx="30%" cy="65%" r="1.5" fill="white" opacity="0.5" />
            <circle cx="75%" cy="55%" r="1.5" fill="white" opacity="0.6" />
          </svg>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10">
          <h2 className={`text-5xl font-bold text-white [text-shadow:0_0_5px_rgba(255,255,255,0.3)] ${currentSection === 4 ? 'animate-slide-in' : 'opacity-0'}`}>
            Tech Stack
          </h2>
          <div className={`max-w-7xl w-full px-4 ${currentSection === 4 ? 'animate-slide-in' : 'opacity-0'}`}>
            <img
              src="/Colorful Simple Modern Business Order Process Flowchart (1920 x 1080 px).png"
              alt="Process Flowchart"
              className="w-full h-auto"
              style={{ maxHeight: '80vh', objectFit: 'contain' }}
            />
          </div>
        </div>
      </section>
    </div >
  );
}