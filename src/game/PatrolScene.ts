import Phaser from "phaser";
import * as RetroAudio from "../audio/retroAudio";

// ---------------------------------------------------------------------------
// Canvas dimensions
// ---------------------------------------------------------------------------
const W = 320;
const H = 256;

// ---------------------------------------------------------------------------
// Sprite scales (source images are 1536×1536)
// ---------------------------------------------------------------------------
const SPRITE_SRC   = 1536;
const SCALE_PLAYER = 32  / SPRITE_SRC;
const SCALE_DRONE  = 26  / SPRITE_SRC;
const SCALE_BOAT   = 30  / SPRITE_SRC;
const SCALE_EXPL   = 48  / SPRITE_SRC;

// ---------------------------------------------------------------------------
// Background — single continuous strait image, tiled vertically
// ---------------------------------------------------------------------------
const BG_SRC_W  = 1152;
const BG_SRC_H  = 2016;
const BG_SCALE  = W / BG_SRC_W;
const BG_DISP_H = Math.round(BG_SRC_H * BG_SCALE);
const BG_KEY    = "bg-strait";

// ---------------------------------------------------------------------------
// Game rules
// ---------------------------------------------------------------------------
const TANKERS_START     = 100;
const PATRIOTS_START    = 8;
const PATRIOTS_MAX      = 16;
const PATRIOT_COOLDOWN  = 280;
const PATRIOT_SPEED     = 400;
const CANNON_COOLDOWN   = 85;
const CANNON_SPEED      = 540;
const WIN_MS            = 90_000;
const BG_SCROLL_SPEED   = 40;
const PLAYER_SPEED      = 170;
const HISCORE_KEY       = "hell-strait-hiscore";

const DEFENSE_LINE      = 236;
const INVINCIBILITY_MS  = 800;
const COMBO_WINDOW_MS   = 1500;

// AA guns
const AA_GUN_INTERVAL   = 2800;
const AA_BULLET_SPEED   = 110;

// Enemy fire
const DRONE_FIRE_INTERVAL = 2200;
const BOAT_FIRE_INTERVAL  = 1600;
const ENEMY_BULLET_SPEED  = 95;

// Depth layers
const DEPTH_BG       = 0;
const DEPTH_GROUND   = 4;
const DEPTH_CONVOY   = 8;
const DEPTH_THREAT   = 50;
const DEPTH_MISSILE  = 80;
const DEPTH_PLAYER   = 90;
const DEPTH_EXPL     = 100;
const DEPTH_VIGNETTE = 200;
const DEPTH_BANNER   = 400;
const DEPTH_HUD      = 900;
const DEPTH_GAMEOVER = 950;

type ThreatKind = "drone" | "boat";
type FormationKind = "v_drones" | "pincer" | "line_drones";

export class PatrolScene extends Phaser.Scene {
  // ── State ─────────────────────────────────────────────────────────────────
  private tankers       = TANKERS_START;
  private patriots      = PATRIOTS_START;
  private wave          = 0;
  private survivedMs    = 0;
  private score         = 0;
  private hi            = 0;
  private gameOver      = false;
  private lastPatriot   = 0;
  private lastCannon    = 0;
  private exited        = false;

  // Player
  private playerX       = W / 2;
  private playerY       = 200;
  private playerAngle   = 0;
  private playerHitTime = 0;

  // Combo
  private comboCount    = 0;
  private lastKillTime  = 0;

  // Zone surge
  private surgeFired      = false;
  private formationCounter = 0;

  // Tanker ship tier
  private tankerTier = 3;

  // ── Background ────────────────────────────────────────────────────────────
  private bgA!: Phaser.GameObjects.Image;
  private bgB!: Phaser.GameObjects.Image;

  // ── Game objects ──────────────────────────────────────────────────────────
  private player!:       Phaser.GameObjects.Image;
  private tankerShips:   (Phaser.GameObjects.Image | null)[] = [null, null, null];
  private vignette!:     Phaser.GameObjects.Graphics;
  private waveTimer!:    Phaser.Time.TimerEvent;

  // ── Input ─────────────────────────────────────────────────────────────────
  private cursors!:  Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!:     Phaser.Input.Keyboard.Key;
  private keyA!:     Phaser.Input.Keyboard.Key;
  private keyS!:     Phaser.Input.Keyboard.Key;
  private keyD!:     Phaser.Input.Keyboard.Key;
  private keyX!:     Phaser.Input.Keyboard.Key;

  // ── HUD ───────────────────────────────────────────────────────────────────
  private hudConvoyBar!:   Phaser.GameObjects.Graphics;
  private hudTankerCount!: Phaser.GameObjects.Text;
  private hudPatriots!:    Phaser.GameObjects.Text;
  private hudWave!:        Phaser.GameObjects.Text;
  private hudTime!:        Phaser.GameObjects.Text;
  private hudScore!:       Phaser.GameObjects.Text;
  private hudHi!:          Phaser.GameObjects.Text;

  // ── Physics groups ────────────────────────────────────────────────────────
  private enemies!:    Phaser.Physics.Arcade.Group;
  private shots!:      Phaser.Physics.Arcade.Group;
  private enemyShots!: Phaser.Physics.Arcade.Group;
  private aaGuns!:     Phaser.Physics.Arcade.Group;
  private aaShots!:    Phaser.Physics.Arcade.Group;
  private nextAaSpawn  = 0;

  // ==========================================================================
  constructor() { super({ key: "PatrolScene" }); }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  preload(): void {
    this.load.image("bg-strait",    "/generated/bg-strait.png");
    this.load.image("player-craft", "/generated/player-craft.png");
    this.load.image("enemy-drone",  "/generated/enemy-drone.png");
    this.load.image("enemy-boat",   "/generated/enemy-boat.png");
    this.load.image("explosion",    "/generated/explosion.png");
  }

  create(): void {
    RetroAudio.unlockAudio();
    try {
      const raw = localStorage.getItem(HISCORE_KEY);
      this.hi = raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
    } catch { this.hi = 0; }

    this.generateTextures();
    this.buildBackground();
    this.buildWorld();
    this.buildPlayer();
    this.buildInput();
    this.buildPhysicsGroups();
    this.buildHud();
    this.startWaves();
    this.showBanner("HELL STRAIT", "INTERCEPT ALL THREATS");
  }

  update(_t: number, delta: number): void {
    if (this.gameOver) return;

    this.scrollBackground(delta);
    this.movePlayer(delta);
    this.survivedMs += delta;

    // Cannon auto-fires while SPACE held
    if (this.cursors.space.isDown) this.fireCannon();

    this.tickEnemies(delta);
    this.tickEnemyShots();
    this.tickAaGuns(delta);
    this.cullShots();
    this.checkTankerThresholds();
    this.checkZoneSurge();
    this.updateVignette();

    if (this.survivedMs >= WIN_MS) this.endGame(true);
    this.updateHud();
  }

  // ==========================================================================
  // Setup
  // ==========================================================================

  private generateTextures(): void {
    // Patriot missile — gold teardrop
    const g = this.add.graphics();
    g.fillStyle(0xffe050); g.fillRect(0, 0, 3, 9);
    g.fillStyle(0xff9800); g.fillRect(0, 7, 3, 2);
    g.generateTexture("patriot", 3, 9); g.destroy();

    // Cannon round — white dart
    const g2 = this.add.graphics();
    g2.fillStyle(0xffffff); g2.fillRect(0, 0, 2, 5);
    g2.generateTexture("cannon-round", 2, 5); g2.destroy();

    // Enemy bullet — orange
    const eb = this.add.graphics();
    eb.fillStyle(0xff5500); eb.fillRect(0, 0, 3, 6);
    eb.generateTexture("enemy-bullet", 3, 6); eb.destroy();

    // AA gun
    const ag = this.add.graphics();
    ag.fillStyle(0x1a2a1a); ag.fillRect(0, 0, 7, 7);
    ag.fillStyle(0x4a6a3a); ag.fillRect(1, 1, 5, 5);
    ag.fillStyle(0xd94a2a); ag.fillRect(3, 0, 1, 4);
    ag.generateTexture("aa-gun", 7, 7); ag.destroy();

    // AA bullet
    const ab = this.add.graphics();
    ab.fillStyle(0xff4400); ab.fillRect(0, 0, 2, 4);
    ab.generateTexture("aa-bullet", 2, 4); ab.destroy();

    // Tanker ship (38×10)
    const tg = this.add.graphics();
    tg.fillStyle(0x1e3350); tg.fillRect(0, 4, 38, 6);        // hull
    tg.fillStyle(0x3a5870); tg.fillRect(5, 1, 16, 4);         // superstructure
    tg.fillStyle(0xc9a227); tg.fillRect(4, 3, 2, 2);          // port light
    tg.fillStyle(0xc9a227); tg.fillRect(32, 3, 2, 2);         // starboard light
    tg.fillStyle(0x555566); tg.fillRect(15, 0, 3, 3);         // funnel
    tg.generateTexture("tanker-ship", 38, 10); tg.destroy();
  }

  private buildBackground(): void {
    // Two tiles of the same image fill the screen; they alternate as they scroll
    this.bgA = this.add.image(W / 2,  BG_DISP_H / 2,             BG_KEY).setScale(BG_SCALE).setDepth(DEPTH_BG);
    this.bgB = this.add.image(W / 2,  BG_DISP_H / 2 - BG_DISP_H, BG_KEY).setScale(BG_SCALE).setDepth(DEPTH_BG);
  }

  private buildWorld(): void {
    // Subtle convoy line
    this.add.line(0, DEFENSE_LINE, 0, 0, W, 0, 0xffd040, 0.4)
      .setOrigin(0, 0.5).setLineWidth(1).setDepth(DEPTH_BG + 2);

    // Three tanker ships visible at the convoy line
    const positions = [64, 160, 256];
    for (let i = 0; i < 3; i++) {
      const ship = this.add.image(positions[i], DEFENSE_LINE + 10, "tanker-ship")
        .setDepth(DEPTH_CONVOY);
      this.tankerShips[i] = ship;
    }
  }

  private buildPlayer(): void {
    this.player = this.add
      .image(this.playerX, this.playerY, "player-craft")
      .setScale(SCALE_PLAYER)
      .setDepth(DEPTH_PLAYER);
  }

  private buildInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    const kb = this.input.keyboard!;
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyX = kb.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    // X key = Patriot auto-target
    kb.on("keydown-X", () => { if (!this.gameOver) this.firePatriot(null); });

    // Click = Patriot aimed at cursor
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.gameOver) this.firePatriot(p);
    });

    this.input.keyboard?.on("keydown-ESC", () => this.quitToTitle());
  }

  private buildPhysicsGroups(): void {
    this.enemies    = this.physics.add.group();
    this.shots      = this.physics.add.group();
    this.enemyShots = this.physics.add.group();
    this.aaGuns     = this.physics.add.group();
    this.aaShots    = this.physics.add.group();

    // Player shots → enemies
    this.physics.add.overlap(this.shots, this.enemies, (sObj, eObj) => {
      const shot  = sObj as Phaser.Physics.Arcade.Sprite;
      const enemy = eObj as Phaser.Physics.Arcade.Sprite;
      shot.destroy();
      this.killEnemy(enemy);
    }, undefined, this);

    // Player shots → AA guns
    this.physics.add.overlap(this.shots, this.aaGuns, (sObj, gObj) => {
      (sObj as Phaser.Physics.Arcade.Sprite).destroy();
      const gun = gObj as Phaser.Physics.Arcade.Sprite;
      this.explode(gun.x, gun.y);
      gun.destroy();
      this.scoreKill("aa", gun.x, gun.y);
    }, undefined, this);
  }

  private buildHud(): void {
    const ts: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "VT323, monospace", fontSize: "16px", color: "#e8eef2",
    };
    const z = DEPTH_HUD;

    // Top strip
    this.add.rectangle(W / 2, 14, W, 28, 0x000000, 0.55).setDepth(z - 1);

    this.hudTime  = this.add.text(W / 2, 3, "", ts).setOrigin(0.5, 0).setDepth(z);
    this.hudWave  = this.add.text(W - 6, 3, "", { ...ts, color: "#8a9ba8" }).setOrigin(1, 0).setDepth(z);
    this.hudScore = this.add.text(6, 3, "", { ...ts, color: "#c9a227" }).setDepth(z);
    this.hudPatriots = this.add.text(6, 19, "", { ...ts, fontSize: "13px" }).setDepth(z);
    this.hudHi    = this.add.text(W / 2, 19, "", { ...ts, fontSize: "13px", color: "#3a5060" })
      .setOrigin(0.5, 0).setDepth(z);
    this.add.text(W - 6, 19, "SPACE cannon · X/click patriot · ESC quit", {
      fontFamily: "VT323, monospace", fontSize: "10px", color: "#2a3a4a",
    }).setOrigin(1, 0).setDepth(z);

    // Tanker bar
    const BX = 6, BY = H / 2 + 20, BH = 100;
    this.add.rectangle(BX, BY, 8, BH, 0x111820).setDepth(z - 1);
    this.add.rectangle(BX, BY, 8, BH, 0x000000, 0).setStrokeStyle(1, 0x3d5468).setDepth(z - 1);
    this.add.text(BX, BY + 52, "TANKERS LEFT", {
      fontFamily: "VT323, monospace", fontSize: "10px", color: "#3d5468",
    }).setOrigin(0.5, 0).setAngle(-90).setDepth(z);
    this.hudTankerCount = this.add.text(BX, BY - BH / 2 - 14, "", {
      fontFamily: "VT323, monospace", fontSize: "13px", color: "#8a9ba8",
    }).setOrigin(0.5, 0).setDepth(z);
    this.hudConvoyBar = this.add.graphics().setDepth(z);

    // Vignette (critical health)
    this.vignette = this.add.graphics().setDepth(DEPTH_VIGNETTE);

    this.updateHud();
  }

  private startWaves(): void {
    this.time.delayedCall(1400, () => {
      this.spawnThreat("drone", Phaser.Math.Between(60, W - 60), "top");
    });
    this.time.delayedCall(3200, () => {
      RetroAudio.playAlert();
      this.spawnWave();
      this.waveTimer = this.time.addEvent({
        delay: 4000, callback: this.spawnWave, callbackScope: this, loop: true,
      });
    });
  }

  private showBanner(head: string, sub: string, color = "#e8dcc4"): void {
    const b = this.add.text(W / 2, H / 2 - 36, head, {
      fontFamily: "Libre Baskerville, Georgia, serif",
      fontSize: "26px", color,
    }).setOrigin(0.5).setDepth(DEPTH_BANNER);
    const s = this.add.text(W / 2, H / 2 - 4, sub, {
      fontFamily: "VT323, monospace", fontSize: "17px", color: "#c9a227",
    }).setOrigin(0.5).setDepth(DEPTH_BANNER);
    this.tweens.add({
      targets: [b, s], alpha: 0, delay: 2000, duration: 700,
      onComplete: () => { b.destroy(); s.destroy(); },
    });
  }

  // ==========================================================================
  // Per-frame
  // ==========================================================================

  private scrollBackground(delta: number): void {
    const dy   = BG_SCROLL_SPEED * (delta / 1000);
    const half = BG_DISP_H / 2;
    this.bgA.y += dy;
    this.bgB.y += dy;
    // Wrap whichever tile scrolls fully below the screen back to above the other
    if (this.bgA.y - half > H) this.bgA.y = this.bgB.y - BG_DISP_H;
    if (this.bgB.y - half > H) this.bgB.y = this.bgA.y - BG_DISP_H;
  }

  private movePlayer(delta: number): void {
    const spd = PLAYER_SPEED * (delta / 1000);
    const leftHeld  = this.cursors.left.isDown  || this.keyA.isDown;
    const rightHeld = this.cursors.right.isDown || this.keyD.isDown;
    const upHeld    = this.cursors.up.isDown    || this.keyW.isDown;
    const downHeld  = this.cursors.down.isDown  || this.keyS.isDown;

    if (leftHeld)  this.playerX -= spd;
    if (rightHeld) this.playerX += spd;
    if (upHeld)    this.playerY -= spd * 0.7;
    if (downHeld)  this.playerY += spd * 0.7;

    this.playerX = Phaser.Math.Clamp(this.playerX, 18, W - 18);
    this.playerY = Phaser.Math.Clamp(this.playerY, 38, H - 16);

    // Tilt toward movement direction
    const targetAngle = leftHeld ? -14 : rightHeld ? 14 : 0;
    this.playerAngle  = Phaser.Math.Linear(this.playerAngle, targetAngle, 0.14);

    this.player.x = this.playerX;
    this.player.y = this.playerY;
    this.player.setAngle(this.playerAngle);

    // Flash during invincibility
    if (this.playerHitTime > 0) {
      const elapsed = this.time.now - this.playerHitTime;
      if (elapsed < INVINCIBILITY_MS) {
        this.player.alpha = Math.sin(elapsed / 60) > 0 ? 1 : 0.25;
      } else {
        this.player.alpha = 1;
        this.playerHitTime = 0;
      }
    }
  }

  private tickEnemies(delta: number): void {
    const now = this.time.now;
    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Phaser.Physics.Arcade.Sprite;
      if (!e.active) return;

      // Drone sine-wave drift
      if (e.getData("kind") === "drone") {
        const phase = (e.getData("phase") as number) + delta * 0.003;
        e.setData("phase", phase);
        const amp = e.getData("amp") as number;
        const b = e.body as Phaser.Physics.Arcade.Body;
        b.setVelocityX(Math.sin(phase) * amp);
        e.setRotation(Math.atan2(b.velocity.y, b.velocity.x) + Math.PI / 2);
      }

      // Enemy fires back
      const nextFire = e.getData("nextFire") as number;
      if (now >= nextFire) {
        const kind  = e.getData("kind") as ThreatKind;
        const delay = kind === "drone" ? DRONE_FIRE_INTERVAL : BOAT_FIRE_INTERVAL;
        e.setData("nextFire", now + delay + Phaser.Math.Between(-300, 300));
        this.fireEnemyShot(e.x, e.y, kind);
      }

      // Reached convoy
      if (e.y > DEFENSE_LINE) {
        const dmg = (e.getData("kind") as ThreatKind) === "boat" ? 4 : 1;
        this.tankers = Math.max(0, this.tankers - dmg);
        this.spawnFloater(e.x, DEFENSE_LINE - 10, `-${dmg}`, "#ff4444");
        this.cameras.main.shake(120, 0.006);
        RetroAudio.playDamage();
        e.destroy();
        this.updateHud();
        if (this.tankers <= 0) this.endGame(false);
      } else if (e.y < -80 || e.x < -80 || e.x > W + 80) {
        e.destroy();
      }
    });
  }

  private tickEnemyShots(): void {
    if (this.playerHitTime > 0) {
      // Still invincible — cull shots near player silently
      this.enemyShots.getChildren().forEach((obj) => {
        const b = obj as Phaser.Physics.Arcade.Sprite;
        if (Phaser.Math.Distance.Between(b.x, b.y, this.playerX, this.playerY) < 10) b.destroy();
      });
      return;
    }
    this.enemyShots.getChildren().forEach((obj) => {
      const b = obj as Phaser.Physics.Arcade.Sprite;
      if (!b.active) return;
      if (Phaser.Math.Distance.Between(b.x, b.y, this.playerX, this.playerY) < 9) {
        b.destroy();
        this.playerHitTime = this.time.now;
        this.tankers = Math.max(0, this.tankers - 2);
        this.spawnFloater(this.playerX, this.playerY - 14, "-2", "#ff4444");
        this.cameras.main.shake(100, 0.005);
        RetroAudio.playDamage();
        this.updateHud();
        if (this.tankers <= 0) this.endGame(false);
      }
    });
  }

  private tickAaGuns(delta: number): void {
    const now = this.time.now;
    if (now > this.nextAaSpawn) {
      this.nextAaSpawn = now + Phaser.Math.Between(2800, 4200);
      const side = Math.random() < 0.5 ? "left" : "right";
      const gx   = side === "left" ? Phaser.Math.Between(4, 18) : Phaser.Math.Between(W - 18, W - 4);
      const gun  = this.aaGuns.create(gx, -10, "aa-gun") as Phaser.Physics.Arcade.Sprite;
      gun.setDepth(DEPTH_GROUND);
      gun.setData("nextFire", now + 1200);
      (gun.body as Phaser.Physics.Arcade.Body).setVelocityY(BG_SCROLL_SPEED);
    }
    this.aaGuns.getChildren().forEach((obj) => {
      const gun = obj as Phaser.Physics.Arcade.Sprite;
      if (!gun.active) return;
      if (gun.y > H + 20) { gun.destroy(); return; }
      const nextFire = gun.getData("nextFire") as number;
      if (now >= nextFire) {
        gun.setData("nextFire", now + AA_GUN_INTERVAL);
        const angle  = Phaser.Math.Angle.Between(gun.x, gun.y, this.playerX, this.playerY);
        const bullet = this.aaShots.create(gun.x, gun.y - 4, "aa-bullet") as Phaser.Physics.Arcade.Sprite;
        bullet.setDepth(DEPTH_MISSILE - 1);
        (bullet.body as Phaser.Physics.Arcade.Body).setVelocity(
          Math.cos(angle) * AA_BULLET_SPEED, Math.sin(angle) * AA_BULLET_SPEED,
        );
      }
    });
    // AA bullets hit player
    if (this.playerHitTime <= 0) {
      this.aaShots.getChildren().forEach((obj) => {
        const b = obj as Phaser.Physics.Arcade.Sprite;
        if (!b.active) return;
        if (Phaser.Math.Distance.Between(b.x, b.y, this.playerX, this.playerY) < 9) {
          b.destroy();
          this.playerHitTime = this.time.now;
          this.tankers = Math.max(0, this.tankers - 2);
          this.spawnFloater(this.playerX, this.playerY - 14, "-2", "#ff4444");
          this.cameras.main.shake(100, 0.005);
          RetroAudio.playDamage();
          this.updateHud();
          if (this.tankers <= 0) this.endGame(false);
        }
      });
    }
  }

  private cullShots(): void {
    [...this.shots.getChildren(), ...this.enemyShots.getChildren(),
      ...this.aaShots.getChildren()].forEach((obj) => {
      const s = obj as Phaser.Physics.Arcade.Sprite;
      if (s.y < -30 || s.y > H + 30 || s.x < -30 || s.x > W + 30) s.destroy();
    });
  }

  private checkTankerThresholds(): void {
    const expectedTier = this.tankers > 66 ? 3 : this.tankers > 33 ? 2 : this.tankers > 0 ? 1 : 0;
    while (this.tankerTier > expectedTier) {
      this.tankerTier--;
      const ship = this.tankerShips[this.tankerTier];
      if (ship) {
        this.explode(ship.x, ship.y);
        this.cameras.main.flash(200, 200, 20, 20);
        this.tweens.add({
          targets: ship, alpha: 0, duration: 500,
          onComplete: () => { ship.destroy(); this.tankerShips[this.tankerTier] = null; },
        });
      }
    }
  }

  private checkZoneSurge(): void {
    if (this.survivedMs >= 60_000 && !this.surgeFired) {
      this.surgeFired = true;
      this.waveTimer.remove();
      this.waveTimer = this.time.addEvent({
        delay: 2200, callback: this.spawnWave, callbackScope: this, loop: true,
      });
      this.showBanner("FINAL APPROACH", "ALL UNITS INBOUND", "#d94a2a");
      RetroAudio.playAlert();
    }
  }

  private updateVignette(): void {
    const pct = this.tankers / TANKERS_START;
    this.vignette.clear();
    if (pct <= 0.20) {
      const intensity = (1 - pct / 0.20) * 0.35 * (0.5 + 0.5 * Math.sin(this.survivedMs / 140));
      if (intensity > 0.01) {
        this.vignette.fillStyle(0xff0000, intensity);
        this.vignette.fillRect(0, 0, 18, H);
        this.vignette.fillRect(W - 18, 0, 18, H);
        this.vignette.fillRect(0, 0, W, 14);
        this.vignette.fillRect(0, H - 14, W, 14);
      }
    }
  }

  // ==========================================================================
  // Actions
  // ==========================================================================

  private firePatriot(pointer: Phaser.Input.Pointer | null): void {
    if (this.gameOver) return;
    const now = this.time.now;
    if (now - this.lastPatriot < PATRIOT_COOLDOWN) return;
    if (this.patriots <= 0) return;

    this.patriots -= 1;
    this.lastPatriot = now;
    RetroAudio.playFire();

    const px = this.playerX, py = this.playerY - 10;
    let vx = 0, vy = -PATRIOT_SPEED;

    if (pointer) {
      const a = Phaser.Math.Angle.Between(px, py, pointer.x, pointer.y);
      vx = Math.cos(a) * PATRIOT_SPEED; vy = Math.sin(a) * PATRIOT_SPEED;
    } else {
      let minDist = Infinity;
      this.enemies.getChildren().forEach((obj) => {
        const e = obj as Phaser.Physics.Arcade.Sprite;
        if (!e.active) return;
        const d = Phaser.Math.Distance.Between(px, py, e.x, e.y);
        if (d < minDist) {
          minDist = d;
          const a = Phaser.Math.Angle.Between(px, py, e.x, e.y);
          vx = Math.cos(a) * PATRIOT_SPEED; vy = Math.sin(a) * PATRIOT_SPEED;
        }
      });
    }

    const shot = this.shots.create(px, py, "patriot") as Phaser.Physics.Arcade.Sprite;
    shot.setDepth(DEPTH_MISSILE);
    shot.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
    (shot.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
    this.updateHud();
  }

  private fireCannon(): void {
    if (this.gameOver) return;
    const now = this.time.now;
    if (now - this.lastCannon < CANNON_COOLDOWN) return;
    this.lastCannon = now;
    for (const ox of [-3, 3]) {
      const r = this.shots.create(this.playerX + ox, this.playerY - 8, "cannon-round") as Phaser.Physics.Arcade.Sprite;
      r.setDepth(DEPTH_MISSILE);
      (r.body as Phaser.Physics.Arcade.Body).setVelocity(ox * 10, -CANNON_SPEED);
    }
  }

  private fireEnemyShot(x: number, y: number, kind: ThreatKind): void {
    const speed = ENEMY_BULLET_SPEED;
    let vx = 0, vy = speed;
    if (kind === "boat") {
      // Boats aim at player
      const a = Phaser.Math.Angle.Between(x, y, this.playerX, this.playerY);
      vx = Math.cos(a) * speed; vy = Math.sin(a) * speed;
    }
    const b = this.enemyShots.create(x, y, "enemy-bullet") as Phaser.Physics.Arcade.Sprite;
    b.setDepth(DEPTH_MISSILE - 1);
    b.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
    (b.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    const kind = enemy.getData("kind") as ThreatKind;
    const { x, y } = enemy;
    enemy.destroy();
    this.explode(x, y);
    this.cameras.main.flash(40, 18, 38, 52, false);
    this.scoreKill(kind, x, y);
  }

  private scoreKill(kind: ThreatKind | "aa", x: number, y: number): void {
    const base = kind === "boat" ? 40 : kind === "aa" ? 25 : 15;
    const now  = this.time.now;
    this.comboCount = (now - this.lastKillTime < COMBO_WINDOW_MS) ? this.comboCount + 1 : 1;
    this.lastKillTime = now;

    const mult   = Math.min(4, this.comboCount);
    const points = base * mult;
    this.score  += points;

    // Score popup
    const col = mult >= 4 ? "#ffe050" : mult >= 3 ? "#ff8c42" : mult >= 2 ? "#7cfcb4" : "#e8eef2";
    const txt = mult > 1 ? `+${points} ×${mult}` : `+${points}`;
    this.spawnFloater(x, y - 8, txt, col);

    if (mult === 4) this.spawnFloater(W / 2, H / 2 - 24, "MAX COMBO!", "#ffe050");

    RetroAudio.playHit();
    this.updateHud();
  }

  private explode(x: number, y: number): void {
    const expl = this.add.image(x, y, "explosion")
      .setScale(SCALE_EXPL).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_EXPL);
    this.tweens.add({
      targets: expl, alpha: 0, scale: SCALE_EXPL * 2, duration: 450, ease: "Quad.easeOut",
      onComplete: () => expl.destroy(),
    });
  }

  private spawnFloater(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: "VT323, monospace", fontSize: "18px", color,
    }).setOrigin(0.5).setDepth(DEPTH_EXPL + 1);
    this.tweens.add({
      targets: t, y: y - 30, alpha: 0, duration: 900, ease: "Quad.easeOut",
      onComplete: () => t.destroy(),
    });
  }

  // ==========================================================================
  // Spawning
  // ==========================================================================

  private spawnWave(): void {
    if (this.gameOver) return;
    this.wave += 1;

    // Every 3rd wave after wave 3 is a formation
    this.formationCounter++;
    if (this.wave > 3 && this.formationCounter >= 3) {
      this.formationCounter = 0;
      const kinds: FormationKind[] = this.wave > 8
        ? ["v_drones", "pincer", "line_drones"]
        : ["v_drones", "pincer"];
      this.spawnFormation(kinds[Phaser.Math.Between(0, kinds.length - 1)]);
    } else {
      const count = 1 + Math.min(6, Math.floor(this.wave / 2));
      for (let i = 0; i < count; i++) {
        this.time.delayedCall(i * 180, () => this.spawnRandomThreat());
      }
    }

    // Patriot resupply every 4 waves
    if (this.wave > 1 && this.wave % 4 === 0) {
      const prev = this.patriots;
      this.patriots = Math.min(PATRIOTS_MAX, this.patriots + 5);
      if (this.patriots > prev) {
        RetroAudio.playUi();
        this.spawnFloater(W / 2, H / 2, "PATRIOTS RESUPPLIED", "#7cfcb4");
      }
    }

    this.updateHud();
  }

  private spawnRandomThreat(): void {
    if (this.gameOver) return;
    if (Math.random() < 0.22) {
      this.spawnThreat("boat", 0, Math.random() < 0.5 ? "left" : "right");
    } else {
      this.spawnThreat("drone", Phaser.Math.Between(20, W - 20), "top");
    }
  }

  private spawnFormation(kind: FormationKind): void {
    if (this.gameOver) return;
    switch (kind) {
      case "v_drones": {
        const cx = Phaser.Math.Between(80, W - 80);
        this.spawnThreat("drone", cx, "top");
        this.time.delayedCall(180, () => {
          this.spawnThreat("drone", cx - 28, "top");
          this.spawnThreat("drone", cx + 28, "top");
        });
        this.time.delayedCall(360, () => {
          this.spawnThreat("drone", cx - 56, "top");
          this.spawnThreat("drone", cx + 56, "top");
        });
        this.spawnFloater(W / 2, 60, "DRONE FORMATION", "#d94a2a");
        break;
      }
      case "pincer": {
        this.spawnThreat("boat", 0, "left");
        this.spawnThreat("boat", 0, "right");
        this.time.delayedCall(600, () => {
          if (!this.gameOver) {
            this.spawnThreat("boat", 0, "left");
            this.spawnThreat("boat", 0, "right");
          }
        });
        this.spawnFloater(W / 2, 60, "PINCER ATTACK", "#d94a2a");
        break;
      }
      case "line_drones": {
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(i * 160, () => {
            this.spawnThreat("drone", 32 + i * 64, "top");
          });
        }
        this.spawnFloater(W / 2, 60, "BROADSIDE SWEEP", "#d94a2a");
        break;
      }
    }
  }

  private spawnThreat(kind: ThreatKind, x: number, entry: "top" | "left" | "right"): void {
    if (this.gameOver) return;
    const key   = kind === "boat" ? "enemy-boat"  : "enemy-drone";
    const scale = kind === "boat" ? SCALE_BOAT     : SCALE_DRONE;
    let sx: number, sy: number, vx: number, vy: number;

    if (entry === "top") {
      sx = x; sy = -30;
      vx = Phaser.Math.Between(-25, 25); vy = Phaser.Math.Between(60, 95);
    } else if (entry === "left") {
      sx = -32; sy = Phaser.Math.Between(10, 60);
      vx = Phaser.Math.Between(30, 55); vy = Phaser.Math.Between(40, 68);
    } else {
      sx = W + 32; sy = Phaser.Math.Between(10, 60);
      vx = Phaser.Math.Between(-55, -30); vy = Phaser.Math.Between(40, 68);
    }

    const sprite = this.enemies.create(sx, sy, key) as Phaser.Physics.Arcade.Sprite;
    sprite.setScale(scale).setDepth(DEPTH_THREAT).setData("kind", kind);

    if (kind === "drone") {
      sprite.setData("phase", Math.random() * Math.PI * 2);
      sprite.setData("amp", Phaser.Math.Between(28, 55));
    }

    // Fire timer — staggered so not everyone fires at once
    sprite.setData("nextFire",
      this.time.now + Phaser.Math.Between(800, 2400));

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(false);
    body.setSize(SPRITE_SRC * 0.60, SPRITE_SRC * 0.60);
    body.setVelocity(vx, vy);
    sprite.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
  }

  // ==========================================================================
  // Game over
  // ==========================================================================

  private getGrade(): string {
    const pct = this.tankers / TANKERS_START;
    if (pct >= 0.80) return "S";
    if (pct >= 0.60) return "A";
    if (pct >= 0.40) return "B";
    if (pct >= 0.20) return "C";
    return "D";
  }

  private endGame(won: boolean): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();
    this.vignette.clear();

    won ? RetroAudio.playWin() : RetroAudio.playLose();

    if (won) {
      try {
        if (this.score > this.hi) { this.hi = this.score; localStorage.setItem(HISCORE_KEY, String(this.score)); }
      } catch { /**/ }
    }

    const grade = won ? this.getGrade() : "—";
    const head  = won ? `VICTORY  ${grade}` : "CONVOY LOST";
    const body  = won
      ? `${this.tankers} tankers saved · wave ${this.wave}\nSCORE  ${this.score}`
      : `${Math.floor(this.survivedMs / 1000)}s survived · wave ${this.wave}\nSCORE  ${this.score}`;
    const gradeColor = grade === "S" ? "#ffe050" : grade === "A" ? "#7cfcb4" : grade === "B" ? "#4a90d9" : "#c9a227";

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(DEPTH_GAMEOVER - 1);
    this.add.text(W / 2, H / 2 - 40, head, {
      fontFamily: "Libre Baskerville, Georgia, serif",
      fontSize: "26px", color: won ? gradeColor : "#ff6655", align: "center",
    }).setOrigin(0.5).setDepth(DEPTH_GAMEOVER);
    this.add.text(W / 2, H / 2 + 6, body, {
      fontFamily: "VT323, monospace", fontSize: "20px", color: "#e8eef2", align: "center",
    }).setOrigin(0.5).setDepth(DEPTH_GAMEOVER);
    this.add.text(W / 2, H / 2 + 68, "ENTER / ESC — menu  ·  R — play again", {
      fontFamily: "VT323, monospace", fontSize: "15px", color: "#8a9ba8", align: "center",
    }).setOrigin(0.5).setDepth(DEPTH_GAMEOVER);

    const kb = this.input.keyboard;
    kb?.once("keydown-ENTER", () => this.quitToTitle());
    kb?.once("keydown-ESC",   () => this.quitToTitle());
    kb?.once("keydown-R",     () => this.scene.restart());
  }

  // ==========================================================================
  // HUD
  // ==========================================================================

  private updateHud(): void {
    const rem = Math.max(0, Math.ceil((WIN_MS - this.survivedMs) / 1000));
    const pct = this.tankers / TANKERS_START;

    this.hudTankerCount.setText(`${this.tankers}`);
    this.hudPatriots.setText(`PAT ${this.patriots}/${PATRIOTS_MAX}`);
    this.hudWave.setText(`W${this.wave}`);
    this.hudTime.setText(`${rem}s`);
    this.hudScore.setText(`${this.score}`);
    this.hudHi.setText(`HI ${this.hi}`);

    let colour: number; let colourHex: string;
    if      (pct > 0.6)  { colour = 0x7cfcb4; colourHex = "#7cfcb4"; }
    else if (pct > 0.35) { colour = 0xe6c84a; colourHex = "#e6c84a"; }
    else if (pct > 0.15) { colour = 0xd94a2a; colourHex = "#d94a2a"; }
    else                 { colour = 0xff2222; colourHex = "#ff2222"; }
    this.hudTankerCount.setColor(colourHex);

    const BH = 100, BX = 3, BAR_TOP = H / 2 - 30;
    this.hudConvoyBar.clear();
    const fillH = Math.round(BH * pct);
    if (fillH > 0) {
      this.hudConvoyBar.fillStyle(colour, 0.9);
      this.hudConvoyBar.fillRect(BX, BAR_TOP + (BH - fillH), 6, fillH);
    }
    if (pct <= 0.15) {
      const pulse = Math.sin(this.survivedMs / 120) > 0 ? 0xff2222 : 0x660000;
      this.hudConvoyBar.lineStyle(1, pulse, 1);
      this.hudConvoyBar.strokeRect(BX, BAR_TOP, 6, BH);
    }
  }

  // ==========================================================================
  // Exit
  // ==========================================================================

  private quitToTitle(): void {
    if (this.exited) return;
    this.exited = true;
    const cb = this.game.registry.get("onExit") as (() => void) | undefined;
    this.game.destroy(true, false);
    cb?.();
  }
}
