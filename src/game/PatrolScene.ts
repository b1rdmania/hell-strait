import Phaser from "phaser";
import * as RetroAudio from "../audio/retroAudio";

const W = 320;
const H = 256;
const TANKERS_START = 100;
const BALLISTICS_START = 8;
const BALLISTICS_MAX = 16;
/** Gold line — enemies crossing this damage the convoy */
const DEFENSE_LINE = 236;
const FIRE_COOLDOWN_MS = 320;
const MISSILE_SPEED = 480;
const WIN_MS = 90_000;
const HISCORE_KEY = "hell-strait-hiscore";

const DEPTH_BG = 0;
const DEPTH_STARS = 5;
const DEPTH_CONVOY = 8;
const DEPTH_THREAT = 50;
const DEPTH_MISSILE = 80;
const DEPTH_BANNER = 400;
const DEPTH_HUD = 900;
const DEPTH_GAMEOVER = 950;

type ThreatKind = "drone" | "boat";

/**
 * Patrol — full strait defence: sprite-based threats, reliable Arcade physics, HUD on top.
 */
export class PatrolScene extends Phaser.Scene {
  private tankers = TANKERS_START;
  private ballistics = BALLISTICS_START;
  private wave = 0;
  private survivedMs = 0;
  private score = 0;
  private hi = 0;
  private gameOver = false;
  private lastFire = 0;
  private exited = false;

  private hudTankers!: Phaser.GameObjects.Text;
  private hudMissiles!: Phaser.GameObjects.Text;
  private hudWave!: Phaser.GameObjects.Text;
  private hudTime!: Phaser.GameObjects.Text;
  private hudScore!: Phaser.GameObjects.Text;
  private hudHi!: Phaser.GameObjects.Text;
  private hudLegend!: Phaser.GameObjects.Text;
  private hudHint!: Phaser.GameObjects.Text;

  private enemies!: Phaser.Physics.Arcade.Group;
  private shots!: Phaser.Physics.Arcade.Group;

  constructor() {
    super({ key: "PatrolScene" });
  }

  create(): void {
    RetroAudio.unlockAudio();

    try {
      const raw = localStorage.getItem(HISCORE_KEY);
      this.hi = raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
    } catch {
      this.hi = 0;
    }

    this.ensureTextures();
    this.drawWorld();

    this.enemies = this.physics.add.group({ runChildUpdate: false });
    this.shots = this.physics.add.group({ runChildUpdate: false });

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "VT323, monospace",
      fontSize: "17px",
      color: "#e8eef2",
    };

    const z = DEPTH_HUD;
    this.hudTankers = this.add.text(8, 4, "", textStyle).setDepth(z);
    this.hudMissiles = this.add.text(8, 22, "", textStyle).setDepth(z);
    this.hudWave = this.add.text(W - 8, 4, "", textStyle).setOrigin(1, 0).setDepth(z);
    this.hudTime = this.add.text(W / 2, 4, "", textStyle).setOrigin(0.5, 0).setDepth(z);
    this.hudScore = this.add
      .text(8, 40, "", { ...textStyle, fontSize: "16px", color: "#c9a227" })
      .setDepth(z);
    this.hudHi = this.add
      .text(W - 8, 40, "", { ...textStyle, fontSize: "16px", color: "#8a9ba8" })
      .setOrigin(1, 0)
      .setDepth(z);

    this.hudLegend = this.add
      .text(W / 2, 62, "", {
        fontFamily: "VT323, monospace",
        fontSize: "14px",
        color: "#8a9ba8",
      })
      .setOrigin(0.5, 0)
      .setDepth(z);

    this.hudHint = this.add
      .text(W / 2, H - 10, "", {
        fontFamily: "VT323, monospace",
        fontSize: "14px",
        color: "#6a7a88",
      })
      .setOrigin(0.5, 1)
      .setDepth(z);

    this.physics.add.overlap(
      this.shots,
      this.enemies,
      (shotObj, enemyObj) => {
        const shot = shotObj as Phaser.Physics.Arcade.Sprite;
        const enemy = enemyObj as Phaser.Physics.Arcade.Sprite;
        const kind = enemy.getData("kind") as ThreatKind | undefined;
        shot.destroy();
        enemy.destroy();
        this.score += kind === "boat" ? 40 : 15;
        RetroAudio.playHit();
        this.cameras.main.flash(65, 18, 38, 52, false);
        this.updateHud();
      },
      undefined,
      this,
    );

    this.input.on("pointerdown", this.tryFire, this);
    this.input.keyboard?.on("keydown-ESC", () => this.quitToTitle());

    const banner = this.add
      .text(W / 2, H / 2 - 36, "HELL STRAIT", {
        fontFamily: "Libre Baskerville, Georgia, serif",
        fontSize: "26px",
        color: "#e8dcc4",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_BANNER);
    const sub = this.add
      .text(W / 2, H / 2 - 4, "AIR & SURFACE THREATS — INTERCEPT", {
        fontFamily: "VT323, monospace",
        fontSize: "18px",
        color: "#c9a227",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_BANNER);

    this.tweens.add({
      targets: [banner, sub],
      alpha: 0,
      delay: 1600,
      duration: 700,
      onComplete: () => {
        banner.destroy();
        sub.destroy();
      },
    });

    // Early spawns so threats are visible immediately
    this.time.delayedCall(400, () => {
      this.spawnPairDemo();
    });

    this.time.delayedCall(1200, () => {
      RetroAudio.playAlert();
      this.spawnWaveTick();
      this.time.addEvent({
        delay: 2600,
        callback: () => this.spawnWaveTick(),
        callbackScope: this,
        loop: true,
      });
    });

    this.hudLegend.setText("▲ ORANGE = air drone   ■ BROWN = boat drone   (cross gold line = −1 tanker)");
    this.hudHint.setText("CLICK / TAP to fire ballistics   ·   ESC — debrief");
    this.updateHud();
  }

  /** Pixel-art style textures — one atlas for predictable physics bounds */
  private ensureTextures(): void {
    const t = this.textures;
    if (t.exists("hs_drone")) return;

    const off = () => {
      const g = this.add.graphics();
      g.setPosition(-2000, -2000);
      return g;
    };

    let g = off();
    g.fillStyle(0xff3d1f, 1);
    g.fillTriangle(9, 2, 16, 16, 2, 16);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeTriangle(9, 2, 16, 16, 2, 16);
    g.fillStyle(0xffaa66, 1);
    g.fillCircle(9, 12, 2);
    g.generateTexture("hs_drone", 18, 18);
    g.destroy();

    g = off();
    g.fillStyle(0x1a1510, 1);
    g.fillRoundedRect(0, 6, 36, 14, 3);
    g.fillStyle(0x8b5a2b, 1);
    g.fillRoundedRect(2, 8, 32, 10, 2);
    g.lineStyle(2, 0xffcc88, 1);
    g.strokeRoundedRect(2, 8, 32, 10, 2);
    g.fillStyle(0x4a90d9, 0.75);
    g.fillEllipse(18, 20, 14, 5);
    g.fillStyle(0x2a2018, 1);
    g.fillRect(14, 4, 8, 6);
    g.generateTexture("hs_boat", 38, 26);
    g.destroy();

    g = off();
    g.fillStyle(0xffe066, 1);
    g.fillRect(0, 0, 4, 14);
    g.fillStyle(0xfff5cc, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture("hs_missile", 4, 14);
    g.destroy();
  }

  private drawWorld(): void {
    const g = this.add.graphics().setDepth(DEPTH_BG);
    g.fillGradientStyle(0x1a2840, 0x1a2840, 0x0a1520, 0x0a1520, 1);
    g.fillRect(0, 0, W, 118);
    g.fillGradientStyle(0x0d1520, 0x0d1520, 0x050a12, 0x050a12, 1);
    g.fillRect(0, 118, W, 92);
    g.fillStyle(0x050a12, 1);
    g.fillRect(0, 200, W, 56);

    this.add
      .line(0, DEFENSE_LINE, 0, 0, W, 0, 0xffd040, 1)
      .setOrigin(0, 0.5)
      .setLineWidth(3)
      .setDepth(DEPTH_BG + 1);

    this.add
      .text(W / 2, DEFENSE_LINE - 10, "— CONVOY —", {
        fontFamily: "VT323, monospace",
        fontSize: "12px",
        color: "#c9a227",
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.85)
      .setDepth(DEPTH_BG + 1);

    this.add.rectangle(W / 2, 222, W, 38, 0x0c1520).setAlpha(0.92).setDepth(DEPTH_BG + 1);

    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(4, W - 4);
      const y = Phaser.Math.Between(4, 108);
      const s = Phaser.Math.Between(1, 2);
      this.add
        .rectangle(x, y, s, s, 0xffffff)
        .setAlpha(Phaser.Math.FloatBetween(0.12, 0.5))
        .setDepth(DEPTH_STARS);
    }

    const convoyY = 232;
    const slots = [-108, -76, -44, -12, 20, 52, 84, 106];
    for (const ox of slots) {
      const hull = this.add.rectangle(W / 2 + ox, convoyY, 24, 7, 0x2a3f54).setDepth(DEPTH_CONVOY);
      hull.setStrokeStyle(1, 0xc9a227, 0.45);
      this.add
        .rectangle(W / 2 + ox, convoyY - 4, 7, 4, 0x8a9ba8)
        .setAlpha(0.92)
        .setDepth(DEPTH_CONVOY);
    }
  }

  /** Guaranteed one of each type so the player always sees both silhouettes */
  private spawnPairDemo(): void {
    if (this.gameOver) return;
    this.spawnThreat("drone", Phaser.Math.Between(40, 120));
    this.spawnThreat("boat", Phaser.Math.Between(200, 280));
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    this.survivedMs += delta;

    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Phaser.Physics.Arcade.Sprite;
      if (!e.active) return;
      if (e.y > DEFENSE_LINE) {
        this.tankers = Math.max(0, this.tankers - 1);
        e.destroy();
        RetroAudio.playDamage();
        this.cameras.main.shake(130, 0.006);
        this.updateHud();
        if (this.tankers <= 0) this.endGame(false);
        return;
      }
      if (e.y < -40 || e.x < -40 || e.x > W + 40) e.destroy();
    });

    this.shots.getChildren().forEach((obj) => {
      const s = obj as Phaser.Physics.Arcade.Sprite;
      if (s.y < -16 || s.y > H + 16 || s.x < -16 || s.x > W + 16) s.destroy();
    });

    if (!this.gameOver && this.tankers > 0 && this.survivedMs >= WIN_MS) {
      this.endGame(true);
    }

    this.updateHud();
  }

  private spawnWaveTick(): void {
    if (this.gameOver) return;
    this.wave += 1;
    const count = 2 + Math.min(7, Math.floor(this.wave / 2));
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 140, () => this.spawnRandomThreat());
    }

    if (this.wave > 1 && this.wave % 4 === 0) {
      const old = this.ballistics;
      this.ballistics = Math.min(BALLISTICS_MAX, this.ballistics + 5);
      if (this.ballistics > old) RetroAudio.playUi();
    }

    this.updateHud();
  }

  private spawnRandomThreat(): void {
    if (this.gameOver) return;
    const boat = Phaser.Math.Between(0, 100) < 30;
    this.spawnThreat(boat ? "boat" : "drone", Phaser.Math.Between(24, W - 24));
  }

  private spawnThreat(kind: ThreatKind, x: number): void {
    if (this.gameOver) return;
    const y = kind === "boat" ? -28 : -22;
    const key = kind === "boat" ? "hs_boat" : "hs_drone";
    const sprite = this.physics.add.sprite(x, y, key);
    sprite.setData("kind", kind);
    sprite.setDepth(DEPTH_THREAT);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(false);

    if (kind === "boat") {
      body.setVelocity(Phaser.Math.Between(-32, 32), Phaser.Math.Between(36, 58));
      body.setAngularVelocity(Phaser.Math.Between(-35, 35));
    } else {
      body.setVelocity(Phaser.Math.Between(-50, 50), Phaser.Math.Between(68, 108));
    }

    this.enemies.add(sprite);
  }

  private tryFire(pointer: Phaser.Input.Pointer): void {
    if (this.gameOver) return;
    const now = this.time.now;
    if (now - this.lastFire < FIRE_COOLDOWN_MS) return;
    if (this.ballistics <= 0) return;

    this.ballistics -= 1;
    this.lastFire = now;
    RetroAudio.playFire();

    const ox = W / 2;
    const oy = H - 22;
    const px = pointer.worldX ?? pointer.x;
    const py = pointer.worldY ?? pointer.y;
    const ang = Phaser.Math.Angle.Between(ox, oy, px, py);

    const shot = this.physics.add.sprite(ox, oy, "hs_missile");
    shot.setDepth(DEPTH_MISSILE);
    shot.setRotation(ang + Math.PI / 2);
    const body = shot.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(ang) * MISSILE_SPEED, Math.sin(ang) * MISSILE_SPEED);
    this.shots.add(shot);
  }

  private endGame(won: boolean): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();

    if (won) {
      RetroAudio.playWin();
      try {
        if (this.score > this.hi) {
          this.hi = this.score;
          localStorage.setItem(HISCORE_KEY, String(this.score));
        }
      } catch {
        /* ignore */
      }
    } else {
      RetroAudio.playLose();
    }

    const head = won ? "VICTORY" : "CONVOY LOST";
    const sub = won
      ? `Strait held — ${this.tankers} tankers · wave ${this.wave}\nSCORE ${this.score}`
      : `${Math.floor(this.survivedMs / 1000)}s · wave ${this.wave}\nSCORE ${this.score}`;

    this.add
      .text(W / 2, H / 2 - 38, head, {
        fontFamily: "Libre Baskerville, Georgia, serif",
        fontSize: "26px",
        color: won ? "#7cfcb4" : "#ff6655",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_GAMEOVER);

    this.add
      .text(W / 2, H / 2 + 6, sub, {
        fontFamily: "VT323, monospace",
        fontSize: "20px",
        color: "#e8eef2",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_GAMEOVER);

    this.add
      .text(W / 2, H / 2 + 70, "ENTER / ESC — command deck   ·   R — patrol again", {
        fontFamily: "VT323, monospace",
        fontSize: "16px",
        color: "#8a9ba8",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_GAMEOVER);

    const kb = this.input.keyboard;
    kb?.once("keydown-ENTER", () => this.quitToTitle());
    kb?.once("keydown-ESC", () => this.quitToTitle());
    kb?.once("keydown-R", () => {
      this.scene.restart();
    });
  }

  private updateHud(): void {
    const rem = Math.max(0, Math.ceil((WIN_MS - this.survivedMs) / 1000));
    this.hudTankers.setText(`TANKERS ${this.tankers}`);
    this.hudMissiles.setText(`BALLISTICS ${this.ballistics}/${BALLISTICS_MAX}`);
    this.hudWave.setText(`WAVE ${this.wave}`);
    this.hudTime.setText(`TIME ${rem}s`);
    this.hudScore.setText(`SCORE ${this.score}`);
    this.hudHi.setText(`HI ${this.hi}`);
  }

  private quitToTitle(): void {
    if (this.exited) return;
    this.exited = true;
    const cb = this.game.registry.get("onExit") as (() => void) | undefined;
    this.game.destroy(true, false);
    cb?.();
  }
}
