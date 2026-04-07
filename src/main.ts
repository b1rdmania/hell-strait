import * as THREE from "three";
import type { Game as PhaserGame } from "phaser";
import { RetroPipeline } from "./retro/RetroPipeline";
import { buildMeridianHub } from "./scenes/meridianHub";
import { createInterceptGame, type InterceptState } from "./scenes/interceptScene";
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
let interceptGameOver = false;

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
const gulfBriefEl = document.getElementById("gulf-sdi-brief");
const hintEl = document.getElementById("hint");
const gameRoot = document.getElementById("game-root");

// Gulf SDI HUD
const gulfHud = document.getElementById("gulf-hud");
const ghScore = document.getElementById("gh-score");
const ghTime = document.getElementById("gh-time");
const ghWave = document.getElementById("gh-wave");
const ghPlants = document.getElementById("gh-plants");
const ghInterceptors = document.getElementById("gh-interceptors");
const ghHi = document.getElementById("gh-hi");
const ghBanner = document.getElementById("gh-banner");
const ghCombo = document.getElementById("gh-combo");

// Gulf SDI Game Over
const gulfGameOver = document.getElementById("gulf-gameover");
const goHead = document.getElementById("go-head");
const goBody = document.getElementById("go-body");

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

// ---------------------------------------------------------------------------
// Gulf SDI HUD management
// ---------------------------------------------------------------------------

let lastBanner: string | null = null;
let lastCombo = 0;
let comboFadeTimer = 0;

function initGulfHud(): void {
  if (!ghPlants) return;
  ghPlants.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const d = document.createElement("div");
    d.className = "gh-plant";
    ghPlants.appendChild(d);
  }
  lastBanner = null;
  lastCombo = 0;
  comboFadeTimer = 0;
}

function updateGulfHud(state: InterceptState, dt: number): void {
  if (ghScore) ghScore.textContent = `${state.score}`;
  if (ghTime) ghTime.textContent = `${state.timeRemaining}s`;
  if (ghWave) ghWave.textContent = `W${state.wave}/${state.totalWaves}`;
  if (ghHi) ghHi.textContent = `HI ${state.hi}`;
  if (ghInterceptors) ghInterceptors.textContent = `SM-3 ×${state.interceptors}`;

  if (ghPlants) {
    const items = ghPlants.children;
    for (let i = 0; i < items.length; i++) {
      const alive = i < state.plants;
      items[i]!.classList.toggle("dead", !alive);
    }
  }

  // Banner
  if (ghBanner) {
    if (state.banner && state.banner !== lastBanner) {
      ghBanner.textContent = state.banner;
      ghBanner.classList.add("show");
    } else if (!state.banner) {
      ghBanner.classList.remove("show");
    }
    lastBanner = state.banner;
  }

  // Combo
  if (ghCombo) {
    if (state.combo > 1 && state.combo !== lastCombo) {
      ghCombo.textContent = `×${state.combo} COMBO`;
      ghCombo.classList.add("show");
      comboFadeTimer = 1.2;
    }
    if (comboFadeTimer > 0) {
      comboFadeTimer -= dt;
      if (comboFadeTimer <= 0) ghCombo.classList.remove("show");
    }
    lastCombo = state.combo;
  }
}

function showGulfGameOver(state: InterceptState): void {
  if (!gulfGameOver || !goHead || !goBody) return;
  interceptGameOver = true;
  const won = state.outcome === "won";
  const grade = intercept.getGrade();
  const gradeColor = grade === "S" ? "#ffe050" : grade === "A" ? "#7cfcb4" : grade === "B" ? "#4a90d9" : "#c9a227";

  goHead.textContent = won ? `VICTORY  ${grade}` : "INFRASTRUCTURE LOST";
  goHead.style.color = won ? gradeColor : "#ff6655";

  const hiLine = state.score >= state.hi ? " ★ NEW HI" : `  HI ${state.hi}`;
  const body = won
    ? `${state.plants} plants defended · wave ${state.wave}/${state.totalWaves}\nSCORE  ${state.score}${hiLine}`
    : `${90 - state.timeRemaining}s survived · wave ${state.wave}/${state.totalWaves}\nSCORE  ${state.score}${hiLine}`;
  goBody.textContent = body;

  gulfGameOver.classList.add("is-active");
}

function hideGulfGameOver(): void {
  interceptGameOver = false;
  gulfGameOver?.classList.remove("is-active");
}

// ---------------------------------------------------------------------------
// Gulf SDI — start / stop
// ---------------------------------------------------------------------------

function showGulfBrief(): void {
  if (gulfBriefEl) {
    show(gulfBriefEl);
  } else {
    startIntercept();
  }
}

function startIntercept(): void {
  if (phaserGame || interceptMode) return;
  intercept.reset();
  interceptMode = true;
  interceptGameOver = false;
  if (usePost) {
    pipeline.setPaletteQuantize(false);
    pipeline.setDitherStrength(0);
    pipeline.setScanlineStrength(0);
  }
  if (introEl) introEl.hidden = true;
  if (briefingEl) briefingEl.hidden = true;
  if (gulfBriefEl) gulfBriefEl.hidden = true;
  gulfHud?.classList.add("is-active");
  initGulfHud();
  setHint("CLICK — SM-3 interceptor · SPACE — CIWS · ESC — menu");
}

function stopIntercept(): void {
  if (!interceptMode) return;
  interceptMode = false;
  interceptGameOver = false;
  if (usePost) {
    pipeline.setPaletteQuantize(hubPostState.quantize);
    pipeline.setDitherStrength(hubPostState.dither);
    pipeline.setScanlineStrength(hubPostState.scan);
  }
  gulfHud?.classList.remove("is-active");
  hideGulfGameOver();
  show(introEl);
  setHint("1 patrol · 2 briefing · 3 Gulf SDI (carrier)");
}

function restartIntercept(): void {
  hideGulfGameOver();
  intercept.reset();
  interceptGameOver = false;
  initGulfHud();
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

// Gulf SDI — pointer on Three canvas (SM-3)
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!interceptMode || interceptGameOver) return;
  intercept.onPointerDown(e, renderer.domElement);
});

// Gulf SDI — SPACE key for CIWS (held = rapid fire)
const ciwsKeys = new Set<string>();
window.addEventListener("keydown", (e) => {
  if (e.key === " " && interceptMode && !interceptGameOver) {
    e.preventDefault();
    ciwsKeys.add(e.key);
  }
});
window.addEventListener("keyup", (e) => {
  ciwsKeys.delete(e.key);
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
  hide(introEl, () => showGulfBrief());
});

document.getElementById("brief-play")?.addEventListener("click", () => {
  RetroAudio.playUi();
  hide(briefingEl, () => void startPatrol());
});
document.getElementById("brief-back")?.addEventListener("click", () => {
  RetroAudio.playUi();
  hide(briefingEl, () => show(introEl));
});

// Gulf SDI briefing buttons
document.getElementById("gulf-play")?.addEventListener("click", () => {
  RetroAudio.playUi();
  hide(gulfBriefEl, () => startIntercept());
});
document.getElementById("gulf-back")?.addEventListener("click", () => {
  RetroAudio.playUi();
  hide(gulfBriefEl, () => show(introEl));
});

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

window.addEventListener("keydown", (e) => {
  if (phaserGame) return;

  if (interceptMode) {
    if (interceptGameOver) {
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        restartIntercept();
        return;
      }
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        RetroAudio.playUi();
        stopIntercept();
        return;
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      RetroAudio.playUi();
      stopIntercept();
    }
    return;
  }

  const introVisible = introEl && !introEl.hidden;
  const briefingVisible = briefingEl && !briefingEl.hidden;
  const gulfBriefVisible = gulfBriefEl && !gulfBriefEl.hidden;

  if (e.key === "Escape") {
    e.preventDefault();
    if (gulfBriefVisible) {
      RetroAudio.playUi();
      hide(gulfBriefEl, () => show(introEl));
    } else if (briefingVisible) {
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
    if (gulfBriefVisible) hide(gulfBriefEl, () => void startPatrol());
    else if (introVisible) hide(introEl, () => void startPatrol());
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
    if (introVisible) hide(introEl, () => showGulfBrief());
    else if (gulfBriefVisible) {
      hide(gulfBriefEl, () => startIntercept());
    } else {
      showGulfBrief();
    }
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

let prevOutcome: string = "playing";

function tick(): void {
  const dt = clock.getDelta();

  if (phaserGame) {
    requestAnimationFrame(tick);
    return;
  }

  if (interceptMode) {
    if (ciwsKeys.has(" ")) intercept.fireCiws();
    const state = intercept.update(dt);
    updateGulfHud(state, dt);

    if (state.outcome !== "playing" && prevOutcome === "playing") {
      showGulfGameOver(state);
    }
    prevOutcome = state.outcome;

    pipeline.render(intercept.scene, intercept.camera);
  } else {
    prevOutcome = "playing";
    pipeline.render(hub.scene, hub.camera);
  }

  requestAnimationFrame(tick);
}

tick();
