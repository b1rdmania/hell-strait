/**
 * Stability AI — Stable Image Core (text → PNG).
 * Docs: https://platform.stability.ai/docs/api-reference
 *
 * Usage:
 *   npm run generate:art -- "your prompt here"
 *   npm run generate:art -- --name=meridian-deck "prompt..."
 *   npm run generate:art -- --name=sprites --aspect=1:1 "prompt..."
 *   npm run generate:art   # default strait title prompt
 *
 * Prompt ideas for Hell Strait (Amiga × Cinemaware × Bitmap):
 *   Title / sky plate — sunset strait, tanker silhouettes, dramatic clouds, limited palette feel,
 *     no readable text, no modern HDR, no depth-of-field, oil painting meets 320×200 dither.
 *   Meridian deck — dark chrome UI, fake CRT meters, gold trim, cold blue backlight, empty panels.
 *   Ashar brief — parchment war map, red marker strokes, torchlight, serious not fantasy cartoon.
 *   Sprites — isolated drone + boat on flat background for cutout (then index-colour in Aseprite).
 *   Strait / hub plates — npm run generate:bg-strait | generate:command-deck (default strait prompt).
 *   Gulf SDI — npm run generate:gulf-bg | generate:carrier | generate:missile-inbound |
 *     generate:missile-interceptor, or npm run generate:all-stability for every preset.
 *   Outputs land in public/generated/; Gulf SDI loads PNGs when present and keeps procedural fallback.
 *
 * Never commit API keys — use .env only (see .env.example).
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "generated");

const DEFAULT_PROMPT = [
  "Wide cinematic strait at bloody sunset, silhouettes of oil tankers and small patrol craft,",
  "dramatic clouds, warm orange and deep teal, 1989 Amiga game painted title art,",
  "limited colours, subtle ordered dither feel, no text, no logos, no photorealistic skin,",
  "no modern lens blur, no UI",
].join(" ");

const DEFAULT_NEGATIVE =
  "text, watermark, logo, typography, modern CGI, anime, photorealistic faces, depth of field, bokeh";

const PRESET_CARRIER = [
  "1990 Amiga Cinemaware painted US Navy aircraft carrier flight deck,",
  "oblique top-down view, grey steel hull, island superstructure, runway centerline, Gulf sea haze,",
  "dramatic warm sunset light, limited palette painterly computer game illustration,",
  "no text, no logos, no photorealistic faces, no modern HDR",
].join(" ");

const PRESET_MISSILE_INBOUND = [
  "Isolated ballistic cruise missile in flight, side view, vertical composition, pointed nose cone,",
  "orange red body, small fins, faint smoke trail, 1990 Amiga Cinemaware game sprite art,",
  "limited palette, solid flat black background, centered subject,",
  "no text, no watermark, no UI",
].join(" ");

const PRESET_MISSILE_INTERCEPTOR = [
  "Isolated SAM interceptor missile, side view, vertical, short agile body, golden yellow flare at rear,",
  "navy white paint, 1990 Amiga computer game sprite, limited colours, solid black background,",
  "no text, no watermark",
].join(" ");

const PRESET_GULF_BG = [
  "1989 Amiga Cinemaware painted Gulf oil depot coastal landscape at dusk,",
  "oil storage tanks, refinery towers, desalination plant, industrial pipes,",
  "dark Persian Gulf sea in foreground, warm orange sunset sky,",
  "military defence installation vibe, dramatic lighting,",
  "limited colour palette, painterly pixel art, retro game background art,",
  "wide panoramic composition, no text, no logos, no modern CGI, no photorealistic faces",
].join(" ");

function parseArgs(argv) {
  let name = null;
  let aspect = "16:9";
  let preset = null;
  const rest = [];
  for (const a of argv) {
    if (a.startsWith("--name=")) {
      name = a.slice(7).replace(/[^a-z0-9-_]/gi, "-");
    } else if (a.startsWith("--aspect=")) {
      aspect = a.slice(9).trim() || "16:9";
    } else if (a.startsWith("--preset=")) {
      preset = a.slice(9).trim();
    } else {
      rest.push(a);
    }
  }
  return { name, aspect, preset, rest };
}

async function main() {
  const key = process.env.STABILITY_API_KEY;
  if (!key?.trim()) {
    console.error("Missing STABILITY_API_KEY — copy .env.example to .env and add your key.");
    process.exit(1);
  }

  const { name, aspect, preset, rest } = parseArgs(process.argv.slice(2));
  const userPrompt = rest.join(" ").trim();
  let prompt = userPrompt;
  if (!prompt && preset === "carrier") {
    prompt = PRESET_CARRIER;
  }
  if (!prompt && preset === "missile-inbound") {
    prompt = PRESET_MISSILE_INBOUND;
  }
  if (!prompt && preset === "missile-interceptor") {
    prompt = PRESET_MISSILE_INTERCEPTOR;
  }
  if (!prompt && preset === "gulf-bg") {
    prompt = PRESET_GULF_BG;
  }
  if (!prompt) prompt = DEFAULT_PROMPT;

  mkdirSync(outDir, { recursive: true });

  const form = new FormData();
  form.append("prompt", prompt);
  form.append("negative_prompt", DEFAULT_NEGATIVE);
  form.append("output_format", "png");
  form.append("aspect_ratio", aspect);

  const url = "https://api.stability.ai/v2beta/stable-image/generate/core";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "image/*",
    },
    body: form,
  });

  const base = name || `strait-${Date.now()}`;
  const outPath = join(outDir, `${base}.png`);

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Stability API ${res.status}:`, errText);
    process.exit(1);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  console.log("Wrote", outPath, `(${buf.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
