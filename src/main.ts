import * as THREE from "three";
import type { Game as PhaserGame } from "phaser";
import { RetroPipeline } from "./retro/RetroPipeline";
import { buildMeridianHub } from "./scenes/meridianHub";
import { createInterceptGame } from "./scenes/interceptScene";
import * as RetroAudio from "./audio/retroAudio";
import meridianPalette from "./palettes/meridian.json";

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

const hub = buildMeridianHub();
const intercept = createInterceptGame();
const clock = new THREE.Clock();

let phaserGame: PhaserGame | null = null;
let interceptMode = false;

const pipeline = new RetroPipeline(
  renderer,
  LOW_W,
  LOW_H,
  meridianPalette.colors as string[],
  { usePost },
);

if (params.has("nodither")) pipeline.setDitherStrength(0);
else if (params.has("dither")) pipeline.setDitherStrength(14);
if (params.has("scan")) pipeline.setScanlineStrength(0.06);

/** Meridian post used on hub — Gulf SDI matches Patrol (full colour @ 320×256, no quantize/dither). */
const hubPostState = {
  quantize: true,
  dither: pipeline.material.uniforms.uDitherStrength.value as number,
  scan: pipeline.material.uniforms.uScanlineStrength.value as number,
};

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const introEl = document.getElementById("intro");
const briefingEl = document.getElementById("briefing");
const hintEl = document.getElementById("hint");
const gameRoot = document.getElementById("game-root");

function show(el: HTMLElement | null): void {
  if (!el) return;
  el.hidden = false;
  el.classList.remove("is-leaving");
}

function hide(el: HTMLElement | null, onComplete?: () => void): void {
  if (!el) {
    onComplete?.();
    return;
  }
  el.classList.add("is-leaving");
  window.setTimeout(() => {
    el.hidden = true;
    el.classList.remove("is-leaving");
    onComplete?.();
  }, 380);
}

function setHint(text: string): void {
  if (!hintEl) return;
  hintEl.textContent = text;
  hintEl.classList.add("is-visible");
}

function startIntercept(): void {
  if (phaserGame || interceptMode) return;
  intercept.reset();
  interceptMode = true;
  if (usePost) {
    pipeline.setPaletteQuantize(false);
    pipeline.setDitherStrength(0);
    pipeline.setScanlineStrength(0);
  }
  if (introEl) introEl.hidden = true;
  if (briefingEl) briefingEl.hidden = true;
  setHint("Gulf SDI — click to launch interceptors from the carrier · ESC — menu");
}

function stopIntercept(): void {
  if (!interceptMode) return;
  interceptMode = false;
  if (usePost) {
    pipeline.setPaletteQuantize(hubPostState.quantize);
    pipeline.setDitherStrength(hubPostState.dither);
    pipeline.setScanlineStrength(hubPostState.scan);
  }
  show(introEl);
  setHint("1 patrol · 2 briefing · 3 Gulf SDI (carrier)");
}

// ---------------------------------------------------------------------------
// Patrol game
// ---------------------------------------------------------------------------

async function startPatrol(): Promise<void> {
  if (phaserGame || !gameRoot || interceptMode) return;

  const { createPatrolGame } = await import("./game/launchGame");

  gameRoot.classList.add("is-active");
  gameRoot.innerHTML = "";
  document.body.classList.add("mode-game");
  setHint("← → move · SPACE/CLICK patriot · Z cannon · ESC quit");

  phaserGame = createPatrolGame("game-root", () => {
    phaserGame = null;
    gameRoot.classList.remove("is-active");
    gameRoot.innerHTML = "";
    document.body.classList.remove("mode-game");
    show(introEl);
    setHint("1 patrol · 2 briefing · 3 Gulf SDI");
  });
}

// ---------------------------------------------------------------------------
// Audio unlock (requires user gesture)
// ---------------------------------------------------------------------------

let audioUnlocked = false;
function unlockOnce(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;
  RetroAudio.unlockAudio();
}
window.addEventListener("pointerdown", unlockOnce, { once: true, passive: true });
window.addEventListener("keydown", unlockOnce, { once: true });

// Gulf SDI — pointer on Three canvas
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!interceptMode) return;
  intercept.onPointerDown(e, renderer.domElement);
});

// ---------------------------------------------------------------------------
// Button wiring
// ---------------------------------------------------------------------------

document.getElementById("btn-deck")?.addEventListener("click", () => {
  RetroAudio.playUi();
  hide(introEl, () => void startPatrol());
});
document.getElementById("btn-brief")?.addEventListener("click", () => {
  RetroAudio.playUi();
  hide(introEl, () => show(briefingEl));
});
document.getElementById("btn-intercept")?.addEventListener("click", () => {
  RetroAudio.playUi();
  hide(introEl, () => startIntercept());
});

document.getElementById("brief-play")?.addEventListener("click", () => {
  RetroAudio.playUi();
  hide(briefingEl, () => void startPatrol());
});
document.getElementById("brief-back")?.addEventListener("click", () => {
  RetroAudio.playUi();
  hide(briefingEl, () => show(introEl));
});

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

window.addEventListener("keydown", (e) => {
  if (phaserGame) return;

  if (interceptMode) {
    if (e.key === "Escape") {
      e.preventDefault();
      RetroAudio.playUi();
      stopIntercept();
    }
    return;
  }

  const introVisible = introEl && !introEl.hidden;
  const briefingVisible = briefingEl && !briefingEl.hidden;

  if (e.key === "Escape") {
    e.preventDefault();
    if (briefingVisible) {
      RetroAudio.playUi();
      hide(briefingEl, () => show(introEl));
    } else if (!introVisible) {
      show(introEl);
    }
    return;
  }

  if (e.key === "1") {
    e.preventDefault();
    RetroAudio.playUi();
    if (introVisible) hide(introEl, () => void startPatrol());
    else if (briefingVisible) hide(briefingEl, () => void startPatrol());
    else void startPatrol();
  }

  if (e.key === "2" && introVisible) {
    e.preventDefault();
    RetroAudio.playUi();
    hide(introEl, () => show(briefingEl));
  }

  if (e.key === "3") {
    e.preventDefault();
    RetroAudio.playUi();
    if (introVisible) hide(introEl, () => startIntercept());
    else startIntercept();
  }
});

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

function resize(): void {
  pipeline.resize(window.innerWidth, window.innerHeight);
  phaserGame?.scale.refresh();
}

window.addEventListener("resize", resize);
resize();

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

if (skipIntro && introEl) introEl.hidden = true;
setHint("1 patrol · 2 briefing · 3 Gulf SDI (carrier)");

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

function tick(): void {
  const dt = clock.getDelta();

  if (phaserGame) {
    requestAnimationFrame(tick);
    return;
  }

  if (interceptMode) {
    setHint(intercept.update(dt));
    pipeline.render(intercept.scene, intercept.camera);
  } else {
    pipeline.render(hub.scene, hub.camera);
  }

  requestAnimationFrame(tick);
}

tick();
