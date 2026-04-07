import * as THREE from "three";
import meridianPalette from "../palettes/meridian.json";

/**
 * Hand-painted Gulf night sky + refinery silhouette (Meridian palette only).
 * Matches Patrol’s bitmap look — no Stability photos.
 */
export function makeGulfSkyBackdropTexture(): THREE.CanvasTexture {
  const P = meridianPalette.colors as string[];
  const w = 256;
  const h = 144;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, P[0]!);
  grad.addColorStop(0.28, P[2]!);
  grad.addColorStop(0.48, P[3]!);
  grad.addColorStop(0.62, P[4]!);
  grad.addColorStop(0.7, P[9]!);
  grad.addColorStop(0.76, P[15]!);
  grad.addColorStop(0.82, P[1]!);
  grad.addColorStop(1, P[0]!);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal bands (Amiga-ish)
  ctx.globalAlpha = 0.12;
  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? "#000000" : "transparent";
    if (y % 6 === 0) ctx.fillRect(0, y, w, 1);
  }
  ctx.globalAlpha = 1;

  // Distant flare
  ctx.fillStyle = P[14]!;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(w * 0.72, h * 0.58, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Refinery / tank farm silhouette (bottom)
  const base = Math.floor(h * 0.78);
  const tanks: [number, number, number][] = [
    [8, 32, 24],
    [44, 22, 28],
    [72, 28, 22],
    [104, 18, 26],
    [128, 26, 20],
    [154, 20, 30],
    [182, 24, 22],
    [210, 16, 24],
  ];
  for (const [tx, tw, th] of tanks) {
    ctx.fillStyle = P[0]!;
    ctx.fillRect(tx, base - th, tw, th);
    ctx.fillStyle = P[1]!;
    ctx.fillRect(tx + 2, base - th - 3, Math.max(4, tw - 4), 3);
  }
  ctx.fillStyle = P[1]!;
  ctx.fillRect(0, base - 2, w, 4);
  ctx.fillStyle = P[0]!;
  ctx.fillRect(0, base, w, h - base);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
