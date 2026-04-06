import * as THREE from "three";

function makeTitleTexture(): THREE.CanvasTexture {
  const w = 640;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#2d1810");
  g.addColorStop(0.45, "#5c3a28");
  g.addColorStop(1, "#1a0f08");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(32, 96, w - 64, 300);

  ctx.font = "bold 52px serif";
  ctx.fillStyle = "#f5e6d0";
  ctx.textAlign = "center";
  ctx.fillText("ASHAR", w / 2, 168);
  ctx.font = "26px serif";
  ctx.fillStyle = "#ffd48a";
  ctx.fillText("STRAIT ORDERS", w / 2, 206);

  ctx.font = "16px ui-monospace, monospace";
  ctx.fillStyle = "#e8c898";
  ctx.fillText("CLASSIFIED BRIEFING · PAL 320×256", w / 2, 238);

  const lines = [
    "Meridian tanker lanes are contested. Ashar pickets report",
    "drone swarms and drone boats — kinetic only, ballistics capped.",
    "Hold convoy integrity 90 seconds or lose the strait window.",
    "",
    "Return to the command deck when ready. Patrol is live-fire.",
  ];
  ctx.font = "17px ui-monospace, monospace";
  ctx.fillStyle = "#d4c4a8";
  let y = 278;
  for (const line of lines) {
    ctx.fillText(line, w / 2, y);
    y += 24;
  }

  ctx.font = "13px ui-monospace, monospace";
  ctx.fillStyle = "rgba(200,180,150,0.65)";
  ctx.fillText("ESC — COMMAND DECK  ·  1 — PATROL", w / 2, 392);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Cinemaware-style full-screen title plate. */
export function buildAsharTitle(): { scene: THREE.Scene; camera: THREE.OrthographicCamera } {
  const scene = new THREE.Scene();
  const tex = makeTitleTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.56), mat);
  scene.add(mesh);

  const camera = new THREE.OrthographicCamera(-1.6, 1.6, 1.28, -1.28, 0.1, 10);
  camera.position.z = 2;

  return { scene, camera };
}
