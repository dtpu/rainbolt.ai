"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import getStarfield from "../../utils/getStarfield";

export default function StarryNightBackground({
  numStars = 4500,
}: {
  numStars?: number;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    // Match globe camera to make stars align visually
    camera.position.set(7, 0, 4);
    camera.lookAt(new THREE.Vector3(-7.7, 0, 0));

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Cap pixel ratio (see Globe.tsx); avoids rendering the full-screen starfield
    // at 4x+ pixels on retina displays.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.pointerEvents = "none";
    renderer.domElement.style.zIndex = "0";

    mountRef.current.appendChild(renderer.domElement);

    const textureLoader = new THREE.TextureLoader();
    const starSprite = textureLoader.load("/circle.png");

    const stars = getStarfield({ numStars, sprite: starSprite });
    scene.add(stars);

    let rafId = 0;
    let lastTime = performance.now();
    const rotationSpeed = 0.004; // radians per second (slow)
    function animate(now: number) {
      const delta = (now - lastTime) / 1000; // seconds
      lastTime = now;
      // time-based rotation for consistent speed across frame rates
      stars.rotation.y += rotationSpeed * delta;
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafId) cancelAnimationFrame(rafId);
      scene.remove(stars);
      try {
        stars.geometry.dispose();
        if (Array.isArray(stars.material as any)) {
          (stars.material as any).forEach((m: THREE.Material) => m.dispose());
        } else if (stars.material instanceof THREE.Material) {
          stars.material.dispose();
        }
      } catch (e) {
        // ignore dispose errors
      }
      if (
        renderer.domElement &&
        mountRef.current &&
        mountRef.current.contains(renderer.domElement)
      ) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [numStars]);

  return (
    <div
      ref={mountRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
