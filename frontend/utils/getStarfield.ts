import * as THREE from "three";

export default function getStarfield({
  numStars = 500,
  sprite,
}: {
  numStars?: number;
  sprite?: THREE.Texture;
}) {
  function randomSpherePoint() {
    const radius = Math.random() * 25 + 25;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    let x = radius * Math.sin(phi) * Math.cos(theta);
    let y = radius * Math.sin(phi) * Math.sin(theta);
    let z = radius * Math.cos(phi);

    return {
      pos: new THREE.Vector3(x, y, z),
      hue: 0.6, // radius * 0.02 + 0.5
      minDist: radius,
    };
  }
  const verts: { pos: THREE.Vector3; hue: number; minDist: number }[] = [];
  for (let i = 0; i < numStars; i++) {
    verts.push(randomSpherePoint());
  }

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(verts.length * 3);
  for (let i = 0; i < verts.length; i++) {
    positions[i * 3] = verts[i].pos.x;
    positions[i * 3 + 1] = verts[i].pos.y;
    positions[i * 3 + 2] = verts[i].pos.z;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 0.2,
    map: sprite,
    transparent: true,
    alphaTest: 0.5,
    color: 0xffffff,
  });

  return new THREE.Points(geometry, material);
}
