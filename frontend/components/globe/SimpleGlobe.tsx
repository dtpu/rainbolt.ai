"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import getStarfield from "../../utils/getStarfield";
import getAtmosphere from "../../utils/getAtmosphere";
import { latLongToVector3 } from "../../utils/coordinates";

interface Location {
  lat: number;
  long: number;
  label?: string;
  color?: string;
  confidence?: number; // 0-100 confidence score
}

interface SimpleGlobeProps {
  markers?: Location[];
  targetMarkerIndex?: number; // Index of marker to center on
  isLocked?: boolean; // Whether globe is locked to marker or free to rotate
  onUnlock?: () => void; // Callback when user clicks globe to unlock
  onLock?: () => void; // Callback when user clicks marker to lock
  onMarkerClick?: (index: number) => void; // Callback when marker is clicked
}

export default function SimpleGlobe({
  markers = [],
  targetMarkerIndex = 0,
  isLocked = true,
  onUnlock,
  onLock,
  onMarkerClick,
}: SimpleGlobeProps) {
  // Camera zoom constants
  const ZOOM_OUT = 4.5; // Unlocked/zoomed out state
  const ZOOM_IN = 2.5; // Locked/zoomed in state

  // Maps a confidence score (0-100) to a blue -> cyan -> green gradient.
  const getConfidenceColor = (confidence: number = 50): string => {
    const conf = Math.max(0, Math.min(100, confidence));
    const t = conf / 100;

    const startColor = { r: 50, g: 100, b: 255 };
    const midColor = { r: 0, g: 200, b: 200 };
    const endColor = { r: 50, g: 255, b: 100 };

    let r, g, b;

    if (t < 0.5) {
      const localT = t * 2;
      r = Math.round(startColor.r + (midColor.r - startColor.r) * localT);
      g = Math.round(startColor.g + (midColor.g - startColor.g) * localT);
      b = Math.round(startColor.b + (midColor.b - startColor.b) * localT);
    } else {
      const localT = (t - 0.5) * 2;
      r = Math.round(midColor.r + (endColor.r - midColor.r) * localT);
      g = Math.round(midColor.g + (endColor.g - midColor.g) * localT);
      b = Math.round(midColor.b + (endColor.b - midColor.b) * localT);
    }

    return `rgb(${r}, ${g}, ${b})`;
  };

  const mountRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<{
    targetRotationY: number;
    targetRotationX: number;
    isAnimating: boolean;
    targetCameraZ: number;
  }>({
    targetRotationY: 0,
    targetRotationX: 0,
    isAnimating: false,
    targetCameraZ: ZOOM_OUT,
  });

  // Store isLocked in a ref so the animate loop can read the current value.
  const isLockedRef = useRef(isLocked);

  // Cached scene objects so the Three.js scene isn't recreated on every render.
  const sceneRef = useRef<{
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    renderer: THREE.WebGLRenderer | null;
    globeYRotationGroup: THREE.Group | null;
    globeXRotationGroup: THREE.Group | null;
    markerGroup: THREE.Group | null;
    markerMeshes: THREE.Mesh[];
  }>({
    scene: null,
    camera: null,
    renderer: null,
    globeYRotationGroup: null,
    globeXRotationGroup: null,
    markerGroup: null,
    markerMeshes: [],
  });

  // Keep isLockedRef in sync with isLocked prop
  useEffect(() => {
    isLockedRef.current = isLocked;
    if (!isLocked) {
      animationRef.current.isAnimating = false;
      animationRef.current.targetCameraZ = ZOOM_OUT;
    } else {
      animationRef.current.targetCameraZ = ZOOM_IN;
    }
  }, [isLocked, ZOOM_OUT, ZOOM_IN]);

  // Rotate to a new target marker without recreating the scene.
  useEffect(() => {
    if (!isLocked || !sceneRef.current.globeYRotationGroup) return;

    function rotateToMarker(markerIndex: number) {
      if (markerIndex < 0 || markerIndex >= markers.length) return;

      const marker = markers[markerIndex];

      // Convert lat/long to rotation angles with an 80 degree Y offset.
      const offsetDegreesY = 80;
      const targetY =
        -((marker.long * Math.PI) / 180) + (offsetDegreesY * Math.PI) / 180;

      const targetX = (marker.lat * Math.PI) / 180;

      animationRef.current.targetRotationY = targetY;
      animationRef.current.targetRotationX = targetX;
      animationRef.current.isAnimating = true;
    }

    if (
      markers.length > 0 &&
      targetMarkerIndex >= 0 &&
      targetMarkerIndex < markers.length
    ) {
      rotateToMarker(targetMarkerIndex);
    }
    // Depend on index and length only, not the array identity.
  }, [targetMarkerIndex, isLocked, markers.length]);

  useEffect(() => {
    if (!mountRef.current) return;

    const mount = mountRef.current;
    const scene = new THREE.Scene();
    // Use the mount element's actual dimensions so the globe is never stretched
    // when the canvas is smaller than the full viewport (e.g. flex-1 layout).
    const initW = mount.clientWidth  || window.innerWidth;
    const initH = mount.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(45, initW / initH, 0.1, 1000);
    camera.position.set(0, 0, 4.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "default",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(initW, initH);
    // Cap pixel ratio so HiDPI screens don't render at 4x+ the pixels.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    mountRef.current.appendChild(renderer.domElement);

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    const rotationSpeed = 0.005;

    const raycaster = new THREE.Raycaster();
    const pointerPos = new THREE.Vector2();
    const globeUV = new THREE.Vector2();

    const textureLoader = new THREE.TextureLoader();
    const starSprite = textureLoader.load("/circle.png");
    const otherMap = textureLoader.load("/04_rainbow1k.jpg");
    const colorMap = textureLoader.load("/00_earthmap1k.jpg");
    const elevMap = textureLoader.load("/01_earthbump1k.jpg");
    const alphaMap = textureLoader.load("/02_earthspec1k.jpg");

    // Horizontal rotation (world Y-axis) and a child group for vertical tilt.
    const globeYRotationGroup = new THREE.Group();
    const globeXRotationGroup = new THREE.Group();

    globeYRotationGroup.position.set(0, 0, 0);
    scene.add(globeYRotationGroup);
    globeYRotationGroup.add(globeXRotationGroup);

    camera.lookAt(0, 0, 0);

    const geo = new THREE.IcosahedronGeometry(1, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0099ff,
      wireframe: true,
      displacementMap: elevMap,
      displacementScale: 0.04,
      transparent: true,
      opacity: 0.8,
      metalness: 0.3,
      roughness: 0.7,
    });
    const globe = new THREE.Mesh(geo, mat);
    globeXRotationGroup.add(globe);

    const detail = 50;
    // Slightly larger radius than the globe to avoid z-fighting.
    const pointsGeo = new THREE.IcosahedronGeometry(1.01, detail);

    const vertexShader = `
      uniform float size;
      uniform sampler2D elevTexture;
      uniform vec2 mouseUV;

      varying vec2 vUv;
      varying float vVisible;
      varying float vDist;

      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        float elv = texture2D(elevTexture, vUv).r;
        vec3 vNormal = normalMatrix * normal;
        vVisible = step(0.0, dot( -normalize(mvPosition.xyz), normalize(vNormal)));
        mvPosition.z += 0.35 * elv;

        float dist = distance(mouseUV, vUv);
        float zDisp = 0.0;
        float thresh = 0.03;
        if (dist < thresh) {
          zDisp = (thresh - dist) * 4.0;
        }
        vDist = dist;
        mvPosition.z += zDisp;

        gl_PointSize = size;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      uniform sampler2D colorTexture;
      uniform sampler2D alphaTexture;
      uniform sampler2D otherTexture;

      varying vec2 vUv;
      varying float vVisible;
      varying float vDist;

      void main() {
        if (floor(vVisible + 0.1) == 0.0) discard;
        float alpha = (1.0 - texture2D(alphaTexture, vUv).r) * 0.6;
        vec3 color = texture2D(otherTexture, vUv).rgb;
        vec3 other = texture2D(colorTexture, vUv).rgb;
        float thresh = 0.03;
        if (vDist < thresh) {
          color = mix(color, other, (thresh - vDist) * 30.0);
        }
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const uniforms = {
      size: { type: "f", value: 5.0 },
      colorTexture: { type: "t", value: colorMap },
      otherTexture: { type: "t", value: otherMap },
      elevTexture: { type: "t", value: elevMap },
      alphaTexture: { type: "t", value: alphaMap },
      mouseUV: { type: "v2", value: new THREE.Vector2(0.0, 0.0) },
    };

    const pointsMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });

    const points = new THREE.Points(pointsGeo, pointsMat);
    globeXRotationGroup.add(points);

    const markerGroup = new THREE.Group();
    globeXRotationGroup.add(markerGroup);

    sceneRef.current = {
      scene,
      camera,
      renderer,
      globeYRotationGroup,
      globeXRotationGroup,
      markerGroup,
      markerMeshes: [],
    };

    let hoveredMarker: THREE.Mesh | null = null;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x080820, 2);
    scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    scene.add(ambientLight);

    // Fresnel atmosphere shell — soft rim of glowing air around the planet.
    globeYRotationGroup.add(getAtmosphere({ color: "#6b9cc4", size: 1.16, intensity: 1.1, power: 3.0 }));

    const stars = getStarfield({ numStars: 1800, sprite: starSprite });
    scene.add(stars);
    const clock = new THREE.Clock();

    let frameCount = 0;
    function handleRaycast() {
      raycaster.setFromCamera(pointerPos, camera);
      globe.updateMatrixWorld(true);
      const intersects = raycaster.intersectObject(globe, false);
      if (intersects.length > 0 && intersects[0].uv) {
        globeUV.copy(intersects[0].uv);
        uniforms.mouseUV.value.copy(globeUV);
      }

      if (sceneRef.current.markerMeshes.length > 0) {
        const markerIntersects = raycaster.intersectObjects(
          sceneRef.current.markerMeshes,
          false,
        );

        // Walk up to the pin group that owns the intersected mesh.
        let hoveredPinGroup: THREE.Object3D | null = null;
        if (markerIntersects.length > 0) {
          let obj = markerIntersects[0].object;
          while (obj.parent && obj.parent !== sceneRef.current.markerGroup) {
            obj = obj.parent;
          }
          hoveredPinGroup = obj;
        }

        if (hoveredMarker && hoveredMarker !== hoveredPinGroup) {
          hoveredMarker.scale.setScalar(1);
          hoveredMarker = null;
          if (mountRef.current) {
            mountRef.current.style.cursor = "grab";
          }
        }

        if (hoveredPinGroup && hoveredPinGroup !== hoveredMarker) {
          hoveredMarker = hoveredPinGroup as THREE.Mesh;
          hoveredMarker.scale.setScalar(1.2);
          if (mountRef.current) {
            mountRef.current.style.cursor = "pointer";
          }
        }
      }
    }

    function animate() {
      frameCount++;

      // Raycast only every 3rd frame to reduce cost.
      if (frameCount % 3 === 0) {
        handleRaycast();
      }

      stars.rotation.y += 0.0002;
      stars.rotation.x += 0.0001;
      stars.update(clock.getElapsedTime());

      const zoomLerpFactor = 0.06;
      const cameraDeltaZ =
        animationRef.current.targetCameraZ - camera.position.z;
      if (Math.abs(cameraDeltaZ) > 0.01) {
        camera.position.z += cameraDeltaZ * zoomLerpFactor;
      }

      if (
        isLockedRef.current &&
        animationRef.current.isAnimating &&
        !isDragging
      ) {
        const lerpFactor = 0.05;

        const deltaY =
          animationRef.current.targetRotationY - globeYRotationGroup.rotation.y;
        const deltaX =
          animationRef.current.targetRotationX - globeYRotationGroup.rotation.x;

        globeYRotationGroup.rotation.y += deltaY * lerpFactor;
        globeYRotationGroup.rotation.x += deltaX * lerpFactor;

        if (Math.abs(deltaY) < 0.001 && Math.abs(deltaX) < 0.001) {
          animationRef.current.isAnimating = false;
        }
      } else if (
        !isLockedRef.current &&
        !isDragging &&
        !animationRef.current.isAnimating
      ) {
        // Passive idle rotation when unlocked and not being dragged.
        globeYRotationGroup.rotation.y += 0.001;
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    function onMouseMove(evt: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;

      pointerPos.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);

      if (isDragging) {
        const deltaX = evt.clientX - previousMousePosition.x;
        const deltaY = evt.clientY - previousMousePosition.y;

        globeYRotationGroup.rotation.y += deltaX * rotationSpeed;
        globeYRotationGroup.rotation.x += deltaY * rotationSpeed;

        previousMousePosition = { x: evt.clientX, y: evt.clientY };
      }
    }

    function onMouseDown(evt: MouseEvent) {
      if (hoveredMarker) {
        const markerIndex = hoveredMarker.userData.markerIndex;

        if (onLock) {
          onLock();
        }
        if (onMarkerClick) {
          onMarkerClick(markerIndex);
        }

        // Don't start dragging when a marker was clicked.
        return;
      }

      if (isLockedRef.current && onUnlock) {
        onUnlock();
      }

      isDragging = true;
      previousMousePosition = { x: evt.clientX, y: evt.clientY };
    }

    function onMouseUp() {
      isDragging = false;
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const w = width  || 1;
        const h = height || 1;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    if (mountRef.current) ro.observe(mountRef.current);
    function onResize() { /* handled by ResizeObserver */ }

    if (mountRef.current) {
      mountRef.current.style.cursor = "grab";
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    if (
      isLocked &&
      markers.length > 0 &&
      targetMarkerIndex >= 0 &&
      targetMarkerIndex < markers.length
    ) {
      const marker = markers[targetMarkerIndex];
      const offsetDegrees = 80;
      const targetY =
        -((marker.long * Math.PI) / 180) + (offsetDegrees * Math.PI) / 180;
      const targetX = (marker.lat * Math.PI) / 180;

      animationRef.current.targetRotationY = targetY;
      animationRef.current.targetRotationX = targetX;
      animationRef.current.isAnimating = true;
      animationRef.current.targetCameraZ = ZOOM_IN;
    } else if (!isLocked) {
      animationRef.current.targetCameraZ = ZOOM_OUT;
    }

    return () => {
      ro.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);

      const mount = mountRef.current;
      if (mount && mount.contains(renderer.domElement)) {
        mount.style.cursor = "default";
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();

      sceneRef.current = {
        scene: null,
        camera: null,
        renderer: null,
        globeYRotationGroup: null,
        globeXRotationGroup: null,
        markerGroup: null,
        markerMeshes: [],
      };
    };
  }, []);

  // Update markers when they change.
  useEffect(() => {
    if (!sceneRef.current.markerGroup) return;

    const markerGroup = sceneRef.current.markerGroup;

    while (markerGroup.children.length > 0) {
      const child = markerGroup.children[0];
      markerGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
    sceneRef.current.markerMeshes = [];

    if (markers.length > 0) {
      // Build a pin from a head + stem. Confidence (0-100) scales the pin
      // height from 0.5x at 0% to 2x at 100%.
      const createPinGeometry = (confidence: number = 50) => {
        const pinGroup = new THREE.Group();

        const heightScale = 0.5 + (confidence / 100) * 1.5;

        const baseHeadSize = 0.0175;
        const baseStemHeight = 0.028;
        const stemRadius = 0.0042;

        const scaledHeadSize = baseHeadSize * heightScale;
        const scaledStemHeight = baseStemHeight * heightScale;

        const headGeometry = new THREE.SphereGeometry(scaledHeadSize, 8, 8);
        const head = new THREE.Mesh(headGeometry);
        head.scale.set(1, 1.3, 1);
        head.position.set(0, scaledStemHeight / 2 + scaledHeadSize * 0.7, 0);

        const stemGeometry = new THREE.CylinderGeometry(
          stemRadius,
          stemRadius,
          scaledStemHeight,
          6,
        );
        const stem = new THREE.Mesh(stemGeometry);
        stem.position.set(0, 0, 0);

        pinGroup.add(head);
        pinGroup.add(stem);

        return pinGroup;
      };

      markers.forEach((marker, index) => {
        const [x, y, z] = latLongToVector3(marker.lat, marker.long, 1.02);

        // Red for the locked/target marker, confidence gradient for the rest.
        const isTargetMarker = isLocked && index === targetMarkerIndex;
        const markerColor = isTargetMarker
          ? "#ff0000"
          : marker.color || getConfidenceColor(marker.confidence || 50);

        const markerMaterial = new THREE.MeshStandardMaterial({
          color: markerColor,
          transparent: true,
          opacity: 0.9,
          metalness: 0.3,
          roughness: 0.4,
        });

        const pinGroup = createPinGeometry(marker.confidence || 50);

        pinGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = markerMaterial;
          }
        });

        pinGroup.position.set(x, y, z);

        // Orient the pin to point outward from the globe center.
        const direction = new THREE.Vector3(x, y, z).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(up, direction);
        pinGroup.setRotationFromQuaternion(quaternion);

        pinGroup.userData = {
          markerIndex: index,
          markerData: marker,
          originalScale: 1,
        };

        markerGroup.add(pinGroup);

        pinGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.userData = pinGroup.userData;
            sceneRef.current.markerMeshes.push(child);
          }
        });
      });
    }
  }, [markers, targetMarkerIndex, isLocked]);

  return (
    <div
      ref={mountRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
