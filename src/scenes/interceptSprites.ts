import * as THREE from "three";

/**
 * Tiny bitmap sprites for Gulf SDI — same idea as PatrolScene.generateTextures():
 * filled rects, no gradients, reads clearly after 320×256 + meridian quantize.
 */

function canvasToNearestTex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

/** Patriot-style: gold body + orange tail (PatrolScene lines 205–208), vertical for 3D billboard. */
export function makeInterceptorSpriteTexture(): THREE.CanvasTexture {
  const w = 3;
  const h = 9;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffe050";
  ctx.fillRect(0, 0, w, h - 2);
  ctx.fillStyle = "#ff9800";
  ctx.fillRect(0, h - 2, w, 2);
  return canvasToNearestTex(c);
}

/** Inbound threat — orange dart, same family as PatrolScene enemy-bullet. */
export function makeInboundSpriteTexture(): THREE.CanvasTexture {
  const w = 4;
  const h = 22;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ff2200";
  ctx.fillRect(1, 0, 2, 5);
  ctx.fillStyle = "#ff5500";
  ctx.fillRect(0, 5, w, h - 5);
  ctx.fillStyle = "#ffcc66";
  ctx.fillRect(1, 2, 2, 2);
  return canvasToNearestTex(c);
}
