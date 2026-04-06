import * as THREE from "three";
import type { Game as PhaserGame } from "phaser";
import meridianPalette from "./palettes/meridian.json";
import asharPalette from "./palettes/ashar.json";
import egaPalette from "./palettes/ega18.json";
import { RetroPipeline } from "./retro/RetroPipeline";
import { buildCourtyard } from "./scenes/courtyardScene";
import { buildMeridianHub } from "./scenes/meridianHub";
import { buildAsharTitle } from "./scenes/asharTitle";
import * as RetroAudio from "./audio/retroAudio";

const LOW_W = 320;
const LOW_H = 256;

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "high-performance",
});
renderer.domElement.id = "three-canvas";
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const params =
  typeof location !== "undefined"
    ? new URLSearchParams(location.search)
    : new URLSearchParams();

const usePost = !params.has("raw");
const skipIntro = params.has("skipIntro");
const demoCourtyard = params.has("courtyard");

const hub = buildMeridianHub();
const title = buildAsharTitle();
const courtyard = buildCourtyard();

/** Three.js view: hub plate, Ashar brief, or EGA courtyard demo — not used during Phaser patrol. */
let mode: "hub" | "title" | "courtyard" = demoCourtyard ? "courtyard" : "hub";

let phaserGame: PhaserGame | null = null;

const pipeline = new RetroPipeline(
  renderer,
  LOW_W,
  LOW_H,
  meridianPalette.colors as string[],
  { usePost },
);

if (params.has("nodither")) {
  pipeline.setDitherStrength(0);
} else if (params.has("dither")) {
  pipeline.setDitherStrength(14);
}
if (params.has("scan")) {
  pipeline.setScanlineStrength(0.06);
}

function applyCourtyardLook(): void {
  pipeline.setPalette(egaPalette.colors as string[]);
  if (!params.has("nodither") && !params.has("dither")) {
    pipeline.setDitherStrength(8);
  }
}

if (demoCourtyard) {
  applyCourtyardLook();
}

/** Matches RetroPipeline constructor default unless ?nodither / ?dither. */
function ditherFromParams(): number {
  if (params.has("nodither")) return 0;
  if (params.has("dither")) return 14;
  return 9;
}

const introEl = document.getElementById("intro");
const hint = document.getElementById("hint");
const gameRoot = document.getElementById("game-root");

function isIntroVisible(): boolean {
  return Boolean(introEl && !introEl.hidden);
}

function showIntroOverlay(): void {
  if (!introEl) return;
  introEl.hidden = false;
  introEl.classList.remove("is-leaving");
}

function setHintBrief(): void {
  if (!hint) return;
  if (mode === "courtyard") {
    hint.textContent = usePost
      ? "EGA courtyard · 1 patrol · 2 brief · 3 deck · ESC — command deck · ?raw"
      : "?raw — no post";
    return;
  }
  if (mode === "title") {
    hint.textContent = usePost
      ? "Ashar briefing · ESC — command deck · 1 patrol · 3 EGA demo · ?raw"
      : "?raw — no post";
    return;
  }
  hint.textContent = usePost
    ? "1 patrol · 2 Ashar · 3 EGA demo · ESC — title · ?nodither · ?scan · ?raw"
    : "?raw — no post";
}

function setHintPatrol(): void {
  if (!hint) return;
  hint.textContent =
    "Patrol — FIRE at drones & boats · 90s to win · resupply every 4 waves · ESC — deck";
}

function showHudHint(): void {
  hint?.classList.add("is-visible");
}

function goDeck(): void {
  mode = "hub";
  pipeline.setPalette(meridianPalette.colors as string[]);
  pipeline.setDitherStrength(ditherFromParams());
}

function goCourtyard(): void {
  mode = "courtyard";
  applyCourtyardLook();
}

function goBrief(): void {
  mode = "title";
  pipeline.setPalette(asharPalette.colors as string[]);
  pipeline.setDitherStrength(ditherFromParams());
}

function dismissIntro(onComplete?: () => void): void {
  if (!introEl) {
    onComplete?.();
    return;
  }
  introEl.classList.add("is-leaving");
  window.setTimeout(() => {
    introEl.hidden = true;
    introEl.classList.remove("is-leaving");
    onComplete?.();
  }, 420);
}

async function startPatrol(): Promise<void> {
  if (phaserGame || !gameRoot) return;

  const { createPatrolGame } = await import("./game/launchGame");

  gameRoot.classList.add("is-active");
  gameRoot.innerHTML = "";
  document.body.classList.add("mode-game");

  phaserGame = createPatrolGame("game-root", () => {
    phaserGame = null;
    gameRoot.classList.remove("is-active");
    gameRoot.innerHTML = "";
    document.body.classList.remove("mode-game");
    if (demoCourtyard) {
      goCourtyard();
      if (introEl) introEl.hidden = true;
    } else {
      showIntroOverlay();
    }
    goDeck();
    setHintBrief();
    showHudHint();
  });

  setHintPatrol();
  showHudHint();
}

function wireIntro(): void {
  document.getElementById("btn-deck")?.addEventListener("click", () => {
    RetroAudio.playUi();
    dismissIntro(() => void startPatrol());
  });
  document.getElementById("btn-brief")?.addEventListener("click", () => {
    RetroAudio.playUi();
    dismissIntro(() => {
      goBrief();
      setHintBrief();
      showHudHint();
    });
  });
  document.getElementById("btn-courtyard")?.addEventListener("click", () => {
    RetroAudio.playUi();
    dismissIntro(() => {
      goCourtyard();
      setHintBrief();
      showHudHint();
    });
  });
}

function unlockAudioOnce(): void {
  RetroAudio.unlockAudio();
}
window.addEventListener(
  "pointerdown",
  () => {
    unlockAudioOnce();
  },
  { once: true, passive: true },
);
window.addEventListener(
  "keydown",
  () => {
    unlockAudioOnce();
  },
  { once: true },
);

wireIntro();

if (skipIntro || demoCourtyard) {
  if (introEl) introEl.hidden = true;
  setHintBrief();
  showHudHint();
} else {
  setHintBrief();
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  pipeline.resize(w, h);
  const aspect = usePost ? LOW_W / LOW_H : w / Math.max(1, h);
  hub.camera.aspect = aspect;
  hub.camera.updateProjectionMatrix();
  courtyard.camera.aspect = aspect;
  courtyard.camera.updateProjectionMatrix();
  phaserGame?.scale.refresh();
}

window.addEventListener("resize", resize);
resize();

function handleBackNavigation(): void {
  if (phaserGame) return;

  if (mode === "title" || mode === "courtyard") {
    goDeck();
    setHintBrief();
    showHudHint();
    return;
  }

  if (mode === "hub" && !isIntroVisible()) {
    showIntroOverlay();
    setHintBrief();
    showHudHint();
  }
}

window.addEventListener("keydown", (e) => {
  if (phaserGame) return;

  if (e.key === "Escape") {
    e.preventDefault();
    if (isIntroVisible()) return;
    handleBackNavigation();
    return;
  }

  if (e.key === "1") {
    e.preventDefault();
    RetroAudio.playUi();
    if (introEl && !introEl.hidden) {
      dismissIntro(() => void startPatrol());
    } else {
      void startPatrol();
    }
  }
  if (e.key === "2") {
    e.preventDefault();
    RetroAudio.playUi();
    if (introEl && !introEl.hidden) {
      dismissIntro(() => {
        goBrief();
        setHintBrief();
        showHudHint();
      });
    } else {
      goBrief();
      setHintBrief();
      showHudHint();
    }
  }
  if (e.key === "3") {
    e.preventDefault();
    RetroAudio.playUi();
    if (introEl && !introEl.hidden) {
      dismissIntro(() => {
        goCourtyard();
        setHintBrief();
        showHudHint();
      });
    } else if (mode === "courtyard") {
      goDeck();
      setHintBrief();
      showHudHint();
    } else {
      goCourtyard();
      setHintBrief();
      showHudHint();
    }
  }
});

function tick(): void {
  if (!phaserGame) {
    if (mode === "courtyard") {
      const t = performance.now();
      courtyard.root.rotation.y = Math.sin(t * 0.00035) * 0.07;
      courtyard.root.position.y = Math.sin(t * 0.0002) * 0.04;
    }
    if (mode === "hub") {
      pipeline.render(hub.scene, hub.camera);
    } else if (mode === "courtyard") {
      pipeline.render(courtyard.scene, courtyard.camera);
    } else {
      pipeline.render(title.scene, title.camera);
    }
  }
  requestAnimationFrame(tick);
}

tick();
