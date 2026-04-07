import * as THREE from "three";

/**
 * Gulf sunset sky + industrial silhouettes — warm Cinemaware palette.
 * Designed for the front-on SDI camera at 320×256 with quantize OFF:
 * colours are baked in, not dependent on the Meridian 18-colour pass.
 */
export function makeGulfSkyBackdropTexture(): THREE.CanvasTexture {
  const w = 320;
  const h = 180;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  // ── Sunset sky gradient ────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, "#060410");
  grad.addColorStop(0.12, "#0c0820");
  grad.addColorStop(0.25, "#18103a");
  grad.addColorStop(0.40, "#3a1838");
  grad.addColorStop(0.52, "#802818");
  grad.addColorStop(0.60, "#c84c1c");
  grad.addColorStop(0.66, "#e07828");
  grad.addColorStop(0.70, "#f0a040");
  grad.addColorStop(0.74, "#cc5020");
  grad.addColorStop(0.80, "#1a0c08");
  grad.addColorStop(1.0, "#080404");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // ── Horizon glow ──────────────────────────────────────────────
  ctx.fillStyle = "#ffc040";
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.ellipse(w * 0.55, h * 0.68, w * 0.4, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff8830";
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.ellipse(w * 0.55, h * 0.66, w * 0.55, h * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ── Subtle scanline bands (Amiga feel) ────────────────────────
  ctx.globalAlpha = 0.05;
  for (let y = 0; y < h; y += 2) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, y, w, 1);
  }
  ctx.globalAlpha = 1;

  // ── Cloud wisps ───────────────────────────────────────────────
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#200c28";
  ctx.beginPath();
  ctx.ellipse(w * 0.25, h * 0.18, 48, 7, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.72, h * 0.14, 55, 6, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#401820";
  ctx.beginPath();
  ctx.ellipse(w * 0.48, h * 0.36, 65, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.15, h * 0.42, 35, 6, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ── Refinery / tank farm silhouettes ──────────────────────────
  const base = Math.floor(h * 0.76);
  ctx.fillStyle = "#040404";

  const tanks: [number, number, number][] = [
    [2, 38, 26], [42, 26, 34], [72, 32, 24], [108, 22, 30],
    [134, 30, 22], [166, 24, 40], [194, 32, 28], [228, 20, 32],
    [252, 28, 24], [282, 36, 30], [318, 18, 26],
  ];
  for (const [tx, tw, th] of tanks) {
    ctx.fillRect(tx, base - th, tw, th + (h - base));
  }

  // Tall chimneys / refinery towers
  ctx.fillStyle = "#060606";
  ctx.fillRect(52, base - 46, 3, 46);
  ctx.fillRect(174, base - 54, 4, 54);
  ctx.fillRect(248, base - 42, 3, 42);
  ctx.fillRect(128, base - 36, 2, 36);
  ctx.fillRect(300, base - 38, 3, 38);

  // Industrial warning lights on silhouettes
  ctx.fillStyle = "#ff5020";
  ctx.globalAlpha = 0.85;
  const lights: [number, number][] = [
    [53, base - 46], [175, base - 54], [249, base - 42],
    [32, base - 20], [96, base - 18], [145, base - 24],
    [210, base - 16], [270, base - 22], [301, base - 38],
  ];
  for (const [lx, ly] of lights) {
    ctx.fillRect(lx, ly, 2, 2);
  }
  ctx.globalAlpha = 1;

  // ── Gas flare glow (chimney 1) ────────────────────────────────
  ctx.fillStyle = "#ff8840";
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(53, base - 49, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffcc60";
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(53, base - 51, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ── Gas flare glow (chimney 2) ────────────────────────────────
  ctx.fillStyle = "#ff7030";
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.ellipse(176, base - 57, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffbb50";
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.ellipse(176, base - 59, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ── Dark sea below silhouettes ────────────────────────────────
  ctx.fillStyle = "#060404";
  ctx.fillRect(0, base + 2, w, h - base);

  // Subtle warm reflection on water
  ctx.globalAlpha = 0.1;
  const rGrad = ctx.createLinearGradient(0, base + 2, 0, h);
  rGrad.addColorStop(0, "#c05020");
  rGrad.addColorStop(0.4, "#401808");
  rGrad.addColorStop(1, "#000000");
  ctx.fillStyle = rGrad;
  ctx.fillRect(0, base + 2, w, h - base);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
