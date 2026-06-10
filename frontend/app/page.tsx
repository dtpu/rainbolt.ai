"use client";

import { useEffect, useState, useRef } from "react";
import { Navbar } from "@/components/ui/Navbar";
import { Button } from "@/components/ui/Button";
import EarthScene from "@/components/ui/Globe";

import "./glow.css";

const FEATURES = [
  {
    title: "Comprehensive Reasoning",
    body: "AI-powered analysis of visual markers, architecture, and environmental clues to determine precise locations with expert-level reasoning.",
    img: "/img1.jpg",
  },
  {
    title: "Precise Geolocation",
    body: "Upload any image and receive exact coordinates with confidence scores in seconds, backed by hundreds of thousands of reference images.",
    img: "/img2.png",
  },
  {
    title: "Learning Mode",
    body: "Master geographic patterns through AI-guided training. Explore cultures and fun facts while sharpening your geography skills.",
    img: "/img3.png",
  },
];

const STACK = [
  { category: "Frontend", items: ["Next.js", "React", "Tailwind CSS", "Radix UI", "Three.js"] },
  { category: "AI Pipeline", items: ["OpenAI CLIP", "LangChain", "Gemini", "FastAPI"] },
  { category: "Data", items: ["Pinecone", "Firebase", "Mapillary", "Geotagged image dataset"] },
  { category: "Infrastructure", items: ["Auth0", "Google Cloud", "Docker"] },
];

const TEAM = [
  { name: "Daniel Pu", program: "UW CS", img: "/IMG_0628.jpg" },
  { name: "Evan Yang", program: "UW SYDE", img: "/IMG_0623.jpg" },
  { name: "Daniel Liu", program: "UW CFM", img: "/IMG_0627.jpg" },
  { name: "Justin Wang", program: "UW MGTE", img: "/IMG_0625.jpg" },
];

export default function Home() {
  const [currentSection, setCurrentSection] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const heroSectionRef = useRef<HTMLElement>(null);

  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const sectionId = parseInt(entry.target.getAttribute("data-section-id") || "0");
        setCurrentSection(sectionId);

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
      const sections = document.querySelectorAll("section[data-section-id]");
      const windowHeight = window.innerHeight;

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const sectionMiddle = rect.top + rect.height / 2;

        if (sectionMiddle >= 0 && sectionMiddle <= windowHeight) {
          const sectionId = parseInt(section.getAttribute("data-section-id") || "0");
          setCurrentSection(sectionId);
        }
      });
    };

    const timer = setTimeout(detectCurrentSection, 100);
    return () => clearTimeout(timer);
  }, []);

  const animateCount = () => {
    // Matches the rebuilt Pinecone index (~400k vectors and climbing).
    const targetNumber = 400000;
    const duration = 2000;
    const steps = 60;
    const increment = targetNumber / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setPhotoCount(Math.min(Math.floor(increment * step), targetNumber));
      if (step >= steps) {
        clearInterval(timer);
        setPhotoCount(targetNumber);
      }
    }, duration / steps);
  };

  const formatNumber = (num: number) => num.toLocaleString();

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.3,
      rootMargin: "-80px 0px",
    });

    document.querySelectorAll("section[data-section-id]").forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <div className="relative h-screen snap-y snap-proximity overflow-y-auto scroll-smooth md:snap-mandatory">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <EarthScene markers={[]} currentSection={currentSection} />
        {/* Dim the globe once the reader moves past the hero so content stays legible */}
        <div
          className={`absolute inset-0 bg-space-950 transition-opacity duration-700 ${
            currentSection === 0 ? "opacity-0" : "opacity-70"
          }`}
        />
        <div className="vignette" />
      </div>

      <Navbar currentSection={currentSection} />

      {/* Hero */}
      <section
        ref={heroSectionRef}
        data-section-id="0"
        className="relative flex min-h-screen snap-start items-center"
      >
        <div className="container relative z-[60] mx-auto px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-fg sm:text-5xl lg:text-6xl">
              Bolt around the world with <span className="text-star-300">rainbolt.ai</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-fg-muted sm:text-xl">
              Powered by{" "}
              <span className="font-semibold text-fg">{formatNumber(photoCount)}+</span> geotagged
              photos and expert geolocation strategies, we turn visual curiosity into global
              understanding.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button size="lg" asChild>
                <a href="/learning">Try Rainbolt AI</a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/15 bg-transparent text-fg hover:bg-white/10"
                asChild
              >
                <a href="https://devpost.com/software/rainbolt-ai?ref_content=my-projects-tab&ref_feature=my_projects">
                  Watch Demo
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" data-section-id="1" className="relative flex min-h-screen snap-start items-center">
        <div className="container mx-auto px-6 py-24 lg:px-8">
          <h2 className="text-center text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            Features
          </h2>
          <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col rounded-xl border border-white/10 bg-space-900/70 p-7 backdrop-blur-md transition-colors hover:border-white/20"
              >
                <h3 className="text-lg font-semibold text-fg">{feature.title}</h3>
                <p className="mt-3 mb-6 text-sm leading-relaxed text-fg-muted">{feature.body}</p>
                <div className="mt-auto aspect-[4/3] w-full overflow-hidden rounded-lg border border-white/5">
                  <img src={feature.img} alt={feature.title} className="h-full w-full object-cover" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" data-section-id="2" className="relative flex min-h-screen snap-start items-center">
        <div className="container mx-auto px-6 py-24 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-space-900/70 p-8 backdrop-blur-md lg:ml-auto lg:mr-12">
            <h2 className="text-2xl font-bold tracking-tight text-fg">
              About <span className="text-star-300">rainbolt.ai</span>
            </h2>

            <div className="mt-6 space-y-6">
              <div>
                <h3 className="font-semibold text-fg">Geographic Illiteracy Crisis</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                  Billions navigate our world yet remain geographically blind—recognizing brands and
                  memes, but not the landscapes and cultures that define our planet.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-fg">Our Mission</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                  We democratize geographic intelligence through AI that combines hundreds of
                  thousands of geotagged images with expert geolocation strategies. Not just guessing
                  locations, but understanding them.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-fg">Why It Matters</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                  Transform passive image viewing into active discovery. We're building geographic
                  literacy one image at a time for travelers, educators, researchers, and the
                  curious.
                </p>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              {[
                { src: "/rainbolt_cool.webp", caption: "Trevor Rainbolt" },
                { src: "/rainbolt_staring.webp", caption: "Rainbolt Focused" },
              ].map((item) => (
                <figure key={item.src} className="flex-1">
                  <img
                    src={item.src}
                    alt={item.caption}
                    className="h-32 w-full rounded-lg border border-white/5 object-cover"
                  />
                  <figcaption className="mt-2 text-center text-xs text-fg-muted">
                    {item.caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section id="team" data-section-id="3" className="relative flex min-h-screen snap-start items-center">
        <div className="container mx-auto px-6 py-24 lg:px-8">
          <h2 className="text-center text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            Meet Our Team
          </h2>
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-6 lg:max-w-5xl lg:grid-cols-4">
            {TEAM.map((member) => (
              <div
                key={member.name}
                className="rounded-xl border border-white/10 bg-space-900/70 p-6 text-center backdrop-blur-md"
              >
                <div className="mx-auto h-20 w-20 overflow-hidden rounded-full border border-white/10">
                  <img src={member.img} alt={member.name} className="h-full w-full object-cover" />
                </div>
                <h3 className="mt-4 font-semibold text-fg">{member.name}</h3>
                <p className="mt-1 text-sm text-fg-muted">{member.program}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology */}
      <section id="contact" data-section-id="4" className="relative flex min-h-screen snap-start items-center">
        <div className="container mx-auto px-6 py-24 lg:px-8">
          <h2
            className={`text-center text-3xl font-bold tracking-tight text-fg sm:text-4xl ${
              currentSection === 4 ? "animate-slide-in" : "opacity-0"
            }`}
          >
            Technology
          </h2>
          <p
            className={`mx-auto mt-4 max-w-xl text-center text-fg-muted ${
              currentSection === 4 ? "animate-slide-in" : "opacity-0"
            }`}
          >
            A retrieval-augmented pipeline: CLIP embeddings over a Pinecone index of geotagged
            imagery, with LLM reasoning layered on top.
          </p>
          <div
            className={`mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 ${
              currentSection === 4 ? "animate-slide-in" : "opacity-0"
            }`}
          >
            {STACK.map((group) => (
              <div
                key={group.category}
                className="rounded-xl border border-white/10 bg-space-900/70 p-6 backdrop-blur-md"
              >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-star-300">
                  {group.category}
                </h3>
                <ul className="mt-4 space-y-2">
                  {group.items.map((item) => (
                    <li key={item} className="text-sm text-fg-muted">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
