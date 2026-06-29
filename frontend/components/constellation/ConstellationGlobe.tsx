"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import getStarfield from "../../utils/getStarfield";
import getAtmosphere from "../../utils/getAtmosphere";
import getShootingStars from "../../utils/getShootingStars";
import { latLongToVector3 } from "../../utils/coordinates";

export interface GlobeMarker { id: string; lat: number; lng: number; }
export interface GlobeArc { fromLat: number; fromLng: number; toLat: number; toLng: number; }

export interface ConstellationGlobeHandle {
  /** Rotate + zoom to center a pin (click / navigate). */
  flyTo: (lat: number, lng: number) => void;
  /** Gently rotate toward a pin without zooming (hover preview). */
  rotateTo: (lat: number, lng: number) => void;
  /** Let the globe idle-spin again after a hover. */
  cancelRotation: () => void;
}

interface ConstellationGlobeProps {
  markers: GlobeMarker[];
  arcs: GlobeArc[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}

const ACCENT        = new THREE.Color("#e5373e");
const ACCENT_BRIGHT = new THREE.Color("#ff6b6b");
const MARKER_RADIUS = 1.02;

/** Compute spinGroup Euler angles that bring (lat, lng) to face the camera. */
function pinRotation(lat: number, lng: number) {
  const [px, py, pz] = latLongToVector3(lat, lng, 1);
  return {
    rotY: Math.atan2(-px, pz),
    rotX: Math.atan2(py, Math.sqrt(px * px + pz * pz)),
  };
}

const ConstellationGlobe = forwardRef<ConstellationGlobeHandle, ConstellationGlobeProps>(
  function ConstellationGlobe({ markers, arcs, activeId, onHover, onOpen }, ref) {
    const mountRef = useRef<HTMLDivElement>(null);

    const onHoverRef = useRef(onHover);
    const onOpenRef  = useRef(onOpen);
    const activeIdRef = useRef(activeId);
    onHoverRef.current  = onHover;
    onOpenRef.current   = onOpen;
    activeIdRef.current = activeId;

    // Fly-to (click): overrides hover rotation, also zooms.
    const flyTargetRef    = useRef<{ rotY: number; rotX: number } | null>(null);
    // Rotate-to (hover): gentle drift, no zoom.
    const rotateTargetRef = useRef<{ rotY: number; rotX: number } | null>(null);
    // Zoom target readable by flyTo() outside the effect closure.
    const targetZRef = useRef(3.2);

    useImperativeHandle(ref, () => ({
      flyTo(lat, lng) {
        flyTargetRef.current    = pinRotation(lat, lng);
        rotateTargetRef.current = null;
        targetZRef.current      = 2.55;
      },
      rotateTo(lat, lng) {
        rotateTargetRef.current = pinRotation(lat, lng);
      },
      cancelRotation() {
        rotateTargetRef.current = null;
      },
    }));

    const sceneRef = useRef<{
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      renderer: THREE.WebGLRenderer;
      spinGroup: THREE.Group;
      contentGroup: THREE.Group;
      pinMeshes: THREE.Object3D[];
      pinById: Map<string, THREE.Group>;
    } | null>(null);

    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      const width  = mount.clientWidth  || 1;
      const height = mount.clientHeight || 1;

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(0, 0, 3.2);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "default" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
      mount.appendChild(renderer.domElement);

      const loader   = new THREE.TextureLoader();
      const starSprite = loader.load("/circle.png");
      const otherMap   = loader.load("/04_rainbow1k.jpg");
      const colorMap   = loader.load("/00_earthmap1k.jpg");
      const elevMap    = loader.load("/01_earthbump1k.jpg");
      const alphaMap   = loader.load("/02_earthspec1k.jpg");

      const spinGroup    = new THREE.Group();
      const contentGroup = new THREE.Group();
      spinGroup.add(contentGroup);
      scene.add(spinGroup);

      contentGroup.add(new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 12),
        new THREE.MeshStandardMaterial({
          color: 0x0099ff, wireframe: true, displacementMap: elevMap,
          displacementScale: 0.04, transparent: true, opacity: 0.6,
          metalness: 0.3, roughness: 0.7,
        }),
      ));

      const pointsMat = new THREE.ShaderMaterial({
        uniforms: {
          size:          { value: 5.0 },
          colorTexture:  { value: colorMap },
          otherTexture:  { value: otherMap },
          elevTexture:   { value: elevMap },
          alphaTexture:  { value: alphaMap },
        },
        vertexShader: `
          uniform float size; uniform sampler2D elevTexture;
          varying vec2 vUv; varying float vVisible;
          void main() {
            vUv = uv;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            float elv = texture2D(elevTexture, vUv).r;
            vec3 vN = normalMatrix * normal;
            vVisible = step(0.0, dot(-normalize(mvPos.xyz), normalize(vN)));
            mvPos.z += 0.35 * elv;
            gl_PointSize = size;
            gl_Position = projectionMatrix * mvPos;
          }`,
        fragmentShader: `
          uniform sampler2D colorTexture, alphaTexture, otherTexture;
          varying vec2 vUv; varying float vVisible;
          void main() {
            if (floor(vVisible + 0.1) == 0.0) discard;
            float a = (1.0 - texture2D(alphaTexture, vUv).r) * 0.6;
            vec3 c = texture2D(otherTexture, vUv).rgb;
            gl_FragColor = vec4(c, a);
          }`,
        transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      });
      contentGroup.add(new THREE.Points(new THREE.IcosahedronGeometry(1.01, 50), pointsMat));

      // Fresnel atmosphere shell - the rim of glowing air around the planet.
      contentGroup.add(getAtmosphere({ color: "#6b9cc4", size: 1.16, intensity: 1.15, power: 3.0 }));

      scene.add(new THREE.HemisphereLight(0xffffff, 0x080820, 2));
      const dir = new THREE.DirectionalLight(0xffffff, 1);
      dir.position.set(5, 3, 5);
      scene.add(dir);
      scene.add(new THREE.AmbientLight(0x404040, 0.8));
      const stars = getStarfield({ numStars: 2200, sprite: starSprite });
      scene.add(stars);
      const shooting = getShootingStars({ count: 2 });
      scene.add(shooting);

      const clock = new THREE.Clock();

      sceneRef.current = { scene, camera, renderer, spinGroup, contentGroup, pinMeshes: [], pinById: new Map() };

      let isDragging = false, moved = false;
      let prev = { x: 0, y: 0 };
      let hoveredId: string | null = null;
      let downId: string | null = null;
      let frame = 0, raf = 0;

      const raycaster = new THREE.Raycaster();
      const pointer   = new THREE.Vector2();

      const pickPinId = () => {
        const sc = sceneRef.current;
        if (!sc || sc.pinMeshes.length === 0) return null;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(sc.pinMeshes, false);
        if (!hits.length) return null;
        let obj = hits[0].object as THREE.Object3D;
        while (obj.parent && obj.parent !== sc.contentGroup) obj = obj.parent;
        return (obj.userData?.id as string) ?? null;
      };

      const animate = () => {
        frame++;
        const dt = clock.getDelta();
        const t = clock.getElapsedTime();
        stars.rotation.y += 0.0002;
        stars.update(t);
        shooting.update(dt);

        if (flyTargetRef.current) {
          const { rotY, rotX } = flyTargetRef.current;
          spinGroup.rotation.y += (rotY - spinGroup.rotation.y) * 0.09;
          spinGroup.rotation.x += (rotX - spinGroup.rotation.x) * 0.09;
        } else if (rotateTargetRef.current) {
          const { rotY, rotX } = rotateTargetRef.current;
          spinGroup.rotation.y += (rotY - spinGroup.rotation.y) * 0.035;
          spinGroup.rotation.x += (rotX - spinGroup.rotation.x) * 0.035;
        } else if (!isDragging && !activeIdRef.current && hoveredId === null) {
          spinGroup.rotation.y += 0.0009;
        }

        camera.position.z += (targetZRef.current - camera.position.z) * 0.08;

        if (frame % 3 === 0 && !isDragging) {
          const id = pickPinId();
          if (id !== hoveredId) {
            hoveredId = id;
            renderer.domElement.style.cursor = id ? "pointer" : "grab";
            onHoverRef.current(id);
          }
        }

        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      const setPointer = (e: MouseEvent) => {
        const r = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((e.clientX - r.left) / r.width)  *  2 - 1,
          ((e.clientY - r.top)  / r.height) * -2 + 1,
        );
      };

      const onMove = (e: MouseEvent) => {
        setPointer(e);
        if (isDragging) {
          const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
          if (Math.abs(dx) + Math.abs(dy) > 2) {
            moved = true;
            flyTargetRef.current    = null;
            rotateTargetRef.current = null;
          }
          spinGroup.rotation.y += dx * 0.005;
          spinGroup.rotation.x = Math.max(-1.1, Math.min(1.1, spinGroup.rotation.x + dy * 0.005));
          prev = { x: e.clientX, y: e.clientY };
        }
      };
      const onDown = (e: MouseEvent) => {
        setPointer(e);
        downId = pickPinId();
        isDragging = true; moved = false;
        prev = { x: e.clientX, y: e.clientY };
      };
      const onUp = () => {
        if (!moved && downId) onOpenRef.current(downId);
        isDragging = false; downId = null;
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        targetZRef.current    = Math.max(2.2, Math.min(5, targetZRef.current + e.deltaY * 0.0015));
        flyTargetRef.current  = null;
      };

      const el = renderer.domElement;
      el.addEventListener("mousemove", onMove);
      el.addEventListener("mousedown", onDown);
      window.addEventListener("mouseup", onUp);
      el.addEventListener("wheel", onWheel, { passive: false });

      const ro = new ResizeObserver(() => {
        const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      ro.observe(mount);

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mousedown", onDown);
        window.removeEventListener("mouseup", onUp);
        el.removeEventListener("wheel", onWheel);
        if (mount.contains(el)) mount.removeChild(el);
        renderer.dispose();
        sceneRef.current = null;
      };
    }, []);

    useEffect(() => {
      const sc = sceneRef.current;
      if (!sc) return;

      for (const pin of sc.pinById.values()) {
        sc.contentGroup.remove(pin);
        pin.traverse((c) => {
          if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
        });
      }
      sc.pinById.clear();
      sc.pinMeshes = [];

      for (const a of sc.contentGroup.children.filter(c => c.userData?.isArc)) {
        sc.contentGroup.remove(a);
        if (a instanceof THREE.Mesh) { a.geometry.dispose(); (a.material as THREE.Material).dispose(); }
      }

      for (const arc of arcs) {
        const [sx, sy, sz] = latLongToVector3(arc.fromLat, arc.fromLng, MARKER_RADIUS);
        const [ex, ey, ez] = latLongToVector3(arc.toLat,   arc.toLng,   MARKER_RADIUS);
        const start = new THREE.Vector3(sx, sy, sz);
        const end   = new THREE.Vector3(ex, ey, ez);
        const mid   = start.clone().add(end).multiplyScalar(0.5).normalize()
                        .multiplyScalar(1.15 + start.distanceTo(end) * 0.18);
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(start, mid, end), 44, 0.0032, 6, false),
          new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.4 }),
        );
        tube.userData.isArc = true;
        sc.contentGroup.add(tube);
      }

      for (const m of markers) {
        const [x, y, z] = latLongToVector3(m.lat, m.lng, MARKER_RADIUS);
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
          color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.6,
          transparent: true, opacity: 0.95, metalness: 0.3, roughness: 0.4,
        });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), mat);
        head.scale.set(1, 1.3, 1);
        head.position.set(0, 0.028, 0);
        group.add(head);
        group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 6), mat));
        group.position.set(x, y, z);
        const q = new THREE.Quaternion();
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z).normalize());
        group.setRotationFromQuaternion(q);
        group.userData = { id: m.id };
        sc.contentGroup.add(group);
        sc.pinById.set(m.id, group);
        group.traverse(c => { if (c instanceof THREE.Mesh) sc.pinMeshes.push(c); });
      }

      applyActive(sc, activeIdRef.current);
    }, [markers, arcs]);

    useEffect(() => {
      const sc = sceneRef.current;
      if (sc) applyActive(sc, activeId);
    }, [activeId]);

    return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
  },
);

ConstellationGlobe.displayName = "ConstellationGlobe";
export default ConstellationGlobe;

function applyActive(sc: { pinById: Map<string, THREE.Group> }, activeId: string | null) {
  for (const [id, group] of sc.pinById) {
    const on = id === activeId;
    group.scale.setScalar(on ? 1.8 : 1);
    group.traverse(c => {
      if (c instanceof THREE.Mesh) {
        const mat = c.material as THREE.MeshStandardMaterial;
        mat.color.copy(on ? ACCENT_BRIGHT : ACCENT);
        mat.emissive.copy(on ? ACCENT_BRIGHT : ACCENT);
        mat.emissiveIntensity = on ? 1.4 : 0.6;
      }
    });
  }
}
