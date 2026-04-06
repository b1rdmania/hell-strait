import * as THREE from "three";

/**
 * Command deck — loads generated Stability art as fullscreen background.
 * Cover-fills the 320×256 viewport (ortho camera, 16:9 image crops sides slightly).
 */
export function buildMeridianHub(): { scene: THREE.Scene; camera: THREE.OrthographicCamera } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#020305");

  const tex = new THREE.TextureLoader().load("/generated/command-deck.png");
  tex.colorSpace = THREE.SRGBColorSpace;

  // Ortho camera: left=-1.6, right=1.6, top=1.28, bottom=-1.28 → viewport 3.2 × 2.56
  // Image is 16:9 (1.778). To cover-fill height: plane = 4.55 × 2.56 (sides crop).
  const CAM_H = 2.56;
  const planeW = CAM_H * (16 / 9);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(planeW, CAM_H),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  scene.add(mesh);

  const camera = new THREE.OrthographicCamera(-1.6, 1.6, 1.28, -1.28, 0.1, 10);
  camera.position.z = 2;
  return { scene, camera };
}
