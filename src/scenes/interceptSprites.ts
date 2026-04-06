import * as THREE from "three";

/**
 * Bitmap missiles for Gulf SDI — same *spirit* as PatrolScene.generateTextures()
 * (hand-pixelled, nearest-neighbour), but larger silhouettes so they read at 320×240.
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

/** SAM / patriot-class — gold body, orange band, tiny glint (reads like Patrol patriot, taller). */
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
  const c = document.createElement("canvas");
  paintGrid(c, rows, palette);
  return canvasToNearestTex(c);
}

/** Inbound ballistic — tapered nose, fins, exhaust plume (not a solid rectangle). */
export function makeInboundSpriteTexture(): THREE.CanvasTexture {
  const rows = [
    "       ##       ",
    "      ####      ",
    "     ##nn##     ",
    "    ##nnnn##    ",
    "   ###nnnn###   ",
    "  ##xxrrrrxx##  ",
    " ##xxrrRRrrxx## ",
    " #xxrrRRRRrrxx# ",
    "#xxrrRRRRRRrrxx#",
    "#xxrrRRRRRRrrxx#",
    "#xxrrRRRRRRrrxx#",
    "#xxrrRRRRRRrrxx#",
    "#xxrrRRRRRRrrxx#",
    "#xxrrRRRRRRrrxx#",
    "##xxrrRRRRrrxx##",
    " #xxrrRRRRrrxx# ",
    " #xxrrRRRRrrxx# ",
    " #xxrrRRRRrrxx# ",
    "##xxrrRRRRrrxx##",
    "#xxrrRRRRRRrrxx#",
    "#xxrrRRRRRRrrxx#",
    "#xxrrRRRRRRrrxx#",
    "#xxrrRRRRRRrrxx#",
    "#xxrrRRRRRRrrxx#",
    "##xxrrRRRRrrxx##",
    " #xxrrRRRRrrxx# ",
    " #xxrrRRRRrrxx# ",
    "##xxrrRRRRrrxx##",
    "#xxrrRRRRRRrrxx#",
    "#xxrrRRRRRRrrxx#",
    "#xxrrRRRRRRrrxx#",
    "#xxrrRRRRRRrrxx#",
    "##xxrrRRRRrrxx##",
    " #xxrrRRRRrrxx# ",
    " ##xxrrrrrrxx## ",
    "  ##xxxxxxxx##  ",
    "   #xxxxxxxx#   ",
    "   #xooooooox#  ",
    "  ##xooooooox## ",
    " ##xxooooooooxx##",
    "##xxooooooooooxx##",
    "#xxooooooooooooxx#",
    "#xxooeoeoeoeoooxx#",
    " ##oooooooooo##  ",
    "  ##oooooooo##   ",
    "   #########     ",
  ];
  const palette: Record<string, string> = {
    " ": "",
    "#": "#5a1010",
    x: "#3a0808",
    n: "#fff5d0",
    r: "#ff5530",
    R: "#c01810",
    o: "#ff7720",
    e: "#ffcc55",
  };
  const c = document.createElement("canvas");
  paintGrid(c, rows, palette);
  return canvasToNearestTex(c);
}
