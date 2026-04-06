import * as THREE from "three";

const PALETTE_COUNT = 18;

function makeBayerTexture(): THREE.DataTexture {
  const order = [
    0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
  ];
  const data = new Uint8Array(4 * 4 * 4);
  for (let i = 0; i < 16; i++) {
    const v = Math.round((order[i] / 15) * 255);
    const o = i * 4;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 4, 4, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// Three.js prepends #version, attributes (position, uv), uniforms (modelViewMatrix, …) — do not duplicate.
const postVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const postFrag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tBayer;
uniform vec2 uResolution;
uniform vec2 uLowRes;
uniform vec3 uPalette[${PALETTE_COUNT}];
uniform float uDitherStrength;
uniform float uScanlineStrength;

varying vec2 vUv;
out vec4 fragColor;

vec2 letterboxUv(vec2 uv) {
  float rTarget = uLowRes.x / uLowRes.y;
  float rWin = uResolution.x / uResolution.y;
  vec2 u = uv - 0.5;
  if (rWin > rTarget) {
    u.x *= rTarget / rWin;
  } else {
    u.y *= rWin / rTarget;
  }
  return u + 0.5;
}

vec3 nearestPalette(vec3 c) {
  vec3 best = uPalette[0];
  float bestd = distance(c, best);
  for (int i = 1; i < ${PALETTE_COUNT}; i++) {
    vec3 p = uPalette[i];
    float d = distance(c, p);
    if (d < bestd) {
      bestd = d;
      best = p;
    }
  }
  return best;
}

void main() {
  vec2 uv = letterboxUv(vUv);
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 texel = floor(uv * uLowRes);
  vec3 col = texture(tDiffuse, uv).rgb;

  // Ordered dither before quantize: on *flat* dark fills it flips between two similar
  // palette colours every pixel → full-screen checkerboard "snow". Only run when asked.
  if (uDitherStrength > 0.001) {
    vec2 bUv = (mod(texel, 4.0) + 0.5) / 4.0;
    float b = texture(tBayer, bUv).r;
    col += (b - 0.5) * (uDitherStrength / 255.0) * 2.5;
    col = clamp(col, 0.0, 1.0);
  }

  col = nearestPalette(col);

  float scan = mod(texel.y, 2.0) < 1.0 ? (1.0 - uScanlineStrength) : 1.0;
  col *= scan;

  fragColor = vec4(col, 1.0);
}
`;

export class RetroPipeline {
  readonly target: THREE.WebGLRenderTarget;
  readonly postScene: THREE.Scene;
  readonly postCamera: THREE.OrthographicCamera;
  readonly quad: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private readonly bayer: THREE.DataTexture;
  usePost: boolean;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    readonly lowW: number,
    readonly lowH: number,
    paletteHex: string[],
    options?: { usePost?: boolean },
  ) {
    this.usePost = options?.usePost !== false;
    if (paletteHex.length !== PALETTE_COUNT) {
      throw new Error(`Expected ${PALETTE_COUNT} palette entries, got ${paletteHex.length}`);
    }

    this.target = new THREE.WebGLRenderTarget(lowW, lowH, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    // Match fullscreen post UVs (Pass.js / EffectComposer pattern); default flipY breaks sampling.
    this.target.texture.flipY = false;
    this.target.texture.colorSpace = THREE.SRGBColorSpace;

    const paletteVec3 = paletteHex.map((hex) => {
      const c = new THREE.Color(hex);
      return new THREE.Vector3(c.r, c.g, c.b);
    });

    this.bayer = makeBayerTexture();

    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDiffuse: { value: this.target.texture },
        tBayer: { value: this.bayer },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uLowRes: { value: new THREE.Vector2(lowW, lowH) },
        uPalette: { value: paletteVec3 },
        uDitherStrength: { value: 9.0 },
        uScanlineStrength: { value: 0.0 },
      },
      vertexShader: postVert,
      fragmentShader: postFrag,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const geom = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geom, this.material);
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    // Ortho + plane at z=0; camera on +Z so the quad faces the lens (same idea as CopyShader / Pass.js).
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.postCamera.position.set(0, 0, 1);
    this.postCamera.lookAt(0, 0, 0);
    this.postCamera.updateProjectionMatrix();
  }

  /** Bayer dither before quantize (optional — off by default; flat fills become checkerboard noise). */
  setDitherStrength(value: number): void {
    this.material.uniforms.uDitherStrength.value = value;
  }

  setScanlineStrength(value: number): void {
    this.material.uniforms.uScanlineStrength.value = value;
  }

  setPalette(paletteHex: string[]): void {
    if (paletteHex.length !== PALETTE_COUNT) {
      throw new Error(`Expected ${PALETTE_COUNT} palette entries`);
    }
    const u = this.material.uniforms.uPalette.value as THREE.Vector3[];
    for (let i = 0; i < PALETTE_COUNT; i++) {
      const c = new THREE.Color(paletteHex[i]);
      u[i].set(c.r, c.g, c.b);
    }
  }

  resize(width: number, height: number): void {
    (this.material.uniforms.uResolution.value as THREE.Vector2).set(width, height);
    this.renderer.setSize(width, height, false);
  }

  /** Render world into 320×256, then fullscreen post to window. */
  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const w = Math.max(1, this.renderer.domElement.width);
    const h = Math.max(1, this.renderer.domElement.height);
    (this.material.uniforms.uResolution.value as THREE.Vector2).set(w, h);

    if (!this.usePost) {
      this.renderer.setRenderTarget(null);
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear(true, true);
      this.renderer.render(scene, camera);
      return;
    }

    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear(true, true);
    this.renderer.render(scene, camera);

    this.material.uniforms.tDiffuse.value = this.target.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear(true, true);
    this.renderer.render(this.postScene, this.postCamera);
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
    this.bayer.dispose();
  }
}
