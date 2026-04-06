import Phaser from "phaser";
import * as RetroAudio from "../audio/retroAudio";

const W = 320;
const H = 256;
const TANKERS_START = 100;
const BALLISTICS_START = 8;
const BALLISTICS_MAX = 16;
const DEFENSE_LINE = 248;
const FIRE_COOLDOWN_MS = 340;
const MISSILE_SPEED = 440;
const WIN_MS = 90_000;
const HISCORE_KEY = "hell-strait-hiscore";

/**
 * Patrol: defend the convoy — Amiga-style vertical slice with score, waves, and resupply.
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

    this.drawWorld();

    this.enemies = this.physics.add.group();
    this.shots = this.physics.add.group();

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "VT323, monospace",
      fontSize: "18px",
      color: "#e8eef2",
    };

    this.hudTankers = this.add.text(10, 6, "", textStyle);
    this.hudMissiles = this.add.text(10, 26, "", textStyle);
    this.hudWave = this.add.text(W - 10, 6, "", textStyle).setOrigin(1, 0);
    this.hudTime = this.add.text(W / 2, 6, "", textStyle).setOrigin(0.5, 0);
    this.hudScore = this.add.text(10, 46, "", { ...textStyle, fontSize: "16px", color: "#c9a227" });
    this.hudHi = this.add.text(W - 10, 46, "", {
      ...textStyle,
      fontSize: "16px",
      color: "#8a9ba8",
    }).setOrigin(1, 0);

    this.hudHint = this.add
      .text(W / 2, H - 12, "", {
        ...textStyle,
        fontSize: "15px",
        color: "#8a9ba8",
      })
      .setOrigin(0.5, 1);

    this.physics.add.overlap(
      this.shots,
      this.enemies,
      (shot, enemy) => {
        const e = enemy as Phaser.GameObjects.Rectangle;
        const w = e.width;
        const isBoat = w > 14;
        (shot as Phaser.GameObjects.GameObject).destroy();
        e.destroy();
        this.score += isBoat ? 35 : 12;
        RetroAudio.playHit();
        this.cameras.main.flash(70, 20, 40, 55, false);
        this.updateHud();
      },
      undefined,
      this,
    );

    this.input.on("pointerdown", this.tryFire, this);
    this.input.keyboard?.on("keydown-ESC", () => this.quitToTitle());

    const banner = this.add
      .text(W / 2, H / 2 - 40, "HELL STRAIT", {
        fontFamily: "Libre Baskerville, Georgia, serif",
        fontSize: "28px",
        color: "#e8dcc4",
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(W / 2, H / 2 - 8, "PATROL — HOLD THE LINE 90s", {
        fontFamily: "VT323, monospace",
        fontSize: "20px",
        color: "#c9a227",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: [banner, sub],
      alpha: 0,
      delay: 2200,
      duration: 900,
      onComplete: () => {
        banner.destroy();
        sub.destroy();
      },
    });

    this.time.delayedCall(1900, () => {
      RetroAudio.playAlert();
      this.spawnWaveTick();
      this.time.addEvent({
        delay: 2800,
        callback: () => this.spawnWaveTick(),
        callbackScope: this,
        loop: true,
      });
    });

    this.hudHint.setText("FIRE — click / tap    ·    ESC — debrief");
    this.updateHud();
  }

  private drawWorld(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a2840, 0x1a2840, 0x0a1520, 0x0a1520, 1);
    g.fillRect(0, 0, W, 120);
    g.fillGradientStyle(0x0d1520, 0x0d1520, 0x050a12, 0x050a12, 1);
    g.fillRect(0, 120, W, 90);
    g.fillStyle(0x050a12, 1);
    g.fillRect(0, 200, W, 56);

    this.add
      .line(0, 200, 0, 0, W, 0, 0xc9a227, 0.55)
      .setOrigin(0, 0.5)
      .setLineWidth(2);

    this.add.rectangle(W / 2, 222, W, 36, 0x0c1520).setAlpha(0.88);

    for (let i = 0; i < 48; i++) {
      const x = Phaser.Math.Between(4, W - 4);
      const y = Phaser.Math.Between(4, 112);
      const s = Phaser.Math.Between(1, 2);
      this.add.rectangle(x, y, s, s, 0xffffff).setAlpha(Phaser.Math.FloatBetween(0.15, 0.55));
    }

    const convoyY = 232;
    const slots = [-110, -78, -46, -14, 18, 50, 82, 108];
    for (const ox of slots) {
      const hull = this.add.rectangle(W / 2 + ox, convoyY, 26, 8, 0x2a3f54);
      hull.setStrokeStyle(1, 0xc9a227, 0.4);
      this.add.rectangle(W / 2 + ox, convoyY - 5, 8, 5, 0x8a9ba8).setAlpha(0.9);
    }
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    this.survivedMs += delta;

    this.enemies.getChildren().forEach((obj) => {
      const e = obj as Phaser.GameObjects.Rectangle;
      if (!e.active) return;
      if (e.y > DEFENSE_LINE) {
        this.tankers = Math.max(0, this.tankers - 1);
        e.destroy();
        RetroAudio.playDamage();
        this.cameras.main.shake(140, 0.005);
        this.updateHud();
        if (this.tankers <= 0) this.endGame(false);
        return;
      }
      if (e.y < -30 || e.x < -20 || e.x > W + 20) e.destroy();
    });

    this.shots.getChildren().forEach((obj) => {
      const s = obj as Phaser.GameObjects.Rectangle;
      if (s.y < -10 || s.y > H + 10 || s.x < -10 || s.x > W + 10) s.destroy();
    });

    if (!this.gameOver && this.tankers > 0 && this.survivedMs >= WIN_MS) {
      this.endGame(true);
    }

    this.updateHud();
  }

  private spawnWaveTick(): void {
    if (this.gameOver) return;
    this.wave += 1;
    const count = 2 + Math.min(6, Math.floor(this.wave / 2));
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 160, () => this.spawnOneEnemy());
    }

    if (this.wave > 1 && this.wave % 4 === 0) {
      const old = this.ballistics;
      this.ballistics = Math.min(BALLISTICS_MAX, this.ballistics + 5);
      if (this.ballistics > old) RetroAudio.playUi();
    }

    this.updateHud();
  }

  private spawnOneEnemy(): void {
    if (this.gameOver) return;
    const boat = Phaser.Math.Between(0, 100) < 24;
    const x = Phaser.Math.Between(24, W - 24);
    const y = -12;

    let body: Phaser.GameObjects.Rectangle;
    if (boat) {
      body = this.add.rectangle(x, y, 22, 12, 0x8b4513);
      body.setStrokeStyle(1, 0x4a3020, 0.9);
      this.physics.add.existing(body);
      const b = body.body as Phaser.Physics.Arcade.Body;
      b.setVelocity(Phaser.Math.Between(-28, 28), Phaser.Math.Between(30, 52));
      b.setAngularVelocity(Phaser.Math.Between(-24, 24));
    } else {
      body = this.add.rectangle(x, y, 8, 8, 0xd94a2a);
      this.physics.add.existing(body);
      const b = body.body as Phaser.Physics.Arcade.Body;
      b.setVelocity(Phaser.Math.Between(-42, 42), Phaser.Math.Between(58, 98));
    }
    this.enemies.add(body);
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
    const oy = H - 20;
    const ang = Phaser.Math.Angle.Between(ox, oy, pointer.x, pointer.y);

    const shot = this.add.rectangle(ox, oy, 3, 11, 0xe6c84a);
    shot.setStrokeStyle(1, 0xfff5cc, 0.8);
    this.physics.add.existing(shot);
    const body = shot.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(ang) * MISSILE_SPEED, Math.sin(ang) * MISSILE_SPEED);
    shot.setRotation(ang + Math.PI / 2);
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
      ? `Strait held — ${this.tankers} tankers remain · wave ${this.wave}\nSCORE ${this.score}`
      : `The strait ran red — ${Math.floor(this.survivedMs / 1000)}s · wave ${this.wave}\nSCORE ${this.score}`;

    this.add
      .text(W / 2, H / 2 - 36, head, {
        fontFamily: "Libre Baskerville, Georgia, serif",
        fontSize: "26px",
        color: won ? "#7cfcb4" : "#d94a4a",
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H / 2 + 8, sub, {
        fontFamily: "VT323, monospace",
        fontSize: "20px",
        color: "#e8eef2",
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H / 2 + 72, "ENTER / ESC — command deck   ·   R — patrol again", {
        fontFamily: "VT323, monospace",
        fontSize: "17px",
        color: "#8a9ba8",
        align: "center",
      })
      .setOrigin(0.5);

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
