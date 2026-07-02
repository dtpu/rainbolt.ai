"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import getStarfield from "../../utils/getStarfield";
import getAtmosphere from "../../utils/getAtmosphere";
import getShootingStars from "../../utils/getShootingStars";
import { latLongToVector3 } from "../../utils/coordinates";
import { useGlobeStore, type WorldMarker, type WorldArc } from "@/lib/globe/store";
import { pinColor } from "@/lib/globe/palette";

const ARC_COLOR = new THREE.Color("#8fb8d8");
const MARKER_RADIUS = 1.02;
const ZOOM_OUT = 3.2;
const ZOOM_IN = 2.0;
const ZOOM_MIN = 1.5;  // closest wheel zoom
const ZOOM_MAX = 5.2;  // farthest
// Normalised zoom 0..1 from camera distance; default view sits low so zooming in ramps detail up.
const zoomLevel = (z: number) => Math.max(0, Math.min(1, (3.45 - z) / 1.5));

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
    // Cap DPR *and* the absolute backing resolution so a maximized 4K window
    // doesn't render an 8-megapixel point cloud every frame.
    const pixelRatioFor = (w: number, h: number) => Math.min(window.devicePixelRatio, 1.5, 2560 / Math.max(w, h, 1));
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatioFor(width, height));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
    mount.appendChild(renderer.domElement);

    // Map-style place/landmark labels overlaid on the globe (HTML, positioned per frame).
    const labelLayer = document.createElement("div");
    labelLayer.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none";
    mount.appendChild(labelLayer);
    interface LabelEl { el: HTMLDivElement; pos: THREE.Vector3; rank: number; }
    let labelEls: LabelEl[] = [];
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    const buildLabels = (labels: { name: string; lat: number; lng: number; rank?: number }[]) => {
      for (const l of labelEls) l.el.remove();
      labelEls = labels.map((p, i) => {
        const el = document.createElement("div");
        el.style.cssText = "position:absolute;left:0;top:0;display:flex;align-items:center;gap:5px;white-space:nowrap;opacity:0;will-change:transform,opacity;transition:opacity .25s ease";
        el.innerHTML =
          `<span style="width:5px;height:5px;border-radius:50%;background:#e8b44f;box-shadow:0 0 6px rgba(232,180,79,.9);flex:none"></span>` +
          `<span style="font:500 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.01em;color:#eef2f8;text-shadow:0 1px 5px rgba(0,0,0,.95)">${esc(p.name)}</span>`;
        labelLayer.appendChild(el);
        const [x, y, z] = latLongToVector3(p.lat, p.lng, 1.02);
        return { el, pos: new THREE.Vector3(x, y, z), rank: p.rank ?? i / Math.max(1, labels.length) };
      });
    };

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

    // Wireframe shell reads well from afar but its triangles overwhelm close-ups,
    // so its opacity is faded down with zoom in the animate loop.
    const wireMat = new THREE.MeshStandardMaterial({
      color: 0x0099ff, wireframe: true, displacementMap: elevMap,
      displacementScale: 0.04, transparent: true, opacity: 0.6, metalness: 0.3, roughness: 0.7,
    });
    const wireMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 12), wireMat);
    contentGroup.add(wireMesh);

    // Point-cloud earth. Two layers: a base grid always on, and a denser layer
    // that fades in as you zoom (density LOD). Both share a shader that does the
    // zoom reconfigure (scatter + relief) and a "homing" data pulse toward the
    // active guess (glow + expanding rings).
    const POINT_VERT = `
      uniform float size, uZoom, uZoomVel, uTime, uActive; uniform vec3 uTarget;
      uniform sampler2D elevTexture; attribute float aRand;
      varying vec2 vUv; varying float vVisible; varying float vGlow;
      void main(){ vUv=uv;
        float elv=texture2D(elevTexture,uv).r; vec3 nn=normalize(normal);
        float relief = elv * (0.02 + uZoom*0.10);                          // gentle terrain as you zoom in
        float flow = sin(uTime*1.6 + aRand*6.2831) * 0.0025;               // always-on faint shimmer
        float scatter = uZoomVel * 0.03 * sin(uTime*10.0 + aRand*6.2831);  // barely-there motion while zooming
        // break the icosahedral lattice: jitter each dot tangentially so close
        // zooms read as organic stippling, not a machine grid
        float r1 = fract(sin(aRand*127.1)*43758.5453) - 0.5;
        float r2 = fract(sin(aRand*311.7)*43758.5453) - 0.5;
        vec3 t1 = normalize(cross(nn, vec3(0.0,1.0,0.0)) + vec3(1e-4));
        vec3 t2 = cross(nn, t1);
        vec3 jit = (t1*r1 + t2*r2) * 0.012;
        float d = length(nn - uTarget);                                    // chord distance to active guess
        float g = exp(-d*d*7.0);                                           // glow near the guess
        float ring = smoothstep(0.09, 0.0, abs(d - fract(uTime*0.30)*1.7)) * step(d, 1.7); // expanding rings
        vGlow = uActive * (g*(0.30 + 0.18*sin(uTime*3.0)) + ring*0.14);
        vec3 p = position + jit + nn * (relief + flow + scatter + vGlow*0.010);
        vec4 mvPos = modelViewMatrix*vec4(p,1.0); vec3 vN=normalMatrix*normal;
        vVisible=step(0.0,dot(-normalize(mvPos.xyz),normalize(vN)));
        gl_PointSize=size*(1.0 + uZoom*0.18); gl_Position=projectionMatrix*mvPos; }`;
    const POINT_FRAG = `
      uniform sampler2D alphaTexture, otherTexture; uniform float uZoom, uDense;
      varying vec2 vUv; varying float vVisible; varying float vGlow;
      void main(){ if(floor(vVisible+0.1)==0.0) discard;
        float a=(1.0-texture2D(alphaTexture,vUv).r)*0.6;
        a *= mix(1.0, clamp((uZoom-0.32)*2.2, 0.0, 1.0), uDense);          // dense layer fades in only on real zoom-in
        vec3 c=texture2D(otherTexture,vUv).rgb;
        c *= 1.0 + vGlow*0.55;                                             // subtle brighten toward the guess
        gl_FragColor=vec4(c, a + vGlow*0.12); }`;
    const makePointsMat = (dense: boolean) => new THREE.ShaderMaterial({
      uniforms: {
        size: { value: dense ? 4.0 : 5.0 },
        otherTexture: { value: otherMap }, elevTexture: { value: elevMap }, alphaTexture: { value: alphaMap },
        uZoom: { value: 0 }, uZoomVel: { value: 0 }, uTime: { value: 0 },
        uTarget: { value: new THREE.Vector3(0, 0, 1) }, uActive: { value: 0 }, uDense: { value: dense ? 1 : 0 },
      },
      vertexShader: POINT_VERT, fragmentShader: POINT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    const makePointsGeo = (detail: number) => {
      const g = new THREE.IcosahedronGeometry(1.01, detail);
      const pn = g.attributes.position.count;
      const rnd = new Float32Array(pn);
      for (let i = 0; i < pn; i++) rnd[i] = Math.random();
      g.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));
      return g;
    };
    const baseMat = makePointsMat(false);
    const denseMat = makePointsMat(true);
    const pointMats = [baseMat, denseMat];
    contentGroup.add(new THREE.Points(makePointsGeo(50), baseMat));
    // Detail 56 keeps the close-up density (jitter hides the coarser lattice)
    // at ~40% fewer vertices than 72 - the located page renders this every frame.
    const densePoints = new THREE.Points(makePointsGeo(56), denseMat);
    densePoints.visible = false;
    contentGroup.add(densePoints);
    void colorMap;
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
          new THREE.MeshBasicMaterial({ color: ARC_COLOR, transparent: true, opacity: 0.35 }),
        );
        tube.userData.isArc = true;
        contentGroup.add(tube);
      }

      markers.forEach((m, i) => {
        const [x, y, z] = latLongToVector3(m.lat, m.lng, MARKER_RADIUS);
        const conf = m.confidence ?? 60;
        const h = 0.5 + (conf / 100) * 0.6; // confidence -> pin height
        const col = new THREE.Color(pinColor(i)); // distinct colour per candidate
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: 0.9, transparent: true, opacity: 0.95, metalness: 0.2, roughness: 0.4,
        });
        const headY = 0.026 * h * 1.6;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.013, 14, 14), mat);
        head.position.set(0, headY, 0);
        group.add(head);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, headY, 6), mat);
        stem.position.set(0, headY / 2, 0);
        group.add(stem);
        // soft additive halo so a small pin is still easy to spot
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(0.03, 12, 12),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        halo.position.set(0, headY, 0);
        group.add(halo);
        // base dot at the surface (the actual pinpoint)
        const base = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 10), mat);
        group.add(base);
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
        group.userData.baseScale = on ? 1.5 : 1; // actual scale applied per-frame (constant screen size)
        group.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            const mt = c.material; // keep each pin's own colour; only pop the active one
            if (mt instanceof THREE.MeshStandardMaterial) mt.emissiveIntensity = on ? 1.7 : 0.9;
            else if (mt instanceof THREE.MeshBasicMaterial) mt.opacity = on ? 0.42 : 0.2; // halo
          }
        });
      }
      // point the data pulse at the active guess (rings + glow home in on it)
      const s = useGlobeStore.getState();
      const am = activeId != null ? s.markers.find((m) => m.id === activeId) : null;
      if (am) {
        const [tx, ty, tz] = latLongToVector3(am.lat, am.lng, 1);
        const v = new THREE.Vector3(tx, ty, tz).normalize();
        for (const m of pointMats) { m.uniforms.uTarget.value.copy(v); m.uniforms.uActive.value = 1; }
      } else {
        for (const m of pointMats) m.uniforms.uActive.value = 0;
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
    buildLabels(useGlobeStore.getState().labels);
    applyFocus();

    // react to store changes without remounting
    let prevMarkers = useGlobeStore.getState().markers;
    let prevArcs = useGlobeStore.getState().arcs;
    let prevActive = useGlobeStore.getState().activeId;
    let prevFocus = useGlobeStore.getState().focusIndex;
    let prevLabels = useGlobeStore.getState().labels;
    const unsub = useGlobeStore.subscribe((s) => {
      if (s.markers !== prevMarkers || s.arcs !== prevArcs) {
        prevMarkers = s.markers; prevArcs = s.arcs;
        buildContent(s.markers, s.arcs);
      }
      if (s.labels !== prevLabels) { prevLabels = s.labels; buildLabels(s.labels); }
      if (s.activeId !== prevActive) { prevActive = s.activeId; applyActive(s.activeId); }
      if (s.focusIndex !== prevFocus) { prevFocus = s.focusIndex; applyFocus(); }
    });

    // ---- interaction ----
    let isDragging = false, moved = false;
    let prev = { x: 0, y: 0 };
    let hoveredId: string | null = null;
    let downId: string | null = null;
    let frame = 0, raf = 0;
    let viewOffX = 0; // smoothed horizontal view-offset so the globe centers in the visible gap
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

    // Reused per-frame scratch for the label pass (avoid per-frame allocations).
    const _camDir = new THREE.Vector3();
    const _world = new THREE.Vector3();
    const _n = new THREE.Vector3();
    const labelCand: { l: LabelEl; sx: number; sy: number; op: number; rank: number }[] = [];
    const labelShown: { sx: number; sy: number }[] = [];

    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (document.hidden) return;
      frame++;
      const t = clock.getElapsedTime();
      const dt = clock.getDelta();
      stars.rotation.y += 0.0002;
      stars.update(t);
      shooting.update(dt);

      // Centre the globe in the visible gap between side panels (not the full screen).
      {
        const st = useGlobeStore.getState();
        const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
        const target = (st.panRight - st.panLeft) / 2; // +x shifts content left (toward an open left area)
        viewOffX += (target - viewOffX) * 0.12;
        if (Math.abs(viewOffX) > 0.5) camera.setViewOffset(w, h, viewOffX, 0, w, h);
        else camera.clearViewOffset();
      }

      if (flyTarget.active) {
        spinGroup.rotation.y += (flyTarget.rotY - spinGroup.rotation.y) * 0.16;
        spinGroup.rotation.x += (flyTarget.rotX - spinGroup.rotation.x) * 0.16;
      } else if (!isDragging && hoveredId === null) {
        spinGroup.rotation.y += 0.0009;
      }
      const prevZ = camera.position.z;
      camera.position.z += (targetZ - camera.position.z) * 0.22; // snappy, google-maps-style zoom

      // Keep markers a constant on-screen size (scale with distance, not perspective).
      const pinScale = camera.position.z / ZOOM_OUT;
      for (const g of pinById.values()) g.scale.setScalar((g.userData.baseScale ?? 1) * pinScale);

      // Drive the dot reconfigure: zoom level + how fast we're zooming.
      const zoom = zoomLevel(camera.position.z);
      const vel = Math.min(1, Math.abs(camera.position.z - prevZ) * 16);
      for (const m of pointMats) {
        const u = m.uniforms;
        u.uZoom.value += (zoom - u.uZoom.value) * 0.18;
        u.uZoomVel.value = Math.max(vel, u.uZoomVel.value * 0.9);
        u.uTime.value = t;
      }
      densePoints.visible = baseMat.uniforms.uZoom.value > 0.32; // density LOD: off at rest, on only when zoomed in
      wireMat.opacity = 0.6 * Math.max(0, 1 - baseMat.uniforms.uZoom.value * 1.2); // triangles fade with zoom
      wireMesh.visible = wireMat.opacity > 0.02; // and fully off up close

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

      // Project + fade place labels, then declutter so they never pile up
      // (map-style LOD: higher-priority names win; more reveal as you zoom and
      // the places spread apart on screen).
      if (labelEls.length) {
        const lw = renderer.domElement.clientWidth, lh = renderer.domElement.clientHeight;
        _camDir.copy(camera.position).normalize();
        labelCand.length = 0;
        for (const l of labelEls) {
          _world.copy(l.pos).applyMatrix4(spinGroup.matrixWorld);
          const facing = _n.copy(_world).normalize().dot(_camDir);        // >0 = front of globe
          const zoomShow = Math.max(0, Math.min(1, (zoom - (0.05 + l.rank * 0.6)) * 6)); // main places early, landmarks on zoom
          const occ = Math.max(0, Math.min(1, (facing - 0.12) * 5));
          const op = zoomShow * occ;
          if (op < 0.02) { if (l.el.style.opacity !== "0") l.el.style.opacity = "0"; continue; }
          _world.project(camera);
          labelCand.push({ l, sx: (_world.x * 0.5 + 0.5) * lw, sy: (-_world.y * 0.5 + 0.5) * lh, op, rank: l.rank });
        }
        labelCand.sort((a, b) => a.rank - b.rank || b.op - a.op);        // priority: important first
        labelShown.length = 0;
        for (const c of labelCand) {
          let clash = false;
          for (const s of labelShown) { if (Math.abs(c.sx - s.sx) < 78 && Math.abs(c.sy - s.sy) < 20) { clash = true; break; } }
          if (clash) { c.l.el.style.opacity = "0"; continue; }
          labelShown.push({ sx: c.sx, sy: c.sy });
          c.l.el.style.transform = `translate(${c.sx.toFixed(1)}px,${c.sy.toFixed(1)}px) translate(8px,-50%)`;
          c.l.el.style.opacity = c.op.toFixed(2);
        }
      }
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
    const onWheel = (e: WheelEvent) => { e.preventDefault(); targetZ = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, targetZ + e.deltaY * 0.004)); flyTarget.active = false; };

    const el = renderer.domElement;
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setPixelRatio(pixelRatioFor(w, h));
      renderer.setSize(w, h);
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
      for (const l of labelEls) l.el.remove();
      if (mount.contains(labelLayer)) mount.removeChild(labelLayer);
      if (mount.contains(el)) mount.removeChild(el);
      // Free GPU resources so cross-route-group navigation doesn't leak contexts.
      scene.traverse((o) => {
        const m = o as THREE.Mesh | THREE.Points;
        if ((m as THREE.Mesh).geometry) (m as THREE.Mesh).geometry.dispose();
        const mat = (m as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      [starSprite, otherMap, colorMap, elevMap, alphaMap].forEach((t) => t.dispose());
      renderer.forceContextLoss();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}
