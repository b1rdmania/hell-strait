import * as THREE from "three";
import meridianPalette from "../palettes/meridian.json";

/** Local-space point where SAM / interceptor volleys originate (flight deck, forward). */
export const CARRIER_FIRE_LOCAL = new THREE.Vector3(0, 3.6, 5);

const P = meridianPalette.colors as string[];

/**
 * Procedural deck plate — flat fills from meridian palette (same quantize path as PatrolScene).
 * No gradients: reads stable through RetroPipeline instead of turning into noise.
 */
export function makeCinemawareDeckCanvasTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = P[4]!;
  ctx.fillRect(0, 0, w, h * 0.34);
  ctx.fillStyle = P[3]!;
  ctx.fillRect(0, h * 0.34, w, h * 0.66);

  ctx.fillStyle = P[2]!;
  ctx.fillRect(0, h * 0.36, w, h * 0.58);
  ctx.fillStyle = P[1]!;
  ctx.fillRect(w * 0.38, h * 0.42, w * 0.24, h * 0.5);

  ctx.strokeStyle = P[9]!;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.06, h * 0.38, w * 0.88, h * 0.54);
  ctx.globalAlpha = 1;

  ctx.fillStyle = P[0]!;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(w * 0.62, h * 0.48, w * 0.08, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export type CarrierBuild = {
  group: THREE.Group;
  /** World position for interceptor spawn (updated if group moves). */
  getFireWorldPosition: () => THREE.Vector3;
};

function applyNearestImageTexture(tex: THREE.Texture): void {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
}

/**
 * Big Nimitz-class style carrier: long hull, full deck, island — Cinemaware read at low internal res.
 * Deck uses procedural Meridian canvas; optional Stability `carrier-cinemaware.png` replaces it when loaded.
 */
export function buildAircraftCarrier(
  scene: THREE.Scene,
  textureLoader: THREE.TextureLoader,
  opts?: { deckImageUrl?: string },
): CarrierBuild {
  const group = new THREE.Group();
  group.position.set(0, 0, 0);

  // Main hull — narrower than before so it doesn't dominate the frame
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(46, 3.0, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(P[3]!) }),
  );
  hull.position.set(0, 1.5, 0);
  group.add(hull);

  // Thin hull-side stripe (slightly lighter) for depth read
  const sideMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(P[4]!) });
  const sideF   = new THREE.Mesh(new THREE.BoxGeometry(46, 1.2, 0.4), sideMat);
  sideF.position.set(0, 2.6, 8);
  group.add(sideF);
  const sideA = sideF.clone();
  sideA.position.z = -8;
  group.add(sideA);

  // Bow — tapered forward section, flush with hull
  const bow = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2.6, 7),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(P[2]!) }),
  );
  bow.position.set(0, 1.3, -11);
  group.add(bow);

  const deckGeo = new THREE.PlaneGeometry(44, 18);
  const deckFallback = makeCinemawareDeckCanvasTexture();
  const deckMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffffff),
    map: deckFallback,
  });
  if (opts?.deckImageUrl) {
    textureLoader.load(
      opts.deckImageUrl,
      (tex) => {
        applyNearestImageTexture(tex);
        deckMat.map = tex;
        deckMat.needsUpdate = true;
      },
      undefined,
      () => {},
    );
  }
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 3.1, 0);
  group.add(deck);

  // Island superstructure — offset to starboard, readable silhouette
  const island = new THREE.Group();
  island.position.set(10, 3.1, -1);

  const stack = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 6, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(P[1]!) }),
  );
  stack.position.y = 3;
  island.add(stack);

  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 2.4, 5.5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(P[4]!) }),
  );
  bridge.position.set(-0.5, 7.2, 0.8);
  island.add(bridge);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.45, 3, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(P[5]!) }),
  );
  mast.position.set(0, 9.5, -1.5);
  island.add(mast);

  group.add(island);

  // Catapult / deck lane lines
  for (let i = 0; i < 3; i++) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(P[0]!) }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(-11 + i * 11, 3.12, 1.5);
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
