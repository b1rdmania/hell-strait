import * as THREE from "three";

/**
 * EGA “castle courtyard” — flat MeshBasic only; parent group for subtle idle motion.
 */
export function buildCourtyard(): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
} {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0000aa");

  const root = new THREE.Group();
  scene.add(root);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshBasicMaterial({ color: "#555555" }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  root.add(ground);

  const wallMat = new THREE.MeshBasicMaterial({ color: "#5555ff" });
  const wallN = new THREE.Mesh(new THREE.BoxGeometry(14, 3.2, 0.4), wallMat);
  wallN.position.set(0, 1.6, -5);
  root.add(wallN);

  const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 10), wallMat);
  wallW.position.set(-7, 1.6, 0);
  root.add(wallW);

  const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 10), wallMat);
  wallE.position.set(7, 1.6, 0);
  root.add(wallE);

  const gate = new THREE.Mesh(
    new THREE.BoxGeometry(3, 2.2, 0.35),
    new THREE.MeshBasicMaterial({ color: "#aa5500" }),
  );
  gate.position.set(0, 1.1, -4.85);
  root.add(gate);

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const torch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 0.5, 8),
      new THREE.MeshBasicMaterial({ color: "#ff5555" }),
    );
    torch.position.set(Math.cos(angle) * 5.5, 0.25, Math.sin(angle) * 3.5);
    root.add(torch);
  }

  const camera = new THREE.PerspectiveCamera(40, 320 / 256, 0.1, 80);
  camera.position.set(0, 2.1, 9.2);
  camera.lookAt(0, 1.2, -2);

  return { scene, camera, root };
}
