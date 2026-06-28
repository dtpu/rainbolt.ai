"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { createHatchMaterial } from "@/lib/decor/hatchMaterial";
import { makeBody, BODY_TYPES, type BodyType } from "@/lib/decor/makeBody";
import type { DecorItem } from "@/lib/decor/layouts";
import { SketchFilter } from "./SketchFilter";

interface DecorLayerProps {
  items: DecorItem[];
  /** When set, an in-app editor (URL `?decor`) persists edits under this key. */
  storageKey?: string;
}

const MODELS = [
  { label: "model: ufo", url: "/models/ufo.glb" },
  { label: "model: rocket", url: "/models/rocket.glb" },
  { label: "model: sun", url: "/models/sun.glb" },
  { label: "model: reward", url: "/models/reward.glb" },
];

interface Holder {
  item: DecorItem;
  group: THREE.Group;
  spinObj?: THREE.Object3D;
  baseY: number;
  phase: number;
  born?: number;
}

/**
 * A transparent WebGL overlay that renders hand-drawn (manga-hatch) decorative
 * props framing the globe. Its own scene/canvas, so the hatch shader + SVG
 * wobble apply only to the decor. Props sit still and animate in place.
 *
 * Add `?decor` to the URL to drag props around, scroll to resize, add/remove
 * shapes, and copy the layout back into `lib/decor/layouts.ts`.
 */
export function DecorLayer({ items, storageKey }: DecorLayerProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addType, setAddType] = useState<string>("planet");
  const [, forceTick] = useState(0);

  // Imperative handles the React toolbar calls into.
  const api = useRef<{
    addItem: (spec: string) => void;
    deleteSelected: () => void;
    copyLayout: () => void;
    resetLayout: () => void;
  } | null>(null);

  useEffect(() => {
    const isEdit =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("decor") &&
      !!storageKey;
    setEditing(isEdit);

    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio, 2);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "default" });
    renderer.setSize(w, h);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText =
      "width:100%;height:100%;display:block;filter:url(#decor-sketch)";
    mount.appendChild(renderer.domElement);

    const material = createHatchMaterial(dpr, 0.82);
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder); // models are meshopt-compressed

    // Working set of items: from localStorage in edit mode, else the props.
    let working: DecorItem[] = items.map((it) => ({ ...it }));
    if (isEdit && storageKey) {
      try {
        const saved = localStorage.getItem(`decor-layout-${storageKey}`);
        if (saved) working = JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }

    const holders: Holder[] = [];

    const selectBox = new THREE.BoxHelper(new THREE.Object3D(), 0xe8b44f);
    selectBox.visible = false;
    scene.add(selectBox);
    let selected: Holder | null = null;

    const buildOne = (item: DecorItem, i: number) => {
      const group = new THREE.Group();
      group.position.set(...item.position);
      if (item.rotation) group.rotation.set(...item.rotation);
      group.scale.setScalar(item.scale);
      scene.add(group);

      const holder: Holder = { item, group, baseY: item.position[1], phase: i * 1.7 };
      holders.push(holder);

      if (item.model) {
        loader.load(
          item.model,
          (gltf) => {
            gltf.scene.traverse((o) => {
              if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = material;
            });
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const ctr = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const norm = 1 / (Math.max(size.x, size.y, size.z) || 1);
            gltf.scene.position.sub(ctr);
            gltf.scene.scale.setScalar(norm);
            const spinObj = new THREE.Group();
            spinObj.add(gltf.scene);
            group.add(spinObj);
            holder.spinObj = spinObj;
          },
          undefined,
          () => { const m = makeBody("asteroid", 1, material); group.add(m); holder.spinObj = m; },
        );
      } else {
        const m = makeBody((item.shape ?? "asteroid") as BodyType, 1, material);
        group.add(m);
        holder.spinObj = m;
      }
    };

    working.forEach(buildOne);

    const persist = () => {
      if (!storageKey) return;
      try {
        localStorage.setItem(`decor-layout-${storageKey}`, JSON.stringify(working));
      } catch {
        /* ignore */
      }
    };

    const select = (holder: Holder | null) => {
      selected = holder;
      if (holder) {
        selectBox.setFromObject(holder.group);
        selectBox.visible = true;
      } else {
        selectBox.visible = false;
      }
      setSelectedId(holder?.item.id ?? null);
    };

    // ---- editor interactions ----
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const plane = new THREE.Plane();
    const dragOffset = new THREE.Vector3();
    const hit = new THREE.Vector3();
    let dragging = false;

    const setPointer = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * -2 + 1);
    };
    const pickHolder = (): Holder | null => {
      raycaster.setFromCamera(pointer, camera);
      for (const hld of holders) {
        if (!hld.spinObj) continue;
        if (raycaster.intersectObject(hld.spinObj, true).length) return hld;
      }
      return null;
    };

    const onDown = (e: PointerEvent) => {
      if (!isEdit) return;
      setPointer(e);
      const hld = pickHolder();
      select(hld);
      if (hld) {
        dragging = true;
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), hld.group.position);
        raycaster.setFromCamera(pointer, camera);
        raycaster.ray.intersectPlane(plane, hit);
        dragOffset.copy(hit).sub(hld.group.position);
        renderer.domElement.setPointerCapture(e.pointerId);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!isEdit || !dragging || !selected) return;
      setPointer(e);
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        const x = hit.x - dragOffset.x;
        const y = hit.y - dragOffset.y;
        selected.group.position.x = x;
        selected.group.position.y = y;
        selected.baseY = y;
        selected.item.position = [x, y, selected.item.position[2]];
        selectBox.setFromObject(selected.group);
      }
    };
    const onUp = () => {
      if (dragging) { dragging = false; persist(); }
    };
    const onWheel = (e: WheelEvent) => {
      if (!isEdit || !selected) return;
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0012);
      const s = Math.max(0.05, Math.min(3, selected.item.scale * f));
      selected.item.scale = +s.toFixed(3);
      selectBox.setFromObject(selected.group);
      persist();
      forceTick((n) => n + 1);
    };

    const onKey = (e: KeyboardEvent) => {
      if (!isEdit || !selected) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
      const step = 0.15;
      const r = selected.group.rotation;
      let handled = true;
      switch (e.key) {
        case "ArrowLeft": r.y -= step; break;
        case "ArrowRight": r.y += step; break;
        case "ArrowUp": r.x -= step; break;
        case "ArrowDown": r.x += step; break;
        case "[": r.z -= step; break;
        case "]": r.z += step; break;
        case "Delete":
        case "Backspace": api.current?.deleteSelected(); e.preventDefault(); return;
        default: handled = false;
      }
      if (handled) {
        e.preventDefault();
        selected.item.rotation = [+r.x.toFixed(3), +r.y.toFixed(3), +r.z.toFixed(3)];
        selectBox.setFromObject(selected.group);
        persist();
      }
    };

    if (isEdit) {
      const el = renderer.domElement;
      el.style.pointerEvents = "auto";
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      el.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("keydown", onKey);
    }

    // ---- imperative API for the toolbar ----
    api.current = {
      addItem: (spec) => {
        const id = `${spec}-${Math.round(performance.now()) % 100000}`;
        const model = MODELS.find((m) => m.label === spec)?.url;
        const item: DecorItem = model
          ? { id, model, position: [0, 0, 0], scale: 0.4 }
          : { id, shape: spec as BodyType, position: [0, 0, 0], scale: 0.4 };
        working.push(item);
        buildOne(item, holders.length);
        persist();
        select(holders[holders.length - 1]);
      },
      deleteSelected: () => {
        if (!selected) return;
        const idx = holders.indexOf(selected);
        scene.remove(selected.group);
        holders.splice(idx, 1);
        working = working.filter((it) => it.id !== selected!.item.id);
        select(null);
        persist();
      },
      copyLayout: () => {
        const lines = working.map((it) => {
          const parts: string[] = [`id: ${JSON.stringify(it.id)}`];
          if (it.shape) parts.push(`shape: ${JSON.stringify(it.shape)}`);
          if (it.model) parts.push(`model: ${JSON.stringify(it.model)}`);
          parts.push(`position: [${it.position.map((n) => +n.toFixed(2)).join(", ")}]`);
          parts.push(`scale: ${it.scale}`);
          if (it.rotation) parts.push(`rotation: [${it.rotation.map((n) => +n.toFixed(2)).join(", ")}]`);
          if (it.spin != null) parts.push(`spin: ${it.spin}`);
          if (it.bob != null) parts.push(`bob: ${it.bob}`);
          return `  { ${parts.join(", ")} },`;
        });
        const text = `[\n${lines.join("\n")}\n]`;
        navigator.clipboard?.writeText(text).catch(() => {});
        console.log("[decor] layout:\n" + text);
      },
      resetLayout: () => {
        if (storageKey) localStorage.removeItem(`decor-layout-${storageKey}`);
        window.location.reload();
      },
    };

    const clock = new THREE.Clock();
    const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (document.hidden) return; // don't burn cycles on a hidden tab
      const t = clock.getElapsedTime();
      material.userData.update(t);
      for (const hld of holders) {
        // Props (incl. async-loaded models) scale in from nothing once ready.
        if (hld.spinObj && hld.born === undefined) hld.born = t;
        const k = hld.born === undefined ? 0 : Math.min(1, (t - hld.born) / 0.45);
        hld.group.scale.setScalar(hld.item.scale * easeOut(k));
        hld.group.position.y = hld.baseY + Math.sin(t * 0.6 + hld.phase) * (hld.item.bob ?? 0.05);
        if (hld.spinObj) {
          hld.spinObj.rotation.y = t * (hld.item.spin ?? 0.15);
          hld.spinObj.rotation.x = Math.sin(t * 0.25 + hld.phase) * 0.2;
        }
      }
      if (selected) selectBox.setFromObject(selected.group);
      renderer.render(scene, camera);
    };
    animate();

    const noise = document.getElementById("decor-sketch-noise");
    const reseed = window.setInterval(() => {
      noise?.setAttribute("seed", String(1 + Math.floor(Math.random() * 90)));
    }, 110);

    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth || 1;
      const nh = mount.clientHeight || 1;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(reseed);
      ro.disconnect();
      if (isEdit) {
        const el = renderer.domElement;
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        el.removeEventListener("wheel", onWheel);
        window.removeEventListener("keydown", onKey);
      }
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  return (
    <>
      <SketchFilter />
      <div ref={mountRef} className="pointer-events-none absolute inset-0 z-[5]" />

      {editing && (
        <div className="pointer-events-auto fixed bottom-5 left-1/2 z-[300] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/[0.1] bg-space-900/95 px-3 py-2 text-xs text-fg shadow-2xl backdrop-blur-md">
          <span className="font-semibold">Decor</span>
          <span className="text-fg-muted/60">
            {selectedId ? "drag · scroll size · arrows + [ ] rotate · ⌫ delete" : "click a prop to select"}
          </span>
          <span className="mx-1 h-4 w-px bg-white/10" />
          <select
            value={addType}
            onChange={(e) => setAddType(e.target.value)}
            className="rounded-md border border-white/10 bg-space-800 px-2 py-1 text-fg outline-none"
          >
            {BODY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
            {MODELS.map((m) => (
              <option key={m.url} value={m.label}>{m.label}</option>
            ))}
          </select>
          <button onClick={() => api.current?.addItem(addType)} className="rounded-md bg-white/[0.08] px-2.5 py-1 font-medium hover:bg-white/[0.14]">
            + Add
          </button>
          <button
            onClick={() => api.current?.deleteSelected()}
            disabled={!selectedId}
            className="rounded-md bg-white/[0.08] px-2.5 py-1 font-medium hover:bg-white/[0.14] disabled:opacity-30"
          >
            Delete
          </button>
          <button onClick={() => api.current?.copyLayout()} className="rounded-md bg-star-400 px-2.5 py-1 font-semibold text-space-950 hover:bg-star-300">
            Copy
          </button>
          <button onClick={() => api.current?.resetLayout()} className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">
            Reset
          </button>
        </div>
      )}
    </>
  );
}
