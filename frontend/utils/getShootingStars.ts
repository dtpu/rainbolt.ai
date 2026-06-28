import * as THREE from "three";

/**
 * A small pool of occasional shooting stars — thin additive streaks that drift
 * across the far sky and fade. Kept rare and subtle on purpose. Call
 * `update(dt)` each frame with the delta time in seconds.
 */
export default function getShootingStars({
  count = 2,
}: { count?: number } = {}) {
  const TRAIL = 18;
  const group = new THREE.Group();

  interface Streak {
    line: THREE.Line;
    geo: THREE.BufferGeometry;
    active: boolean;
    t: number;
    dur: number;
    cooldown: number;
    head: THREE.Vector3;
    dir: THREE.Vector3;
    len: number;
    tint: THREE.Color;
  }

  const ICE = new THREE.Color("#cfe3f2");
  const GOLD = new THREE.Color("#f2cc8f");
  const streaks: Streak[] = [];

  for (let i = 0; i < count; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.visible = false;
    group.add(line);
    streaks.push({
      line,
      geo,
      active: false,
      t: 0,
      dur: 0,
      cooldown: 2 + i * 3 + Math.random() * 4,
      head: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      len: 0,
      tint: ICE,
    });
  }

  const spawn = (s: Streak) => {
    s.active = true;
    s.t = 0;
    s.dur = 0.9 + Math.random() * 0.8;
    // Start in the upper sky, behind/around the globe.
    s.head.set(
      (Math.random() * 2 - 1) * 14,
      6 + Math.random() * 7,
      -4 - Math.random() * 8,
    );
    // Travel mostly down and across the screen.
    s.dir
      .set((Math.random() * 2 - 1) * 0.8, -(0.6 + Math.random() * 0.5), 0)
      .normalize();
    s.len = 16 + Math.random() * 10;
    s.tint = Math.random() > 0.8 ? GOLD : ICE;
    s.line.visible = true;
  };

  const tmp = new THREE.Vector3();
  const update = (dt: number) => {
    for (const s of streaks) {
      if (!s.active) {
        s.cooldown -= dt;
        if (s.cooldown <= 0) spawn(s);
        continue;
      }
      s.t += dt;
      const k = s.t / s.dur;
      if (k >= 1) {
        s.active = false;
        s.line.visible = false;
        s.cooldown = 4 + Math.random() * 8;
        continue;
      }

      const headPos = tmp.copy(s.head).addScaledVector(s.dir, s.len * k);
      const pos = s.geo.attributes.position.array as Float32Array;
      const col = s.geo.attributes.color.array as Float32Array;
      const trailLen = s.len * 0.16;
      // Fade the whole streak in then out over its life.
      const lifeFade = Math.sin(Math.min(Math.max(k, 0), 1) * Math.PI);

      for (let j = 0; j < TRAIL; j++) {
        const f = j / (TRAIL - 1); // 0 = head, 1 = tail
        const px = headPos.x - s.dir.x * trailLen * f;
        const py = headPos.y - s.dir.y * trailLen * f;
        const pz = headPos.z - s.dir.z * trailLen * f;
        pos[j * 3] = px;
        pos[j * 3 + 1] = py;
        pos[j * 3 + 2] = pz;
        const b = (1 - f) * lifeFade;
        col[j * 3] = s.tint.r * b;
        col[j * 3 + 1] = s.tint.g * b;
        col[j * 3 + 2] = s.tint.b * b;
      }
      s.geo.attributes.position.needsUpdate = true;
      s.geo.attributes.color.needsUpdate = true;
    }
  };

  return Object.assign(group, { update });
}
