import * as THREE from "three";
import * as RetroAudio from "../audio/retroAudio";
import { buildAircraftCarrier } from "./carrierBase";

const PLANT_HP = 4;
const MISSILE_SPEED = 10;
const INTERCEPTOR_SPEED = 42;
const HIT_R = 2.4;
const SPAWN_EVERY_MS = 2200;
const WIN_SURVIVE_MS = 90_000;
const STARTING_INTERCEPTORS = 12;
const INTERCEPTOR_MAX = 24;
const RESUPPLY_EVERY_MS = 16_000;

export type InterceptOutcome = "playing" | "won" | "lost";

export type InterceptAPI = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update: (dt: number) => string;
  onPointerDown: (event: PointerEvent, domElement: HTMLElement) => void;
  getOutcome: () => InterceptOutcome;
  reset: () => void;
};

/**
 * Gulf SDI — Missile Command style: defend oil & desalination plants from inbound missiles.
 * Flat MeshBasic materials for stable retro palette read.
 */
function floatBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function intBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function createInterceptGame(): InterceptAPI {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a2840);
  scene.fog = new THREE.Fog(0x152038, 40, 95);

  const camera = new THREE.PerspectiveCamera(50, 320 / 256, 0.1, 220);
  camera.position.set(0, 36, 48);
  camera.lookAt(0, 5, -2);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 80),
    new THREE.MeshBasicMaterial({ color: 0x3d2e1a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -5);
  scene.add(ground);

  // Shallow gulf water band
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 22),
    new THREE.MeshBasicMaterial({ color: 0x0c1a28 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.02, 12);
  scene.add(water);

  type Plant = {
    mesh: THREE.Group;
    x: number;
    z: number;
    hp: number;
  };

  const plants: Plant[] = [];
  const plantXs = [-22, -11, 0, 11, 22];
  for (const x of plantXs) {
    const g = new THREE.Group();
    g.position.set(x, 0, -8);
    // Oil cluster (dark tanks)
    const oil = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2.2, 3),
      new THREE.MeshBasicMaterial({ color: 0x2a1810 }),
    );
    oil.position.y = 1.1;
    g.add(oil);
    // Desal / process (lighter block + blue hint)
    const desal = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 3, 2.2),
      new THREE.MeshBasicMaterial({ color: 0x4a3d32 }),
    );
    desal.position.set(2.2, 1.6, 0.5);
    g.add(desal);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 1),
      new THREE.MeshBasicMaterial({ color: 0x2d5a8c }),
    );
    blue.position.set(2.2, 3.2, 0.5);
    g.add(blue);
    scene.add(g);
    plants.push({ mesh: g, x, z: -8, hp: PLANT_HP });
  }

  const textureLoader = new THREE.TextureLoader();
  const carrier = buildAircraftCarrier(scene, textureLoader);

  type Missile = {
    mesh: THREE.Sprite;
    vel: THREE.Vector3;
    alive: boolean;
  };

  type Interceptor = {
    mesh: THREE.Sprite;
    vel: THREE.Vector3;
    alive: boolean;
  };

  const missiles: Missile[] = [];
  const interceptors: Interceptor[] = [];

  /** Shared materials — textures from /generated/*.png (Stability); tinted until load. */
  const inboundMat = new THREE.SpriteMaterial({
    color: 0xff4422,
    transparent: true,
    depthTest: true,
  });
  textureLoader.load(
    "/generated/missile-inbound.png",
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      inboundMat.map = tex;
      inboundMat.color.setHex(0xffffff);
      inboundMat.needsUpdate = true;
    },
    undefined,
    () => {
      /* solid colour fallback */
    },
  );

  const interceptorMat = new THREE.SpriteMaterial({
    color: 0xe6c84a,
    transparent: true,
    depthTest: true,
  });
  textureLoader.load(
    "/generated/missile-interceptor.png",
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      interceptorMat.map = tex;
      interceptorMat.color.setHex(0xffffff);
      interceptorMat.needsUpdate = true;
    },
    undefined,
    () => {
      /* fallback */
    },
  );

  let outcome: InterceptOutcome = "playing";
  let lastOutcome: InterceptOutcome = "playing";
  let timeMs = 0;
  let spawnAcc = 0;
  let resupplyAcc = 0;
  let interceptorsLeft = STARTING_INTERCEPTORS;
  let wave = 0;

  const tmpV = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const planeHit = new THREE.Vector3();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function alivePlants(): Plant[] {
    return plants.filter((p) => p.hp > 0);
  }

  function pickRandomPlant(): Plant | null {
    const a = alivePlants();
    if (a.length === 0) return null;
    return a[intBetween(0, a.length - 1)]!;
  }

  function spawnMissile(): void {
    if (outcome !== "playing") return;
    const target = pickRandomPlant();
    if (!target) return;

    const x = floatBetween(-28, 28);
    const z = floatBetween(-2, 18);
    const y = 22 + floatBetween(0, 8);

    const mesh = new THREE.Sprite(inboundMat);
    mesh.position.set(x, y, z);
    mesh.scale.set(1.8, 6.2, 1);
    mesh.center.set(0.5, 0.5);
    scene.add(mesh);

    tmpV.set(target.x, 1.5, target.z).sub(mesh.position).normalize();
    const vel = tmpV.multiplyScalar(MISSILE_SPEED);

    missiles.push({ mesh, vel: vel.clone(), alive: true });
    wave += 1;
  }

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
    const dir = planeHit.clone().sub(origin);
    if (dir.lengthSq() < 0.01) dir.set(0, 0.5, -1);
    dir.normalize().multiplyScalar(INTERCEPTOR_SPEED);

    const mesh = new THREE.Sprite(interceptorMat);
    mesh.position.copy(origin);
    mesh.scale.set(1.2, 3.8, 1);
    mesh.center.set(0.5, 0.5);
    scene.add(mesh);

    interceptors.push({ mesh, vel: dir.clone(), alive: true });
  }

  function update(dt: number): string {
    if (outcome !== "playing") {
      if (outcome !== lastOutcome) {
        lastOutcome = outcome;
        if (outcome === "won") RetroAudio.playWin();
        else RetroAudio.playLose();
      }
      return outcome === "won" ? "VICTORY — GULF HOLDING" : "CRITICAL INFRASTRUCTURE LOST";
    }
    lastOutcome = "playing";

    const dtMs = dt * 1000;
    timeMs += dtMs;
    spawnAcc += dtMs;
    resupplyAcc += dtMs;

    if (spawnAcc >= SPAWN_EVERY_MS) {
      spawnAcc = 0;
      const n = 1 + Math.min(2, Math.floor(timeMs / 25_000));
      for (let i = 0; i < n; i++) spawnMissile();
    }

    if (resupplyAcc >= RESUPPLY_EVERY_MS) {
      resupplyAcc = 0;
      const old = interceptorsLeft;
      interceptorsLeft = Math.min(INTERCEPTOR_MAX, interceptorsLeft + 6);
      if (interceptorsLeft > old) {
        /* resupply ping — audio handled in main if needed */
      }
    }

    // Missiles move
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
        m.alive = false;
        m.mesh.visible = false;
        if (target.p.hp <= 0) {
          target.p.mesh.visible = false;
        }
        if (alivePlants().length === 0) outcome = "lost";
      }

      if (m.mesh.position.y < 0.5) {
        m.alive = false;
        m.mesh.visible = false;
      }
    }

    // Interceptors move + hit missiles
    for (const s of interceptors) {
      if (!s.alive) continue;
      s.mesh.position.addScaledVector(s.vel, dt);

      for (const m of missiles) {
        if (!m.alive) continue;
        if (s.mesh.position.distanceTo(m.mesh.position) < HIT_R) {
          RetroAudio.playHit();
          m.alive = false;
          m.mesh.visible = false;
          s.alive = false;
          s.mesh.visible = false;
          break;
        }
      }

      if (s.mesh.position.length() > 120) {
        s.alive = false;
        s.mesh.visible = false;
      }
    }

    if (timeMs >= WIN_SURVIVE_MS && alivePlants().length > 0) {
      outcome = "won";
    }

    const t = Math.max(0, Math.ceil((WIN_SURVIVE_MS - timeMs) / 1000));
    const ap = alivePlants().length;
    return `CARRIER CVN · Gulf SDI · plants ${ap}/5 · interceptors ${interceptorsLeft} · time ${t}s · click · ESC`;
  }

  function getOutcome(): InterceptOutcome {
    return outcome;
  }

  function reset(): void {
    for (const m of missiles) m.mesh.removeFromParent();
    for (const s of interceptors) s.mesh.removeFromParent();
    missiles.length = 0;
    interceptors.length = 0;
    outcome = "playing";
    lastOutcome = "playing";
    timeMs = 0;
    spawnAcc = 0;
    resupplyAcc = 0;
    interceptorsLeft = STARTING_INTERCEPTORS;
    wave = 0;
    for (const p of plants) {
      p.hp = PLANT_HP;
      p.mesh.visible = true;
    }
  }

  return {
    scene,
    camera,
    update,
    onPointerDown: (e, el) => fireInterceptor(e.clientX, e.clientY, el),
    getOutcome,
    reset,
  };
}
