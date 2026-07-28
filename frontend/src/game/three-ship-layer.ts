import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ThreeNebulaBackground } from "./three-nebula-background";
import { applySpaceMaterial, makeEnemyCore, makeEnemyFlowShell, ENEMY_ACCENTS, setMaterialAnisotropyMax, type SpaceRole } from "./space-material";
import { perfRegisterThree } from "./perf";
import { getRendererSettings } from "./RendererSettings";
import { loadEnvironment } from "./three-environment";
import { createPostFX, type PostFX } from "./three-postfx";

// Stable string hash → seed for reproducible per-class surface aging.
function shipSeedHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Does a material's dominant color match the accent hue (so we know it's the
// enemy's "core" part, e.g. the overlord's blue crystal)? Compares hue and
// requires the color to be reasonably saturated + not near-black, so plain
// grey/dark hull plates never match.
function materialMatchesAccentColor(m: THREE.MeshStandardMaterial, accentHex: number, matchAny = false): boolean {
  const src = (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.15)
    ? m.emissive : m.color;
  if (!src) return false;
  const hsl = { h: 0, s: 0, l: 0 };
  src.getHSL(hsl);
  // Grey / black / white → never the core (leave plain hull plates alone).
  if (hsl.s < 0.22 || hsl.l < 0.1 || hsl.l > 0.92) return false;
  if (matchAny) return true; // any reasonably-colored material is the core
  const acc = new THREE.Color(accentHex);
  const ah = { h: 0, s: 0, l: 0 }; acc.getHSL(ah);
  let dh = Math.abs(hsl.h - ah.h); if (dh > 0.5) dh = 1 - dh; // circular hue distance
  return dh < 0.14; // within ~50° of the accent hue (a bit looser)
}
import {
  ENABLE_THREE_NEBULA_SHADER,
  THREE_NEBULA_RENDER_SCALE,
  THREE_NEBULA_PIXEL_SIZE,
  THREE_NEBULA_ALPHA,
  THREE_NEBULA_INTENSITY,
  THREE_NEBULA_SPEED_A,
  THREE_NEBULA_SPEED_B,
  THREE_NEBULA_SCALE_A,
  THREE_NEBULA_SCALE_B,
  PIXELATE_3D,
  PIXELATE_3D_SCALE,
  ENABLE_SHARED_3D_SCENE,
} from "./renderer-config";
import {
  ensureWorldLayer, claimWorldRenderDriver, isWorldRenderDriver,
  playerShipsGroup, enemyShipsGroup, setShipLift, getShipLiftFactor,
  normalizeSharedDepth, destroyWorldLayer,
} from "./three-world-layer";

// Effective downscale factor for the fake pixel-art render mode (1 = off)
const PIX_SCALE = PIXELATE_3D ? Math.max(1, PIXELATE_3D_SCALE) : 1;

// Render layer for additive/transparent glow FX (engine sprites, halo shells).
// Excluded from the silhouette-outline pass, drawn on top afterwards.
const FX_LAYER = 1;

// ── Billboard glow sprites ───────────────────────────────────────────────
// Enemy GLBs author their light effects as transparent "halo" shell meshes.
// At runtime those shells are hidden and replaced by layered camera-facing
// sprites parented to the same node — so authored positions, colors, sizes
// and scale-pulse animations all drive the sprites. Nodes named "Glow_*"
// (empties exported from Blender) are supported as explicit anchors too.
//
// Layered look: small bright inner glow, medium soft glow, faint outer glow.
// All values configurable here.
const GLOW_SPRITE_LAYERS = [
  { scale: 1.15, opacity: 0.85 }, // inner bright
  { scale: 2.4,  opacity: 0.34 }, // medium soft
  { scale: 4.0,  opacity: 0.12 }, // outer faint
];
const GLOW_BASE_ALPHA = 0.24;     // authored halo alpha that maps to 1x intensity
const GLOW_DEFAULT_COLOR = 0x88ccff;

let glowTexture: THREE.CanvasTexture | null = null;
// Radial gradient: bright center, soft falloff, fully transparent edge —
// no square border, no hard rim. White; sprite material tints it.
function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.12, "rgba(255,255,255,0.85)");
  g.addColorStop(0.35, "rgba(255,255,255,0.30)");
  g.addColorStop(0.65, "rgba(255,255,255,0.08)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

interface GlowAnchor {
  color: THREE.Color;
  intensity: number; // 1 = authored baseline
  size: number;      // base radius in node-local units
}

function attachGlowSprites(node: THREE.Object3D, anchor: GlowAnchor): void {
  for (const layer of GLOW_SPRITE_LAYERS) {
    const mat = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: anchor.color,
      transparent: true,
      opacity: Math.min(1, layer.opacity * anchor.intensity),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    const s = anchor.size * layer.scale;
    sprite.scale.set(s, s, 1);
    sprite.castShadow = false;
    sprite.receiveShadow = false;
    sprite.layers.set(FX_LAYER);
    node.add(sprite);
  }
}

const SHIP_3D_MODELS: Record<string, string> = {
  apex: "/models/Apex_Destroyer.glb",
  colossus: "/models/Colossus_MK_X.glb",
  eclipse: "/models/Eclipse_Destroyer.glb",
  harbinger: "/models/Harbinger_Class.glb",
  leviathan: "/models/Leviathan_Dreadnought.glb",
  marauder: "/models/Marauder.glb",
  obsidian: "/models/Obsidian_Reaver.glb",
  phalanx: "/models/Phallanx_Cruiser.glb",
  reaver: "/models/reaver_mk2.glb",
  skimmer: "/models/Skimmer_MK_1.glb",
  sovereign: "/models/Sovereign_Flagship.glb",
  specter: "/models/Specter_Phasefreame.glb",
  titan: "/models/Titan_Bulwark.glb",
  vanguard: "/models/Vanguard.glb",
  wasp: "/models/Wasp_Interceptor.glb",
  // Enemy NPC models — one GLB per enemy type (nose = -Z, up = +Y, size
  // normalization via maxDim so ENEMY_DEFS.size drives small→big scaling)
  enemy_scout: "/models/enemies/enemy_scout.glb?v=19",
  enemy_interceptor: "/models/enemies/enemy_interceptor.glb?v=19",
  enemy_raider: "/models/enemies/enemy_raider.glb?v=19",
  enemy_corvette: "/models/enemies/enemy_corvette.glb?v=19",
  enemy_destroyer: "/models/enemies/enemy_destroyer.glb?v=19",
  enemy_sentinel: "/models/enemies/enemy_sentinel.glb?v=18",
  enemy_specter: "/models/enemies/enemy_specter.glb?v=18",
  enemy_phantom: "/models/enemies/enemy_phantom.glb?v=18",
  enemy_wraith: "/models/enemies/enemy_wraith.glb?v=18",
  enemy_voidling: "/models/enemies/enemy_voidling.glb?v=18",
  enemy_dread: "/models/enemies/enemy_dread.glb?v=18",
  enemy_titan: "/models/enemies/enemy_titan.glb?v=18",
  enemy_juggernaut: "/models/enemies/enemy_juggernaut.glb?v=18",
  enemy_overlord: "/models/enemies/enemy_overlord.glb?v=19",
  enemy_leviathan: "/models/enemies/enemy_leviathan.glb?v=18",
  // Zengas — x-4 tier ship, registered and render-ready (not yet mapped to a type)
  enemy_zengas: "/models/enemies/enemy_zengas.glb?v=18",
  // Erix — new NPC on all x-1 maps
  enemy_erix: "/models/enemies/enemy_erix.glb?v=19",
  enemy_angin: "/models/enemies/enemy_angin.glb?v=1",
  enemy_crobium: "/models/enemies/enemy_crobium.glb?v=1",
  enemy_draug: "/models/enemies/enemy_draug.glb?v=1",
  enemy_knoton: "/models/enemies/enemy_knoton.glb?v=1",
  enemy_maron: "/models/enemies/enemy_maron.glb?v=1",
  enemy_nabas: "/models/enemies/enemy_nabas.glb?v=1",
  enemy_silikum: "/models/enemies/enemy_silikum.glb?v=1",
  enemy_simonit: "/models/enemies/enemy_simonit.glb?v=1",
};

// Per-model heading offset (radians), added to the computed yaw so a GLB whose
// nose is NOT authored along -Z still flies/aims the right way. The existing
// enemies are all nose=-Z (offset 0, the default). New NPCs exported from a
// different tool may need a quarter/half turn — set it here instead of
// re-exporting the GLB. Baked into the model at load (see loadModel).
export const MODEL_YAW_OFFSET: Record<string, number> = {
  // enemy_erix: Math.PI,  // uncomment/adjust if Erix faces the wrong way
  // silikum's hull is authored nose-DOWN (+Z), the reverse of the -Z convention —
  // top-down renders show the pointed nose at the bottom, the engine block up — so
  // it flew backwards/sideways. Half-turn corrects it. (angin/crobium/draug/nabas
  // render nose-up = correct; maron/knoton/simonit are radially symmetric so a
  // heading offset is visually moot.)
  enemy_silikum: Math.PI,
};

// Models whose AUTHORED texture look must be preserved: no space-metal
// override (which darkens the albedo ~45% and swaps the normal map). These
// Tripo-generated NPC GLBs carry their whole identity in the baseColor
// texture (red energy lines, crystal whites) and ship WITHOUT an emissive
// channel — so we derive a glow from the albedo instead: bright/saturated
// texel areas self-illuminate (bloom picks them up), dark hull stays dark.
const KEEP_AUTHORED_MODELS = new Set([
  "enemy_angin", "enemy_crobium", "enemy_draug", "enemy_knoton",
  "enemy_maron", "enemy_nabas", "enemy_silikum", "enemy_simonit",
]);

interface ShipHardpoints {
  thrusters: THREE.Object3D[];
  muzzles: THREE.Object3D[];
  weapons: THREE.Object3D[];
  debugMarkers?: THREE.Mesh[];
}

// Wrapper tilt applied to every ship for the pseudo-3D depth feel. Kept as a
// module-scope constant so the render code and the analytic hardpoint transform
// stay in sync — changing this in one place must not silently misalign the
// other. If the tilt is ever tuned, update both wrapper.rotation.x and this.
export const SHIP_WRAPPER_TILT_X = -0.85;
const COS_TILT = Math.cos(SHIP_WRAPPER_TILT_X);
const SIN_TILT = Math.sin(SHIP_WRAPPER_TILT_X);

// Model-local (canonical, un-rotated, un-scaled) hardpoint offsets. Captured
// once at template load and never change. Projectile spawn uses these plus the
// ship's last-rendered (worldX, worldY, lastYRot) to compute muzzle world
// positions that coincide with the visible weapon on the tilted 3D model.
//
// Coordinates are in model-local space (Three.js convention): +X sideways,
// +Y up, +Z forward-back. All three axes are stored — Y is needed because the
// wrapper tilt bleeds model-Y into screen-Y.
interface ModelLocalHardpoints {
  muzzles: { x: number; y: number; z: number }[];
  weapons: { x: number; y: number; z: number }[];
  thrusters: { x: number; y: number; z: number }[];
  // Hardpoint node names, kept parallel to the coords arrays, so debug tools
  // can identify which GLB node each analytic muzzle corresponds to.
  muzzleNames: string[];
  weaponNames: string[];
  thrusterNames: string[];
}

interface Ship3D {
  lastYRot: number;
  yawFix?: number;   // per-model heading offset (nose not authored on -Z)
  wrapper: THREE.Group;
  model: THREE.Group;
  // Starblast-style flight lean: banking roll into turns + pitch on
  // accel/decel, applied to model.rotation.x/z (heading stays on .y). Purely
  // visual; the analytic muzzle transform uses lastYRot + wrapper tilt only,
  // so projectile spawns are unaffected. Smoothed toward a target each frame.
  bank: number;     // current roll (rad, +/- ~0.5)
  pitch: number;    // current pitch (rad) — always 0 now, kept for the debug hook
  prevYRot?: number; // last heading, to derive turn rate
  prevWorldX?: number;
  prevWorldY?: number;
  prevMoveAng?: number; // last MOVEMENT-direction angle, to derive turn rate for bank
  smoothSpeed?: number; // low-pass filtered speed
  hardpoints: ShipHardpoints;
  engineGlows: THREE.Sprite[];
  mixer: THREE.AnimationMixer | null;
  selectionOutline?: THREE.Group | null; // red backface-hull, built lazily on select
  lastCamX: number;
  lastCamY: number;
  lastWorldX: number;
  lastWorldY: number;
  // World units per model unit for this ship class + sizeScale. Cached at
  // updateShip3D() time so getShipMuzzleWorldPositionsAt() can compute the
  // world offset from model-local hardpoint coords without a Three.js query.
  worldUnitsPerModelUnit: number;
}

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let initialized = false;

// Optional EffectComposer post-processing (GTAO + UnrealBloom + FXAA + vignette),
// enabled per quality tier. When active it renders the scene into outlineRT so
// the existing selection-outline + FX passes still composite on top. When null,
// the cheap inline bloom pipeline below runs instead.
let postFX: PostFX | null = null;
// Debug (depth-test harness): when true, render3DLayer skips the postFX composer
// and takes the cheap inline path, so an A/B grab can isolate whether the
// GTAO/Bloom/FXAA/Vignette chain is what makes the merged station read wrong.
let _debugBypassPostFX = false;
export function __setBypassPostFX(v: boolean): void { _debugBypassPostFX = v; }
// depth-test harness: reach the individual composer passes so each can be
// toggled to find which one washes the merged station out.
export function __getPostFX(): PostFX | null { return postFX; }
// Plain copy material to blit the composer's result (outlineRT) to screen,
// preserving transparency. Used only when postFX is active.
//
// NO colorspace conversion here. The composer's final OutputPass already encodes
// linear→sRGB; the target it writes (outlineRT) therefore holds sRGB pixels. A
// `#include <colorspace_fragment>` here (which honours renderer.outputColorSpace =
// sRGB) would encode a SECOND time — a double sRGB curve that lifts every mid-
// tone toward white. On a small dark ship it read as a faint haze and went
// unnoticed; on the big bright station in the merged scene it was an obvious
// grey, washed-out veil that flattened all the hull detail. Straight copy fixes
// it: sRGB in, sRGB out, once.
let copyMat: THREE.ShaderMaterial | null = null;
const COPY_FRAG = `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tDiffuse, vUv);
}`;

// Silhouette outline pass: ships render into an offscreen target, then a
// fullscreen blit paints 1 buffer-pixel of black wherever a transparent pixel
// touches an opaque one. In the pixelated low-res buffer this reads as a
// crisp 1-line pixel-art outline around every ship/enemy, player included.
let outlineRT: THREE.WebGLRenderTarget | null = null;
let outlineScene: THREE.Scene | null = null;
let outlineCamera: THREE.OrthographicCamera | null = null;
let outlineMat: THREE.ShaderMaterial | null = null;

const OUTLINE_FRAG = `
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  // Black silhouette outline REMOVED — it made every model read as a flat
  // cut-out sticker. Ships now sit directly in the scene with no hard rim.
  // Emissive bloom: bulbs, cores and strips bleed light like real lamps
  vec3 b = texture2D(tBloom, vUv).rgb * 0.85;
  c.rgb += b;
  c.a = max(c.a, min(1.0, (b.r + b.g + b.b) * 1.4));
  gl_FragColor = c;
  #include <colorspace_fragment>
}`;

const BRIGHT_FRAG = `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float l = max(max(c.r, c.g), c.b) * c.a;
  float f = smoothstep(0.72, 0.95, l);
  gl_FragColor = vec4(c.rgb * f, 1.0);
}`;

const BLUR_FRAG = `
uniform sampler2D tDiffuse;
uniform vec2 dir;
varying vec2 vUv;
void main() {
  vec3 acc = texture2D(tDiffuse, vUv).rgb * 0.227027;
  acc += texture2D(tDiffuse, vUv + dir * 1.3846).rgb * 0.3162162;
  acc += texture2D(tDiffuse, vUv - dir * 1.3846).rgb * 0.3162162;
  acc += texture2D(tDiffuse, vUv + dir * 3.2308).rgb * 0.0702703;
  acc += texture2D(tDiffuse, vUv - dir * 3.2308).rgb * 0.0702703;
  gl_FragColor = vec4(acc, 1.0);
}`;

const QUAD_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Red SELECTION outline: the selected ship is rendered (flat white) into a mask
// target; this pass draws a red rim on the mask's silhouette edge — a clean
// thin line, NOT a filled area. Blended over the final image.
const SELECT_FRAG = `
uniform sampler2D tMask;
uniform vec2 texel;
uniform float thickness;
varying vec2 vUv;
void main() {
  float inside = texture2D(tMask, vUv).a;
  if (inside > 0.5) { discard; }     // never cover the ship (no red fill)
  // Nearest silhouette hit within a radius → distance-based falloff. A THIN
  // bright core (dist 1-2) + a soft MINI glow further out (up to ~5px).
  float best = 999.0;
  for (float dx = -5.0; dx <= 5.0; dx += 1.0) {
    for (float dy = -5.0; dy <= 5.0; dy += 1.0) {
      if (texture2D(tMask, vUv + vec2(dx, dy) * texel * thickness).a > 0.5) {
        best = min(best, length(vec2(dx, dy)));
      }
    }
  }
  if (best > 6.0) discard;                 // too far from the ship → nothing
  float core = 1.0 - smoothstep(0.0, 2.6, best);   // thin crisp line
  float glow = 1.0 - smoothstep(0.0, 6.0, best);   // soft outer halo
  float a = core * 0.85 + glow * 0.4;              // line + mini glow, semi-transparent
  gl_FragColor = vec4(1.0, 0.2, 0.22, min(0.9, a));
}`;

let bloomRTA: THREE.WebGLRenderTarget | null = null;
let bloomRTB: THREE.WebGLRenderTarget | null = null;
let brightMat: THREE.ShaderMaterial | null = null;
let blurMat: THREE.ShaderMaterial | null = null;
let fsQuad: THREE.Mesh | null = null;
let _anySelected = false;
let selectRT: THREE.WebGLRenderTarget | null = null;
let selectMat: THREE.ShaderMaterial | null = null;
let selectMaskMat: THREE.MeshBasicMaterial | null = null;

function setupOutlinePass(bufW: number, bufH: number): void {
  const hw = Math.max(1, Math.floor(bufW / 2));
  const hh = Math.max(1, Math.floor(bufH / 2));
  outlineRT = new THREE.WebGLRenderTarget(bufW, bufH, {
    depthBuffer: true,
    format: THREE.RGBAFormat,
  });
  bloomRTA = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false, format: THREE.RGBAFormat });
  bloomRTB = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false, format: THREE.RGBAFormat });
  bloomRTA.texture.minFilter = bloomRTA.texture.magFilter = THREE.LinearFilter;
  bloomRTB.texture.minFilter = bloomRTB.texture.magFilter = THREE.LinearFilter;

  brightMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: outlineRT.texture } },
    vertexShader: QUAD_VERT,
    fragmentShader: BRIGHT_FRAG,
    blending: THREE.NoBlending, depthTest: false, depthWrite: false,
  });
  blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: QUAD_VERT,
    fragmentShader: BLUR_FRAG,
    blending: THREE.NoBlending, depthTest: false, depthWrite: false,
  });
  outlineMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: outlineRT.texture },
      tBloom: { value: bloomRTA.texture },
      texel: { value: new THREE.Vector2(1 / bufW, 1 / bufH) },
    },
    vertexShader: QUAD_VERT,
    fragmentShader: OUTLINE_FRAG,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  outlineScene = new THREE.Scene();
  outlineCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), outlineMat);
  fsQuad.frustumCulled = false;
  outlineScene.add(fsQuad);

  // Copy material for the post-processing path (blit composer result to screen).
  copyMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: outlineRT.texture } },
    vertexShader: QUAD_VERT,
    fragmentShader: COPY_FRAG,
    blending: THREE.NoBlending, depthTest: false, depthWrite: false, transparent: true,
  });

  // Selection mask target + red-edge material.
  selectRT = new THREE.WebGLRenderTarget(bufW, bufH, { depthBuffer: true, format: THREE.RGBAFormat });
  selectMaskMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // flat mask
  selectMat = new THREE.ShaderMaterial({
    uniforms: {
      tMask: { value: selectRT.texture },
      texel: { value: new THREE.Vector2(1 / bufW, 1 / bufH) },
      thickness: { value: 1.0 },
    },
    vertexShader: QUAD_VERT,
    fragmentShader: SELECT_FRAG,
    blending: THREE.NormalBlending,
    depthTest: false, depthWrite: false, transparent: true,
  });
}

function resizeOutlinePass(bufW: number, bufH: number): void {
  if (!outlineRT || !outlineMat) return;
  outlineRT.setSize(bufW, bufH);
  const hw = Math.max(1, Math.floor(bufW / 2));
  const hh = Math.max(1, Math.floor(bufH / 2));
  if (bloomRTA) bloomRTA.setSize(hw, hh);
  if (bloomRTB) bloomRTB.setSize(hw, hh);
  (outlineMat.uniforms.texel.value as THREE.Vector2).set(1 / bufW, 1 / bufH);
  if (selectRT) selectRT.setSize(bufW, bufH);
  if (selectMat) (selectMat.uniforms.texel.value as THREE.Vector2).set(1 / bufW, 1 / bufH);
}

const loadedModels = new Map<string, THREE.Group>();
const loadingModels = new Set<string>();
const failedModels = new Set<string>();
const activeShips = new Map<string, Ship3D>();

// Entity ids currently selected (clicked) → drawn with a red outline. Set each
// frame from the renderer. Format matches updateShip3D's entityId ("player",
// remote player o.id, or "enemy:<id>").
let _selectedShipIds = new Set<string>();
export function setSelectedShipIds(ids: Set<string>): void { _selectedShipIds = ids; }

// Selection outline is drawn as a POST-PROCESS silhouette edge (see the red
// outline pass in render3DLayer) — NOT a backface-hull (that filled the whole
// ship red instead of a clean rim). We just track which ships are selected and
// mark their meshes so the selection pass can render only them into a mask.
const SELECT_LAYER = 2; // layer used to isolate selected meshes for the mask
const activeThisFrame = new Set<string>();

let cameraZoom = 1;
let renderFrameCount = 0;
let lastFrameTime = 0;
let frameDt = 1 / 60;
let _lastEmissivePulseUpdate = 0;

// Station rendering moved to three-station-layer.ts (own canvas at zIndex 0)
export function initStationLayer(_canvas: HTMLCanvasElement): void {}
export function renderStationLayer(): void {}
export function destroyStationLayer(): void {}

// Nebula background
let nebulaBackground: ThreeNebulaBackground | null = null;

export function init3DLayer(canvas: HTMLCanvasElement): void {
  if (initialized) return;
  initialized = true;

  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;

  // ── Shared scene ──────────────────────────────────────────────────────
  // Everything below this block — renderer, camera, lights, environment — is
  // exactly what three-world-layer.ts now owns for ALL four object groups.
  // Adopt its objects instead of making a second set, and keep only what is
  // genuinely this layer's: the post chain and the outline/FX passes, which
  // still run on the shared scene at the end of the frame.
  if (ENABLE_SHARED_3D_SCENE) {
    const world = ensureWorldLayer(canvas, w, h);
    renderer = world.renderer;
    scene = world.scene;
    camera = world.camera;
    claimWorldRenderDriver("ships");

    const dbShared = renderer.getDrawingBufferSize(new THREE.Vector2());
    setupOutlinePass(dbShared.x, dbShared.y);
    if (outlineRT) {
      postFX = createPostFX(renderer, scene, camera, dbShared.x, dbShared.y, outlineRT);
    }
    window.addEventListener("resize", onResize);
    console.log("[Three.js] INIT OK (shared world scene)", w, "x", h, "postFX:", !!postFX);
    return;
  }

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: PIX_SCALE === 1, // hard pixels when pixelating
    premultipliedAlpha: false,
  });
  if (PIX_SCALE > 1) {
    // Fake pixel-art mode: render the ships into a low-res buffer and let the
    // browser upscale the canvas nearest-neighbor. Camera frustum stays in CSS
    // pixels, so all world/hardpoint math is unaffected — models keep full detail.
    renderer.setPixelRatio(1);
    renderer.setSize(Math.ceil(w / PIX_SCALE), Math.ceil(h / PIX_SCALE), false);
    canvas.style.imageRendering = "pixelated";
  } else {
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Quality settings (per-GPU tier) — one source of truth in RendererSettings.
  const rs = getRendererSettings();
  // Physically-correct light falloff (r155+ default; set explicitly for clarity).
  (renderer as any).useLegacyLights = false;
  // Feed the material system the GPU-clamped anisotropy cap for this tier.
  setMaterialAnisotropyMax(renderer.capabilities.getMaxAnisotropy());
  // Perf overlay: register this renderer's draw-call info. This module is
  // loaded twice (ship layer + `?instance=enemy` duplicate); the enemy
  // instance tags its offscreen canvas with data-perf-name (query strings on
  // import.meta.url don't survive the production bundle).
  perfRegisterThree(canvas.dataset?.perfName ?? "3d-ships", renderer.info);

  // Self-shadowing: plates/limbs cast onto the hull for a lived-in look. Soft
  // PCF filtering; stable bias per tier to avoid acne/peter-panning + flicker.
  renderer.shadowMap.enabled = rs.shadowsEnabled;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const dbSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  setupOutlinePass(dbSize.x, dbSize.y);

  scene = new THREE.Scene();

  // Orthographic camera looking straight down (top-down view)
  camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 2000);
  camera.position.set(0, 500, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, -1);

  // Initialize nebula background
  if (ENABLE_THREE_NEBULA_SHADER) {
    nebulaBackground = new ThreeNebulaBackground({
      enabled: ENABLE_THREE_NEBULA_SHADER,
      renderScale: THREE_NEBULA_RENDER_SCALE,
      pixelSize: THREE_NEBULA_PIXEL_SIZE,
      alpha: THREE_NEBULA_ALPHA,
      intensity: THREE_NEBULA_INTENSITY,
      speedA: THREE_NEBULA_SPEED_A,
      speedB: THREE_NEBULA_SPEED_B,
      scaleA: THREE_NEBULA_SCALE_A,
      scaleB: THREE_NEBULA_SCALE_B,
    });
    nebulaBackground.init(scene, camera, renderer);
  }

  // Filmic tone mapping + environment reflections: hulls pick up soft
  // sky/sun reflections and specular highlights roll off naturally, so the
  // ships read as objects lit BY the scene instead of cut-in renders.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Exposure per tier (was a hard 0.86). The CSS brightness grade is gone
  // (forbidden canvas filter) so the filmic exposure carries the grade.
  renderer.toneMappingExposure = rs.toneMappingExposure;
  // IBL: HDR via PMREM when the tier allows (RoomEnvironment fallback), so
  // hulls pick up soft cinematic sky/sun reflections instead of reading flat.
  const pmrem = loadEnvironment(renderer, scene);
  // Grade the DOM-presented canvas to match the Pixi scene lighting (the
  // player layer sits ABOVE the Pixi vignette/ambient and would otherwise
  // read brighter than everything else — the "cut-in" look).
  // NOTE: the old `canvas.style.filter = brightness(0.94) saturate(0.96)` CSS
  // grade was REMOVED (forbidden canvas filter). The equivalent dimming is now
  // done properly in-scene via tone-mapping exposure (set above) + the deeper
  // low ambient below, so nothing outside WebGL touches the pixels.

  // ── Directional world lighting (deep shadow side, no flat ambient) ──
  // Very low, cool ambient so the side facing away from the sun goes genuinely
  // dark instead of being lifted flat — the main cause of the "flat/cut-out"
  // read. The material's own AO map darkens recesses on top of this.
  const ambient = new THREE.AmbientLight(0x232a42, 0.12);
  scene.add(ambient);

  // Main sun: strong warm key from the upper-right → clear lit side.
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
  sun.position.set(120, 320, -90);
  sun.castShadow = rs.shadowsEnabled;
  sun.shadow.mapSize.set(rs.shadowMapSize, rs.shadowMapSize);
  sun.shadow.camera.left = -900;
  sun.shadow.camera.right = 900;
  sun.shadow.camera.top = 900;
  sun.shadow.camera.bottom = -900;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 1500;
  sun.shadow.bias = rs.shadowBias;
  sun.shadow.normalBias = rs.shadowNormalBias;
  scene.add(sun);

  // Cool fill: weak, opposite side — defines the dark side's edge without
  // lifting it to grey.
  const fill = new THREE.DirectionalLight(0x5c86d6, 0.4);
  fill.position.set(-90, 140, 110);
  scene.add(fill);

  // Grazing rim from behind/below → catches top edges (fresnel-like) so hulls
  // read against the dark background instead of blending into a flat blob.
  const rim = new THREE.DirectionalLight(0x9ec2ff, 0.55);
  rim.position.set(-30, -70, 210);
  scene.add(rim);

  // Post-processing composer (GTAO + UnrealBloom + FXAA + vignette), rendering
  // INTO outlineRT so the selection/FX passes still composite over it. null on
  // low tier → the inline pipeline runs instead.
  if (outlineRT) {
    const dbS = renderer.getDrawingBufferSize(new THREE.Vector2());
    postFX = createPostFX(renderer, scene, camera, dbS.x, dbS.y, outlineRT);
  }

  window.addEventListener("resize", onResize);
  console.log("[Three.js] INIT OK canvas:", w, "x", h, "postFX:", !!postFX);
}

function onResize(): void {
  if (!renderer || !camera) return;
  const canvas = renderer.domElement;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  if (PIX_SCALE > 1) {
    renderer.setSize(Math.ceil(w / PIX_SCALE), Math.ceil(h / PIX_SCALE), false);
  } else {
    renderer.setSize(w, h);
  }
  const dbSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  resizeOutlinePass(dbSize.x, dbSize.y);
  if (postFX) postFX.setSize(dbSize.x, dbSize.y);
  camera.left = -w / 2;
  camera.right = w / 2;
  camera.top = h / 2;
  camera.bottom = -h / 2;
  camera.updateProjectionMatrix();

  // Update nebula on resize
  if (nebulaBackground) {
    nebulaBackground.resize(w, h);
  }
}

// Classify hardpoint nodes by name. Accepts a wide set of naming conventions
// authored across different GLB export tools and Blender workflows:
//   - hp_muzzle_*         (original convention)
//   - hp_weapon_*
//   - hp_thruster_*
//   - muzzle_hp[_*]       (reversed convention added later)
//   - weapon_hp[_*]
//   - thruster_hp[_*]
//   - hp_muzzle / muzzle_hp (no trailing token, single node)
//   - Blender duplicates:  foo.001, foo.002, ...
//   - dot-separated:       hp.muzzle.left, muzzle.hp.left
// The name must include an `hp` token to be a hardpoint — we don't classify
// a raw mesh named just "Weapon" as a weapon hardpoint.
//
// Returns the category ("muzzle" | "weapon" | "thruster") or null.
function classifyHardpointName(raw: string): "muzzle" | "weapon" | "thruster" | null {
  if (!raw) return null;
  // Normalize: lowercase, strip Blender duplicate suffix (.001), collapse
  // dots/dashes to underscores so we can match either separator style.
  const lower = raw.toLowerCase().replace(/\.\d+$/, "");
  const norm = lower.replace(/[.\-]/g, "_");
  const isHp = /(^|_)hp(_|$)/.test(norm);
  if (!isHp) return null;
  if (/(^|_)muzzle(_|$)/.test(norm)) return "muzzle";
  if (/(^|_)weapon(_|$)/.test(norm)) return "weapon";
  if (/(^|_)thruster(_|$)/.test(norm)) return "thruster";
  if (/(^|_)engine(_|$)/.test(norm)) return "thruster";
  return null;
}

function collectHardpoints(model: THREE.Group, shipClass: string): ShipHardpoints {
  const thrusters: THREE.Object3D[] = [];
  const muzzles: THREE.Object3D[] = [];
  const weapons: THREE.Object3D[] = [];

  const allObjects: string[] = [];

  // Traverse and collect hardpoints
  model.traverse((child) => {
    const name = child.name || "(unnamed)";
    allObjects.push(name);
    const kind = classifyHardpointName(name);
    if (kind === "muzzle") muzzles.push(child);
    else if (kind === "weapon") weapons.push(child);
    else if (kind === "thruster") thrusters.push(child);
  });

  // Canonical order: sort by name so hardpointIndex maps stably across all clients.
  const byName = (a: THREE.Object3D, b: THREE.Object3D) => a.name.localeCompare(b.name);
  thrusters.sort(byName);
  muzzles.sort(byName);
  weapons.sort(byName);

  // Debug logging (shown at model load only, keep this until the alignment
  // fix is verified on all ships)
  console.log(`[Three.js] ${shipClass} - All objects in GLB:`, allObjects);
  console.log(`[Three.js] ${shipClass} - Hardpoints found:`);
  console.log(`  Thrusters (${thrusters.length}):`, thrusters.map(t => t.name));
  console.log(`  Muzzles (${muzzles.length}):`, muzzles.map(m => m.name));
  console.log(`  Weapons (${weapons.length}):`, weapons.map(w => w.name));

  if (thrusters.length === 0) {
    console.warn(`[Three.js] ${shipClass} - NO thruster hardpoints found!`);
  }
  if (muzzles.length === 0 && weapons.length === 0) {
    console.warn(`[Three.js] ${shipClass} - NO muzzle/weapon hardpoints found! Projectiles will use center-of-ship fallback.`);
  }

  return { thrusters, muzzles, weapons };
}

function loadModel(shipClass: string): void {
  const path = SHIP_3D_MODELS[shipClass];
  if (!path || loadedModels.has(shipClass) || loadingModels.has(shipClass) || failedModels.has(shipClass)) return;

  loadingModels.add(shipClass);
  console.log("[Three.js] Loading GLB:", path);

  const loader = new GLTFLoader();
  loader.load(
    path,
    (gltf) => {
      const model = gltf.scene;
      // Enemy models author their own emissive glow + PBR values in Blender —
      // preserve them. Player ships keep the legacy clamps below.
      const isEnemy = shipClass.startsWith("enemy_");
      const role: SpaceRole = isEnemy ? "npc" : "player";
      const seed = shipSeedHash(shipClass);
      // Per-enemy signature accent. "cracks"/"both" apply an emissive fracture
      // map to the hull here; "core"/"both" attach a glowing crystal/orb per
      // instance in updateShip3D (see makeEnemyCore).
      const accent = ENEMY_ACCENTS[shipClass];
      const energyCracks = accent && accent.kind === "cracks"
        ? { color: accent.color, intensity: accent.intensity }
        : undefined;
      // "aura" accent (e.g. Erix) is applied per-instance in updateShip3D as a
      // separate glow halo — the hull material stays normal/solid here.
      // For "core" enemies, the accent-colored material on the model is made
      // shiny + self-lit (so only the interior/core glows, not a decal over
      // the whole ship).
      const coreAccent = accent && accent.kind === "core"
        ? { color: accent.color, intensity: accent.intensity, matchAny: !!accent.matchAnyColored }
        : undefined;
      let hullMatCount = 0, glowSkipCount = 0;
      let dbgMeshes = 0, dbgMats = 0, dbgStrongEmis = 0, dbgGlow = 0, dbgCore = 0, dbgNoStd = 0;
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        dbgMeshes++;

        // Handle BOTH single materials and material ARRAYS (multi-material
        // meshes were silently skipped before → some models never changed).
        const matList: THREE.Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const newList: THREE.Material[] = [];
        let anyTransparentGlow = false;

        // aoMap needs a 2nd UV channel — set once per mesh.
        const geo = mesh.geometry as THREE.BufferGeometry;
        if (geo && geo.attributes.uv && !geo.attributes.uv2) {
          geo.setAttribute("uv2", geo.attributes.uv);
        }

        for (let mi = 0; mi < matList.length; mi++) {
          let m = matList[mi] as THREE.MeshStandardMaterial;
          dbgMats++;
          const dbgType = (m as any).type;

          // Unlit → lit upgrade.
          if ((m as any).type === "MeshBasicMaterial") {
            const om = m as any;
            const up = new THREE.MeshStandardMaterial({
              map: om.map, color: om.color, transparent: om.transparent,
              opacity: om.opacity, side: om.side, roughness: 0.5, metalness: 0.4,
            });
            om.dispose?.();
            m = up;
          }
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;

          // Diagnostic: log EVERY material (all ships) so we can see type,
          // color, emissive + which branch it will take.
          if ((window as any).__DEBUG_MAT) {
            const em = m.emissive ? m.emissive.getHexString() : "000000";
            const emSum = m.emissive ? (m.emissive.r + m.emissive.g + m.emissive.b) : 0;
            console.log(`[SpaceMat] ${shipClass} mat[${mi}] type=${dbgType} "${m.name || "?"}" color=#${m.color?.getHexString() ?? "?"} emissive=#${em}(sum=${emSum.toFixed(2)},I=${(m.emissiveIntensity ?? 1).toFixed(1)}) transp=${m.transparent} op=${(m.opacity ?? 1).toFixed(2)} hasMap=${!!m.map}`);
          }

          // A GLOW SHELL is an enemy halo: transparent AND essentially unlit /
          // emissive-driven. Only these are skipped + hidden. A merely
          // alpha-flagged HULL material is NOT a glow shell and still gets the
          // space-metal treatment (this over-broad skip was the bug).
          const glowByEmissive = !!m.emissive &&
            (m.emissive.r + m.emissive.g + m.emissive.b) > 0.05;
          const isGlowShell = isEnemy && m.transparent && (m.opacity ?? 1) < 0.9 && glowByEmissive;

          // MANY of these GLBs ship a BROKEN export: emissive set to WHITE with
          // the albedo map plugged into the emissive slot (emissive≈#ffffff,
          // sum≈3). That makes the whole hull self-lit and unlit-flat — the real
          // cause of the "too bright / flat / cut-out" look. Detect it (near-
          // white / desaturated emissive) and KILL it so the material becomes a
          // normal lit hull that the space-metal treatment then darkens.
          const emHsl = { h: 0, s: 0, l: 0 };
          if (m.emissive) m.emissive.getHSL(emHsl);
          const emSum = m.emissive ? (m.emissive.r + m.emissive.g + m.emissive.b) : 0;
          const brokenWhiteEmissive = emSum > 0.35 && emHsl.s < 0.25; // white/grey glow = bug
          if (brokenWhiteEmissive) {
            m.emissive = new THREE.Color(0x000000);
            m.emissiveIntensity = 0;
            m.emissiveMap = null;
          }

          // A GENUINE emissive part (engine core, weapon strip) glows in a real
          // COLOR — keep it. White/grey was handled above.
          const strongEmissive = !brokenWhiteEmissive && !!m.emissive &&
            emSum > 0.35 && emHsl.s >= 0.25 &&
            (m.emissiveIntensity ?? 1) > 0.3;

          if (KEEP_AUTHORED_MODELS.has(shipClass)) {
            // Authored-look NPC: keep the GLB's own baseColor/normal maps, but the
            // Tripo exports ship as MATTE (high roughness / low metalness) so they
            // never catch the environment — they read as flat next to the glossy
            // ships. Push them toward reflective metal (without discarding the
            // authored albedo) so they glisten + mirror the studio env like the
            // rest of the fleet, and keep the albedo-derived glow on the bright
            // accent areas (red lines, crystal white).
            if (m.map) {
              m.emissiveMap = m.map;
              m.emissive = new THREE.Color(0xffffff);
              m.emissiveIntensity = 0.38;
            }
            m.metalness = Math.max(m.metalness ?? 0, 0.72);
            m.roughness = Math.min(m.roughness ?? 1, 0.4);
            (m as any).envMapIntensity = 1.6;
            m.needsUpdate = true;
            hullMatCount++;
            newList.push(m);
            continue;
          }

          if (isGlowShell) {
            dbgGlow++;
            // Enemy halo → hidden + turned into a glow anchor (unchanged behavior).
            m.visible = false;
            anyTransparentGlow = true;
            const col = glowByEmissive ? m.emissive!.clone()
              : (m.color ? m.color.clone() : new THREE.Color(GLOW_DEFAULT_COLOR));
            if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
            const r = mesh.geometry.boundingSphere ? mesh.geometry.boundingSphere.radius : 1;
            mesh.userData.glowAnchor = {
              color: "#" + col.getHexString(),
              intensity: (m.opacity ?? GLOW_BASE_ALPHA) / GLOW_BASE_ALPHA,
              size: r * 2,
            };
            mesh.layers.set(FX_LAYER);
          } else if (coreAccent && materialMatchesAccentColor(m, coreAccent.color, coreAccent.matchAny)) {
            if ((window as any).__DEBUG_MAT) {
              const hsl = { h: 0, s: 0, l: 0 }; (m.color ?? new THREE.Color()).getHSL(hsl);
              console.log(`[SpaceMat] ${shipClass} CORE material "${m.name || "?"}" color=#${m.color?.getHexString()} hsl=(${hsl.h.toFixed(2)},${hsl.s.toFixed(2)},${hsl.l.toFixed(2)}) → made shiny+glowing`);
            }
            // This material is the enemy's core part (accent-colored, or — for
            // matchAny models like the overlord — any non-grey colored material)
            // → make it shiny + self-lit so ONLY the interior/core glows. The
            // rest of the hull stays dark (falls to the space-metal branch).
            // Keep the material's OWN hue (so bluish-green stays bluish-green),
            // just make it glow that color.
            const own = m.color ? m.color.clone() : new THREE.Color(coreAccent.color);
            m.emissive = own.clone();
            m.color = own.clone().multiplyScalar(0.55);
            m.emissiveIntensity = coreAccent.intensity ?? 2.0;
            m.metalness = 0.9;
            m.roughness = 0.12;          // very shiny
            (m as any).envMapIntensity = 1.6;
            m.userData.pulseEmissive = {
              base: coreAccent.intensity ?? 2.0,
              amp: (coreAccent.intensity ?? 2.0) * 0.4, speed: 1.5,
            };
            m.needsUpdate = true;
            hullMatCount++; dbgCore++;
          } else if (strongEmissive) {
            dbgStrongEmis++;
            // Keep the glow, but still darken the base + add reflectivity so it
            // reads as lit metal with an emissive detail, not a flat bright blob.
            m.metalness = Math.max(m.metalness ?? 0, 0.5);
            m.roughness = Math.min(m.roughness ?? 1, 0.55);
            (m as any).envMapIntensity = 0.8;
            m.needsUpdate = true;
          } else {
            if (dbgType !== "MeshStandardMaterial" && dbgType !== "MeshPhysicalMaterial") dbgNoStd++;
            applySpaceMaterial(m, role, { seed, energyCracks });
            hullMatCount++;
          }
          newList.push(m);
        }

        mesh.material = Array.isArray(mesh.material) ? newList : newList[0];
        mesh.castShadow = !anyTransparentGlow;
        mesh.receiveShadow = true;
        if (anyTransparentGlow) glowSkipCount++;
      });
      if ((window as any).__DEBUG_MAT) {
        console.log(`[SpaceMat] ${shipClass}: meshes=${dbgMeshes} mats=${dbgMats} → textured=${hullMatCount} core=${dbgCore} strongEmissive=${dbgStrongEmis} glowShell=${dbgGlow} nonStd=${dbgNoStd}`);
      }
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Center the pivot on the mesh bounding-box center. GLB exports (Tripo)
      // put the origin at the mesh BASE, and the wrapper tilt bleeds that Y
      // offset into screen-Y — the visible ship floated above the entity
      // position/hitbox, so shots seemed to strike the model's bottom edge.
      // With the pivot centered, entity pos = visual center = hull center
      // (ship-hulls are generated about the same bbox center) and heading
      // rotation spins the ship around its middle.
      const inner = model;
      const pivot = new THREE.Group();
      inner.position.sub(center);
      pivot.add(inner);

      // Keep authored animation clips (glow pulses, spinning rings, limb sway)
      pivot.userData.animations = gltf.animations ?? [];

      // Collect hardpoints from the GLB model (via the centered pivot so
      // captured local coords carry the centering offset)
      const hardpoints = collectHardpoints(pivot, shipClass);
      pivot.userData.hardpoints = hardpoints;

      // Snapshot model-local hardpoint positions with the template at the origin
      // and no rotation/scale applied. Store (x, y, z) — model-Y is needed by
      // getShipMuzzleWorldPositionsAt() because the wrapper's -0.85 tilt around
      // X mixes model-Y into screen-Z. Node names are kept parallel to the
      // coord arrays so debug tools can identify which GLB node produced each
      // muzzle.
      pivot.updateMatrixWorld(true);
      const _localTmp = new THREE.Vector3();
      const localHardpoints: ModelLocalHardpoints = {
        muzzles: [], weapons: [], thrusters: [],
        muzzleNames: [], weaponNames: [], thrusterNames: [],
      };
      for (const hp of hardpoints.muzzles) {
        hp.getWorldPosition(_localTmp);
        localHardpoints.muzzles.push({ x: _localTmp.x, y: _localTmp.y, z: _localTmp.z });
        localHardpoints.muzzleNames.push(hp.name || "(unnamed)");
      }
      for (const hp of hardpoints.weapons) {
        hp.getWorldPosition(_localTmp);
        localHardpoints.weapons.push({ x: _localTmp.x, y: _localTmp.y, z: _localTmp.z });
        localHardpoints.weaponNames.push(hp.name || "(unnamed)");
      }
      for (const hp of hardpoints.thrusters) {
        hp.getWorldPosition(_localTmp);
        localHardpoints.thrusters.push({ x: _localTmp.x, y: _localTmp.y, z: _localTmp.z });
        localHardpoints.thrusterNames.push(hp.name || "(unnamed)");
      }
      pivot.userData.localHardpoints = localHardpoints;

      // Store raw size for scaling later
      pivot.userData.maxDim = maxDim;
      loadedModels.set(shipClass, pivot);
      loadingModels.delete(shipClass);
      console.log("[Three.js] GLB LOADED:", shipClass, "maxDim:", maxDim.toFixed(2), "bbox:", size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));
    },
    (progress) => {
      if (progress.total > 0 && progress.loaded === progress.total) {
        console.log("[Three.js] GLB download complete:", shipClass);
      }
    },
    (error) => {
      console.error("[Three.js] GLB LOAD FAILED:", shipClass, error);
      loadingModels.delete(shipClass);
      failedModels.add(shipClass);
    }
  );
}

let preloadPriorityShip = '';
let preloadStarted = false;

export function preload3DModels(priorityShip?: string): void {
  if (preloadStarted) return;
  preloadStarted = true;
  if (priorityShip && SHIP_3D_MODELS[priorityShip]) {
    preloadPriorityShip = priorityShip;
    loadModel(priorityShip);
  }
}

export function getLoadingProgress(): { loaded: number; total: number; playerReady: boolean } {
  const total = Object.keys(SHIP_3D_MODELS).length;
  const loaded = loadedModels.size + failedModels.size;
  const playerReady = !preloadPriorityShip || loadedModels.has(preloadPriorityShip) || failedModels.has(preloadPriorityShip);
  return { loaded, total, playerReady };
}

export function has3DModel(shipClass: string): boolean {
  return shipClass in SHIP_3D_MODELS && !failedModels.has(shipClass);
}

export function is3DReady(shipClass: string): boolean {
  if (failedModels.has(shipClass)) return false;
  if (loadedModels.has(shipClass)) return true;
  loadModel(shipClass);
  return false;
}

export function setCameraZoom(zoom: number): void {
  cameraZoom = zoom;
}

// Debug/measurement hook: current flight-lean of an entity's ship model.
// Both three-ship-layer instances (ships + ?instance=enemy) register; the
// combined lookup returns whichever instance actually owns that entity so
// "player" resolves against the ship instance, enemies against theirs.
export function getShipLean(entityId: string): { bank: number; pitch: number } | null {
  const s = activeShips.get(entityId);
  return s ? { bank: s.bank, pitch: s.pitch } : null;
}
if (typeof window !== "undefined") {
  const w = window as any;
  const prev = typeof w.__SHIP_LEAN === "function" ? w.__SHIP_LEAN : null;
  w.__SHIP_LEAN = (id: string) => getShipLean(id) ?? (prev ? prev(id) : null);
}

// Reusable vector to avoid allocation
const tempVec3 = new THREE.Vector3();


// Reusable quaternions/axes for the heading+roll composition (no alloc/frame)
const _qHeading = new THREE.Quaternion();
const _qRoll = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisZfwd = new THREE.Vector3(0, 0, 1); // model fore-aft axis (roll axis)

export function getShipHardpointPositions(
  entityId: string,
  camX: number,
  camY: number
): {
  thrusters: { x: number; y: number }[];
  muzzles: { x: number; y: number }[];
  weapons: { x: number; y: number }[];
} | null {
  const ship = activeShips.get(entityId);
  if (!ship || !ship.hardpoints) return null;

  const result = {
    thrusters: [] as { x: number; y: number }[],
    muzzles: [] as { x: number; y: number }[],
    weapons: [] as { x: number; y: number }[],
  };

  const wrapperPos = ship.wrapper.position;
  const wrapperScale = ship.wrapper.scale;

  // Top-down projection that bypasses the wrapper tilt (rotation.x = -0.85).
  // See getShipMuzzleWorldPositions for the rationale.
  const project = (hp: THREE.Object3D): { x: number; y: number } => {
    hp.getWorldPosition(tempVec3);
    ship.wrapper.worldToLocal(tempVec3);
    const screenX = wrapperPos.x + tempVec3.x * wrapperScale.x;
    const screenZ = wrapperPos.z + tempVec3.z * wrapperScale.z;
    return {
      x: screenX / cameraZoom + camX,
      y: screenZ / cameraZoom + camY,
    };
  };

  for (const hp of ship.hardpoints.thrusters) result.thrusters.push(project(hp));
  for (const hp of ship.hardpoints.muzzles) result.muzzles.push(project(hp));
  for (const hp of ship.hardpoints.weapons) result.weapons.push(project(hp));

  return result;
}

// Analytic muzzle/weapon world positions that match exactly where the user
// sees the weapon on the visible tilted 3D ship model.
//
// The Three.js render pipeline applies two rotations to each hardpoint:
//   (1) model.rotation.y = ship.lastYRot     — Y-axis (heading)
//   (2) wrapper.rotation.x = SHIP_WRAPPER_TILT_X (-0.85)   — X-axis (depth tilt)
// then scales by ship.worldUnitsPerModelUnit and translates to ship world pos.
// The orthographic camera looks straight down, so the on-screen (X, Y) offset
// equals the (x, z) of the doubly-rotated point.
//
// Previous versions of this function ignored the X tilt, treating the ship as
// a flat top-down billboard. That produced a rotation-dependent offset:
//   * hardpoints with non-zero model-Y projected to the wrong screen-Y
//     (bleed of my through sin(tilt))
//   * hardpoints with non-zero forward/back (model-Z) had their screen-Y
//     offset over-scaled by 1/cos(tilt) ≈ 1.52×
// Both symptoms are visible as the projectile spawning next to the weapon,
// with the mismatch rotating with the ship.
//
// Correct math:
//   Step 1 — Y-axis (heading) rotation:
//     x1 =  mx·cos(θ) + mz·sin(θ)
//     y1 =  my
//     z1 = -mx·sin(θ) + mz·cos(θ)
//   Step 2 — X-axis (tilt) rotation with tilt = SHIP_WRAPPER_TILT_X:
//     x2 = x1
//     y2 = y1·cos(tilt) - z1·sin(tilt)       (depth; camera drops this)
//     z2 = y1·sin(tilt) + z1·cos(tilt)       (this is the on-screen Y offset)
//   Step 3 — scale and translate:
//     worldX = shipWorldX + x2 · s
//     worldY = shipWorldY + z2 · s
//
// Uses ship.lastYRot / lastWorldX / lastWorldY — the exact state Three.js
// drew on its last render — so the analytic muzzle position coincides with
// the visible weapon regardless of interpolation lag.
export function getShipMuzzleWorldPositionsAt(
  entityId: string,
  _worldX: number,
  _worldY: number,
  _angle: number,
): {
  muzzles: { x: number; y: number }[];
  weapons: { x: number; y: number }[];
  thrusters: { x: number; y: number }[];
} | null {
  const ship = activeShips.get(entityId);
  if (!ship) return null;
  const localHp = ship.model.userData.localHardpoints as ModelLocalHardpoints | undefined;
  if (!localHp) return null;
  const originX = ship.lastWorldX;
  const originY = ship.lastWorldY;

  // Project a model-local hardpoint through the ACTUAL rendered model matrix
  // (heading + bank + wrapper camera-tilt + scale, exactly as Three.js drew
  // it this frame), then map screen space back to world. Using the real matrix
  // instead of re-deriving the rotations by hand guarantees muzzles/thrusters
  // coincide with the visible weapon at ANY bank/heading — the previous manual
  // reconstruction drifted up to ~20px once the ship leaned.
  ship.wrapper.updateWorldMatrix(true, false);
  ship.model.updateWorldMatrix(true, false);
  const mMat = ship.model.matrixWorld;

  const project = (mx: number, my: number, mz: number, label: string, idx: number, nodeName: string): { x: number; y: number } => {
    // local hardpoint -> world (in the three.js scene, which is screen-space:
    // x = screen px offset, z = screen px offset, y = depth the camera drops).
    tempVec3.set(mx, my, mz).applyMatrix4(mMat);
    // model.matrixWorld already includes wrapper.position (the ship's screen
    // pos) and scale; screen offset from ship centre = local scene coords.
    // The ship centre in scene space is wrapper.position (x, 0, z).
    const dxScene = tempVec3.x - ship.wrapper.position.x;
    const dzScene = tempVec3.z - ship.wrapper.position.z;
    // scene px -> world units: the wrapper scale already turned model units
    // into screen px (targetPixels * zoom). Divide by zoom to get world units.
    const wx = originX + dxScene / cameraZoom;
    const wy = originY + dzScene / cameraZoom;
    void label; void idx; void nodeName;
    return { x: wx, y: wy };
  };

  const muzzles = localHp.muzzles.map((m, i) => project(m.x, m.y, m.z, "muzzle", i, localHp.muzzleNames[i] ?? ""));
  const weapons = localHp.weapons.map((w, i) => project(w.x, w.y, w.z, "weapon", i, localHp.weaponNames[i] ?? ""));
  const thrusters = localHp.thrusters.map((t, i) => project(t.x, t.y, t.z, "thruster", i, localHp.thrusterNames[i] ?? ""));
  return { muzzles, weapons, thrusters };
}

// Debug-only: enumerate every active ship's analytic muzzle and weapon world
// positions plus context. Used by the PixiJS debug marker overlay to render
// dots at the current muzzle locations for visual verification of alignment.
// Called at most once per render frame under a __DEBUG_MUZZLE_MARKERS gate,
// so allocation is intentional and harmless.
export interface DebugMuzzleRecord {
  entityId: string;
  ring: "muzzle" | "weapon" | "thruster";
  index: number;
  nodeName: string;
  worldX: number;
  worldY: number;
  shipWorldX: number;
  shipWorldY: number;
  lastYRot: number;
}

export function debugEnumerateAllMuzzles(): DebugMuzzleRecord[] {
  const out: DebugMuzzleRecord[] = [];
  for (const [entityId, ship] of activeShips) {
    const localHp = ship.model.userData.localHardpoints as ModelLocalHardpoints | undefined;
    if (!localHp) continue;
    const s = ship.worldUnitsPerModelUnit;
    const theta = ship.lastYRot;
    const ca = Math.cos(theta);
    const sa = Math.sin(theta);
    const originX = ship.lastWorldX;
    const originY = ship.lastWorldY;

    const emit = (
      mx: number, my: number, mz: number,
      ring: "muzzle" | "weapon" | "thruster", index: number, nodeName: string,
    ) => {
      const x1 =  mx * ca + mz * sa;
      const y1 =  my;
      const z1 = -mx * sa + mz * ca;
      const z2 = y1 * SIN_TILT + z1 * COS_TILT;
      out.push({
        entityId, ring, index, nodeName,
        worldX: originX + x1 * s,
        worldY: originY + z2 * s,
        shipWorldX: originX,
        shipWorldY: originY,
        lastYRot: theta,
      });
    };

    for (let i = 0; i < localHp.muzzles.length; i++) {
      const m = localHp.muzzles[i];
      emit(m.x, m.y, m.z, "muzzle", i, localHp.muzzleNames[i] ?? "");
    }
    for (let i = 0; i < localHp.weapons.length; i++) {
      const w = localHp.weapons[i];
      emit(w.x, w.y, w.z, "weapon", i, localHp.weaponNames[i] ?? "");
    }
    for (let i = 0; i < localHp.thrusters.length; i++) {
      const t = localHp.thrusters[i];
      emit(t.x, t.y, t.z, "thruster", i, localHp.thrusterNames[i] ?? "");
    }
  }
  return out;
}

// Legacy: returns muzzle/weapon hardpoint world positions using the cam values
// from the last render frame — safe to call from the game tick without passing
// cam. Prefer getShipMuzzleWorldPositionsAt() for projectile spawn logic; this
// function is retained for callers that need the live rendered position.
//
// The wrapper has rotation.x = -0.85 for depth. A naive inverse of
//   getWorldPosition().z / zoom + camY
// is wrong for hardpoints with non-zero model-space Y: the tilt bleeds model-Y
// into world-Z. To recover a true top-down projection we resolve the hardpoint
// in wrapper-local space (pre-tilt), then apply only the wrapper's scale and
// position on the top-down plane — ignoring the tilt entirely.
export function getShipMuzzleWorldPositions(entityId: string): {
  muzzles: { x: number; y: number }[];
  weapons: { x: number; y: number }[];
} | null {
  const ship = activeShips.get(entityId);
  if (!ship || !ship.hardpoints) return null;

  const muzzles: { x: number; y: number }[] = [];
  const weapons: { x: number; y: number }[] = [];
  const cx = ship.lastCamX;
  const cy = ship.lastCamY;
  const dbg = (window as any).__DEBUG_HARDPOINTS;

  const wrapperPos = ship.wrapper.position;
  const wrapperScale = ship.wrapper.scale;

  const project = (hp: THREE.Object3D, label: string): { x: number; y: number } => {
    // World-space position via the full tilted transform.
    hp.getWorldPosition(tempVec3);
    // Undo the wrapper's transform to get wrapper-local (pre-tilt) coordinates.
    // worldToLocal mutates tempVec3 in place.
    ship.wrapper.worldToLocal(tempVec3);
    // Re-project on the top-down plane: apply only scale + position (no tilt).
    // Wrapper-local coords have the ship's heading rotation already baked in
    // (model.rotation.y), so local.x and local.z are the sideways and forward
    // offsets in the ship's frame — exactly what we want for top-down.
    const screenX = wrapperPos.x + tempVec3.x * wrapperScale.x;
    const screenZ = wrapperPos.z + tempVec3.z * wrapperScale.z;
    const wx = screenX / cameraZoom + cx;
    const wy = screenZ / cameraZoom + cy;
    if (dbg) console.log(`[HP:raw] ${label} "${hp.name}" local=(${tempVec3.x.toFixed(1)},${tempVec3.y.toFixed(1)},${tempVec3.z.toFixed(1)}) wrapperPos=(${wrapperPos.x.toFixed(1)},${wrapperPos.z.toFixed(1)}) scale=${wrapperScale.x.toFixed(2)} zoom=${cameraZoom.toFixed(2)} => world=(${wx.toFixed(1)},${wy.toFixed(1)}) shipWorld=(${ship.lastWorldX.toFixed(1)},${ship.lastWorldY.toFixed(1)})`);
    return { x: wx, y: wy };
  };

  for (const hp of ship.hardpoints.muzzles) muzzles.push(project(hp, "muzzle"));
  for (const hp of ship.hardpoints.weapons) weapons.push(project(hp, "weapon"));

  return { muzzles, weapons };
}

export function updateShip3D(
  entityId: string,
  shipClass: string,
  worldX: number,
  worldY: number,
  angle: number,
  sizeScale: number,
  camX: number,
  camY: number,
  // Optional authoritative velocity (server-smoothed). When provided, the
  // flight-lean pitch uses THIS instead of differentiating the interpolated
  // world position — the position is nudged by netcode reconciliation every
  // frame, which made the derived accel (and thus the pitch) jitter. vel is
  // already low-passed by applyServerSmoothing, so it's stable.
  velX?: number,
  velY?: number,
): void {
  if (!scene || !loadedModels.has(shipClass)) return;

  let ship = activeShips.get(entityId);
  if (!ship) {
    const template = loadedModels.get(shipClass)!;
    const model = template.clone();
    // Per-model heading correction for GLBs not authored nose=-Z.
    const yawFix = MODEL_YAW_OFFSET[shipClass] ?? 0;

    // Clone hardpoint references (they move with the cloned model)
    const templateHardpoints = template.userData.hardpoints as ShipHardpoints;
    const hardpoints: ShipHardpoints = {
      thrusters: [],
      muzzles: [],
      weapons: [],
    };

    // Find cloned hardpoints using the same classifier as the template so the
    // per-instance list matches the canonical model-local hardpoint list.
    if (templateHardpoints) {
      model.traverse((child) => {
        const kind = classifyHardpointName(child.name || "");
        if (kind === "thruster") hardpoints.thrusters.push(child);
        else if (kind === "muzzle") hardpoints.muzzles.push(child);
        else if (kind === "weapon") hardpoints.weapons.push(child);
      });
      // Canonical order must match template so hardpointIndex resolves consistently.
      const byName = (a: THREE.Object3D, b: THREE.Object3D) => a.name.localeCompare(b.name);
      hardpoints.thrusters.sort(byName);
      hardpoints.muzzles.sort(byName);
      hardpoints.weapons.sort(byName);
    }

    // Create engine glow sprites at thruster hardpoints
    const engineGlows: THREE.Sprite[] = [];
    // Sovereign gets smaller glow (half size)
    const glowSize = shipClass === "sovereign" ? 0.45 : 0.9;

    for (const thruster of hardpoints.thrusters) {
      const material = new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: 0x4488ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(glowSize, glowSize, 1); // Glow size - tiny and subtle
      sprite.layers.set(FX_LAYER); // engine glow must not receive an outline

      // Position relative to thruster
      thruster.add(sprite);
      engineGlows.push(sprite);
    }

    // Tilt the model slightly toward camera for 3D depth feel. Same constant
    // is consumed by the analytic hardpoint transform so muzzle positions stay
    // aligned with the visible tilted weapon.
    const wrapper = new THREE.Group();
    wrapper.rotation.x = SHIP_WRAPPER_TILT_X;
    wrapper.add(model);
    if (ENABLE_SHARED_3D_SCENE) {
      // Which of the two ship groups this belongs to is decided by the id the
      // renderer already uses to tell them apart — no new plumbing, and the
      // grouping is the only difference between them. Both groups sit in the
      // same scene, under the same camera, in the same depth buffer.
      const isEnemy = entityId.startsWith("enemy:");
      // Enemies get the dark-hull lift (their metallic near-black hull stays a
      // silhouette even under the bright viewport env); player ships don't need
      // it and stations opt out.
      normalizeSharedDepth(model, shipClass, isEnemy);
      (isEnemy ? enemyShipsGroup : playerShipsGroup).add(wrapper);
    } else {
      scene.add(wrapper);
    }

    // "aura" enemies (e.g. Erix): a translucent red LIQUID FLOW that runs over
    // the solid model like water — a shell clone with a scrolling flow texture
    // (animated in the render loop). The hull itself is untouched/solid.
    const auraAcc = ENEMY_ACCENTS[shipClass];
    if (auraAcc && auraAcc.kind === "aura") {
      // Attaches flow shells directly under each hull mesh (they sit ON the
      // surface). No add() needed; the render loop finds them by userData tag.
      makeEnemyFlowShell(model, auraAcc.color, auraAcc.intensity ?? 1.6);
    }

    // NOTE: the separate glowing "core" object was removed — it always read as
    // a glow OVER the whole model. Instead, the enemy's OWN accent-colored
    // material is made shiny + self-lit in the material traversal above (see
    // the accent.kind === "core" branch there), so only the parts that are
    // already that color (the interior/core) light up; the rest stays dark.

    // Billboard glow sprites: attach to authored halo anchors (hidden shells)
    // and to any explicitly named "Glow_*" empties. Parenting means the
    // anchor's pulse animation scales the sprites too.
    model.traverse((child) => {
      const ud = child.userData || {};
      if (ud.glowAnchor) {
        const a = ud.glowAnchor;
        attachGlowSprites(child, {
          color: new THREE.Color(a.color ?? GLOW_DEFAULT_COLOR),
          intensity: a.intensity ?? 1,
          size: a.size ?? 1,
        });
      } else if (/^glow[_.]/i.test(child.name) && !(child as THREE.Mesh).isMesh) {
        attachGlowSprites(child, {
          color: new THREE.Color(ud.glow_color ?? GLOW_DEFAULT_COLOR),
          intensity: ud.glow_intensity ?? 1,
          size: ud.glow_size ?? 0.3,
        });
      }
    });

    // Play authored idle animations (clips bind to cloned nodes by name)
    let mixer: THREE.AnimationMixer | null = null;
    const clips = (template.userData.animations as THREE.AnimationClip[]) || [];
    if (clips.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      for (const clip of clips) {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
      }
      // Desync instances so a pack of the same enemy doesn't pulse in unison
      mixer.setTime(Math.random() * 5);
    }

    ship = {
      wrapper, model, hardpoints, engineGlows, mixer,
      yawFix,
      lastYRot: -angle + Math.PI,
      bank: 0, pitch: 0,
      lastCamX: camX, lastCamY: camY,
      lastWorldX: worldX, lastWorldY: worldY,
      worldUnitsPerModelUnit: 1,
    };
    activeShips.set(entityId, ship);
    console.log("[Three.js] SHIP CREATED:", entityId, shipClass,
                `(${hardpoints.thrusters.length}T/${hardpoints.muzzles.length}M/${hardpoints.weapons.length}W + ${engineGlows.length}G)`);
  }

  // Position: convert world-space offset to screen-space pixels
  const screenX = (worldX - camX) * cameraZoom;
  const screenY = (worldY - camY) * cameraZoom;
  ship.wrapper.position.set(screenX, 0, screenY);

  // Scale: target pixel size on screen
  // Apex sizeScale=2.0, so targetPixels = 85 * 2.0 * 1.6 = 272px
  const targetPixels = 85 * sizeScale * 1.1;
  const maxDim = ship.model.userData.maxDim || 1;
  // Scale model so its longest dimension = targetPixels in world units
  const finalScale = (targetPixels * cameraZoom) / maxDim;
  ship.wrapper.scale.setScalar(finalScale);
  // Cache the model→world scale so analytic hardpoint lookup doesn't need the
  // Three.js wrapper. worldUnits/modelUnit = targetPixels / maxDim (a world
  // unit and a screen pixel are 1:1 at zoom=1, and the ship renders at
  // targetPixels wide regardless of zoom).
  ship.worldUnitsPerModelUnit = targetPixels / maxDim;

  // Rotation: game angle 0=east(+X), PI/2=south(+Z), PI=west(-X)
  // Three.js Y-rotation: 0=facing+Z, PI/2=facing-X, PI=facing-Z
  // To map game-east to Three.js: Y-rot = -(angle) + offset
  // Model default facing: test and adjust this offset
  const targetYRot = -angle + Math.PI;
  let rotDiff = targetYRot - ship.lastYRot;
  while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
  while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
  if (Math.abs(rotDiff) > 3) {
    ship.lastYRot = targetYRot;
  } else {
    const rotLerp = 1 - Math.exp(-4.5 * frameDt);
    ship.lastYRot += rotDiff * rotLerp;
  }

  // ── Flight lean (visual only): SCREEN-SIDE BANK ───────────────────────
  // When the ship curves left, the LEFT screen side dips (and vice versa) —
  // a bank about the camera depth axis, applied to the wrapper below. The
  // bank amount comes from how fast the MOVEMENT DIRECTION is turning (not
  // the aim/heading — in WASD mode heading follows the cursor and would bank
  // when you only look around). Scaled by speed so a slow drift barely rolls.
  const dt = Math.max(1 / 240, Math.min(frameDt, 1 / 20));
  let bankTarget = 0;

  // Movement direction + speed from the authoritative velocity (server-
  // smoothed); fall back to position deltas only if no velocity was passed.
  let mvx: number, mvy: number, rawSpeed: number;
  if (velX != null && velY != null) {
    mvx = velX; mvy = velY; rawSpeed = Math.hypot(velX, velY);
  } else if (ship.prevWorldX != null && ship.prevWorldY != null) {
    mvx = (worldX - ship.prevWorldX) / dt; mvy = (worldY - ship.prevWorldY) / dt;
    rawSpeed = Math.hypot(mvx, mvy);
  } else { mvx = 0; mvy = 0; rawSpeed = 0; }
  const speedLerp = 1 - Math.exp(-10 * dt);
  const prevSpeed = ship.smoothSpeed ?? rawSpeed;
  const speed = prevSpeed + (rawSpeed - prevSpeed) * speedLerp;
  ship.smoothSpeed = speed;

  // BANK (Starblast model): the ship banks while its HEADING is turning — roll
  // into the turn, level out when flying straight. Derived from the turn rate
  // of the rendered heading (lastYRot), scaled by speed so a stationary pivot
  // doesn't roll. Because the nose points where you steer and movement follows
  // it, this reads as a natural bank into the curve.
  void mvx; void mvy; // (movement dir not needed for the heading-turn bank)
  // Only PLAYER ships bank into turns (own ship "player" + other players by
  // numeric id). Enemy/NPC ships (entityId prefixed "enemy:") never lean —
  // they fly flat like before.
  const isEnemyShip = entityId.startsWith("enemy:");
  if (!isEnemyShip && ship.prevYRot != null) {
    let dYaw = ship.lastYRot - ship.prevYRot;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    const turnRate = dYaw / dt;            // rad/s
    const MAX_BANK = 0.35;                 // ~20° max lean (halved from 0.7)
    const moveFrac = Math.min(1, speed / 60);
    // sign: roll INTO the turn (left turn -> left side dips). Verified live.
    // gain halved too so the whole lean is half as strong at every turn rate.
    bankTarget = Math.max(-MAX_BANK, Math.min(MAX_BANK, turnRate * 0.25 * moveFrac));
  }

  // ease toward target — well-damped so nothing snaps or shivers.
  const bankLerp = 1 - Math.exp(-7 * dt);
  ship.bank += (bankTarget - ship.bank) * bankLerp;
  ship.pitch = 0; // no nose pitch
  ship.prevYRot = ship.lastYRot;
  ship.prevWorldX = worldX;
  ship.prevWorldY = worldY;

  // Heading on the model (drives the muzzle transform via lastYRot). The bank
  // is a roll about the model's OWN forward axis (nose, local -Z), composed
  // AFTER the heading — a true wing-dip roll. With the ship-camera tilted
  // slightly toward the horizon (see camera init) this reads as a real
  // side-lean the way Starblast does, instead of nose/tail lift. The muzzle
  // transform still uses lastYRot only, so projectile spawns are unaffected.
  // Heading about world Y, THEN bank about the model's local X axis. Under
  // the fixed -0.85rad wrapper camera tilt, model-local X is what points along
  // the SCREEN VERTICAL, so a roll about it dips one screen SIDE (a true side-
  // lean) while the nose/tail stay level — verified empirically vs Z (which
  // pitched the nose fore/aft) and Y (which twisted it in-plane). Composed as
  // quaternions so the bank rides on top of the heading regardless of facing.
  _qHeading.setFromAxisAngle(_axisY, ship.lastYRot + (ship.yawFix ?? 0));
  _qRoll.setFromAxisAngle(_axisX, ship.bank);
  ship.model.quaternion.copy(_qHeading).multiply(_qRoll);

  // Wrapper keeps ONLY the fixed camera-depth tilt.
  ship.wrapper.rotation.set(SHIP_WRAPPER_TILT_X, 0, 0);
  ship.lastCamX = camX;
  ship.lastCamY = camY;
  ship.lastWorldX = worldX;
  ship.lastWorldY = worldY;

  if (renderFrameCount % 180 === 1) {
    console.log("[Three.js] Ship update:", entityId, "pos:", screenX.toFixed(0), screenY.toFixed(0), "scale:", finalScale.toFixed(1), "angle:", (angle * 180 / Math.PI).toFixed(0) + "deg");
  }
}

export function removeShip3D(entityId: string): void {
  const ship = activeShips.get(entityId);
  if (ship) {
    if (ship.mixer) ship.mixer.stopAllAction();
    // Detach from whatever actually holds it — the scene in the legacy layout,
    // playerShipsGroup/enemyShipsGroup in the shared one.
    ship.wrapper.parent?.remove(ship.wrapper);
    activeShips.delete(entityId);
  }
}

export function updateEngineGlow(entityId: string, speed: number): void {
  const ship = activeShips.get(entityId);
  if (!ship || !ship.engineGlows) return;

  // Glow intensity scales linearly with speed, capped at 1 at speed 80.
  // Below ~speed=1 (near-standstill) the glow is effectively off — no floor.
  const intensity = speed < 1 ? 0 : Math.min(1, speed / 80);

  for (const glow of ship.engineGlows) {
    const material = glow.material as THREE.SpriteMaterial;
    material.opacity = intensity;
  }
}

export function updateNebulaBackground(cameraX: number, cameraY: number): void {
  if (nebulaBackground) {
    nebulaBackground.update({ x: cameraX, y: cameraY }, performance.now());
  }
}

export function beginFrame(): void {
  activeThisFrame.clear();
}

export function markActive(entityId: string): void {
  activeThisFrame.add(entityId);
}

export function endFrame(): void {
  for (const [id] of activeShips) {
    if (!activeThisFrame.has(id)) {
      removeShip3D(id);
    }
  }
}

export function render3DLayer(): void {
  if (!renderer || !scene || !camera) return;
  // In the shared layout this single call draws stations, players, enemies and
  // NPCs together. If some other module claimed the driver role (the isolated
  // ?station-test harness does), stay out of its way rather than drawing the
  // same scene twice.
  if (ENABLE_SHARED_3D_SCENE) {
    if (!isWorldRenderDriver("ships")) return;
    // Ships float above the world plane so a station's hull cannot bury them
    // during normal flight; the docking sequence ramps the factor to 0 and the
    // ship sinks into the station, occluded by roof and door for real.
    setShipLift(getShipLiftFactor(), cameraZoom);
  }
  const now = performance.now() / 1000;
  if (lastFrameTime > 0) frameDt = Math.min(0.1, now - lastFrameTime);
  lastFrameTime = now;
  let anySelected = false;
  for (const [id, ship] of activeShips) {
    if (ship.mixer) ship.mixer.update(frameDt);
    // Mark selected ships' meshes onto SELECT_LAYER so the post-process pass
    // can render just them into a silhouette mask → a clean red edge. The main
    // pass renders layer 0, so this is additive (meshes stay on layer 0 too).
    const selected = _selectedShipIds.has(id);
    if (selected) anySelected = true;
    let markedMeshes = 0;
    ship.model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (selected) { mesh.layers.enable(SELECT_LAYER); markedMeshes++; }
      else mesh.layers.disable(SELECT_LAYER);
    });
    if (selected && (window as any).__DEBUG_SEL) {
      console.log(`[SelOutline] "${id}" selected, ${markedMeshes} meshes marked on SELECT_LAYER`);
    }
  }
  if (anySelected && !_anySelected && (window as any).__DEBUG_SEL) console.log("[SelOutline] pass ACTIVE");
  _anySelected = anySelected;
  // Emissive pulse (e.g. Leviathan energy cracks): materials tagged with
  // userData.pulseEmissive breathe their emissiveIntensity around a base.
  if (now - _lastEmissivePulseUpdate > 0.03) {
    _lastEmissivePulseUpdate = now;
    for (const ship of activeShips.values()) {
      // Hull crack emissive pulse.
      ship.model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const p = (m as any).userData?.pulseEmissive;
          if (p) (m as THREE.MeshStandardMaterial).emissiveIntensity = p.base + Math.sin(now * p.speed) * p.amp;
        }
        // Liquid FLOW SHELL (Erix): scroll the emissive/colour map over the
        // hull so the red glow runs across it like water, and breathe opacity.
        const fs = (mesh.userData as any)?.flowShell;
        if (fs && fs.tex) {
          fs.tex.offset.x = (now * 0.08) % 1;
          fs.tex.offset.y = (Math.sin(now * 0.35) * 0.5) % 1;
          const bm = mesh.material as THREE.MeshBasicMaterial;
          if (bm) bm.opacity = 0.4 + (0.5 + 0.5 * Math.sin(now * 1.6)) * 0.35;
        }
      });
      // Signature core (inner gem) pulse — emissive breathing + a slow spin.
      const core = (ship.wrapper.userData as any).enemyCore as THREE.Group | undefined;
      if (core) {
        const ps = (core.userData as any).pulseSprite;
        if (ps && ps.coreMat) {
          const s = Math.sin(now * ps.speed);
          ps.coreMat.emissiveIntensity = ps.base + s * ps.amp;
          if (ps.haloMat) ps.haloMat.opacity = 0.4 + s * 0.15;
        }
        core.rotation.y += frameDt * 0.6; // gentle gem turn
      }
    }
  }
  if (outlineRT && outlineScene && outlineCamera && fsQuad && brightMat && blurMat && outlineMat && bloomRTA && bloomRTB) {
    camera.layers.set(0);

    if (postFX && copyMat && !_debugBypassPostFX) {
      // Post-processing path: the composer renders the scene + GTAO + UnrealBloom
      // + FXAA + vignette INTO outlineRT, then we blit that to screen. The
      // selection/FX passes below still composite on top, unchanged.
      postFX.render(frameDt);
      fsQuad.material = copyMat;
      // Read the composer's ACTUAL output buffer, not outlineRT. EffectComposer
      // ping-pongs between two targets; with the current pass count the result
      // lands in the OTHER one on alternate frames, so a fixed outlineRT read
      // showed last frame's image every other frame — the material flicker seen
      // on undock (and everywhere, just most noticeable there). outputTexture()
      // always returns the buffer render() actually left the image in.
      copyMat.uniforms.tDiffuse.value = postFX.outputTexture();
      renderer.setRenderTarget(null);
      renderer.render(outlineScene, outlineCamera);
    } else {
      // Legacy inline path (low tier): scene → outlineRT, custom bloom, composite.
      // Pass 1: solid hulls only (default layer) → offscreen target
      renderer.setRenderTarget(outlineRT);
      renderer.clear();
      renderer.render(scene, camera);

      // Pass 2: bloom — extract bright emissives, blur H+V twice at half res
      fsQuad.material = brightMat;
      renderer.setRenderTarget(bloomRTA);
      renderer.render(outlineScene, outlineCamera);
      fsQuad.material = blurMat;
      const bw = bloomRTA.width, bh = bloomRTA.height;
      for (let i = 0; i < 2; i++) {
        blurMat.uniforms.tDiffuse.value = bloomRTA.texture;
        (blurMat.uniforms.dir.value as THREE.Vector2).set(1 / bw, 0);
        renderer.setRenderTarget(bloomRTB);
        renderer.render(outlineScene, outlineCamera);
        blurMat.uniforms.tDiffuse.value = bloomRTB.texture;
        (blurMat.uniforms.dir.value as THREE.Vector2).set(0, 1 / bh);
        renderer.setRenderTarget(bloomRTA);
        renderer.render(outlineScene, outlineCamera);
      }

      // Pass 3: blit with additive bloom (black outline removed)
      fsQuad.material = outlineMat;
      renderer.setRenderTarget(null);
      renderer.render(outlineScene, outlineCamera);
    }

    // Pass 3b: RED SELECTION OUTLINE. Render only the selected ship(s) (on
    // SELECT_LAYER) into a flat-white mask, then draw a thin red rim on the
    // mask's silhouette edge over the screen. A clean line, not a filled area.
    if (_anySelected && selectRT && selectMat && selectMaskMat && fsQuad) {
      camera.layers.set(SELECT_LAYER);
      scene.overrideMaterial = selectMaskMat;
      renderer.setRenderTarget(selectRT);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      scene.overrideMaterial = null;
      camera.layers.set(0);
      // draw red rim over the final image
      fsQuad.material = selectMat;
      renderer.setRenderTarget(null);
      renderer.autoClear = false;
      renderer.render(outlineScene, outlineCamera);
      renderer.autoClear = true;
    }

    // Pass 4: glow FX (halos, engine sprites) on top, no outline/bloom
    camera.layers.set(FX_LAYER);
    renderer.autoClear = false;
    renderer.render(scene, camera);
    renderer.autoClear = true;
    camera.layers.set(0);
  } else {
    renderer.render(scene, camera);
  }
  renderFrameCount++;
  if (renderFrameCount === 1 || renderFrameCount % 300 === 0) {
    console.log("[Three.js] Frame:", renderFrameCount, "ships:", activeShips.size, "models:", loadedModels.size, "loading:", loadingModels.size);
  }
}

export function destroy3DLayer(): void {
  if (postFX) {
    postFX.dispose();
    postFX = null;
  }
  if (copyMat) { copyMat.dispose(); copyMat = null; }
  if (nebulaBackground) {
    nebulaBackground.destroy();
    nebulaBackground = null;
  }

  if (outlineRT) {
    outlineRT.dispose();
    outlineRT = null;
    outlineScene = null;
    outlineCamera = null;
    outlineMat = null;
  }
  if (bloomRTA) { bloomRTA.dispose(); bloomRTA = null; }
  if (bloomRTB) { bloomRTB.dispose(); bloomRTB = null; }
  brightMat = null;
  blurMat = null;
  fsQuad = null;
  if (ENABLE_SHARED_3D_SCENE) {
    // The renderer is not ours to dispose piecemeal — the station layer is
    // attached to the same one. destroyWorldLayer empties every group, drops
    // the driver claim and disposes it once.
    destroyWorldLayer();
    renderer = null;
    scene = null;
    camera = null;
    initialized = false;
  } else if (renderer) {
    renderer.dispose();
    renderer = null;
    scene = null;
    camera = null;
    initialized = false;
  }
  activeShips.clear();
  loadedModels.clear();
  loadingModels.clear();
  failedModels.clear();
  window.removeEventListener("resize", onResize);
  renderFrameCount = 0;
}
