import * as THREE from "three";

/** Local-space point where SAM / interceptor volleys originate (flight deck, forward). */
export const CARRIER_FIRE_LOCAL = new THREE.Vector3(0, 3.8, 4);

/**
 * Procedural “painted plate” deck — reads Cinemaware-adjacent at low resolution.
 * Used when `/generated/carrier-cinemaware.png` is missing or fails to load.
 */
export function makeCinemawareDeckCanvasTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.35);
  sky.addColorStop(0, "#2a4060");
  sky.addColorStop(1, "#1a2838");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.35);
  ctx.fillStyle = "#3d4a58";
  ctx.fillRect(0, h * 0.35, w, h * 0.65);

  ctx.fillStyle = "#2a3544";
  ctx.fillRect(0, h * 0.38, w, h * 0.55);
  // Deck runway strip
  ctx.fillStyle = "#1e2a38";
  ctx.fillRect(w * 0.38, h * 0.42, w * 0.24, h * 0.48);
  ctx.strokeStyle = "rgba(201,162,39,0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(w * 0.06, h * 0.4, w * 0.88, h * 0.52);
  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = "rgba(232,220,196,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2, h * 0.42);
  ctx.lineTo(w / 2, h * 0.88);
  ctx.stroke();
  ctx.setLineDash([]);
  // Island shadow (painted blob)
  ctx.fillStyle = "rgba(10,14,20,0.55)";
  ctx.beginPath();
  ctx.ellipse(w * 0.62, h * 0.48, w * 0.08, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export type CarrierBuild = {
  group: THREE.Group;
  /** World position for interceptor spawn (updated if group moves). */
  getFireWorldPosition: () => THREE.Vector3;
};

/**
 * Big Nimitz-class style carrier: long hull, full deck, island — Cinemaware read at low internal res.
 * Optional texture: `/generated/carrier-cinemaware.png` (Stability or hand-painted).
 */
export function buildAircraftCarrier(
  scene: THREE.Scene,
  textureLoader: THREE.TextureLoader,
): CarrierBuild {
  const group = new THREE.Group();
  group.position.set(0, 0, 15);

  const hullMat = new THREE.MeshBasicMaterial({ color: 0x3d4a58 });
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(52, 3.2, 18),
    hullMat,
  );
  hull.position.set(0, 1.6, 0);
  group.add(hull);

  // Bow wedge (simple box)
  const bow = new THREE.Mesh(
    new THREE.BoxGeometry(14, 2.8, 8),
    new THREE.MeshBasicMaterial({ color: 0x354250 }),
  );
  bow.position.set(0, 1.5, -13);
  bow.rotation.y = 0.08;
  group.add(bow);

  const deckGeo = new THREE.PlaneGeometry(50, 20);
  const deckMat = new THREE.MeshBasicMaterial({ color: 0x5a6878 });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 3.25, 0);
  group.add(deck);

  textureLoader.load(
    "/generated/carrier-cinemaware.png",
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      deckMat.map = tex;
      deckMat.color.setHex(0xffffff);
      deckMat.needsUpdate = true;
    },
    undefined,
    () => {
      deckMat.map = makeCinemawareDeckCanvasTexture();
      deckMat.color.setHex(0xffffff);
      deckMat.needsUpdate = true;
    },
  );

  // Island superstructure (stacked blocks — “Bitmap” readable silhouette)
  const island = new THREE.Group();
  island.position.set(11, 3.25, -2);
  const stack = new THREE.Mesh(
    new THREE.BoxGeometry(5, 6, 12),
    new THREE.MeshBasicMaterial({ color: 0x2a3440 }),
  );
  stack.position.y = 3;
  island.add(stack);
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(4, 2.5, 6),
    new THREE.MeshBasicMaterial({ color: 0x3d4c5c }),
  );
  bridge.position.set(-0.5, 7.2, 1);
  island.add(bridge);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.5, 3, 6),
    new THREE.MeshBasicMaterial({ color: 0x4a5868 }),
  );
  mast.position.set(0, 9.5, -2);
  island.add(mast);
  group.add(island);

  // Elevator strip hints
  for (let i = 0; i < 3; i++) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 14),
      new THREE.MeshBasicMaterial({ color: 0x1a2028 }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(-12 + i * 12, 3.26, 2);
    group.add(line);
  }

  scene.add(group);

  const worldFire = new THREE.Vector3();
  function getFireWorldPosition(): THREE.Vector3 {
    worldFire.copy(CARRIER_FIRE_LOCAL);
    worldFire.applyMatrix4(group.matrixWorld);
    return worldFire;
  }

  return { group, getFireWorldPosition };
}
