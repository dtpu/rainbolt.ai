"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import getStarfield from "../../utils/getStarfield";
import getAtmosphere from "../../utils/getAtmosphere";
import getShootingStars from "../../utils/getShootingStars";
import { latLongToVector3 } from "../../utils/coordinates";
import { useGlobeStore, type WorldMarker, type WorldArc } from "@/lib/globe/store";

const ACCENT = new THREE.Color("#e5373e");
const ACCENT_BRIGHT = new THREE.Color("#ff6b6b");
const MARKER_RADIUS = 1.02;
const ZOOM_OUT = 3.2;
const ZOOM_IN = 2.45;

function pinRotation(lat: number, lng: number) {
  const [px, py, pz] = latLongToVector3(lat, lng, 1);
  return { rotY: Math.atan2(-px, pz), rotX: Math.atan2(py, Math.sqrt(px * px + pz * pz)) };
}

/**
 * The single globe shared by the learning + location pages. Mounted once in the
 * (map) route-group layout and driven entirely by the globe store, so moving
 * between pages keeps the same canvas alive and just flies the camera.
 */
export default function WorldGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 1;
    const height = mount.clientHeight || 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, ZOOM_OUT);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    // Full-viewport globe: cap DPR so HiDPI screens don't render 4x the pixels.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
    mount.appendChild(renderer.domElement);

    const loader = new THREE.TextureLoader();
    const starSprite = loader.load("/circle.png");
    const otherMap = loader.load("/04_rainbow1k.jpg");
    const colorMap = loader.load("/00_earthmap1k.jpg");
    const elevMap = loader.load("/01_earthbump1k.jpg");
    const alphaMap = loader.load("/02_earthspec1k.jpg");

    const spinGroup = new THREE.Group();
    const contentGroup = new THREE.Group();
    spinGroup.add(contentGroup);
    scene.add(spinGroup);

    contentGroup.add(new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 12),
      new THREE.MeshStandardMaterial({
        color: 0x0099ff, wireframe: true, displacementMap: elevMap,
        displacementScale: 0.04, transparent: true, opacity: 0.6, metalness: 0.3, roughness: 0.7,
      }),
    ));

    // Point-cloud earth with a per-point random so the dots can reconfigure on zoom.
    const pointsGeo = new THREE.IcosahedronGeometry(1.01, 50);
    {
      const pn = pointsGeo.attributes.position.count;
      const rnd = new Float32Array(pn);
      for (let i = 0; i < pn; i++) rnd[i] = Math.random();
      pointsGeo.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));
    }
    const pointsMat = new THREE.ShaderMaterial({
      uniforms: {
        size: { value: 5.0 },
        otherTexture: { value: otherMap }, elevTexture: { value: elevMap }, alphaTexture: { value: alphaMap },
        uZoom: { value: 0 }, uZoomVel: { value: 0 }, uTime: { value: 0 },
      },
      vertexShader: `
        uniform float size, uZoom, uZoomVel, uTime; uniform sampler2D elevTexture;
        attribute float aRand;
        varying vec2 vUv; varying float vVisible;
        void main(){ vUv=uv;
          float elv=texture2D(elevTexture,uv).r; vec3 nn=normalize(normal);
          float relief = elv * (0.03 + uZoom*0.20);                       // terrain rises as you zoom in
          float flow = sin(uTime*1.6 + aRand*6.2831) * 0.0035;           // always-on gentle shimmer
          float scatter = uZoomVel * (0.20 + aRand*0.55) * sin(uTime*17.0 + aRand*6.2831); // reconfigure while zooming
          vec3 p = position + nn * (relief + flow + scatter);
          vec4 mvPos = modelViewMatrix*vec4(p,1.0); vec3 vN=normalMatrix*normal;
          vVisible=step(0.0,dot(-normalize(mvPos.xyz),normalize(vN)));
          gl_PointSize=size*(1.0 + uZoom*0.7 + uZoomVel*0.8); gl_Position=projectionMatrix*mvPos; }`,
      fragmentShader: `
        uniform sampler2D alphaTexture, otherTexture;
        varying vec2 vUv; varying float vVisible;
        void main(){ if(floor(vVisible+0.1)==0.0) discard;
          float a=(1.0-texture2D(alphaTexture,vUv).r)*0.6; vec3 c=texture2D(otherTexture,vUv).rgb;
          gl_FragColor=vec4(c,a); }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    void colorMap;
    contentGroup.add(new THREE.Points(pointsGeo, pointsMat));
    contentGroup.add(getAtmosphere({ color: "#6b9cc4", size: 1.16, intensity: 1.15, power: 3.0 }));

    scene.add(new THREE.HemisphereLight(0xffffff, 0x080820, 2));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 3, 5);
    scene.add(dir);
    scene.add(new THREE.AmbientLight(0x404040, 0.8));
    const stars = getStarfield({ numStars: 1400, sprite: starSprite });
    scene.add(stars);
    const shooting = getShootingStars({ count: 1 });
    scene.add(shooting);
    const clock = new THREE.Clock();

    const pinById = new Map<string, THREE.Group>();
    let pinMeshes: THREE.Object3D[] = [];

    // ---- build pins + arcs from a marker/arc set ----
    const buildContent = (markers: WorldMarker[], arcs: WorldArc[]) => {
      for (const pin of pinById.values()) {
        contentGroup.remove(pin);
        pin.traverse((c) => { if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); } });
      }
      pinById.clear();
      pinMeshes = [];
      for (const a of contentGroup.children.filter((c) => c.userData?.isArc)) {
        contentGroup.remove(a);
        if (a instanceof THREE.Mesh) { a.geometry.dispose(); (a.material as THREE.Material).dispose(); }
      }

      for (const arc of arcs) {
        const [sx, sy, sz] = latLongToVector3(arc.fromLat, arc.fromLng, MARKER_RADIUS);
        const [ex, ey, ez] = latLongToVector3(arc.toLat, arc.toLng, MARKER_RADIUS);
        const start = new THREE.Vector3(sx, sy, sz);
        const end = new THREE.Vector3(ex, ey, ez);
        const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(1.15 + start.distanceTo(end) * 0.18);
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(start, mid, end), 44, 0.0032, 6, false),
          new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.4 }),
        );
        tube.userData.isArc = true;
        contentGroup.add(tube);
      }

      markers.forEach((m, i) => {
        const [x, y, z] = latLongToVector3(m.lat, m.lng, MARKER_RADIUS);
        const conf = m.confidence ?? 60;
        const h = 0.55 + (conf / 100) * 1.0; // confidence -> pin height
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
          color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.6, transparent: true, opacity: 0.95, metalness: 0.3, roughness: 0.4,
        });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), mat);
        head.scale.set(1, 1.3, 1);
        head.position.set(0, 0.028 * h * 1.6, 0);
        group.add(head);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.03 * h * 1.6, 6), mat);
        stem.position.set(0, 0.015 * h * 1.6, 0);
        group.add(stem);
        group.position.set(x, y, z);
        const q = new THREE.Quaternion();
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z).normalize());
        group.setRotationFromQuaternion(q);
        group.userData = { id: m.id, index: i };
        contentGroup.add(group);
        pinById.set(m.id, group);
        group.traverse((c) => { if (c instanceof THREE.Mesh) pinMeshes.push(c); });
      });
      applyActive(useGlobeStore.getState().activeId);
    };

    const applyActive = (activeId: string | null) => {
      for (const [id, group] of pinById) {
        const on = id === activeId;
        group.scale.setScalar(on ? 1.8 : 1);
        group.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            const mt = c.material as THREE.MeshStandardMaterial;
            mt.color.copy(on ? ACCENT_BRIGHT : ACCENT);
            mt.emissive.copy(on ? ACCENT_BRIGHT : ACCENT);
            mt.emissiveIntensity = on ? 1.4 : 0.6;
          }
        });
      }
    };

    // ---- camera targets ----
    const flyTarget = { rotY: 0, rotX: 0, active: false };
    let targetZ = ZOOM_OUT;

    const applyFocus = () => {
      const s = useGlobeStore.getState();
      if (s.focusIndex != null && s.markers[s.focusIndex]) {
        const m = s.markers[s.focusIndex];
        const r = pinRotation(m.lat, m.lng);
        flyTarget.rotY = r.rotY; flyTarget.rotX = r.rotX; flyTarget.active = true;
        targetZ = ZOOM_IN;
      } else {
        flyTarget.active = false;
        targetZ = ZOOM_OUT;
      }
    };

    // initial
    buildContent(useGlobeStore.getState().markers, useGlobeStore.getState().arcs);
    applyFocus();

    // react to store changes without remounting
    let prevMarkers = useGlobeStore.getState().markers;
    let prevArcs = useGlobeStore.getState().arcs;
    let prevActive = useGlobeStore.getState().activeId;
    let prevFocus = useGlobeStore.getState().focusIndex;
    const unsub = useGlobeStore.subscribe((s) => {
      if (s.markers !== prevMarkers || s.arcs !== prevArcs) {
        prevMarkers = s.markers; prevArcs = s.arcs;
        buildContent(s.markers, s.arcs);
      }
      if (s.activeId !== prevActive) { prevActive = s.activeId; applyActive(s.activeId); }
      if (s.focusIndex !== prevFocus) { prevFocus = s.focusIndex; applyFocus(); }
    });

    // ---- interaction ----
    let isDragging = false, moved = false;
    let prev = { x: 0, y: 0 };
    let hoveredId: string | null = null;
    let downId: string | null = null;
    let frame = 0, raf = 0;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const pickPin = (): { id: string; index: number } | null => {
      if (pinMeshes.length === 0) return null;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pinMeshes, false);
      if (!hits.length) return null;
      let obj = hits[0].object as THREE.Object3D;
      while (obj.parent && obj.parent !== contentGroup) obj = obj.parent;
      return obj.userData?.id ? { id: obj.userData.id, index: obj.userData.index } : null;
    };

    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (document.hidden) return;
      frame++;
      const t = clock.getElapsedTime();
      const dt = clock.getDelta();
      stars.rotation.y += 0.0002;
      stars.update(t);
      shooting.update(dt);

      if (flyTarget.active) {
        spinGroup.rotation.y += (flyTarget.rotY - spinGroup.rotation.y) * 0.08;
        spinGroup.rotation.x += (flyTarget.rotX - spinGroup.rotation.x) * 0.08;
      } else if (!isDragging && hoveredId === null) {
        spinGroup.rotation.y += 0.0009;
      }
      const prevZ = camera.position.z;
      camera.position.z += (targetZ - camera.position.z) * 0.08;

      // Drive the dot reconfigure: zoom level + how fast we're zooming.
      const zoom = Math.max(0, Math.min(1, (5 - camera.position.z) / 2.8));
      const vel = Math.min(1, Math.abs(camera.position.z - prevZ) * 16);
      const pu = pointsMat.uniforms;
      pu.uZoom.value += (zoom - pu.uZoom.value) * 0.15;
      // peak-hold so the reconfigure pops on zoom and eases out smoothly
      pu.uZoomVel.value = Math.max(vel, pu.uZoomVel.value * 0.92);
      pu.uTime.value = t;

      if (frame % 3 === 0 && !isDragging) {
        const hit = pickPin();
        const id = hit?.id ?? null;
        if (id !== hoveredId) {
          hoveredId = id;
          renderer.domElement.style.cursor = id ? "pointer" : "grab";
          useGlobeStore.getState().onHover?.(id);
        }
      }
      renderer.render(scene, camera);
    };
    animate();

    const setPointer = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * -2 + 1);
    };
    const onMove = (e: MouseEvent) => {
      setPointer(e);
      if (isDragging) {
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) { moved = true; flyTarget.active = false; }
        spinGroup.rotation.y += dx * 0.005;
        spinGroup.rotation.x = Math.max(-1.1, Math.min(1.1, spinGroup.rotation.x + dy * 0.005));
        prev = { x: e.clientX, y: e.clientY };
      }
    };
    const onDown = (e: MouseEvent) => { setPointer(e); downId = pickPin()?.id ?? null; isDragging = true; moved = false; prev = { x: e.clientX, y: e.clientY }; };
    const onUp = () => {
      if (!moved && downId) {
        const hit = pickPin();
        if (hit && hit.id === downId) useGlobeStore.getState().onPick?.(hit.id, hit.index);
      }
      isDragging = false; downId = null;
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); targetZ = Math.max(1.9, Math.min(5.2, targetZ + e.deltaY * 0.0024)); flyTarget.active = false; };

    const el = renderer.domElement;
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      el.removeEventListener("wheel", onWheel);
      if (mount.contains(el)) mount.removeChild(el);
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}
