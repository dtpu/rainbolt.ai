import * as THREE from "three";

/**
 * Shared snapshot of the landing-page EarthScene camera. EarthScene writes its
 * camera position/orientation here every frame; the DecorLayer (when run with
 * `cameraSync`) copies it onto its own camera so decorative props live in the
 * exact same 3D space as the globe/rainbolt model and parallax together as the
 * camera flies between scroll sections.
 */
export const landingCamera = {
  active: false,
  position: new THREE.Vector3(7, 0, 4),
  quaternion: new THREE.Quaternion(),
  fov: 45,
};

/**
 * Live zoom of the persistent WorldGlobe camera (learning/session pages),
 * normalised so 1 = resting overview and <1 = flown in on a location.
 * The DecorLayer dollies its own camera with this so the foreground props
 * zoom and parallax together with the globe instead of sticking to the
 * screen like wallpaper.
 */
export const worldGlobeZoom = { norm: 1 };
