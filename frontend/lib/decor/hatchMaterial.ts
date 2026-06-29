import * as THREE from "three";

/**
 * The manga / hand-drawn "hatch" material, ported from the UWDSC gacha
 * prototype's `bodyMat`. It's a screen-space pencil look: shading is quantised
 * into ink/paper bands sampled from a chaotic hatch sheet, with a per-frame
 * "boil" (the sheet is re-offset + rotated each frame so strokes are genuinely
 * redrawn), plus a faint paper grain. One material is shared across every decor
 * prop. Call `material.userData.update(t)` each frame to drive the boil.
 */

let hatchTex: THREE.Texture | null = null;
let paperTex: THREE.Texture | null = null;

export function loadHatchTextures() {
  const tl = new THREE.TextureLoader();
  if (!hatchTex) {
    hatchTex = tl.load("/decor/hatch.webp");
    hatchTex.colorSpace = THREE.NoColorSpace;
    hatchTex.wrapS = hatchTex.wrapT = THREE.RepeatWrapping;
  }
  if (!paperTex) {
    paperTex = tl.load("/decor/paper.webp");
    paperTex.colorSpace = THREE.SRGBColorSpace;
    paperTex.wrapS = paperTex.wrapT = THREE.RepeatWrapping;
  }
  return { hatchTex, paperTex };
}

export function createHatchMaterial(dpr: number) {
  const { hatchTex, paperTex } = loadHatchTextures();
  const L1 = new THREE.Vector3(0.5, 0.85, 0.7).normalize();

  // Opaque + depth-writing so props are solid and near surfaces correctly
  // occlude far ones (e.g. a planet hides the back of its own ring).
  const material = new THREE.ShaderMaterial({
    uniforms: {
      hatchTex: { value: hatchTex },
      paperTex: { value: paperTex },
      uL1: { value: L1 },
      uTime: { value: 0 },
      uHscale: { value: 300.0 * dpr },
    },
    vertexShader: `
      varying vec3 vN;
      void main(){
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      precision highp float;
      uniform sampler2D hatchTex, paperTex;
      uniform vec3  uL1;
      uniform float uTime, uHscale;
      varying vec3  vN;
      void main(){
        vec3 N = normalize(vN);
        float ndl = max(dot(N, normalize(uL1)), 0.0);
        float shade = clamp(ndl * 0.85 + 0.18, 0.0, 1.0);
        float t = 1.0 - shade;
        // BOIL: each frame samples a different region + rotation of the sheet.
        float fr = floor(uTime * 8.0);
        float ja = fr * 1.7;
        mat2 R = mat2(cos(ja), -sin(ja), sin(ja), cos(ja));
        vec2 off = vec2(fract(sin(fr * 91.7) * 4373.0), fract(sin(fr * 47.3) * 7919.0)) * 1200.0;
        vec3 hx = texture2D(hatchTex, (R * gl_FragCoord.xy + off) / uHscale).rgb;
        float i0 = smoothstep(0.20, 0.50, t), i1 = smoothstep(0.42, 0.74, t), i2 = smoothstep(0.66, 1.0, t);
        float m0 = mix(1.0, hx.r, i0);
        float m1 = m0 * mix(1.0, hx.g, i1);
        float m2 = m1 * mix(1.0, hx.b, i2);
        vec3 paper = vec3(0.93) * mix(vec3(1.0), texture2D(paperTex, gl_FragCoord.xy / 620.0).rgb, 0.12);
        gl_FragColor = vec4(mix(vec3(0.04), paper, clamp(m2, 0.0, 1.0)), 1.0);
      }`,
  });

  material.userData.update = (t: number) => {
    material.uniforms.uTime.value = t;
  };
  return material;
}
