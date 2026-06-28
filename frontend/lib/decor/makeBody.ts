import * as THREE from "three";

/** Procedural decor shapes, ported from the gacha prototype's `makeBody`. */
export const BODY_TYPES = [
  "planet",
  "asteroid",
  "crystal",
  "cube",
  "diamond",
  "dodeca",
  "tetra",
  "ring",
  "knot",
  "star",
  "ringplanet",
] as const;

export type BodyType = (typeof BODY_TYPES)[number];

function starGeo(r: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * 6.2832 - 1.5708;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, {
    depth: r * 0.4,
    bevelEnabled: true,
    bevelThickness: r * 0.07,
    bevelSize: r * 0.07,
    bevelSegments: 1,
  });
}

/** Build a decor body of `type` at base radius `r`, using `material`. */
export function makeBody(type: BodyType, r: number, material: THREE.Material): THREE.Object3D {
  let g: THREE.BufferGeometry;
  switch (type) {
    case "planet":
      g = new THREE.SphereGeometry(r, 24, 16);
      break;
    case "crystal":
      g = new THREE.OctahedronGeometry(r, 0);
      break;
    case "cube":
      g = new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6);
      break;
    case "diamond":
      g = new THREE.OctahedronGeometry(r, 0);
      g.scale(0.7, 1.5, 0.7);
      break;
    case "dodeca":
      g = new THREE.DodecahedronGeometry(r, 0);
      break;
    case "tetra":
      g = new THREE.TetrahedronGeometry(r, 0);
      break;
    case "ring":
      g = new THREE.TorusGeometry(r, r * 0.32, 10, 28);
      break;
    case "knot":
      g = new THREE.TorusKnotGeometry(r * 0.7, r * 0.26, 64, 8);
      break;
    case "star":
      g = starGeo(r);
      break;
    case "ringplanet": {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), material));
      const rg = new THREE.Mesh(new THREE.TorusGeometry(r * 2.0, r * 0.14, 8, 40), material);
      rg.rotation.x = 1.2;
      grp.add(rg);
      return grp;
    }
    default:
      g = new THREE.IcosahedronGeometry(r, 0); // asteroid
      break;
  }
  return new THREE.Mesh(g, material);
}
