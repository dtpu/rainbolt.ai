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
