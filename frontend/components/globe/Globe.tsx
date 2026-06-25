"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import getStarfield from "../../utils/getStarfield";
import { latLongToVector3 } from "../../utils/coordinates";

interface Location {
  lat: number;
  long: number;
  label?: string;
  color?: string;
}

interface EarthSceneProps {
  markers?: Location[];
  currentSection?: number;
  onWaterlooScreenPosition?: (position: { x: number; y: number }) => void;
}

export default function EarthScene({
  markers = [],
  currentSection = 0,
  onWaterlooScreenPosition,
}: EarthSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const targetPosition = useRef(new THREE.Vector3(7, 0, 4));
  const targetLookAt = useRef(new THREE.Vector3(-7.7, 0, 0));
  const currentSectionRef = useRef(currentSection);
  const targetRotationY = useRef(0);
  const targetRotationX = useRef(0);
  const targetRotationZ = useRef(0);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const connectionLineRef = useRef<THREE.Line | null>(null);
  const waterlooScreenPos = useRef({ x: 0, y: 0 });
  const waterlooLabelRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef(new THREE.Vector2());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const defaultMarkers = [
    { lat: 43.4643, long: -80.5204, label: "Waterloo, Ontario" },
  ];

  useEffect(() => {
    if (rendererRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      rendererRef.current.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    }

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(7, 0, 4);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Cap pixel ratio: on retina/HiDPI screens an uncapped ratio (2+) renders the
    // full-screen globe at 4x+ the pixels, which is the main source of lag. 1.5 is
    // visually near-identical but far cheaper.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    rendererRef.current = renderer;

    if (mountRef.current) {
      const existingCanvas = mountRef.current.querySelector("canvas");
      if (existingCanvas) {
        mountRef.current.removeChild(existingCanvas);
      }
      mountRef.current.appendChild(renderer.domElement);
    }

    const orbitCtrl = new OrbitControls(camera, renderer.domElement);
    orbitCtrl.enableDamping = true;
    orbitCtrl.target.set(-7.7, 0, 0);

    orbitCtrl.enableZoom = false;
    orbitCtrl.minDistance = 4;
    orbitCtrl.maxDistance = 4;

    const raycaster = new THREE.Raycaster();
    const pointerPos = new THREE.Vector2();
    const globeUV = new THREE.Vector2();

    const emojiRaycaster = new THREE.Raycaster();
    const targetPoint = new THREE.Vector3();

    // Reused temps for the per-frame streak-particle animation, so the render
    // loop doesn't allocate a new Vector3 for every streak + tail segment each
    // frame (pure GC optimization; positions are identical).
    const streakBasePos = new THREE.Vector3();
    const streakTrailPos = new THREE.Vector3();

    let emojiModel: THREE.Group | null = null;
    let emojiHead: THREE.Object3D | null = null;

    const intersectionPoint = new THREE.Vector3();
    const planeNormal = new THREE.Vector3();
    const plane = new THREE.Plane();
    const mousePosition = new THREE.Vector2();
    const headRaycaster = new THREE.Raycaster();

    const textureLoader = new THREE.TextureLoader();
    const starSprite = textureLoader.load("/circle.png");
    const otherMap = textureLoader.load("/00_earthmap1k.jpg");
    const colorMap = textureLoader.load("/03_earthlights1k.jpg");
    const elevMap = textureLoader.load("/01_earthbump1k.jpg");
    const alphaMap = textureLoader.load("/02_earthspec1k.jpg");

    const globeGroup = new THREE.Group();
    globeGroup.position.x = -6;
    globeGroup.position.y = 0;
    globeGroup.position.z = -0.5;
    scene.add(globeGroup);

    const geo = new THREE.IcosahedronGeometry(1, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0099ff,
      wireframe: true,
      displacementMap: elevMap,
      displacementScale: 0.05,
      transparent: true,
      opacity: 0.8,
      metalness: 0.3,
      roughness: 0.7,
    });
    const globe = new THREE.Mesh(geo, mat);
    globeGroup.add(globe);

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      "/rainbolt.glb",
      (gltf) => {
        emojiModel = gltf.scene;

        emojiModel.position.set(-5.8, 0, -0.5);
        emojiModel.scale.set(0.3, 0.3, 0.3);

        // Model faces -Y in Blender; leave rotation at zero and let lookAt()
        // handle the full orientation each frame.
        emojiModel.rotation.set(0, 0, 0);

        emojiModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material) {
              child.material.transparent = false;
              child.material.opacity = 1.0;
              child.castShadow = true;
              child.receiveShadow = true;
            }
          }

          if (
            child.name.toLowerCase().includes("head") ||
            child.name.toLowerCase().includes("face") ||
            child.name.toLowerCase().includes("skull")
          ) {
            emojiHead = child;
          }
        });

        if (!emojiHead) {
          emojiHead = emojiModel;
        }

        const emojiLight = new THREE.PointLight(0xffffff, 1, 100);
        emojiLight.position.copy(emojiModel.position);
        emojiLight.position.y += 1;
        scene.add(emojiLight);

        const emojiFillLight = new THREE.PointLight(0xffffff, 15, 100);
        emojiFillLight.position.set(
          emojiModel.position.x + 2,
          emojiModel.position.y,
          emojiModel.position.z + 2,
        );
        scene.add(emojiFillLight);

        scene.add(emojiModel);
      },
      undefined,
      (error) => {
        console.error("Error loading GLB model:", error);
      },
    );

    const markerGroup = new THREE.Group();
    defaultMarkers.forEach((marker) => {
      const [x, y, z] = latLongToVector3(marker.lat, marker.long, 1.02);

      const markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: "#ff0000",
        transparent: true,
        opacity: 0.8,
      });

      const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
      markerMesh.position.set(x, y, z);

      const markerGlowGeometry = new THREE.SphereGeometry(0.03, 16, 16);
      const markerGlowMaterial = new THREE.MeshBasicMaterial({
        color: "#ff0000",
        transparent: true,
        opacity: 0.3,
      });
      const markerGlow = new THREE.Mesh(markerGlowGeometry, markerGlowMaterial);
      markerMesh.add(markerGlow);

      markerGroup.add(markerMesh);
    });
    globeGroup.add(markerGroup);

    // Connection line from the Waterloo marker to the UI badge (Team section only).
    const [waterlooX, waterlooY, waterlooZ] = latLongToVector3(
      43.4643,
      -80.5204,
      1.02,
    );
    const waterlooWorldPos = new THREE.Vector3(waterlooX, waterlooY, waterlooZ);

    const lineGeometry = new THREE.BufferGeometry();
    const linePoints = [
      waterlooWorldPos,
      new THREE.Vector3(waterlooX + 2, waterlooY + 0.5, waterlooZ + 1),
    ];
    lineGeometry.setFromPoints(linePoints);

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      linewidth: 2,
    });

    const connectionLine = new THREE.Line(lineGeometry, lineMaterial);
    connectionLine.visible = false;
    connectionLineRef.current = connectionLine;
    globeGroup.add(connectionLine);

    const waterlooLabel = document.createElement("div");
    waterlooLabel.className = "waterloo-label";
    waterlooLabel.style.cssText = `
      position: fixed;
      background: rgba(11, 17, 32, 0.75);
      color: #e6eaf2;
      padding: 20px;
      border-radius: 12px;
      font-family: inherit;
      pointer-events: none;
      display: none;
      z-index: 100;
      width: 320px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    `;
    waterlooLabel.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <img
          src="/uwaterloo-seal.svg"
          alt="University of Waterloo"
          style="width: 40px; height: 40px; display: block; flex-shrink: 0;"
        />
        <div>
          <div style="font-size: 15px; font-weight: 600; color: #e6eaf2; letter-spacing: -0.01em;">Waterloo, Ontario</div>
          <div style="font-size: 12px; color: #8e9aae; margin-top: 3px; font-variant-numeric: tabular-nums;">43.4643&deg;N &bull; 80.5204&deg;W</div>
        </div>
      </div>
      <div style="font-size: 13px; line-height: 1.6; color: #8e9aae; margin-top: 12px;">
        Home to the University of Waterloo, known for its innovation ecosystem and startup culture. The birthplace of rainbolt.ai.
      </div>
      <div style="margin-top: 16px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.08);">
        <img
          src="/uw-sign-dp-scaled.jpeg"
          alt="University of Waterloo campus"
          style="width: 100%; height: 120px; display: block; object-fit: cover;"
        />
      </div>
    `;
    waterlooLabelRef.current = waterlooLabel;
    if (mountRef.current) {
      mountRef.current.appendChild(waterlooLabel);
    }

    const glowVertexShader = `
      varying vec3 vNormal;
      varying vec3 vPositionNormal;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const glowFragmentShader = `
      varying vec3 vNormal;
      varying vec3 vPositionNormal;
      
      void main() {
        float alignment = dot(vNormal, vPositionNormal);
// Flip it so edges are bright, center is dim
float intensity = 1.0 - smoothstep(0.0, 1.0, 1.0-abs(alignment));
intensity = pow(intensity, 1.5);
        
        vec3 glowColor = vec3(0.35, 0.55, 0.78);
        vec3 glow = glowColor * intensity * 1.4;
        
        gl_FragColor = vec4(glow, intensity * 0.5);
      }
    `;

    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: glowVertexShader,
      fragmentShader: glowFragmentShader,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const glowMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.08, 32),
      glowMaterial,
    );
    globeGroup.add(glowMesh);

    const streakParticles: Array<{
      head: THREE.Mesh;
      tail: THREE.Mesh[];
      angle: number;
      speed: number;
      radius: number;
      axis: THREE.Vector3;
    }> = [];

    function createStreakParticle(
      radius: number,
      color: number,
      speed: number,
      axis: THREE.Vector3,
    ) {
      const headGeometry = new THREE.SphereGeometry(0.015, 8, 8);
      const headMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1.0,
      });
      const head = new THREE.Mesh(headGeometry, headMaterial);

      const tail: THREE.Mesh[] = [];
      const tailLength = 15;

      for (let i = 0; i < tailLength; i++) {
        const tailGeometry = new THREE.SphereGeometry(0.015 - i * 0.0003, 6, 6);
        const opacity = 1.0 - (i / tailLength) * 0.9;
        const tailMaterial = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
        });
        const tailSegment = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.push(tailSegment);
        globeGroup.add(tailSegment);
      }

      globeGroup.add(head);

      return {
        head,
        tail,
        angle: Math.random() * Math.PI * 2,
        speed,
        radius,
        axis,
      };
    }

    streakParticles.push(
      createStreakParticle(1.3, 0xffffff, 0.02, new THREE.Vector3(0, 1, 0)),
      createStreakParticle(
        1.4,
        0xccddff,
        0.015,
        new THREE.Vector3(1, 0.5, 0).normalize(),
      ),
      createStreakParticle(
        1.5,
        0xffccdd,
        0.018,
        new THREE.Vector3(0.5, 0, 1).normalize(),
      ),
      createStreakParticle(
        1.35,
        0xddffcc,
        0.012,
        new THREE.Vector3(1, 1, 0).normalize(),
      ),
    );

    const detail = 120;
    // Slightly larger radius than the globe to avoid z-fighting.
    const pointsGeo = new THREE.IcosahedronGeometry(1.01, detail);

    // Shaders
    const vertexShader = `
  uniform float size;
  uniform sampler2D elevTexture;
  uniform vec2 mouseUV;

  varying vec2 vUv;
  varying float vVisible;
  varying float vDist;

  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    float elv = texture2D(elevTexture, vUv).r;
    vec3 vNormal = normalMatrix * normal;
    vVisible = step(0.0, dot( -normalize(mvPosition.xyz), normalize(vNormal)));
    mvPosition.z += 0.35 * elv;

    float dist = distance(mouseUV, vUv);
    float zDisp = 0.0;
    float thresh = 0.03;
    if (dist < thresh) {
      zDisp = (thresh - dist) * 4.0;
    }
    vDist = dist;
    mvPosition.z += zDisp;

    gl_PointSize = size;
    gl_Position = projectionMatrix * mvPosition;
  }
`;
    const fragmentShader = `
  uniform sampler2D colorTexture;
  uniform sampler2D alphaTexture;
  uniform sampler2D otherTexture;
  uniform sampler2D newTexture;


  varying vec2 vUv;
  varying float vVisible;
  varying float vDist;

  void main() {
    if (floor(vVisible + 0.1) == 0.0) discard;
    float alpha = (1.0 - texture2D(alphaTexture, vUv).r) * 0.6;
    vec3 color = texture2D(otherTexture, vUv).rgb;
    vec3 other = texture2D(colorTexture, vUv).rgb;
    float thresh = 0.03;
    if (vDist < thresh) {
      color = mix(color, other, (thresh - vDist) * 30.0);
    }
    gl_FragColor = vec4(color * 0.8, alpha);
  }
`;

    const uniforms = {
      size: { type: "f", value: 8.0 },
      colorTexture: { type: "t", value: colorMap },
      otherTexture: { type: "t", value: otherMap },
      elevTexture: { type: "t", value: elevMap },
      alphaTexture: { type: "t", value: alphaMap },
      mouseUV: { type: "v2", value: new THREE.Vector2(0.0, 0.0) },
    };

    const pointsMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    const points = new THREE.Points(pointsGeo, pointsMat);
    globeGroup.add(points);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x080820, 4);
    globeGroup.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 3, 5);
    globeGroup.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
    globeGroup.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 10);
    pointLight.position.set(2, 2, 2);
    globeGroup.add(pointLight);

    const stars = getStarfield({ numStars: 4500, sprite: starSprite });
    scene.add(stars);

    function handleRaycast() {
      raycaster.setFromCamera(pointerPos, camera);
      const intersects = raycaster.intersectObjects([globe], false);
      if (intersects.length > 0 && intersects[0].uv) {
        globeUV.copy(intersects[0].uv);
        uniforms.mouseUV.value.copy(globeUV);
      }
    }

    function animate() {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (cameraRef.current) {
        cameraRef.current.position.lerp(targetPosition.current, 0.009);
        orbitCtrl.target.lerp(targetLookAt.current, 0.009);
      }

      // Make the emoji track the cursor every frame, even when the mouse is idle.
      if (emojiModel) {
        emojiRaycaster.setFromCamera(mouseRef.current, camera);

        const cursorPoint = new THREE.Vector3();
        emojiRaycaster.ray.at(1, cursorPoint);

        const direction = cursorPoint
          .clone()
          .sub(emojiModel.position)
          .normalize();
        const targetPoint = emojiModel.position.clone().add(direction);

        emojiModel.lookAt(targetPoint);
      }

      if (currentSectionRef.current === 3) {
        const [waterlooX, waterlooY, waterlooZ] = latLongToVector3(
          43.4643,
          -80.5204,
          1.02,
        );
        const waterlooWorldPos = new THREE.Vector3(
          waterlooX,
          waterlooY,
          waterlooZ,
        );

        waterlooWorldPos.applyMatrix4(globeGroup.matrixWorld);

        const vector = waterlooWorldPos.clone().project(camera);

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (vector.y * -0.5 + 0.5) * window.innerHeight;

        waterlooScreenPos.current = { x, y };

        if (waterlooLabelRef.current) {
          // Only when the marker faces the camera and there's room for the card.
          const isVisible = vector.z < 1 && window.innerWidth >= 1024;
          if (isVisible) {
            const labelWidth = 320;
            const clampedX = Math.min(
              x + 80,
              window.innerWidth - labelWidth - 24,
            );
            const clampedY = Math.max(
              96,
              Math.min(y - 120, window.innerHeight - 360),
            );
            waterlooLabelRef.current.style.display = "block";
            waterlooLabelRef.current.style.left = `${clampedX}px`;
            waterlooLabelRef.current.style.top = `${clampedY}px`;
          } else {
            waterlooLabelRef.current.style.display = "none";
          }
        }
      } else {
        if (waterlooLabelRef.current) {
          waterlooLabelRef.current.style.display = "none";
        }
      }

      renderer.render(scene, camera);

      if (currentSectionRef.current === 3) {
        // Rotate to bring Waterloo to the front and tilt downwards.
        globeGroup.rotation.y +=
          (targetRotationY.current - globeGroup.rotation.y) * 0.09;
        globeGroup.rotation.x +=
          (targetRotationX.current - globeGroup.rotation.x) * 0.09;
        globeGroup.rotation.z +=
          (targetRotationZ.current - globeGroup.rotation.z) * 0.09;
      } else {
        globeGroup.rotation.y += 0.001;
        globeGroup.rotation.x += (0 - globeGroup.rotation.x) * 0.03;
        globeGroup.rotation.z += (0 - globeGroup.rotation.z) * 0.03;
      }

      streakParticles.forEach((streak) => {
        streak.angle += streak.speed;

        // Reuses a hoisted temp to avoid per-frame allocations.
        streakBasePos.set(
          Math.cos(streak.angle) * streak.radius,
          0,
          Math.sin(streak.angle) * streak.radius,
        );

        streakBasePos.applyAxisAngle(streak.axis, streak.angle * 0.5);

        streak.head.position.copy(streakBasePos);

        streak.tail.forEach((tailSegment, i) => {
          const trailAngle = streak.angle - (i + 1) * 0.02;
          streakTrailPos.set(
            Math.cos(trailAngle) * streak.radius,
            0,
            Math.sin(trailAngle) * streak.radius,
          );
          streakTrailPos.applyAxisAngle(streak.axis, trailAngle * 0.5);
          tailSegment.position.copy(streakTrailPos);
        });
      });

      handleRaycast();
      orbitCtrl.update();
    }
    animate();

    function onMouseMove(evt: MouseEvent) {
      pointerPos.set(
        (evt.clientX / window.innerWidth) * 2 - 1,
        -(evt.clientY / window.innerHeight) * 2 + 1,
      );

      mouseRef.current.x = (evt.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(evt.clientY / window.innerHeight) * 2 + 1;
    }

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);

      if (mountRef.current) {
        if (
          renderer.domElement &&
          mountRef.current.contains(renderer.domElement)
        ) {
          mountRef.current.removeChild(renderer.domElement);
        }
        if (
          waterlooLabelRef.current &&
          mountRef.current.contains(waterlooLabelRef.current)
        ) {
          mountRef.current.removeChild(waterlooLabelRef.current);
        }
      }

      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  // Update camera position when section changes
  useEffect(() => {
    if (!cameraRef.current) return;

    const positions: Record<
      number,
      { position: [number, number, number]; lookAt: [number, number, number] }
    > = {
      0: { position: [7, 0, 4], lookAt: [-7.7, 0, 0] }, // Hero - default view
      1: { position: [6, -4, 2], lookAt: [-7.7, 1, -0.85] }, // Features - globe at bottom, camera lower
      2: { position: [12, 0, -24], lookAt: [-7.7, 0, 0] }, // About - globe on left, camera further away
      3: { position: [10, -3, 1], lookAt: [-7.7, 0, 10] }, // Team - camera lower to show Waterloo higher, zoom on Waterloo
      4: { position: [20, 15, 20], lookAt: [30, 20, 30] }, // Contact - moderate zoom showing stars with earth smaller
    };

    const config = positions[currentSection] || positions[0];

    // Team section (3): rotate the globe so Waterloo faces the camera.
    if (currentSection === 3) {
      const [waterlooX, waterlooY, waterlooZ] = latLongToVector3(
        43.4643,
        -80.5204,
        1,
      );
      // Offset from globe center (-7.7, 0, 0).
      const waterlooWorldX = waterlooX - 7.7;
      const waterlooWorldY = waterlooY;
      const waterlooWorldZ = waterlooZ;

      // Extra rotation accounts for the globe's initial orientation.
      const waterlooRotationY = (80.5204 + 160) * (Math.PI / 180);
      const waterlooRotationX = 90 * (Math.PI / 180);
      const waterlooRotationZ = 90 * (Math.PI / 180);

      targetRotationY.current = waterlooRotationY;
      targetRotationX.current = waterlooRotationX;
      targetRotationZ.current = waterlooRotationZ;

      if (connectionLineRef.current) {
        connectionLineRef.current.visible = true;
      }

      targetPosition.current.set(...config.position);
      targetLookAt.current.set(waterlooWorldX, waterlooWorldY, waterlooWorldZ);
    } else {
      targetRotationY.current = 0;
      targetRotationX.current = 0;
      targetRotationZ.current = 0;

      if (connectionLineRef.current) {
        connectionLineRef.current.visible = false;
      }

      targetPosition.current.set(...config.position);
      targetLookAt.current.set(...config.lookAt);
    }
  }, [currentSection]);

  // Update currentSection ref for use in animation loop
  useEffect(() => {
    currentSectionRef.current = currentSection;
  }, [currentSection]);

  useEffect(() => {
    function handleMouseMove(evt: MouseEvent) {
      mouseRef.current.x = (evt.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(evt.clientY / window.innerHeight) * 2 + 1;
    }

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "100%" }}
      className="absolute inset-0"
    />
  );
}
