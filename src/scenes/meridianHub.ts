import * as THREE from "three";

const W = 640;
const H = 512;

/**
 * Full landing plate: Bitmap chrome + Cinemaware framing — one painted screen, not empty panels.
 */
function makeMeridianLandingTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#152028");
  g.addColorStop(0.35, "#0a1218");
  g.addColorStop(0.65, "#050608");
  g.addColorStop(1, "#020305");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, H * 0.85);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Outer chrome frame
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, W - 24, H - 24);
  ctx.strokeStyle = "#3d5468";
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  // Top gold segments (meter strip)
  for (let i = 0; i < 6; i++) {
    const bx = 36 + i * 96;
    ctx.fillStyle = i % 2 === 0 ? "#c9a227" : "#e6c84a";
    ctx.fillRect(bx, 28, 72, 8);
  }

  // Title block
  ctx.textAlign = "center";
  ctx.font = "bold 46px Georgia, Times New Roman, serif";
  ctx.fillStyle = "#e8eef2";
  ctx.fillText("HELL STRAIT", W / 2, 88);
  ctx.font = "20px ui-monospace, monospace";
  ctx.fillStyle = "#8a9ba8";
  ctx.fillText("MERIDIAN · COMMAND DECK", W / 2, 118);
  ctx.font = "14px ui-monospace, monospace";
  ctx.fillStyle = "#4a90d9";
  ctx.fillText("STRAIT OPS · 320×256 · PAL · 18-COLOUR + DITHER", W / 2, 142);
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillStyle = "rgba(138,155,168,0.85)";
  ctx.fillText("WORKBENCH v1 — patrol · brief · EGA test (all runs in-browser)", W / 2, 162);

  // 2×2 station panels (extra horizontal margin so nothing kisses the chrome)
  const pad = 44;
  const gw = (W - pad * 2 - 16) / 2;
  const gh = 148;
  const topY = 168;
  const labels = [
    ["SEA GRID", "lanes · chokepoints"],
    ["TANKER NET", "coverage · repairs"],
    ["STRIKE CONSOLE", "ballistics · intercept"],
    ["SORTIE BAY", "drones · picket"],
  ];
  let idx = 0;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const x = pad + col * (gw + 16);
      const y = topY + row * (gh + 14);
      ctx.fillStyle = "#1a2332";
      ctx.fillRect(x, y, gw, gh);
      ctx.strokeStyle = "#2a3f54";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, gw, gh);
      ctx.strokeStyle = "#3d5468";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4, y + 4, gw - 8, gh - 8);
      const [title, sub] = labels[idx]!;
      idx++;
      ctx.textAlign = "left";
      ctx.font = "bold 15px ui-monospace, monospace";
      ctx.fillStyle = "#c9a227";
      ctx.fillText(title, x + 12, y + 26);
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillStyle = "#8a9ba8";
      ctx.fillText(sub, x + 12, y + 44);
      // Fake scanlines in cell
      ctx.strokeStyle = "rgba(138,155,168,0.15)";
      for (let s = 0; s < 5; s++) {
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 58 + s * 18);
        ctx.lineTo(x + gw - 10, y + 58 + s * 18);
        ctx.stroke();
      }
    }
  }

  // Bottom status / footer strip
  const footY = H - 56;
  ctx.fillStyle = "#152028";
  ctx.fillRect(24, footY, W - 48, 36);
  ctx.strokeStyle = "#2a3f54";
  ctx.strokeRect(24, footY, W - 48, 36);
  ctx.textAlign = "center";
  ctx.font = "13px ui-monospace, monospace";
  ctx.fillStyle = "#e8eef2";
  ctx.fillText("TANKERS   100", W * 0.22, footY + 23);
  ctx.fillStyle = "#c9a227";
  ctx.fillText("BALLISTICS   04", W * 0.5, footY + 23);
  ctx.fillStyle = "#7cfcb4";
  ctx.fillText("BACKLASH   LOW", W * 0.78, footY + 23);

  ctx.textAlign = "center";
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillStyle = "rgba(138,155,168,0.75)";
  ctx.fillText("DISK A — MAIN   ·   1 PATROL   ·   2 ASHAR BRIEF   ·   3 EGA COURTYARD", W / 2, H - 22);
  ctx.fillText("© MERIDIAN COMMAND — HELL STRAIT — MMXXVI", W / 2, H - 6);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Full-screen landing plate: one cohesive “painted UI” (Cinemaware × Bitmap). */
export function buildMeridianHub(): { scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#020305");

  const tex = makeMeridianLandingTexture();
  const aspect = W / H;
  const planeH = 2.45;
  const planeW = planeH * aspect;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(planeW, planeH),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  scene.add(mesh);

  // At z≈2.35 the plane was wider/taller than the frustum → sides/top cropped ("DEC", missing columns).
  const camera = new THREE.PerspectiveCamera(38, 320 / 256, 0.1, 50);
  camera.position.set(0, 0, 3.65);
  camera.lookAt(0, 0, 0);

  return { scene, camera };
}
