import * as THREE from "three";
import * as RetroAudio from "../audio/retroAudio";
import meridianPalette from "../palettes/meridian.json";
import { buildAircraftCarrier } from "./carrierBase";
import {
  makeInboundSpriteTexture,
  makeInterceptorSpriteTexture,
} from "./interceptSprites";

const PLANT_HP = 4;
const MISSILE_SPEED = 10;
const INTERCEPTOR_SPEED = 32;
const BLAST_R = 8;
const SPAWN_EVERY_MS = 2200;
const WIN_SURVIVE_MS = 90_000;
const STARTING_INTERCEPTORS = 12;
const INTERCEPTOR_MAX = 24;
const RESUPPLY_EVERY_MS = 16_000;
const COMBO_WINDOW_MS = 1500;
const SURGE_MS = 60_000;
const HISCORE_KEY = "hell-strait-sdi-hiscore";

export type InterceptOutcome = "playing" | "won" | "lost";

type WaveKind = "normal" | "salvo" | "saturation" | "scatter";

export type InterceptState = {
  outcome: InterceptOutcome;
  plants: number;
  plantsMax: number;
  interceptors: number;
  interceptorsMax: number;
  timeRemaining: number;
  score: number;
  hi: number;
  wave: number;
  combo: number;
  banner: string | null;
};

export type InterceptAPI = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update: (dt: number) => InterceptState;
  onPointerDown: (event: PointerEvent, domElement: HTMLElement) => void;
  getOutcome: () => InterceptOutcome;
  getState: () => InterceptState;
  getGrade: () => string;
  reset: () => void;
};

function floatBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function intBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function createInterceptGame(): InterceptAPI {
  const P = meridianPalette.colors as string[];
  const c = (hex: string) => new THREE.Color(hex);

  let hi = 0;
  try {
    const raw = localStorage.getItem(HISCORE_KEY);
    hi = raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch { hi = 0; }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050a12);

  const camera = new THREE.PerspectiveCamera(50, 320 / 256, 0.1, 220);
  camera.position.set(0, 36, 48);
  camera.lookAt(0, 5, -2);

  const textureLoader = new THREE.TextureLoader();

  // ── Stability-generated background ──────────────────────────────────────
  const bgMat = new THREE.MeshBasicMaterial({ color: c(P[3]!) });
  const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), bgMat);
  bgPlane.position.set(0, 20, -45);
  scene.add(bgPlane);

  textureLoader.load(
    "/generated/gulf-bg.png",
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      bgMat.map = tex;
      bgMat.color.setHex(0xffffff);
      bgMat.needsUpdate = true;
    },
    undefined,
    () => { /* keep flat colour */ },
  );

  // Ground plane (in front of backdrop)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 40),
    new THREE.MeshBasicMaterial({ color: c(P[3]!) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.1, -5);
  scene.add(ground);

  // Gulf water band
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 22),
    new THREE.MeshBasicMaterial({ color: c(P[2]!) }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.02, 12);
  scene.add(water);

  // Flash overlay
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xff2200,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const flashQuad = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), flashMat);
  flashQuad.position.set(0, 0, camera.position.z - 1);
  flashQuad.renderOrder = 999;
  scene.add(flashQuad);
  let flashTimer = 0;

  // ── Plants (oil infrastructure) ─────────────────────────────────────────

  type Plant = { mesh: THREE.Group; x: number; z: number; hp: number };

  const plants: Plant[] = [];
  const plantXs = [-22, -11, 0, 11, 22];
  for (const x of plantXs) {
    const g = new THREE.Group();
    g.position.set(x, 0, -8);
    const oil = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2.2, 3),
      new THREE.MeshBasicMaterial({ color: c(P[1]!) }),
    );
    oil.position.y = 1.1;
    g.add(oil);
    const desal = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 3, 2.2),
      new THREE.MeshBasicMaterial({ color: c(P[4]!) }),
    );
    desal.position.set(2.2, 1.6, 0.5);
    g.add(desal);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 1),
      new THREE.MeshBasicMaterial({ color: c(P[12]!) }),
    );
    blue.position.set(2.2, 3.2, 0.5);
    g.add(blue);
    scene.add(g);
    plants.push({ mesh: g, x, z: -8, hp: PLANT_HP });
  }

  // ── Carrier (scaled down) ──────────────────────────────────────────────
  const carrier = buildAircraftCarrier(scene, textureLoader);
  carrier.group.scale.set(0.6, 0.6, 0.6);
  carrier.group.position.set(0, 0, 20);

  // ── Missile textures: Stability PNGs with canvas fallback ──────────────

  const inboundFallbackTex = makeInboundSpriteTexture();
  const interceptorFallbackTex = makeInterceptorSpriteTexture();

  const inboundMat = new THREE.SpriteMaterial({
    map: inboundFallbackTex,
    color: 0xffffff,
    transparent: true,
    depthTest: true,
    fog: false,
    alphaTest: 0.01,
  });

  textureLoader.load(
    "/generated/missile-inbound.png",
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      inboundMat.map = tex;
      inboundMat.needsUpdate = true;
    },
    undefined,
    () => { /* keep canvas fallback */ },
  );

  const interceptorMat = new THREE.SpriteMaterial({
    map: interceptorFallbackTex,
    color: 0xffffff,
    transparent: true,
    depthTest: true,
    fog: false,
    alphaTest: 0.01,
  });

  textureLoader.load(
    "/generated/missile-interceptor.png",
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      interceptorMat.map = tex;
      interceptorMat.needsUpdate = true;
    },
    undefined,
    () => { /* keep canvas fallback */ },
  );

  // Explosion texture
  const explTex = (() => {
    const sz = 32;
    const cv = document.createElement("canvas");
    cv.width = sz;
    cv.height = sz;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const r = sz / 2;
    ctx.fillStyle = "#ffe050";
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff6600";
    ctx.beginPath();
    ctx.arc(r, r, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(r, r, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  })();

  // ── Entity types ───────────────────────────────────────────────────────

  type Missile = { mesh: THREE.Sprite; vel: THREE.Vector3; alive: boolean };
  type Interceptor = {
    mesh: THREE.Sprite;
    vel: THREE.Vector3;
    target: THREE.Vector3;
    alive: boolean;
  };
  type Explosion = { mesh: THREE.Sprite; age: number; maxAge: number };

  const missiles: Missile[] = [];
  const interceptors: Interceptor[] = [];
  const explosions: Explosion[] = [];

  // ── State ──────────────────────────────────────────────────────────────

  let outcome: InterceptOutcome = "playing";
  let lastOutcome: InterceptOutcome = "playing";
  let timeMs = 0;
  let spawnAcc = 0;
  let resupplyAcc = 0;
  let interceptorsLeft = STARTING_INTERCEPTORS;
  let wave = 0;
  let score = 0;
  let comboCount = 0;
  let lastKillTime = 0;
  let banner: string | null = null;
  let bannerTimer = 0;
  let surgeFired = false;
  let waveKindAcc = 0;

  const tmpV = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const planeHit = new THREE.Vector3();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // ── Helpers ────────────────────────────────────────────────────────────

  function alivePlants(): Plant[] {
    return plants.filter((p) => p.hp > 0);
  }

  function pickRandomPlant(): Plant | null {
    const a = alivePlants();
    if (a.length === 0) return null;
    return a[intBetween(0, a.length - 1)]!;
  }

  function showBanner(text: string, durationMs = 2200): void {
    banner = text;
    bannerTimer = durationMs;
  }

  function spawnExplosion(pos: THREE.Vector3, big = false): void {
    const mat = new THREE.SpriteMaterial({
      map: explTex,
      transparent: true,
      opacity: 1,
      depthTest: true,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Sprite(mat);
    mesh.position.copy(pos);
    const startSize = big ? 6 : 3;
    mesh.scale.set(startSize, startSize, 1);
    mesh.renderOrder = 100;
    scene.add(mesh);
    explosions.push({ mesh, age: 0, maxAge: big ? 0.65 : 0.4 });
  }

  function triggerFlash(color: number, intensity: number): void {
    flashMat.color.setHex(color);
    flashMat.opacity = intensity;
    flashTimer = 0.15;
  }

  function blastAtPoint(pos: THREE.Vector3): number {
    let kills = 0;
    for (const m of missiles) {
      if (!m.alive) continue;
      if (m.mesh.position.distanceTo(pos) < BLAST_R) {
        m.alive = false;
        m.mesh.visible = false;
        spawnExplosion(m.mesh.position.clone());
        kills++;
      }
    }
    return kills;
  }

  // ── Spawning ───────────────────────────────────────────────────────────

  function spawnMissile(): void {
    if (outcome !== "playing") return;
    const target = pickRandomPlant();
    if (!target) return;

    const x = floatBetween(-28, 28);
    const z = floatBetween(-2, 18);
    const y = 22 + floatBetween(0, 8);

    const mesh = new THREE.Sprite(inboundMat);
    mesh.position.set(x, y, z);
    mesh.scale.set(3, 9, 1);
    mesh.center.set(0.5, 0.5);
    scene.add(mesh);

    tmpV.set(target.x, 1.5, target.z).sub(mesh.position).normalize();
    const vel = tmpV.multiplyScalar(MISSILE_SPEED);

    missiles.push({ mesh, vel: vel.clone(), alive: true });
  }

  function pickWaveKind(): WaveKind {
    if (wave < 4) return "normal";
    waveKindAcc++;
    if (waveKindAcc >= 3) {
      waveKindAcc = 0;
      const kinds: WaveKind[] = wave > 8
        ? ["salvo", "saturation", "scatter"]
        : ["salvo", "scatter"];
      return kinds[intBetween(0, kinds.length - 1)]!;
    }
    return "normal";
  }

  function spawnWave(): void {
    wave += 1;
    const kind = pickWaveKind();
    const n = 1 + Math.min(3, Math.floor(timeMs / 25_000));

    switch (kind) {
      case "salvo":
        showBanner("MISSILE SALVO");
        for (let i = 0; i < n + 2; i++) {
          setTimeout(() => spawnMissile(), i * 150);
        }
        break;
      case "saturation":
        showBanner("SATURATION STRIKE");
        for (let i = 0; i < n + 4; i++) {
          setTimeout(() => spawnMissile(), i * 80);
        }
        break;
      case "scatter":
        showBanner("SCATTER PATTERN");
        for (let i = 0; i < n + 1; i++) spawnMissile();
        break;
      default:
        for (let i = 0; i < n; i++) spawnMissile();
        break;
    }
  }

  function scoreIntercept(kills: number): void {
    const base = 30;
    const now = timeMs;
    for (let i = 0; i < kills; i++) {
      comboCount = (now - lastKillTime < COMBO_WINDOW_MS) ? comboCount + 1 : 1;
      lastKillTime = now;
      const mult = Math.min(4, comboCount);
      score += base * mult;
    }
  }

  // ── Fire interceptor ───────────────────────────────────────────────────

  function fireInterceptor(clientX: number, clientY: number, domElement: HTMLElement): void {
    if (outcome !== "playing" || interceptorsLeft <= 0) return;

    const rect = domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    raycaster.ray.intersectPlane(groundPlane, planeHit);
    if (!Number.isFinite(planeHit.x)) return;

    interceptorsLeft -= 1;
    RetroAudio.playFire();

    carrier.group.updateMatrixWorld(true);
    const origin = carrier.getFireWorldPosition();
    const target = planeHit.clone();
    target.y = 10;
    const dir = target.clone().sub(origin);
    if (dir.lengthSq() < 0.01) dir.set(0, 0.5, -1);
    dir.normalize().multiplyScalar(INTERCEPTOR_SPEED);

    const mesh = new THREE.Sprite(interceptorMat);
    mesh.position.copy(origin);
    mesh.scale.set(2, 6, 1);
    mesh.center.set(0.5, 0.5);
    scene.add(mesh);

    interceptors.push({ mesh, vel: dir.clone(), target, alive: true });
  }

  // ── Grade ──────────────────────────────────────────────────────────────

  function getGrade(): string {
    const pct = alivePlants().length / plants.length;
    if (pct >= 0.8) return "S";
    if (pct >= 0.6) return "A";
    if (pct >= 0.4) return "B";
    if (pct >= 0.2) return "C";
    return "D";
  }

  function buildState(): InterceptState {
    return {
      outcome,
      plants: alivePlants().length,
      plantsMax: plants.length,
      interceptors: interceptorsLeft,
      interceptorsMax: INTERCEPTOR_MAX,
      timeRemaining: Math.max(0, Math.ceil((WIN_SURVIVE_MS - timeMs) / 1000)),
      score,
      hi,
      wave,
      combo: comboCount,
      banner,
    };
  }

  // ── Update loop ────────────────────────────────────────────────────────

  function update(dt: number): InterceptState {
    if (outcome !== "playing") {
      if (outcome !== lastOutcome) {
        lastOutcome = outcome;
        if (outcome === "won") {
          RetroAudio.playWin();
          try {
            if (score > hi) {
              hi = score;
              localStorage.setItem(HISCORE_KEY, String(score));
            }
          } catch { /**/ }
        } else {
          RetroAudio.playLose();
        }
      }
      tickExplosions(dt);
      tickFlash(dt);
      return buildState();
    }
    lastOutcome = "playing";

    const dtMs = dt * 1000;
    timeMs += dtMs;
    spawnAcc += dtMs;
    resupplyAcc += dtMs;

    if (banner && bannerTimer > 0) {
      bannerTimer -= dtMs;
      if (bannerTimer <= 0) banner = null;
    }

    if (!surgeFired && timeMs >= SURGE_MS) {
      surgeFired = true;
      showBanner("FINAL SALVO — ALL UNITS");
      RetroAudio.playAlert();
    }

    if (spawnAcc >= (surgeFired ? SPAWN_EVERY_MS * 0.55 : SPAWN_EVERY_MS)) {
      spawnAcc = 0;
      spawnWave();
    }

    if (resupplyAcc >= RESUPPLY_EVERY_MS) {
      resupplyAcc = 0;
      const old = interceptorsLeft;
      interceptorsLeft = Math.min(INTERCEPTOR_MAX, interceptorsLeft + 6);
      if (interceptorsLeft > old) {
        showBanner("INTERCEPTORS RESUPPLIED");
        RetroAudio.playUi();
      }
    }

    // Missiles move toward plants
    for (const m of missiles) {
      if (!m.alive) continue;
      m.mesh.position.addScaledVector(m.vel, dt);

      const target = plants.reduce(
        (best, p) => {
          if (p.hp <= 0) return best;
          const d = m.mesh.position.distanceToSquared(tmpV.set(p.x, 1.5, p.z));
          return d < best.d ? { d, p } : best;
        },
        { d: Infinity as number, p: null as Plant | null },
      );

      if (target.p && m.mesh.position.distanceTo(tmpV.set(target.p.x, 1.5, target.p.z)) < 2.2) {
        target.p.hp -= 1;
        RetroAudio.playDamage();
        spawnExplosion(m.mesh.position.clone());
        triggerFlash(0xff2200, 0.25);
        m.alive = false;
        m.mesh.visible = false;
        if (target.p.hp <= 0) {
          target.p.mesh.visible = false;
          triggerFlash(0xff0000, 0.5);
        }
        if (alivePlants().length === 0) outcome = "lost";
      }

      if (m.mesh.position.y < 0.5) {
        m.alive = false;
        m.mesh.visible = false;
      }
    }

    // Interceptors: fly to target, DETONATE on arrival (Missile Command style)
    for (const s of interceptors) {
      if (!s.alive) continue;
      s.mesh.position.addScaledVector(s.vel, dt);

      const distToTarget = s.mesh.position.distanceTo(s.target);
      if (distToTarget < INTERCEPTOR_SPEED * dt * 1.5 || distToTarget < 2.5) {
        s.alive = false;
        s.mesh.visible = false;
        spawnExplosion(s.target.clone(), true);
        RetroAudio.playHit();
        const kills = blastAtPoint(s.target);
        if (kills > 0) {
          scoreIntercept(kills);
          triggerFlash(0x1a3a5a, 0.18);
        }
        continue;
      }

      if (s.mesh.position.length() > 120) {
        s.alive = false;
        s.mesh.visible = false;
      }
    }

    tickExplosions(dt);
    tickFlash(dt);

    if (timeMs >= WIN_SURVIVE_MS && alivePlants().length > 0) {
      outcome = "won";
    }

    return buildState();
  }

  function tickExplosions(dt: number): void {
    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i]!;
      e.age += dt;
      const t = e.age / e.maxAge;
      if (t >= 1) {
        e.mesh.removeFromParent();
        (e.mesh.material as THREE.SpriteMaterial).dispose();
        explosions.splice(i, 1);
        continue;
      }
      const s = 3 + t * 12;
      e.mesh.scale.set(s, s, 1);
      (e.mesh.material as THREE.SpriteMaterial).opacity = 1 - t;
    }
  }

  function tickFlash(dt: number): void {
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) {
        flashMat.opacity = 0;
      } else {
        flashMat.opacity *= 0.88;
      }
    }
  }

  function getOutcome(): InterceptOutcome {
    return outcome;
  }

  function reset(): void {
    for (const m of missiles) m.mesh.removeFromParent();
    for (const s of interceptors) s.mesh.removeFromParent();
    for (const e of explosions) {
      e.mesh.removeFromParent();
      (e.mesh.material as THREE.SpriteMaterial).dispose();
    }
    missiles.length = 0;
    interceptors.length = 0;
    explosions.length = 0;
    outcome = "playing";
    lastOutcome = "playing";
    timeMs = 0;
    spawnAcc = 0;
    resupplyAcc = 0;
    interceptorsLeft = STARTING_INTERCEPTORS;
    wave = 0;
    score = 0;
    comboCount = 0;
    lastKillTime = 0;
    banner = null;
    bannerTimer = 0;
    surgeFired = false;
    waveKindAcc = 0;
    flashMat.opacity = 0;
    flashTimer = 0;
    for (const p of plants) {
      p.hp = PLANT_HP;
      p.mesh.visible = true;
    }
    try {
      const raw = localStorage.getItem(HISCORE_KEY);
      hi = raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
    } catch { hi = 0; }
  }

  return {
    scene,
    camera,
    update,
    onPointerDown: (e, el) => fireInterceptor(e.clientX, e.clientY, el),
    getOutcome,
    getState: buildState,
    getGrade,
    reset,
  };
}
