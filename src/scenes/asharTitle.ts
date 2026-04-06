import * as THREE from "three";

/**
 * Mission briefing — rendered as a canvas texture running through the
 * RetroPipeline (palette quantisation + dither + scanlines).
 *
 * Canvas is 640×512 (2× the 320×256 render target), so all measurements
 * here are doubled — the pipeline halves them to crisp retro pixels.
 */
export function buildAsharTitle(): { scene: THREE.Scene; camera: THREE.OrthographicCamera } {
  const scene = new THREE.Scene();

  // Background: command deck art
  const bgTex = new THREE.TextureLoader().load("/generated/command-deck.png");
  bgTex.colorSpace = THREE.SRGBColorSpace;

  const CAM_H = 2.56;
  const planeW = CAM_H * (16 / 9);

  scene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(planeW, CAM_H),
    new THREE.MeshBasicMaterial({ map: bgTex }),
  ));

  // ── Canvas overlay ────────────────────────────────────────────────────────
  const CW = 640, CH = 512;
  const canvas = document.createElement("canvas");
  canvas.width = CW; canvas.height = CH;
  const ctx = canvas.getContext("2d")!;

  // Dark scrim so text is legible over the art
  ctx.fillStyle = "rgba(4,8,14,0.78)";
  ctx.fillRect(0, 0, CW, CH);

  // ── Helper: copper bar ────────────────────────────────────────────────────
  function copperBar(y: number, h = 3): void {
    const g = ctx.createLinearGradient(0, y, CW, y);
    g.addColorStop(0,    "#3d1800");
    g.addColorStop(0.15, "#8b5a38");
    g.addColorStop(0.5,  "#c48c58");
    g.addColorStop(0.85, "#8b5a38");
    g.addColorStop(1,    "#3d1800");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, CW, h);
  }

  // ── Header ────────────────────────────────────────────────────────────────
  copperBar(0, 4);

  ctx.textAlign = "left";
  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.fillStyle = "#c48c58";
  ctx.fillText("MERIDIAN COMMAND  //  STRAIT OPS  //  CLASSIFICATION: RESTRICTED", 24, 22);

  ctx.textAlign = "center";
  ctx.font = "bold 38px Georgia, 'Times New Roman', serif";
  ctx.fillStyle = "#f5e6d0";
  ctx.shadowColor = "rgba(196,140,88,0.6)";
  ctx.shadowBlur = 18;
  ctx.fillText("OPERATION MERIDIAN GATE", CW / 2, 68);
  ctx.shadowBlur = 0;

  ctx.font = "16px 'Courier New', monospace";
  ctx.fillStyle = "#ffd48a";
  ctx.fillText("PILOT BRIEFING  ·  0558 LOCAL  ·  ASHAR SECTOR", CW / 2, 92);

  copperBar(104, 3);

  // ── Two-column body ───────────────────────────────────────────────────────
  const COL1 = 40, COL2 = 340;
  let y1 = 124, y2 = 124;

  // -- Left: Situation --
  function sectionHead(x: number, y: number, label: string): void {
    ctx.textAlign = "left";
    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.fillStyle = "#ff8c42";
    ctx.fillText("▸ " + label, x, y);
  }

  function bodyLine(x: number, y: number, text: string, color = "#e8c898"): void {
    ctx.textAlign = "left";
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  sectionHead(COL1, y1, "SITUATION");    y1 += 22;
  bodyLine(COL1, y1, "Ashar insurgents have blocked the");  y1 += 18;
  bodyLine(COL1, y1, "Meridian Strait — the Coalition's");  y1 += 18;
  bodyLine(COL1, y1, "primary fuel corridor.");             y1 += 18;
  y1 += 6;
  bodyLine(COL1, y1, "Twelve laden tankers are staged");    y1 += 18;
  bodyLine(COL1, y1, "at north anchorage. Transit window"); y1 += 18;
  bodyLine(COL1, y1, "holds for 90 seconds before Ashar"); y1 += 18;
  bodyLine(COL1, y1, "reinforcements arrive in force.");    y1 += 26;

  sectionHead(COL1, y1, "OBJECTIVE");  y1 += 22;
  bodyLine(COL1, y1, "Intercept all inbound threats.");     y1 += 18;
  bodyLine(COL1, y1, "Hold convoy integrity for 90s.");     y1 += 18;
  bodyLine(COL1, y1, "Lose all tankers = lose the strait."); y1 += 26;

  sectionHead(COL1, y1, "LOADOUT");    y1 += 22;
  bodyLine(COL1, y1, "16 ballistic rounds.");               y1 += 18;
  bodyLine(COL1, y1, "Resupply drops every 4th wave.");

  // -- Right: Threat assessment --
  sectionHead(COL2, y2, "THREAT ASSESSMENT");  y2 += 28;

  // Drone silhouette
  drawDroneSilhouette(ctx, COL2 + 20, y2 + 12);
  ctx.textAlign = "left";
  ctx.font = "bold 14px 'Courier New', monospace";
  ctx.fillStyle = "#d94a2a";
  ctx.fillText("AIR THREAT — DRONE SWARM", COL2 + 60, y2 + 6);
  ctx.font = "13px 'Courier New', monospace";
  ctx.fillStyle = "#e8c898";
  ctx.fillText("Fast descent, lateral drift.", COL2 + 60, y2 + 22);
  ctx.fillText("Low mass — high numbers.", COL2 + 60, y2 + 38);
  ctx.fillStyle = "#c48c58";
  ctx.fillText("DAMAGE  ×1 per breach", COL2 + 60, y2 + 54);
  y2 += 80;

  // Divider
  ctx.strokeStyle = "rgba(196,140,88,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(COL2, y2); ctx.lineTo(CW - 24, y2); ctx.stroke();
  y2 += 16;

  // Boat silhouette
  drawBoatSilhouette(ctx, COL2 + 20, y2 + 14);
  ctx.font = "bold 14px 'Courier New', monospace";
  ctx.fillStyle = "#d94a2a";
  ctx.fillText("SEA THREAT — FAST ATTACK", COL2 + 60, y2 + 6);
  ctx.font = "13px 'Courier New', monospace";
  ctx.fillStyle = "#e8c898";
  ctx.fillText("Knife in from the flanks.", COL2 + 60, y2 + 22);
  ctx.fillText("Armoured hull, angled run.", COL2 + 60, y2 + 38);
  ctx.fillStyle = "#c48c58";
  ctx.fillText("DAMAGE  ×4 per breach", COL2 + 60, y2 + 54);
  y2 += 80;

  ctx.strokeStyle = "rgba(196,140,88,0.25)";
  ctx.beginPath(); ctx.moveTo(COL2, y2); ctx.lineTo(CW - 24, y2); ctx.stroke();
  y2 += 16;

  // Fire control
  sectionHead(COL2, y2, "FIRE CONTROL");  y2 += 22;
  bodyLine(COL2, y2, "SPACE  auto-target nearest threat"); y2 += 18;
  bodyLine(COL2, y2, "CLICK  aim at cursor position");    y2 += 18;
  bodyLine(COL2, y2, "← →    manoeuvre",                "#e8c898"); y2 += 18;
  bodyLine(COL2, y2, "W S    adjust depth band");

  // ── Footer ────────────────────────────────────────────────────────────────
  copperBar(CH - 46, 3);

  ctx.textAlign = "center";
  ctx.font = "bold 18px 'Courier New', monospace";
  ctx.fillStyle = "#ffd48a";
  ctx.fillText("[ 1 ]  LAUNCH PATROL", CW / 2 - 130, CH - 22);
  ctx.fillStyle = "#8b5a38";
  ctx.fillText("·", CW / 2, CH - 22);
  ctx.fillStyle = "#c48c58";
  ctx.fillText("[ ESC ]  STAND DOWN", CW / 2 + 110, CH - 22);

  copperBar(CH - 3, 3);

  // ── Upload to Three.js ────────────────────────────────────────────────────
  const overlayTex = new THREE.CanvasTexture(canvas);
  overlayTex.colorSpace = THREE.SRGBColorSpace;
  overlayTex.needsUpdate = true;

  const overlay = new THREE.Mesh(
    new THREE.PlaneGeometry(planeW, CAM_H),
    new THREE.MeshBasicMaterial({ map: overlayTex, transparent: true }),
  );
  overlay.position.z = 0.01;
  scene.add(overlay);

  const camera = new THREE.OrthographicCamera(-1.6, 1.6, 1.28, -1.28, 0.1, 10);
  camera.position.z = 2;
  return { scene, camera };
}

// ── Silhouette helpers ────────────────────────────────────────────────────────

function drawDroneSilhouette(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  ctx.fillStyle = "#d94a2a";
  ctx.strokeStyle = "#ff8c42";
  ctx.lineWidth = 1.5;
  // Body
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Four arms
  for (let a = 0; a < 4; a++) {
    const angle = (a * Math.PI) / 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 8, cy + Math.sin(angle) * 8);
    ctx.lineTo(cx + Math.cos(angle) * 20, cy + Math.sin(angle) * 20);
    ctx.stroke();
    // Rotor disc
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(angle) * 22, cy + Math.sin(angle) * 22, 5, 0, Math.PI * 2,
    );
    ctx.strokeStyle = "#ff8c42";
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoatSilhouette(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  ctx.fillStyle = "#4a6b8c";
  ctx.strokeStyle = "#8b5a38";
  ctx.lineWidth = 1.5;
  // Hull (elongated oval)
  ctx.beginPath();
  ctx.ellipse(cx, cy, 22, 9, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Bridge
  ctx.fillStyle = "#2d4a6c";
  ctx.beginPath();
  ctx.rect(cx - 6, cy - 12, 12, 8);
  ctx.fill(); ctx.stroke();
  // Bow wake lines
  ctx.strokeStyle = "#4a6b8c";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 22, cy - 4); ctx.lineTo(cx + 36, cy - 10);
  ctx.moveTo(cx + 22, cy + 4); ctx.lineTo(cx + 36, cy + 10);
  ctx.stroke();
  ctx.restore();
}
