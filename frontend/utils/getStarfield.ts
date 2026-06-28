import * as THREE from "three";

/**
 * A depth-layered starfield that gently twinkles. Stars get a random size,
 * a slight colour tint (mostly white, a few ice-blue and warm-gold), and a
 * per-star phase so they shimmer independently. The returned object exposes
 * `update(t)` — call it each frame with elapsed seconds to animate the twinkle.
 */
export default function getStarfield({
  numStars = 1500,
}: {
  numStars?: number;
  sprite?: THREE.Texture; // accepted for backwards-compat, no longer used
} = {}) {
  const positions = new Float32Array(numStars * 3);
  const sizes = new Float32Array(numStars);
  const phases = new Float32Array(numStars);
  const tints = new Float32Array(numStars * 3);

  const cIce = new THREE.Color("#b5d4ea");
  const cGold = new THREE.Color("#f2cc8f");
  const cWhite = new THREE.Color("#ffffff");

  for (let i = 0; i < numStars; i++) {
    const radius = Math.random() * 28 + 22;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    // Mostly tiny stars, a rare few slightly larger. Kept small so the field
    // reads as quiet depth rather than a distracting sparkle.
    const r = Math.random();
    sizes[i] = r > 0.98 ? 1.9 : r > 0.88 ? 1.3 : 0.8;
    phases[i] = Math.random() * Math.PI * 2;

    // 80% white, 12% ice, 8% gold.
    const t = Math.random();
    const col = t > 0.92 ? cGold : t > 0.8 ? cIce : cWhite;
    tints[i * 3] = col.r;
    tints[i * 3 + 1] = col.g;
    tints[i * 3 + 2] = col.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aTint", new THREE.BufferAttribute(tints, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: {
        value: Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2),
      },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3  aTint;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3  vTint;
      varying float vTwinkle;
      void main() {
        vTint = aTint;
        // Gentle, slow shimmer — narrow range so stars stay calm.
        vTwinkle = 0.55 + 0.2 * sin(uTime * 0.9 + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z) * (0.85 + 0.25 * vTwinkle);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3  vTint;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        // Lower overall opacity so the field recedes into the background.
        float alpha = smoothstep(0.5, 0.0, d) * vTwinkle * 0.5;
        gl_FragColor = vec4(vTint, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = Object.assign(new THREE.Points(geometry, material), {
    update: (t: number) => {
      material.uniforms.uTime.value = t;
    },
  });
  return points;
}
