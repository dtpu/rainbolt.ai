import * as THREE from "three";

/**
 * A soft fresnel "atmosphere" shell rendered just outside the globe. Drawn on
 * the back side with additive blending so it reads as a rim of glowing air —
 * the single biggest upgrade to making a Three.js planet look alive.
 */
export default function getAtmosphere({
  color = "#6b9cc4",
  size = 1.16,
  intensity = 1.0,
  power = 3.2,
}: {
  color?: string;
  size?: number;
  intensity?: number;
  power?: number;
} = {}) {
  const geometry = new THREE.SphereGeometry(size, 64, 64);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uPower: { value: power },
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vNormal;
      uniform vec3  uColor;
      uniform float uIntensity;
      uniform float uPower;
      void main() {
        float rim = pow(clamp(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), uPower);
        gl_FragColor = vec4(uColor, 1.0) * rim * uIntensity;
      }`,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  return new THREE.Mesh(geometry, material);
}
