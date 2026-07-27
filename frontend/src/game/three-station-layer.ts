import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { PIXELATE_3D, PIXELATE_3D_SCALE, ENABLE_NEW_DOCKING_FLOW, ENABLE_SHARED_3D_SCENE } from "./renderer-config";
import {
  ensureWorldLayer, claimWorldRenderDriver, isWorldRenderDriver,
  stationsGroup, normalizeSharedDepth,
} from "./three-world-layer";
import { STATIONS } from "./types";
import { applySpaceMaterial, setMaterialAnisotropyMax } from "./space-material";
import { perfRegisterThree } from "./perf";
import { getRendererSettings } from "./RendererSettings";
import { loadEnvironment } from "./three-environment";
import { HangarDoorController } from "./scene/HangarDoorController";

// Effective downscale factor for the fake pixel-art render mode (1 = off).
// The Pixi stationSprite stretches this canvas back to screen size with
// NEAREST filtering, producing the pixelated look.
const PIX_SCALE = PIXELATE_3D ? Math.max(1, PIXELATE_3D_SCALE) : 1;

interface Station3D {
  wrapper: THREE.Group;
  model: THREE.Group;
  maxDim: number;
  /** M9: null when the flag is off or the model has no usable door. */
  door: HangarDoorController | null;
}
interface StationTemplate { group: THREE.Group; maxDim: number; clips: THREE.AnimationClip[] }

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let initialized = false;
let stationCanvas: HTMLCanvasElement | null = null;

// Silhouette outline + emissive bloom pass — same pixel-art treatment the
// ship layers get (three-ship-layer.ts): stations render into an offscreen
// target, then a fullscreen blit paints 1 buffer-pixel of black wherever a
// transparent pixel touches an opaque one, and adds blurred bright-pass
// bloom so lit windows/lamps bleed light.
let outlineRT: THREE.WebGLRenderTarget | null = null;
let outlineScene: THREE.Scene | null = null;
let outlineCamera: THREE.OrthographicCamera | null = null;
let outlineMat: THREE.ShaderMaterial | null = null;
let bloomRTA: THREE.WebGLRenderTarget | null = null;
let bloomRTB: THREE.WebGLRenderTarget | null = null;
let brightMat: THREE.ShaderMaterial | null = null;
let blurMat: THREE.ShaderMaterial | null = null;
let fsQuad: THREE.Mesh | null = null;

const OUTLINE_FRAG = `
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  if (c.a < 0.5) {
    float n = texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).a;
    n = max(n, texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).a);
    n = max(n, texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).a);
    n = max(n, texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).a);
    if (n > 0.5) c = vec4(0.0, 0.0, 0.0, 1.0);
  }
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

function setupOutlinePass(bufW: number, bufH: number): void {
  const hw = Math.max(1, Math.floor(bufW / 2));
  const hh = Math.max(1, Math.floor(bufH / 2));
  outlineRT = new THREE.WebGLRenderTarget(bufW, bufH, { depthBuffer: true, format: THREE.RGBAFormat });
  bloomRTA = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false, format: THREE.RGBAFormat });
  bloomRTB = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false, format: THREE.RGBAFormat });
  bloomRTA.texture.minFilter = bloomRTA.texture.magFilter = THREE.LinearFilter;
  bloomRTB.texture.minFilter = bloomRTB.texture.magFilter = THREE.LinearFilter;
  brightMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: outlineRT.texture } },
    vertexShader: QUAD_VERT, fragmentShader: BRIGHT_FRAG,
    blending: THREE.NoBlending, depthTest: false, depthWrite: false,
  });
  blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG,
    blending: THREE.NoBlending, depthTest: false, depthWrite: false,
  });
  outlineMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: outlineRT.texture },
      tBloom: { value: bloomRTA.texture },
      texel: { value: new THREE.Vector2(1 / bufW, 1 / bufH) },
    },
    vertexShader: QUAD_VERT, fragmentShader: OUTLINE_FRAG,
    blending: THREE.NoBlending, depthTest: false, depthWrite: false, transparent: true,
  });
  outlineScene = new THREE.Scene();
  outlineCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), outlineMat);
  fsQuad.frustumCulled = false;
  outlineScene.add(fsQuad);
}

function resizeOutlinePass(bufW: number, bufH: number): void {
  if (!outlineRT || !outlineMat) return;
  outlineRT.setSize(bufW, bufH);
  const hw = Math.max(1, Math.floor(bufW / 2));
  const hh = Math.max(1, Math.floor(bufH / 2));
  if (bloomRTA) bloomRTA.setSize(hw, hh);
  if (bloomRTB) bloomRTB.setSize(hw, hh);
  (outlineMat.uniforms.texel.value as THREE.Vector2).set(1 / bufW, 1 / bufH);
}

const activeStations = new Map<string, Station3D>();
let cameraZoom = 1;
const activeThisFrame = new Set<string>();

// ── model pools ────────────────────────────────────────────────────────────
// Stations pick from the spacestation pool, factories from the factory pool.
// Models are assigned round-robin within each zone (offset by a zone hash) so
// every map mixes different models and no zone shows the same model twice.
//
// M9: the docking flow needs a station with a door, and spacestation1-3 are
// single merged Tripo meshes — one node, no animation, nothing to separate. Only
// cosmic_station.glb has a real HangarRamp node plus its clip, so with the flag
// on every dockable station uses it and the approach ends at a door that
// actually opens. Gated so ENABLE_NEW_DOCKING_FLOW=false still renders the world
// exactly as before — doors that never open would be worse than no doors.
// Factories are untouched: you cannot dock at one.
// Which station GLBs to use. The docking flow AND the shared-scene test both
// pin to cosmic_station.glb — it is the only station model deployed to the VPS
// (the legacy spacestation*/factorystation* GLBs live only in the local asset
// tree, never shipped), and it is the one authored with a hangar door. Without
// this, ?shared-scene would fall through to the legacy list, nginx would answer
// each missing GLB with index.html (HTTP 200 + "<!DOCTYPE"), the loader would
// throw, and every station would be invisible — which is exactly what "shared
// scene = no stations" turned out to be, not a depth-buffer bug.
const USE_COSMIC_STATION = ENABLE_NEW_DOCKING_FLOW || ENABLE_SHARED_3D_SCENE;
const STATION_MODEL_URLS = USE_COSMIC_STATION
  ? ["/models/stations/cosmic_station.glb"]
  : [
      "/models/stations/spacestation1.glb",
      "/models/stations/spacestation2.glb",
      "/models/stations/spacestation3.glb",
    ];
const FACTORY_MODEL_URLS = USE_COSMIC_STATION
  // Factories have no deployed model either, so reuse the cosmic hull for the
  // test rather than leave every factory invisible. Cosmetic only — the merge
  // being verified is about depth, not which mesh a factory wears.
  ? ["/models/stations/cosmic_station.glb"]
  : [
      "/models/stations/factorystation.glb",
      "/models/stations/factorystation2.glb",
    ];

function strHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Stations you can actually dock at — everything that is not a factory.
 *
 * Only these get a door controller. Factories keep the old single-mesh models,
 * which have no door by design, and building a controller for them would log
 * HangarDoorController's "fix the model in Blender" error on every instance.
 */
const dockableStations = new Set(STATIONS.filter((s) => s.kind !== "factory").map((s) => s.id));

// stationId → model url, computed once from static STATIONS data
const stationModelUrl = new Map<string, string>();
{
  const byZone = new Map<string, { id: string; kind: string }[]>();
  for (const st of STATIONS) {
    const arr = byZone.get(st.zone) ?? [];
    arr.push({ id: st.id, kind: st.kind });
    byZone.set(st.zone, arr);
  }
  for (const [zone, sts] of byZone) {
    let si = strHash(zone) % STATION_MODEL_URLS.length;
    let fi = strHash(zone) % FACTORY_MODEL_URLS.length;
    for (const st of sts) {
      if (st.kind === "factory") {
        stationModelUrl.set(st.id, FACTORY_MODEL_URLS[fi % FACTORY_MODEL_URLS.length]);
        fi++;
      } else {
        stationModelUrl.set(st.id, STATION_MODEL_URLS[si % STATION_MODEL_URLS.length]);
        si++;
      }
    }
  }
}

const templates = new Map<string, StationTemplate>();
const templateLoading = new Set<string>();
/**
 * URLs that failed to load. Without this, updateStationOnly() calls
 * loadTemplate() again on the very next frame — a failing 3.5 MB model was
 * re-downloaded once per frame, forever.
 */
const templateFailed = new Set<string>();

// ── Emissive taming ─────────────────────────────────────────────────────────
// Blender exports every glowing material at KHR emissive_strength 8-9, which
// three.js maps straight to emissiveIntensity. On a 4-pixel signal lamp that is
// exactly right. cosmic_station.glb puts the SAME cyan emissive on 29 deck
// plates, each spanning a fifth of the model — as a light that floods the whole
// screen and the hull stops being visible at all.
//
// Colour cannot tell those apart, so SIZE decides. Under EMISSIVE_SPAN_LARGE a
// material is a fixture and keeps its glow (capped, scaled by size). At or above
// it, it is a surface mis-authored as a light and goes through the hull path
// instead, which zeroes the emissive entirely.
//
// The measured spans on cosmic_station.glb are 0.018 (Sig_Red / Sig_Green) and
// ~0.21 (SS_Deck_Glow) — a 10x gap — so the threshold sits in the middle of it
// rather than next to either value.
/** Cap for a small fixture — bright enough to blow out and bloom. */
const EMISSIVE_MAX = 1.6;
/** Cap for a fixture right at the size limit. */
const EMISSIVE_MIN = 0.45;
/** Geometry radius / model maxDim below which a material counts as a fixture. */
const EMISSIVE_SPAN_SMALL = 0.06;
/** ...and at or above which it is not a light at all, but hull. */
const EMISSIVE_SPAN_LARGE = 0.1;
/** Ceiling for a kept emissive's ALBEDO luminance, same reason. */
const EMISSIVE_ALBEDO_MAX = 0.18;

/** Reused by getStationDoorWorldOffset — see the note there. */
const doorScratch = new THREE.Vector3();

/**
 * Shared Draco decoder, created on first use.
 *
 * cosmic_station.glb is Draco-compressed (467k triangles — uncompressed it
 * would be ~20 MB instead of 3.5 MB), and without a DRACOLoader the GLTFLoader
 * throws "No DRACOLoader instance provided" and the station silently never
 * appears. The decoder is self-hosted in public/draco/ rather than pulled from
 * the gstatic CDN, so the game has no third-party runtime dependency and works
 * offline. Uncompressed models are unaffected — the decoder is only invoked for
 * files that actually declare KHR_draco_mesh_compression.
 */
let dracoLoader: DRACOLoader | null = null;
function getDracoLoader(): DRACOLoader {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
  }
  return dracoLoader;
}

function loadTemplate(url: string): void {
  if (templates.has(url) || templateLoading.has(url) || templateFailed.has(url)) return;
  templateLoading.add(url);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(getDracoLoader());
  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      // Apply the shared dark space-metal material to the station hull so it
      // reads as a heavy metallic structure (panels, seams, wear, AO) instead
      // of the old forced-matte grey block (rough≥0.88/metal≤0.08). Emissive
      // window/light materials are preserved so they can glow.
      const seed = strHash(url);
      let stHull = 0, stEmis = 0;
      // Pre-pass: how big is the geometry behind each material? Needed before
      // the main pass so an emissive can be judged "fixture" vs "whole deck".
      // Materials are shared per glTF material index, so one entry covers every
      // primitive using it; the largest wins.
      const matSpan = new Map<unknown, number>();
      /** One line per kept emissive, so a too-bright station is diagnosable. */
      const emisLog: string[] = [];
      model.traverse((child: any) => {
        if (!child.isMesh || !child.geometry || !child.material) return;
        if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();
        const r = child.geometry.boundingSphere?.radius ?? 0;
        const mm = Array.isArray(child.material) ? child.material : [child.material];
        for (const one of mm) if (one) matSpan.set(one, Math.max(matSpan.get(one) ?? 0, r));
      });
      model.traverse((child: any) => {
        if (!child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const geo = child.geometry as THREE.BufferGeometry | undefined;
        if (geo && geo.attributes && geo.attributes.uv && !geo.attributes.uv2) {
          geo.setAttribute("uv2", geo.attributes.uv);
        }
        for (let mi = 0; mi < materials.length; mi++) {
          let m = materials[mi];
          if (m.type === "MeshBasicMaterial") {
            const up = new THREE.MeshStandardMaterial({ map: m.map, color: m.color, roughness: 0.6, metalness: 0.5 });
            m.dispose?.(); materials[mi] = up; m = up;
          }
          m.transparent = false;
          m.opacity = 1;
          m.depthWrite = true;
          m.depthTest = true;
          m.alphaTest = 0;
          m.alphaMap = null;
          m.blending = THREE.NormalBlending;
          m.premultipliedAlpha = false;
          // Only STRONGLY emissive materials (real windows/lights) are kept as
          // Kill the broken white/grey emissive export (albedo plugged into the
          // emissive slot → self-lit flat hull), same bug as the ships.
          const emHsl = { h: 0, s: 0, l: 0 };
          if (m.emissive) m.emissive.getHSL(emHsl);
          const emSum = m.emissive ? (m.emissive.r + m.emissive.g + m.emissive.b) : 0;
          if (emSum > 0.35 && emHsl.s < 0.25) {
            m.emissive = new THREE.Color(0x000000); m.emissiveIntensity = 0; m.emissiveMap = null;
          }
          // A light is a FIXTURE. Blender hands out emissive strength 8-9 to
          // anything the artist wanted lit, so "has a bright colour" is not
          // enough to tell a warning lamp from a deck plate — and on
          // cosmic_station.glb the same cyan emissive sits on 29 surfaces
          // covering a fifth of the model each. At any intensity that reads as a
          // light, those flood the screen and the hull stops being visible.
          //
          // So size decides. Below EMISSIVE_SPAN_LARGE it is a fixture and keeps
          // its glow; at or above it, it is a surface that was mis-authored as a
          // light, and it goes through applySpaceMaterial with the hull — which
          // zeroes the emissive and gives it the same dark steel, plates, seams
          // and AO as the rest of the station.
          const span = (matSpan.get(m) ?? 0) / (maxDim || 1);
          const strongEmissive = !!m.emissive &&
            emSum > 0.35 && emHsl.s >= 0.25 &&
            (m.emissiveIntensity ?? 1) > 0.3 &&
            span < EMISSIVE_SPAN_LARGE;
          if (strongEmissive) {
            // Clamp KHR_materials_emissive_strength: cyan [0.12,0.80,1.00] x 9 =
            // [1.1,7.2,9.0] is past 1.0 on every channel, so the tone map clips
            // it to flat white and the hue is gone before the bloom pass ever
            // sees it. Scaled by size, so a big fixture still stays calmer than
            // a pinpoint lamp.
            const t = Math.min(1, Math.max(0,
              (span - EMISSIVE_SPAN_SMALL) / (EMISSIVE_SPAN_LARGE - EMISSIVE_SPAN_SMALL)));
            const cap = EMISSIVE_MAX + (EMISSIVE_MIN - EMISSIVE_MAX) * t;
            if ((m.emissiveIntensity ?? 1) > cap) m.emissiveIntensity = cap;
            // Same problem from the other side: a lamp exported with a WHITE
            // albedo gets painted white by the scene lights on top of its own
            // glow. A self-lit fixture's albedo barely matters, so force it dark
            // and let the emissive be the only thing you see.
            if (m.color) {
              const lum = m.color.r * 0.299 + m.color.g * 0.587 + m.color.b * 0.114;
              if (lum > EMISSIVE_ALBEDO_MAX) m.color.multiplyScalar(EMISSIVE_ALBEDO_MAX / lum);
            }
            if (!emisLog.some((e) => e.startsWith(m.name + " "))) {
              emisLog.push(`${m.name} span ${span.toFixed(2)} → glow ${cap.toFixed(2)}`);
            }
            m.needsUpdate = true; stEmis++; continue;
          }
          if (emSum > 0.35 && span >= EMISSIVE_SPAN_LARGE &&
              !emisLog.some((e) => e.startsWith(m.name + " "))) {
            emisLog.push(`${m.name} span ${span.toFixed(2)} → hull (too large to be a light)`);
          }
          applySpaceMaterial(m as THREE.MeshStandardMaterial, "station", { seed });
          stHull++;
        }
        if (Array.isArray(child.material)) child.material = materials;
        // Modules cast + receive shadows on each other (real depth between them).
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
      });
      // M9: keep the clips alongside the scene. Each station instance clones the
      // group and builds its own mixer from these — the clips themselves are
      // immutable and safely shared.
      templates.set(url, { group: model, maxDim, clips: gltf.animations ?? [] });
      templateLoading.delete(url);
      console.log(
        "[Station3D] loaded", url, "maxDim:", maxDim.toFixed(2),
        `(${stHull} hull mats, ${stEmis} emissive kept)`,
        emisLog.length ? "· emissive caps: " + emisLog.join(" | ") : "",
      );
    },
    undefined,
    (err) => {
      console.error("[Station3D] GLB load failed:", url, err);
      templateLoading.delete(url);
      // Give up on this URL. Retrying every frame turned one broken model into
      // a permanent download loop and buried the real error in the console.
      templateFailed.add(url);
    }
  );
}

export function initStation3DLayer(width?: number, height?: number): HTMLCanvasElement {
  if (initialized && stationCanvas) return stationCanvas;
  initialized = true;

  const w = width ?? window.innerWidth;
  const h = height ?? window.innerHeight;

  // ── Shared scene ──────────────────────────────────────────────────────
  // Stations stop being their own render target and become stationsGroup in
  // the one world scene. Nothing below runs: no second renderer, no second
  // camera, no second light rig, and — the point of the exercise — no second
  // depth buffer, so a hull can finally occlude a ship instead of merely being
  // composited under one.
  //
  // ensureWorldLayer is idempotent, so it does not matter that initPixiRenderer
  // reaches this before App.tsx boots the ship layer; whoever is first supplies
  // the canvas. claimWorldRenderDriver returning true means nobody else will
  // draw the scene (the ?station-test harness), and then renderStation3DLayer
  // below does the work.
  if (ENABLE_SHARED_3D_SCENE) {
    const world = ensureWorldLayer(undefined, w, h);
    renderer = world.renderer;
    scene = world.scene;
    camera = world.camera;
    stationCanvas = world.canvas;
    if (claimWorldRenderDriver("stations")) {
      const dbShared = renderer.getDrawingBufferSize(new THREE.Vector2());
      setupOutlinePass(dbShared.x, dbShared.y);
      window.addEventListener("resize", onResize);
    }
    return stationCanvas;
  }

  stationCanvas = document.createElement("canvas");
  stationCanvas.width = w;
  stationCanvas.height = h;

  renderer = new THREE.WebGLRenderer({
    canvas: stationCanvas,
    alpha: true,
    antialias: PIX_SCALE === 1, // hard pixels when pixelating
    premultipliedAlpha: false,
  });
  if (PIX_SCALE > 1) {
    // Low-res buffer; camera frustum stays in CSS pixels (see renderer-config)
    renderer.setPixelRatio(1);
    renderer.setSize(Math.ceil(w / PIX_SCALE), Math.ceil(h / PIX_SCALE), false);
  } else {
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
  renderer.setClearColor(0x000000, 0); // Transparent — Pixi composites this over its bgLayer
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const rs = getRendererSettings();
  (renderer as any).useLegacyLights = false;
  setMaterialAnisotropyMax(renderer.capabilities.getMaxAnisotropy());
  perfRegisterThree("3d-station", renderer.info);
  // Real inter-module shadows (modules occlude each other under the key light).
  renderer.shadowMap.enabled = rs.shadowsEnabled;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const dbSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  setupOutlinePass(dbSize.x, dbSize.y);

  scene = new THREE.Scene();

  // Camera sits far above the tallest possible station so the near plane can
  // never slice a model open (the new station GLBs are tall: y ≈ maxDim, and
  // near-plane clipping made them look hollow/see-through). Orthographic, so
  // the height changes nothing but the clip range.
  camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 20000);
  camera.position.set(0, 8000, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, -1);

  // Station lighting is deliberately dimmer and cooler than the ship layer:
  // the warm 2.6-intensity sun lit the big hull plates so bright they crossed
  // the bloom threshold and shimmered — a light source that read as alien to
  // the dark galaxy. Cool starlight key + faint blue fill keeps stations
  // moody and embedded in the scene.
  // Filmic tone mapping + soft environment reflections — matches the ship
  // layer so stations shine subtly and sit in the same light as the world.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Stations stay a touch moodier than ships: nudge the tier exposure down.
  renderer.toneMappingExposure = rs.toneMappingExposure * 0.98;
  const pmrem = loadEnvironment(renderer, scene);
  // Metallic station hulls want a bit more reflection than the tier default.
  (scene as any).environmentIntensity = rs.environmentIntensity * 1.15;

  // Deeper directional contrast so the station reads as a heavy 3D structure
  // (bright lit side, dark shadow side, deep module gaps) instead of a flat,
  // uniformly-lifted grey block. Lower ambient is the key change.
  const ambient = new THREE.AmbientLight(0x232840, 0.16);
  scene.add(ambient);

  // Strong cool key from the upper-right, shadow-casting so modules occlude
  // each other (real inter-module shadows).
  const sun = new THREE.DirectionalLight(0xe6ecff, 1.9);
  sun.position.set(120, 320, -90);
  sun.castShadow = rs.shadowsEnabled;
  sun.shadow.mapSize.set(rs.shadowMapSize, rs.shadowMapSize);
  sun.shadow.camera.left = -1400; sun.shadow.camera.right = 1400;
  sun.shadow.camera.top = 1400; sun.shadow.camera.bottom = -1400;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 6000;
  sun.shadow.bias = rs.shadowBias; sun.shadow.normalBias = 1.0;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x5c86d6, 0.32);
  fill.position.set(-90, 140, 110);
  scene.add(fill);

  // Grazing rim so panel edges + antennae catch light against the dark.
  const rim = new THREE.DirectionalLight(0x9ec2ff, 0.45);
  rim.position.set(-30, -70, 210);
  scene.add(rim);

  window.addEventListener("resize", onResize);
  return stationCanvas;
}

export function getStationCanvas(): HTMLCanvasElement | null {
  return stationCanvas;
}

function onResize(): void {
  if (!renderer || !camera || !stationCanvas) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (PIX_SCALE > 1) {
    renderer.setSize(Math.ceil(w / PIX_SCALE), Math.ceil(h / PIX_SCALE), false);
  } else {
    renderer.setSize(w, h, false);
  }
  const dbSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  resizeOutlinePass(dbSize.x, dbSize.y);
  camera.left = -w / 2;
  camera.right = w / 2;
  camera.top = h / 2;
  camera.bottom = -h / 2;
  camera.updateProjectionMatrix();
}

export function setStationCameraZoom(z: number): void {
  cameraZoom = z;
}

/** Wall-clock of the last door pump, for the dt below. */
let lastDoorPump = 0;

export function beginStationFrame(): void {
  activeThisFrame.clear();

  // M9: pump the door animations. This is the existing per-frame render call,
  // NOT a new RAF loop — the door has to keep moving here rather than from the
  // sim tick, because state.dockedAt halts tickWorld (loop.ts:994) and the door
  // still needs to close behind the player. dt is clamped for the same reason
  // any frame-derived dt is: a backgrounded tab returns with a delta of seconds
  // and would snap the door through its whole travel in one frame.
  if (ENABLE_NEW_DOCKING_FLOW) {
    const now = performance.now();
    const dt = lastDoorPump ? Math.min(0.05, (now - lastDoorPump) / 1000) : 0;
    lastDoorPump = now;
    for (const st of activeStations.values()) st.door?.update(dt);
  }
}

/**
 * The door of a station currently on screen, or null (M9).
 *
 * Null is a normal answer, not an error: the station may be off screen (its
 * instance is destroyed by endStationFrame), the model may have no door, or the
 * flag may be off. Every caller must treat the door as optional.
 */
export function getStationDoor(id: string): HangarDoorController | null {
  return activeStations.get(id)?.door ?? null;
}

/**
 * Where the hangar mouth sits, as a WORLD-UNIT offset from the station's own
 * position. The docking flow needs this to aim at the door instead of the
 * station centre — the model is ~1843 units across but the dock prompt fires at
 * 300, so "the station" and "the door" are nowhere near the same point.
 *
 * Read out of the live Three.js scene rather than hardcoded, so it stays correct
 * if the model is re-exported with the ramp somewhere else.
 *
 * Zoom-independent by construction: the layer scales the station by cameraZoom
 * (screen px), and dividing it back out returns world units. Returns null when
 * the station has no 3D instance yet or no door — callers fall back to the
 * station centre, which is the pre-M9 behaviour.
 */
export function getStationDoorWorldOffset(id: string): { x: number; y: number } | null {
  const st = activeStations.get(id);
  const node = st?.door?.doorNode;
  if (!st || !node || cameraZoom <= 0) return null;
  // updateStationOnly() runs every frame, so the matrices are current for the
  // frame that last drew this station; force an update anyway because enter()
  // can land between a sim tick and a render.
  st.wrapper.updateWorldMatrix(true, false);
  node.updateWorldMatrix(true, false);
  // Scratch vector: App.tsx calls this for every station in the zone on every
  // React tick to place the dock prompt, and a per-call allocation there is
  // pure garbage.
  const world = doorScratch.setFromMatrixPosition(node.matrixWorld);
  // Scene space is (x, y=up, z) with the ortho camera looking down -Y, so the
  // world plane is (x, z). Raw offset of the HangarRamp NODE from the station.
  let dx = (world.x - st.wrapper.position.x) / cameraZoom;
  let dy = (world.z - st.wrapper.position.z) / cameraZoom;
  // In cosmic_station.glb the HangarRamp node's ORIGIN sits ~at the model centre
  // (local z 0.447 of a ±8 model → only ~51 world units out), so the raw offset
  // above lands the dock target almost on the station centre and the ship never
  // visibly flies INTO the hangar. The mouth is really at the model's +Z edge.
  // Push the offset out ALONG the ramp's direction to a fraction of the model's
  // world half-size, so the approach aims at the actual opening. Falls back to
  // pure +Z (screen-bottom, where door stations are pinned) if the node is dead
  // centre and gives no direction.
  // The station is scaled so maxDim maps to targetPixels(1843) world units, so its
  // world half-size is 1843/2 regardless of maxDim. The mouth sits at ~0.82 of that.
  const reach = (1843 / 2) * 0.82; // ≈ 756 world units out along the ramp axis
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) { dx = 0; dy = 1; } // dead-centre node → default +Z
  else { dx /= len; dy /= len; }
  return { x: dx * reach, y: dy * reach };
}


export function updateStationOnly(
  id: string,
  worldX: number,
  worldY: number,
  camX: number,
  camY: number,
): void {
  if (!scene) return;
  const url = stationModelUrl.get(id) ?? STATION_MODEL_URLS[strHash(id) % STATION_MODEL_URLS.length];
  const tpl = templates.get(url);
  if (!tpl) { loadTemplate(url); return; }

  let st = activeStations.get(id);
  if (!st) {
    const model = tpl.group.clone();
    const wrapper = new THREE.Group();
    wrapper.rotation.x = -0.6;
    wrapper.add(model);
    if (ENABLE_SHARED_3D_SCENE) {
      // Same scene, same camera, same depth buffer as the ships — the station
      // is just another group in it. No renderOrder, no clearDepth, nothing
      // pushing it in front of or behind anything: the hull occludes what it
      // geometrically covers and nothing else.
      normalizeSharedDepth(model, "station:" + id);
      stationsGroup.add(wrapper);
    } else {
      scene.add(wrapper);
    }
    // M9: one door controller per station instance, bound to THIS clone. The
    // clips come from the shared template but the mixer targets the clone, so
    // two stations on screen animate independently. Object3D.clone() preserves
    // node names, which is what the clip's tracks resolve against.
    let door: HangarDoorController | null = null;
    if (ENABLE_NEW_DOCKING_FLOW && dockableStations.has(id)) {
      const d = new HangarDoorController({ root: model, clips: tpl.clips });
      if (d.ready) {
        d.setImmediate(false); // stations idle closed
        door = d;
      } else {
        // detect() already logged why. Not fatal: the docking flow skips the
        // door step and the approach still works.
        d.dispose();
      }
    }
    st = { wrapper, model, maxDim: tpl.maxDim, door };
    activeStations.set(id, st);
  }

  const screenX = (worldX - camX) * cameraZoom;
  const screenY = (worldY - camY) * cameraZoom;
  st.wrapper.position.set(screenX, 0, screenY);

  // Stations scale with the camera zoom like every other world object. The
  // camera sits at y=8000 (far above the tallest station at max zoom 2.5),
  // so zooming in can never push a model through the near plane — the hull
  // always renders solid, top to bottom.
  const targetPixels = 1843;
  const finalScale = (targetPixels * cameraZoom) / st.maxDim;
  st.wrapper.scale.setScalar(finalScale);

  // A station you fly INTO cannot drift. The hangar mouth has to sit at a fixed
  // world position or the approach path has nothing to aim at — at one turn per
  // 300 s the door wanders ~700 units around the hull over a few minutes, so a
  // player lining up on it would never arrive. Door-bearing stations are pinned
  // at yaw 0, which puts the ramp at screen-BOTTOM (model +Z, and the ortho
  // camera's up is -Z) — the same side the legacy undock already exits toward.
  // Doorless stations (factories, and every station when the flag is off) keep
  // the slow idle spin exactly as before.
  st.model.rotation.y = st.door ? 0 : -(performance.now() / 1000 / 300) * Math.PI * 2;
  activeThisFrame.add(id);
}

export function endStationFrame(): void {
  for (const [id, st] of activeStations) {
    if (!activeThisFrame.has(id)) {
      // dispose() resolves any in-flight open/close promise, so a caller
      // awaiting a door on a station that just left the screen is not stranded.
      st.door?.dispose();
      st.wrapper.parent?.remove(st.wrapper);
      activeStations.delete(id);
    }
  }
}

// ── Why there is no PerspectiveCamera fly-in here ────────────────────────────
// A first cut of M10 gave the shot its own PerspectiveCamera and flew it down
// the door axis. It cannot work, for two reasons that are structural rather
// than tuning:
//
//   • This layer's ortho camera is not a stylistic choice — it EXISTS to match
//     the Pixi 2D projection. The ship, the projectiles, the other players and
//     every effect are 2D sprites in worldLayer. Swap in a perspective camera
//     and the station stops lining up with all of them; the ship the shot is
//     supposed to follow slides off the hull it is flying into.
//   • The scene is tilted (wrapper.rotation.x = -0.6) and the model's -Z runs
//     BELOW the scene plane, so "forward through the door" was a dive through
//     the station body — which is what the shot looked like.
//
// The cinematic therefore lives where the camera actually is: DockingCameraController
// drives worldLayer.pivot/scale, so the chase runs in the same 2D projection
// everything else is drawn in and the ship stays exactly where it belongs.

export function renderStation3DLayer(): void {
  if (!renderer || !scene || !camera) return;
  // In the shared layout the ship layer normally draws the whole scene —
  // stations included — in its own single render call, and this is a no-op.
  // It only runs when nobody else claimed the driver role, i.e. the isolated
  // ?station-test harness, which has no ship layer to do it.
  if (ENABLE_SHARED_3D_SCENE && !isWorldRenderDriver("stations")) return;
  if (outlineRT && outlineScene && outlineCamera && fsQuad && brightMat && blurMat && outlineMat && bloomRTA && bloomRTB) {
    // Pass 1: stations → offscreen target
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

    // Pass 3: blit with 1px black outline + additive bloom
    fsQuad.material = outlineMat;
    renderer.setRenderTarget(null);
    renderer.render(outlineScene, outlineCamera);
  } else {
    renderer.render(scene, camera);
  }
}

export function removeStation3D(id: string): void {
  const st = activeStations.get(id);
  if (st) {
    st.door?.dispose();
    st.wrapper.parent?.remove(st.wrapper);
    activeStations.delete(id);
  }
}

export function destroyStation3DLayer(): void {
  if (outlineRT) { outlineRT.dispose(); outlineRT = null; outlineScene = null; outlineCamera = null; outlineMat = null; }
  if (bloomRTA) { bloomRTA.dispose(); bloomRTA = null; }
  if (bloomRTB) { bloomRTB.dispose(); bloomRTB = null; }
  brightMat = null;
  blurMat = null;
  fsQuad = null;
  if (renderer) {
    window.removeEventListener("resize", onResize);
    // The shared renderer belongs to three-world-layer and is disposed by
    // destroy3DLayer(); tearing it down from here would pull it out from under
    // the ship layer, which is attached to the same one.
    if (!ENABLE_SHARED_3D_SCENE) renderer.dispose();
    renderer = null;
  }
  for (const st of activeStations.values()) st.wrapper.parent?.remove(st.wrapper);
  scene = null;
  camera = null;
  for (const st of activeStations.values()) st.door?.dispose();
  activeStations.clear();
  templates.clear();
  templateLoading.clear();
  templateFailed.clear();
  dracoLoader?.dispose();
  dracoLoader = null;
  stationCanvas = null;
  initialized = false;
}
