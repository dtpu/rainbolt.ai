import * as THREE from "three";

interface ConstellationsOptions {
  count?: number;
  radius?: number;
}

/**
 * Faint constellation figures: small clusters of stars joined by hairlines,
 * scattered on a far shell. Ambient filler that echoes the app's constellation
 * theme without adding solid objects. Call update(t) per frame for a slow
 * drift + gentle per-figure breathing.
 */
export default function getConstellations({ count = 8, radius = 30 }: ConstellationsOptions = {}) {
  const group = new THREE.Group();
  const figures: { lines: THREE.LineBasicMaterial; points: THREE.PointsMaterial; phase: number }[] = [];

  for (let i = 0; i < count; i++) {
    // Random direction on the shell, with a local tangent frame to lay the figure in.
    const dir = new THREE.Vector3().randomDirection();
    const center = dir.clone().multiplyScalar(radius);
    const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const t1 = new THREE.Vector3().crossVectors(dir, up).normalize();
    const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize();

    // 4-7 stars forming a meandering figure.
    const n = 4 + Math.floor(Math.random() * 4);
    const spread = radius * 0.10;
    const stars: THREE.Vector3[] = [];
    let x = (Math.random() - 0.5) * spread, y = (Math.random() - 0.5) * spread;
    for (let s = 0; s < n; s++) {
      stars.push(center.clone().addScaledVector(t1, x).addScaledVector(t2, y));
      const ang = Math.random() * Math.PI * 2;
      const step = spread * (0.35 + Math.random() * 0.45);
      x += Math.cos(ang) * step;
      y += Math.sin(ang) * step;
    }

    // Hairline path joining the stars (plus an occasional branch).
    const linePts: THREE.Vector3[] = [];
    for (let s = 0; s < n - 1; s++) linePts.push(stars[s], stars[s + 1]);
    if (n > 4 && Math.random() < 0.5) linePts.push(stars[1], stars[n - 1]);

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x8fb8d8, transparent: true, opacity: 0.10, depthWrite: false,
    });
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts), lineMat));

    const pointMat = new THREE.PointsMaterial({
      color: 0xdfe9f5, size: 0.2, transparent: true, opacity: 0.65,
      sizeAttenuation: true, depthWrite: false,
    });
    group.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(stars), pointMat));

    figures.push({ lines: lineMat, points: pointMat, phase: Math.random() * Math.PI * 2 });
  }

  const update = (t: number) => {
    group.rotation.y = t * 0.004; // barely-there drift
    for (const f of figures) {
      const breathe = 0.5 + 0.5 * Math.sin(t * 0.35 + f.phase);
      f.lines.opacity = 0.09 + breathe * 0.12;
      f.points.opacity = 0.5 + breathe * 0.35;
    }
  };

  return Object.assign(group, { update });
}
