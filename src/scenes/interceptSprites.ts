import * as THREE from "three";

/**
 * Bitmap missiles for Gulf SDI — same *spirit* as PatrolScene.generateTextures()
 * (hand-pixelled, nearest-neighbour). Inbound is intentionally **narrow** so it
 * scales up without reading as a vague red blob.
 * Top of image = nose (toward target when flying).
 */

function canvasToNearestTex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function paintGrid(
  c: HTMLCanvasElement,
  rows: string[],
  palette: Record<string, string>,
): void {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    const row = rows[y] ?? "";
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      const hex = palette[ch];
      if (hex === undefined || hex === "") continue;
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** SAM / patriot-class — gold body, orange band, tiny glint. */
export function makeInterceptorSpriteTexture(): THREE.CanvasTexture {
  const rows = [
    "       #       ",
    "      ###      ",
    "     ##G##     ",
    "    ##GGG##    ",
    "   ##GGGGG##   ",
    "   #GGGGGGG#   ",
    "   #GGGGGGG#   ",
    "   #GGGGGGG#   ",
    "   #GGGGGGG#   ",
    "   #GGGGGGG#   ",
    "  ##GGGGGGG##  ",
    "  #GGGwGGGGG#  ",
    "  #GGGGGGGGG#  ",
    "  #GGGGGGGGG#  ",
    "  #GGGGGGGGG#  ",
    " ##GGGGGGGGG## ",
    " #GGGGGGGGGGG# ",
    " #GGGGGGGGGGG# ",
    " #GGGGGGGGGGG# ",
    " #GGGGGGGGGGG# ",
    "##GGGGGGGGGGG##",
    "#GGGGGGGGGGGGG#",
    "#GGGGGGGGGGGGG#",
    "#GGGGGGGGGGGGG#",
    "#GGGGGGooGGGGG#",
    "#GGGGGooooGGGG#",
    "#GGGGooooooGGG#",
    " #GoooooooooG# ",
    " ##oooooooo##  ",
    "  #oooooooo#   ",
    "   #oooooo#    ",
    "    #oooo#     ",
    "     ####      ",
  ];
  const palette: Record<string, string> = {
    " ": "",
    "#": "#c9a227",
    G: "#ffe898",
    w: "#ffffff",
    o: "#ff9800",
  };
  const canvas = document.createElement("canvas");
  paintGrid(canvas, rows, palette);
  return canvasToNearestTex(canvas);
}

/** Inbound ballistic — **narrow** dart: white nose, dark body, orange exhaust. */
export function makeInboundSpriteTexture(): THREE.CanvasTexture {
  const rows = [
    "      w       ",
    "     wnw      ",
    "    wnnnw     ",
    "   #nnnnn#    ",
    "  #rrrrrrr#   ",
    " #xxrrRRrxx#  ",
    " #xxrRRRrxx#  ",
    "#xxrrRRRrrxx# ",
    "#xxrrRRRrrxx# ",
    "#xxrrRRRrrxx# ",
    "#xxrrRRRrrxx# ",
    "#xxrrRRRrrxx# ",
    " ##rrRRRrr##  ",
    "  #xxrrrxx#   ",
    "  #xxxxxxx#   ",
    "   ##ooo##    ",
    "    #ooo#     ",
    "     ###      ",
  ];
  const palette: Record<string, string> = {
    " ": "",
    w: "#ffffff",
    n: "#fff5d0",
    "#": "#4a0808",
    x: "#2a0404",
    r: "#ff5530",
    R: "#c01810",
    o: "#ff8800",
  };
  const canvas = document.createElement("canvas");
  paintGrid(canvas, rows, palette);
  return canvasToNearestTex(canvas);
}
