# Hell Strait — Image Assets

All art is generated via [Stability AI Stable Image Core](https://platform.stability.ai/docs/api-reference).  
Place finished PNGs in the `images/` folder — the game loads them automatically and falls back to procedural canvas art if missing.

---

## Generating with Stability AI

```bash
cp .env.example .env
# Add your STABILITY_API_KEY to .env

# Generate a specific asset:
node scripts/stability-generate.mjs -- --name=title-art --aspect=16:9 "YOUR PROMPT"

# Or use the npm shortcuts:
npm run generate:all
```

---

## Screen Backgrounds

### `images/title-art.png` — 640 × 240

```
Amiga Cinemaware 1989 game title screen, dramatic pixel art,
dark Strait of Hormuz at night, massive oil tanker silhouette on horizon,
jagged Iranian coastline low hills far left, Shahed drones as dark specks
in sky, lone figure in a tiny battered speedboat smoking a thick cigar,
moonlight shimmer on flat black water, orange-red distant glow from
refinery flares, limited 32-colour Amiga palette, chunky pixels,
retro game aesthetic, no modern HDR, no text, no logos
```

**Negative:** text, watermark, modern CGI, photorealistic, bokeh, anime  
**Aspect:** 16:9  
**npm:** `npm run generate:title-art`

---

### `images/scene-border.png` — 640 × 280

Used in cutscene frames 1–2 (Omani border crossing).

```
Amiga pixel art 1989 Cinemaware style, desert border checkpoint at early dawn,
Omani guard in traditional white dishdasha and leather belt, holding open a
crumpled Western passport, suspicious squinting expression, small dusty
checkpoint building with boom gate, sand dunes and flat horizon behind,
orange-pink sunrise sky, warm side light, limited 32-colour palette,
chunky retro game art, no text, no logos, no photorealistic faces
```

**Negative:** text, modern CGI, photorealistic, bokeh, watermark, anime  
**Aspect:** 16:9  
**npm:** `npm run generate:scene-border`

---

### `images/scene-hamid.png` — 640 × 280

Used in cutscene frames 3–4 (Meet Hamid, "Fuck the police").

```
Amiga pixel art 1989 Cinemaware style, Omani fisherman at a rickety
night canal dock, weathered dark skin, rolled sleeves, one hand pointing
at a battered 40-year-old wooden dinghy speedboat tied with fraying rope,
other hand holding a folded wad of dollar bills, single dock lamp warm glow,
moonlight on dark still water, dramatic shadow play, limited 32-colour palette,
chunky retro game scene, no text, no logos
```

**Negative:** text, modern CGI, photorealistic, bokeh, watermark, anime  
**Aspect:** 16:9  
**npm:** `npm run generate:scene-hamid`

---

### `images/scene-boat.png` — 640 × 280

Used in cutscene frames 5–6 (The crossing → The swim).

```
Amiga pixel art 1989 Cinemaware side-scrolling scene, battered old
wooden dinghy racing across open flat ocean at pre-dawn, Iranian rocky
coastline silhouette in far hazy distance, Shahed-136 drone dark shape
visible in orange-grey sky overhead, man sitting at bow smoking a
thick Cuban cigar, salt spray, wave motion lines, very limited 32-colour
Amiga palette, retro game background art, no text, no logos
```

**Negative:** text, watermark, modern lens blur, photorealistic, anime  
**Aspect:** 16:9  
**npm:** `npm run generate:scene-boat`

---

### `images/win-art.png` — 640 × 160

Victory screen art.

```
Amiga pixel art 1989 Cinemaware victory screen, American man floating
on his back in calm turquoise ocean, thick lit Cuban cigar clamped in
wide grinning teeth, aviator sunglasses, arms spread wide, two Shahed
drones passing harmlessly high overhead in orange sunrise sky,
golden morning light glittering on water, triumphant joyful mood,
limited 32-colour retro palette, chunky pixels, no text, no UI
```

**Negative:** text, watermark, modern CGI, bokeh, anime  
**Aspect:** 16:9 (top 160px crop)  
**npm:** `npm run generate:win-art`

---

### `images/lose-art.png` — 640 × 160

Game over screen art.

```
Amiga pixel art 1989 Cinemaware game-over screen, large Omani Coast Guard
patrol vessel looming in the foreground, powerful white searchlight beam
cutting across dark water onto a bedraggled wet man treading water,
stern uniformed officers leaning over deck railing aiming rifles down,
dramatic stark contrast between light and shadow, humiliation and threat,
limited 32-colour retro palette, no text, no UI
```

**Negative:** text, watermark, modern CGI, bokeh, anime  
**Aspect:** 16:9 (top 160px crop)  
**npm:** `npm run generate:lose-art`

---

## Sprite Sheet PNGs

All sprites use **transparent background**. Amiga 32-colour palette.  
The game auto-detects and draws these via `ctx.drawImage()` — if missing, procedural canvas art is used as fallback.

---

### `images/sprite-player.png` — 96 × 20

4-frame horizontal strip. Each frame: 24 × 20px.

```
Amiga pixel art sprite sheet, 4-frame swim cycle animation horizontal strip,
American man swimming breaststroke side-view facing right, each frame 24×20px
(total 96×20px), lit cigar clamped between grinning teeth, dark aviator
sunglasses, khaki shorts, arms alternating stroke positions, legs kicking,
transparent background, 1989 Cinemaware style, limited 32-colour palette,
no text, no outline border
```

**Aspect:** 1:1 (custom: 96×20)  
**npm:** `npm run generate:sprite-player`

---

### `images/sprite-drone.png` — 88 × 24

2-frame horizontal strip. Each frame: 44 × 24px (engine-off / engine-on).

```
Amiga pixel art sprite sheet, Shahed-136 loitering munition drone,
2-frame horizontal strip (total 88×24px), each frame 44×24px,
top-down plan view, frame 1 engine cold: dark grey delta-wing body
pointed nose left, red LED dot dim; frame 2 engine hot: same body with
small orange exhaust flame at rear, red LED bright,
transparent background, retro game enemy sprite, limited 32-colour palette
```

**Aspect:** 1:1 (custom: 88×24)  
**npm:** `npm run generate:sprite-drone`

---

### `images/sprite-boat.png` — 104 × 18

2-frame horizontal strip. Each frame: 52 × 18px (left-facing / right-facing).

```
Amiga pixel art sprite sheet, Iranian IRGC fast-attack patrol boat,
2-frame horizontal strip (total 104×18px), each frame 52×18px,
top-down view, dark hull with grey deck, mounted machine gun on foredeck,
tiny Iranian tricolour flag at stern, short wake lines at stern,
frame 1 boat facing left, frame 2 boat facing right (mirror),
transparent background, 1989 retro game enemy sprite, limited 32-colour palette
```

**Aspect:** 1:1 (custom: 104×18)  
**npm:** `npm run generate:sprite-boat`

---

### `images/sprite-zyn.png` — 16 × 12

Single frame. Power-up collectible.

```
Amiga pixel art sprite, Zyn nicotine pouch, single frame 16×12px,
small white rectangular foil pouch, bold blue ZYN text in pixel font,
subtle cyan glow outline around edges suggesting power-up,
transparent background, retro game collectible item, limited palette
```

**Aspect:** 1:1 (custom: 16×12)  
**npm:** `npm run generate:sprite-zyn`

---

### `images/sprite-cigar.png` — 24 × 8

Single frame. Collectible.

```
Amiga pixel art sprite, lit Cuban cigar floating in water, single frame 24×8px,
brown tobacco body with gold band at one third, glowing orange-red lit ember
at right end, tiny wisp of grey smoke curling up, ash grey at left tip,
transparent background, retro game collectible, limited 32-colour Amiga palette
```

**Aspect:** 1:1 (custom: 24×8)  
**npm:** `npm run generate:sprite-cigar`

---

### `images/sprite-coastguard.png` — 68 × 24

Single frame. Boss / end-of-level threat.

```
Amiga pixel art sprite, Omani Coast Guard patrol vessel, single frame 68×24px,
top-down view, dark navy hull with white superstructure, searchlight tower
amidships with beam indicated, Omani national flag at stern (red white green),
two rifle barrels protruding from starboard deck, small wake at stern,
dramatic and threatening, transparent background, retro game boss enemy,
limited 32-colour Amiga palette
```

**Aspect:** 1:1 (custom: 68×24)  
**npm:** `npm run generate:sprite-coastguard`

---

## Optional / Background Tiles

### `images/bg-water.png` — 640 × 360 _(optional)_

If present, replaces the procedural wave animation. Tiled horizontally.

```
Amiga pixel art, top-down open ocean water texture tile 640×360px,
dark blue-green water with horizontal wave crest lines, subtle parallax
depth variation, light diffuse patterns, Strait of Hormuz deep water,
1989 retro game background scroll, limited 32-colour palette, no text
```

---

## Generation Order (recommended)

1. `npm run generate:title-art` — gets the title screen looking right first
2. `npm run generate:scene-border` + `scene-hamid` + `scene-boat` — cutscenes
3. `npm run generate:win-art` + `lose-art` — end screens
4. Sprites last (hardest to get right at small sizes)

---

## Style Notes for Consistency

- **Palette:** Warm oranges, deep teals, dark navy, sandy ochre — Amiga OCS 32-colour
- **No** modern HDR, no depth-of-field blur, no photorealistic faces
- **Yes** chunky pixel dithering, flat colour regions, hard shadow edges
- All reference images: 1989 Cinemaware games (*Wings*, *It Came from the Desert*, *Defender of the Crown*)
