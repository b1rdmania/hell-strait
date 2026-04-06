/**
 * Tiny Amiga-ish bleeps via Web Audio (no asset files).
 * Browsers require a user gesture before AudioContext runs — call unlockAudio() from input handlers.
 */

let ctx: AudioContext | null = null;

export function unlockAudio(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function now(): number {
  return ctx?.currentTime ?? 0;
}

function tone(
  freq: number,
  dur: number,
  vol: number,
  type: OscillatorType = "square",
): void {
  const c = unlockAudio();
  if (!c) return;
  const t0 = now();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function sweep(
  f0: number,
  f1: number,
  dur: number,
  vol: number,
): void {
  const c = unlockAudio();
  if (!c) return;
  const t0 = now();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Menu / UI acknowledge */
export function playUi(): void {
  tone(880, 0.05, 0.06);
  window.setTimeout(() => tone(1320, 0.07, 0.05), 40);
}

/** Ballistic launch */
export function playFire(): void {
  sweep(1200, 400, 0.12, 0.07);
}

/** Intercept hit */
export function playHit(): void {
  tone(200, 0.04, 0.09);
  window.setTimeout(() => tone(360, 0.06, 0.06), 30);
}

/** Tanker struck */
export function playDamage(): void {
  sweep(180, 90, 0.35, 0.1);
}

/** Wave tick / alert */
export function playAlert(): void {
  tone(660, 0.08, 0.06);
  window.setTimeout(() => tone(880, 0.1, 0.05), 70);
}

export function playWin(): void {
  const c = unlockAudio();
  if (!c) return;
  const notes = [523, 659, 784, 1047];
  let delay = 0;
  for (const f of notes) {
    window.setTimeout(() => tone(f, 0.14, 0.07), delay);
    delay += 120;
  }
}

export function playLose(): void {
  sweep(300, 80, 0.45, 0.09);
  window.setTimeout(() => sweep(240, 60, 0.5, 0.07), 200);
}
