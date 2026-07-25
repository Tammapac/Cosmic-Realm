// ─────────────────────────────────────────────────────────────────────────────
// HangarScene — the 3D docking payoff.
//
// A SELF-CONTAINED Three.js scene with its OWN perspective camera, separate from
// the shared top-down ortho world scene (which is locked to the Pixi 2D
// projection and cannot fly a camera through a room). The docked player sees a
// real modeled hangar interior — floor, ceiling, walls, a landing platform,
// lamps, crates, railings — exported from the Blender "HangarHall" scene as its
// own GLB (hangar_interior.glb), with the player ship parked on the platform.
//
//   • playIntro(): the ship flies IN from the hangar mouth onto the platform
//     while the camera follows; occlusion by the room geometry is free (one
//     scene, one depth buffer).
//   • showParked(): the static docked framing (also login-while-docked).
//   • playOutro(): the reverse, for undock.
//
// Renders to its OWN opaque canvas layered above the Pixi world (zIndex 3) and
// below the 2D hangar menu. Pumped by its OWN requestAnimationFrame — the sim
// tick halts while docked (state.dockedAt), so nothing else would advance it.
//
// Gated by ENABLE_HANGAR_3D_SCENE (?hangar). Fully disposable.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { installStudioEnv, type EnvKind } from "../three-environment";
import { CombatLights, type CombatLightKind } from "./CombatLights";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

/** Clamped smoothstep — zero slope at both ends, matching DockingCameraController. */
function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/** Layer that the selective-bloom pass renders. Emissive meshes are enabled on
 *  it (in addition to layer 0) so only they contribute glow. */
const BLOOM_LAYER = 1;

/** Max emissiveIntensity — above this the hue clips to white in the tonemap. */
const EMISSIVE_CAP = 2.0;

/** envMapIntensity for glossy (roughness-mapped) surfaces, so reflections read. */
const GLOSSY_ENV_INTENSITY = 2.5;

/**
 * Per-material gloss tuning (dialled in against the Blender reference). `roughMul`
 * scales the baked roughness map, `envI` the reflection strength.
 *
 * The reference floor is SATIN, not a mirror: the lamps read as soft, broad,
 * voluminous glow pools, not sharp reflections. So roughness is kept fairly HIGH
 * (blurry reflection) with only a moderate envI — a wet-look sheen, not chrome.
 * (Note: three's MeshStandardMaterial reflects only the environment map, never
 * the scene objects, so there is no ship mirror-image regardless — real object
 * reflections would need SSR/reflection probes.)
 */
const GLOSS_TUNING: Record<string, { roughMul: number; envI: number }> = {
  // Reflections should be BROAD + SOFT: roughness pushed near-max so the PMREM
  // samples its blurriest mips (wide diffuse glow, no shape), envI kept up so the
  // soft glow still reads. The baked roughness MAP still varies across the surface
  // (roughness-variation), this just scales it up toward matte.
  Hall_Floor_Mat: { roughMul: 1.0, envI: 1.0 },    // deck: broad soft glow
  SS_Hull_DarkMetal: { roughMul: 1.0, envI: 1.0 }, // platform/hull
  Hall_Wall: { roughMul: 1.0, envI: 0.9 },         // walls
  Aged_Orange: { roughMul: 1.0, envI: 0.8 },       // crates: soft sheen
  Aged_Blue: { roughMul: 1.0, envI: 0.8 },
  Aged_Green: { roughMul: 1.0, envI: 0.8 },
  Aged_Rust: { roughMul: 1.0, envI: 0.8 },
  Aged_Orange2: { roughMul: 1.0, envI: 0.8 },
  Aged_Blue2: { roughMul: 1.0, envI: 0.8 },
  Barrel_Mil: { roughMul: 1.0, envI: 0.9 },        // barrels: soft metal sheen
  Barrel_Red: { roughMul: 1.0, envI: 0.9 },
};

/** True if a material glows enough to belong on the bloom layer: a non-trivial
 *  emissive colour with real intensity, or an emissive map. */
function isEmissive(m: THREE.MeshStandardMaterial): boolean {
  if (!m.isMeshStandardMaterial) return false;
  if (m.emissiveMap) return true;
  const e = m.emissive;
  if (!e) return false;
  return (e.r + e.g + e.b) * (m.emissiveIntensity ?? 1) > 0.6;
}

// The hangar interior — a modeled room, its own GLB (from Blender HangarHall).
// Now carries baked Roughness/Metallic maps on ALL surface materials (floor,
// walls, hull/platform, every container + barrel) so the whole hangar reflects
// the lights — not just flat base-colour. Emissive strips (Hall_Cyan/Amber) stay
// map-free (colour from emissive).
const HANGAR_URL = "/models/stations/hangar_interior.glb";
/** Node the ship parks on. */
const PAD_NODE = "LandingPlatform";
/** Authored camera node, used to derive the docked framing. */
const CAM_NODE = "HallCam";

/** Player ship GLB paths, keyed by shipClass. Mirrors three-ship-layer's map. */
const SHIP_MODELS: Record<string, string> = {
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
};

function shipUrl(shipClass: string): string {
  return SHIP_MODELS[shipClass] ?? SHIP_MODELS.skimmer;
}

// ── Shared loaders ───────────────────────────────────────────────────────────
// One DRACOLoader (ship GLBs are Draco-compressed) and a small GLTF cache so
// re-docking never re-fetches.
let _draco: DRACOLoader | null = null;
function getDraco(): DRACOLoader {
  if (!_draco) {
    _draco = new DRACOLoader();
    _draco.setDecoderPath("/draco/");
  }
  return _draco;
}

interface LoadedGLB { scene: THREE.Group; animations: THREE.AnimationClip[] }
const _glbCache = new Map<string, Promise<LoadedGLB>>();
function loadGLB(url: string): Promise<LoadedGLB> {
  let p = _glbCache.get(url);
  if (!p) {
    p = new Promise<LoadedGLB>((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.setDRACOLoader(getDraco());
      loader.load(url, (g) => resolve({ scene: g.scene, animations: g.animations ?? [] }), undefined, reject);
    });
    _glbCache.set(url, p);
  }
  return p;
}

/** Find a node by exact name (case-insensitive) in a model. */
function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let hit: THREE.Object3D | null = null;
  const lower = name.toLowerCase();
  root.traverse((o) => { if (!hit && o.name.toLowerCase() === lower) hit = o; });
  return hit;
}

// ── Material validation (Phase C — validate, don't override) ─────────────────
// The user's goal is that a GLB looks in-game the way it does in Blender's
// Material Preview. So we DO NOT rebuild materials, force metalness/roughness,
// replace normal/rough/AO maps, tint albedo, or fake emission. We VALIDATE:
//   • enforce correct texture colour spaces (base/emissive = sRGB, data = linear)
//     — GLTFLoader already does this, but a re-export can get it wrong;
//   • log missing maps and material stats so problems are visible, not hidden;
//   • fix ONE narrowly-defined EXPORT BUG: a full-surface white/grey emissive
//     (albedo mis-plugged into the emissive slot), which self-lights the whole
//     model white. That is a broken material, not authored emission, so it is
//     zeroed — and logged as a fix, not a style choice.
// Everything else (authored metalness, roughness, normalScale, real coloured
// emissive on windows/thrusters, envMapIntensity) is left EXACTLY as exported.

interface MatStat {
  name: string; type: string;
  metal: number; rough: number;
  maps: string[]; missing: string[];
  emissiveFixed: boolean;
  pbrFixed: boolean;
}

/** True for the broken "albedo dumped into emissive" export: bright, unsaturated,
 *  full-surface white/grey emission that would self-light the whole mesh. */
function isBrokenWhiteEmissive(m: THREE.MeshStandardMaterial): boolean {
  if (!m.emissive) return false;
  const sum = m.emissive.r + m.emissive.g + m.emissive.b;
  if (sum < 0.35) return false;
  const hsl = { h: 0, s: 0, l: 0 };
  m.emissive.getHSL(hsl);
  // white/grey (low saturation) + no emissive map (so it's a flat whole-surface
  // glow, not authored windows/strips) = the export bug.
  return hsl.s < 0.25 && !m.emissiveMap;
}

function validateMaterial(m: THREE.MeshStandardMaterial): MatStat {
  const maps: string[] = [];
  const missing: string[] = [];
  const track = (map: THREE.Texture | null, label: string, linear: boolean) => {
    if (map) {
      maps.push(label);
      // enforce colour space: base/emissive sRGB, data maps linear.
      const want = linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      if (map.colorSpace !== want) { map.colorSpace = want; map.needsUpdate = true; }
    } else {
      missing.push(label);
    }
  };
  track(m.map, "base", false);
  track(m.emissiveMap ?? null, "emissive", false);
  track(m.normalMap ?? null, "normal", true);
  track(m.roughnessMap ?? null, "rough", true);
  track(m.metalnessMap ?? null, "metal", true);
  track(m.aoMap ?? null, "ao", true);

  let emissiveFixed = false;
  if (isBrokenWhiteEmissive(m)) {
    m.emissive.setScalar(0);
    m.emissiveIntensity = 0;
    m.emissiveMap = null;
    emissiveFixed = true;
  }

  // Fix the glTF metallic-default export artifact. When a mesh carries a base
  // map but NO metalnessMap and NO roughnessMap, and metalness/roughness are BOTH
  // exactly 1, those are three.js's MeshStandardMaterial defaults stamped because
  // the (procedural) metal/rough channels never exported — NOT an authored value.
  // A real full-metal surface would carry a rough map or a sub-1 roughness. Left
  // as-is these painted props (crates, barrels, walls) render as dull grey metal.
  // Reset them to a sane dielectric so they read as painted surfaces, the way
  // Blender's Principled BSDF showed them (metallic 0, mid roughness).
  let pbrFixed = false;
  const isExportMetalDefault =
    m.metalness === 1 && m.roughness === 1 && !m.metalnessMap && !m.roughnessMap;
  if (isExportMetalDefault) {
    m.metalness = 0.0; // painted dielectric, not metal
    m.roughness = 0.7; // matte-ish, not a mirror
    pbrFixed = true;
  }

  // Cap runaway emissive intensity. The deck strips exported at Blender's
  // emission STRENGTH (Hall_Cyan @8, Hall_Amber @6), which as a raw linear
  // multiplier clips straight to white in the tonemap — the colour is lost. Cap
  // to a level where the hue survives (reads as cyan/amber, not white) and the
  // selective-bloom pass has a sane value to work with instead of a blowout.
  if (isEmissive(m) && (m.emissiveIntensity ?? 1) > EMISSIVE_CAP) {
    m.emissiveIntensity = EMISSIVE_CAP;
  }

  // Glossy surfaces (those carrying a baked roughness map) need a stronger env
  // reflection to read as wet/polished. Per-material tuning where dialled in
  // (deck/platform wet-mirror, walls semi-gloss, crates softer sheen); otherwise
  // the flat glossy default. Matte props (no roughness map) are untouched.
  if (m.roughnessMap) {
    const t = GLOSS_TUNING[m.name ?? ""];
    if (t) {
      m.roughness = t.roughMul; // scales the baked map (below 1 = shinier)
      m.envMapIntensity = t.envI;
    } else {
      m.envMapIntensity = GLOSSY_ENV_INTENSITY;
    }
  }

  m.needsUpdate = true;
  return {
    name: m.name || "(unnamed)", type: m.type,
    metal: +(m.metalness ?? 0).toFixed(2), rough: +(m.roughness ?? 0).toFixed(2),
    maps, missing, emissiveFixed, pbrFixed,
  };
}

/**
 * Validate (not override) every material in a GLB clone, enable shadows, and log
 * a per-material summary. `label` names the model in the log.
 */
function validateModel(root: THREE.Object3D, label: string, hideLights = false): void {
  const stats: MatStat[] = [];
  root.traverse((o) => {
    const light = o as THREE.Light;
    if (light.isLight) { if (hideLights) light.visible = false; return; }
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let meshGlows = false;
    for (const mm of mats) {
      const m = mm as THREE.Material;
      if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        stats.push(validateMaterial(m as THREE.MeshStandardMaterial));
        if (isEmissive(m as THREE.MeshStandardMaterial)) meshGlows = true;
      }
    }
    // Emissive meshes also live on the bloom layer so the selective-bloom pass
    // sees them; everything else stays on layer 0 only and never blooms.
    if (meshGlows) mesh.layers.enable(BLOOM_LAYER);
  });
  const fixed = stats.filter((s) => s.emissiveFixed).length;
  const pbrFixed = stats.filter((s) => s.pbrFixed).length;
  const noBase = stats.filter((s) => s.missing.includes("base")).length;
  console.log(
    `[HangarScene] validate "${label}": ${stats.length} MeshStandard mats · ` +
    `${fixed} broken-emissive fixed · ${pbrFixed} export-metal-default fixed · ${noBase} without base map`,
  );
  if ((window as unknown as { __PBR_DEBUG?: boolean }).__PBR_DEBUG) {
    console.table(stats.map((s) => ({ ...s, maps: s.maps.join("+"), missing: s.missing.join("+") })));
  }
}

/** Live PBR-pipeline state, surfaced by the debug overlay (Phase F). */
export interface HangarDebugInfo {
  renderer: { drawCalls: number; triangles: number; textures: number; geometries: number; programs: number };
  env: { pmremActive: boolean; environmentInstalled: boolean; envKind: EnvKind; envIntensity: number };
  tone: { mode: string; exposure: number; outputColorSpace: string };
  lights: { directional: number; point: number; spot: number; hemisphere: number; ambient: number; rectArea: number };
  combatLightsActive: number;
  postFx: { enabled: boolean; bloomStrength: number; bloomThreshold: number; bloomRadius: number; fxaa: boolean };
  materials: { name: string; type: string; metalness: number; roughness: number; envMapIntensity: number; maps: string[] }[];
}

export class HangarScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;

  private raf = 0;
  private lastT = 0;
  private hangarRoot: THREE.Group;
  private ship: THREE.Group | null = null;
  /** The dominant shadow-casting key light (kept for the debug overlay). */
  private keyLight: THREE.DirectionalLight | null = null;
  /** Pooled dynamic combat lights (laser / explosion / hit). */
  private combat: CombatLights | null = null;
  /** Handle for a running combat-demo interval, so it can be stopped. */
  private demoTimer = 0;

  // ── Post-processing (Phase H) ─────────────────────────────────────────────
  private composer: EffectComposer | null = null;
  private bloomComposer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private fxaaPass: ShaderPass | null = null;
  // Post-FX (selective emissive bloom) is OFF by default: on this scene — a wide
  // deck covered in long emissive guide-strips seen at a grazing angle — even a
  // gentle UnrealBloom merges their halos into a floor-wide wash, which is the
  // "künstliche globale Aufhellung" the brief explicitly rejects. The clean AgX
  // render with capped emissive already reads the strips as coloured. The
  // selective-bloom chain stays wired and correct, opt-in via ?bloom, for scenes
  // (e.g. the space world) where compact emitters bloom cleanly.
  static postFx =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("bloom");

  /** World-space landing platform centre, and the authored camera pose. */
  private padWorld = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  /** Recentre offset baked into the ship so its bbox centre sits at the origin. */
  private shipRecenter = new THREE.Vector3();
  /** Half-height of the ship, to rest it ON the platform not through it. */
  private shipLift = 0;

  private anim:
    | { t: number; dur: number; kind: "intro" | "outro"; resolve: () => void }
    | null = null;

  /** The studio-env PMREM generator, disposed on teardown (fixes the old leak). */
  private envPmrem: THREE.PMREMGenerator | null = null;

  // ── Env A/B config (Phase B) ──────────────────────────────────────────────
  // Which IBL the studio env installs, and how strong. Static so a harness can
  // set them before preload() to compare procedural-studio vs the space HDRI.
  // Space HDRI is the reflection source (user's choice) — the near-black space
  // env reflects only faintly, so surfaces read soft/dark, not mirror-bright.
  // Lower intensity keeps reflections subtle/soft rather than crisp.
  static envKind: EnvKind = "hdr";
  static envIntensity = 0.8;

  // ── Tone-mapping A/B config (Phase D) ─────────────────────────────────────
  // Blender 4.x's Material Preview uses the AgX view transform, so AgX is the
  // strongest candidate for matching it; ACESFilmic (the old default) and
  // Khronos Neutral are the alternatives. Static so the harness can compare.
  static toneMapping: THREE.ToneMapping = THREE.AgXToneMapping;
  // AgX (as in Blender). Exposure recalibrated to 1.05 after the real Blender
  // light rig replaced the generic studio stand-in: 1.35 was compensating for the
  // missing lights, which is exactly the "künstliche Aufhellung" to avoid. Blender
  // itself runs AgX at exposure -0.5, but its 12 area lights + Cycles GI carry the
  // brightness; with the rebuilt rig 1.05 sits close without lifting.
  static toneExposure = 1.05;
  /** Live setter used by the harness to switch tone mapping without a rebuild. */
  setToneMapping(mode: THREE.ToneMapping, exposure: number): void {
    this.renderer.toneMapping = mode;
    this.renderer.toneMappingExposure = exposure;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => (mm.needsUpdate = true));
    });
  }

  private constructor(canvas: HTMLCanvasElement, hangarRoot: THREE.Group) {
    this.canvas = canvas;
    this.hangarRoot = hangarRoot;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x05070d, 1); // opaque near-black behind the room
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = HangarScene.toneMapping;
    this.renderer.toneMappingExposure = HangarScene.toneExposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    // Bright IBL — the room's colour is baked into the albedo, but the LIGHTING
    // is live: a STUDIO IBL (not the space background) gives the metal deck/walls
    // rich soft reflections, the way Blender's Material Preview lights a model.
    // Kept as the caller-selected kind so procedural-studio vs HDRI can be A/B'd.
    this.envPmrem = installStudioEnv(this.renderer, this.scene, {
      kind: HangarScene.envKind,
      intensity: HangarScene.envIntensity,
    });
    this.scene.add(hangarRoot);

    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 200);

    this.buildLights();
    this.combat = new CombatLights(this.scene);
    if (HangarScene.postFx) this.buildComposer(w, h); // opt-in via ?bloom
    window.addEventListener("resize", this.onResize);
  }

  /**
   * SELECTIVE-bloom post-FX chain (Phase H). Threshold-based bloom can't be
   * "emission-only" in a bright studio scene — the lit walls/windows are already
   * above any sane threshold and would bloom too. So we render bloom from a
   * SEPARATE pass that only sees the emissive objects (a dedicated layer), then
   * composite that glow additively over the full scene:
   *
   *   bloomComposer: RenderPass(layer BLOOM only, everything else black)
   *                  → UnrealBloomPass → (render target, not screen)
   *   finalComposer: RenderPass(full scene)
   *                  → mixPass (adds the bloom target)
   *                  → OutputPass (tone map + sRGB)
   *                  → FXAA
   *
   * Emissive meshes are tagged onto BLOOM_LAYER in validateModel/parkShip; combat
   * lights are lights (no mesh) so they light the scene directly rather than
   * blooming, which is correct.
   */
  private buildComposer(w: number, h: number): void {
    const size = new THREE.Vector2(w, h);
    const pr = Math.min(window.devicePixelRatio, 2);

    // — bloom-only composer (renders to its own target, renderToScreen=false) —
    const bloomComposer = new EffectComposer(this.renderer);
    bloomComposer.renderToScreen = false;
    bloomComposer.setPixelRatio(pr);
    bloomComposer.setSize(w, h);
    bloomComposer.addPass(new RenderPass(this.scene, this.camera));
    // Conservative: the layer is already isolated (threshold 0), so keep strength
    // + radius low — the emissive cap gives sane input values.
    const bloom = new UnrealBloomPass(size, 0.35, 0.3, 0.0);
    bloomComposer.addPass(bloom);
    this.bloomPass = bloom;
    this.bloomComposer = bloomComposer;

    // — final composer: full scene + additive bloom + tonemap + fxaa —
    const finalComposer = new EffectComposer(this.renderer);
    finalComposer.setPixelRatio(pr);
    finalComposer.setSize(w, h);
    finalComposer.addPass(new RenderPass(this.scene, this.camera));

    const mixPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: bloomComposer.renderTarget2.texture },
        },
        vertexShader:
          "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv;" +
          "void main(){ gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }",
        defines: {},
      }),
      "baseTexture",
    );
    mixPass.needsSwap = true;
    finalComposer.addPass(mixPass);

    finalComposer.addPass(new OutputPass());

    const fxaa = new ShaderPass(FXAAShader);
    fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    finalComposer.addPass(fxaa);
    this.fxaaPass = fxaa;

    this.composer = finalComposer;
  }

  /** Render the selective-bloom chain: bloom-only first, then the composite. */
  private renderComposed(): void {
    if (!this.composer || !this.bloomComposer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    // 1) Darken everything not on the bloom layer, render bloom-only.
    this.camera.layers.set(BLOOM_LAYER);
    this.bloomComposer.render();
    // 2) Restore all layers, render the full composite.
    this.camera.layers.enableAll();
    this.composer.render();
  }

  // ── Construction ─────────────────────────────────────────────────────────

  /**
   * Build a hangar scene with the player's ship parked, ready to show or play.
   * Loads (cached) both GLBs. Meant to run behind the docking blackout.
   */
  static async preload(shipClass: string): Promise<HangarScene> {
    const [hangarGLB, shipGLB] = await Promise.all([
      loadGLB(HANGAR_URL),
      loadGLB(shipUrl(shipClass)),
    ]);

    const hangarRoot = hangarGLB.scene.clone(true);
    validateModel(hangarRoot, "hangar", /* hideLights */ true);
    const canvas = document.createElement("canvas");
    const scene = new HangarScene(canvas, hangarRoot);
    scene.resolveNodes();
    scene.buildStripLights(); // local lights on the emissive deck strips
    scene.buildBounceLights(); // coloured bounce from crates/barrels (fake GI)
    scene.parkShip(shipGLB.scene);
    return scene;
  }

  private buildLights(): void {
    // REAL Blender rig (audit finding): the GLB carries ZERO lights — glTF can't
    // export Blender's AREA lamps, and KHR_lights_punctual wasn't enabled, so even
    // the 2 spots were dropped. The generic Key/Fill/Rim studio rig was a stand-in;
    // this rebuilds the actual 12 HangarHall lights (10 AREA + 2 SPOT) at their
    // exported positions/colours, so the room is lit the way Blender lit it.
    //
    // Coordinate convert: the GLB was exported yup=True, so Blender Z-up →
    // three Y-up is (x, z, -y). Positions are in the same unit scale as the model
    // (verified: Blender lamps z=5.6 land just under the three ceiling at y≈6.15).
    RectAreaLightUniformsLib.init();
    const B = (bx: number, by: number, bz: number) => new THREE.Vector3(bx, bz, -by);
    const col = (r: number, g: number, b: number) => new THREE.Color(r, g, b);

    // Blender watts → three intensity. RectAreaLight uses a different unit than
    // Blender's radiometric watts; these divisors were picked so the key reads as
    // the dominant light without clipping (calibrated against the reference).
    const AREA_K = 1 / 220; // RectAreaLight intensity per Blender watt
    const SPOT_K = 1 / 55;  // SpotLight intensity per Blender watt

    const addArea = (
      name: string, bx: number, by: number, bz: number,
      dx: number, dy: number, dz: number, w: number, sx: number, sy: number,
      r: number, g: number, bl: number,
    ) => {
      const l = new THREE.RectAreaLight(col(r, g, bl).getHex(), w * AREA_K, Math.max(sx, 0.5), Math.max(sy, 0.5));
      l.position.copy(B(bx, by, bz));
      // aim: look from position toward position + Blender-dir (converted)
      const target = B(bx + dx, by + dy, bz + dz);
      l.lookAt(target);
      l.name = name;
      this.scene.add(l);
    };

    // — the 4 big hall lights (Key/Fill/Fill/Back) —
    addArea("HallKey", 0, 1, 5.5,   0, 0, -1,  900, 8, 0.25,  0.7, 0.85, 1.0);
    addArea("HallFill1", -5, 2, 3,  -0.866, 0, -0.5, 250, 5, 0.25, 0.4, 0.7, 1.0);
    addArea("HallFill2",  5, 2, 3,   0.866, 0, -0.5, 250, 5, 0.25, 0.4, 0.7, 1.0);
    addArea("HallBack",   0, -7, 3,  0, -0.866, -0.5, 180, 5, 0.25, 1.0, 0.7, 0.4);

    // — the 6 ceiling lamp panels (Lamp0..5), all pointing straight down —
    const lampXY: [number, number][] = [[-2.5,-4],[2.5,-4],[-2.5,0],[2.5,0],[-2.5,4],[2.5,4]];
    lampXY.forEach(([lx, ly], i) =>
      addArea(`Lamp${i}`, lx, ly, 5.6, 0, 0, -1, 180, 1.4, 0.4, 0.6, 0.8, 1.0),
    );

    // — the 2 spots (these DO cast shadow; give the room its directional pop) —
    const addSpot = (
      name: string, bx: number, by: number, bz: number,
      dx: number, dy: number, dz: number, w: number, angDeg: number, blend: number,
      r: number, g: number, bl: number, shadow: boolean,
    ) => {
      const s = new THREE.SpotLight(col(r, g, bl).getHex(), w * SPOT_K, 0, (angDeg * Math.PI) / 180 / 2, blend, 1.5);
      s.position.copy(B(bx, by, bz));
      s.target.position.copy(B(bx + dx, by + dy, bz + dz));
      s.name = name;
      if (shadow) {
        s.castShadow = true;
        s.shadow.mapSize.set(2048, 2048);
        s.shadow.camera.near = 0.5;
        s.shadow.camera.far = 30;
        s.shadow.bias = -0.0002;
        s.shadow.normalBias = 0.02;
      }
      this.scene.add(s);
      this.scene.add(s.target);
    };
    addSpot("Spot1", -3, 3, 5.5,  0.52, -0.347, -0.78, 400, 45, 0.4, 0.8, 0.9, 1.0, true);
    addSpot("Spot2",  3, -1, 5.5, -0.52,  0.347, -0.78, 400, 45, 0.4, 0.8, 0.9, 1.0, false);

    // Keep ONE shadow-casting directional as a broad key so the ship + crates get
    // a clean contact shadow on the deck (RectAreaLights can't cast shadows).
    const shadowKey = new THREE.DirectionalLight(0xdfe8ff, 0.5);
    shadowKey.position.set(1.5, 8, 3);
    shadowKey.castShadow = true;
    shadowKey.shadow.mapSize.set(2048, 2048);
    shadowKey.shadow.camera.near = 1;
    shadowKey.shadow.camera.far = 40;
    shadowKey.shadow.bias = -0.0002;
    shadowKey.shadow.normalBias = 0.02;
    this.scene.add(shadowKey);
    this.keyLight = shadowKey;

    // Faked GI fill (chosen over a real lightmap bake, per the user): two soft,
    // low-intensity fills that stand in for Cycles indirect light WITHOUT flat
    // ambient and WITHOUT global lifting.
    //   • giHemi  — cool sky above / warm deck below, normal-aware, lifts the
    //     shadow side a touch the way sky+bounce GI does.
    //   • giBounce — a dim WARM directional pointing UP from under the deck, so the
    //     undersides of the ship/crates catch a floor-bounce tint (what Cycles GI
    //     gives for free). Tuned low so it never plats the forms.
    const giHemi = new THREE.HemisphereLight(0x9fb8ff, 0x40381f, 0.25);
    this.scene.add(giHemi);
    const giBounce = new THREE.DirectionalLight(0xffe8d0, 0.35);
    giBounce.position.set(0, -3, 0);
    giBounce.target.position.set(0, 2, 0);
    this.scene.add(giBounce);
    this.scene.add(giBounce.target);
  }

  /**
   * Real local lights on the emissive deck strips (audit finding #6). Emission +
   * bloom alone light nothing around them — Blender had cyan RingLight PointLights
   * at the strips for that. This samples the Hall_Cyan / Hall_Amber mesh centres at
   * runtime (so a model re-export stays correct) and drops a small, short-range,
   * SHADOWLESS coloured PointLight at a thinned subset of them, so the deck, ship,
   * stairs and crates actually catch cyan/amber light. Thinned + range-limited so
   * they never dominate and stay well under the light-uniform budget.
   */
  private buildStripLights(): void {
    this.hangarRoot.updateWorldMatrix(true, true);
    const cyan: THREE.Vector3[] = [];
    const amber: THREE.Vector3[] = [];
    const tmp = new THREE.Box3();
    this.hangarRoot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const nm = (mats[0] as THREE.Material)?.name ?? "";
      if (!/Hall_Cyan|Hall_Amber/.test(nm)) return;
      tmp.setFromObject(mesh);
      const c = tmp.getCenter(new THREE.Vector3());
      (/Cyan/.test(nm) ? cyan : amber).push(c);
    });

    // EVERY emissive fixture becomes a real light — the user found lamps that
    // glowed but cast nothing (wall stripes, pad lights, screens). No thinning:
    // each Hall_Cyan / Hall_Amber mesh (deck strip, wall Screen, ceiling Lamp
    // panel, PadLight, WallStripe, rail) gets a short-range shadowless coloured
    // PointLight so it lights the deck/wall/ship around it. Floor fixtures light
    // the deck; elevated ones (y≥1) reach a bit further to hit wall + floor.
    // Intensities are modest per-light because there are many.
    const addLights = (
      pts: THREE.Vector3[], hex: number,
      floorIntensity: number, floorRange: number,
      highIntensity: number, highRange: number,
    ) => {
      for (const p of pts) {
        const high = p.y >= 1.0;
        const l = new THREE.PointLight(
          hex, high ? highIntensity : floorIntensity, high ? highRange : floorRange, 2.0,
        );
        l.position.copy(p);
        l.position.y += high ? 0.0 : 0.15;
        l.castShadow = false;
        l.name = "strip";
        this.scene.add(l);
      }
    };
    // cyan: deck strips, platform ring, rails + the wall Screen_* / ceiling Lamp panels
    addLights(cyan, 0x2ec8ff, /*floor*/ 1.6, 2.6, /*high*/ 2.4, 5.5);
    // amber: pad lights, wall stripes, tank valves
    addLights(amber, 0xffb040, /*floor*/ 1.4, 2.6, /*high*/ 2.0, 5.0);
  }

  /**
   * Coloured bounce light from the crates/barrels (fakes Cycles indirect/colour
   * bleed). A blue crate bounces blue onto the deck beside it, an orange crate
   * orange, etc. For each container/barrel mesh, sample its average albedo and
   * drop a dim, wide, SHADOWLESS PointLight of that colour just outside it near the
   * floor — so the surrounding deck + walls pick up its colour, the way GI does.
   */
  private buildBounceLights(): void {
    this.hangarRoot.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    const seenMat = new Map<string, THREE.Color>();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 8;
    const cctx = canvas.getContext("2d")!;

    const avgAlbedo = (m: THREE.MeshStandardMaterial): THREE.Color => {
      const cached = seenMat.get(m.name);
      if (cached) return cached;
      const c = new THREE.Color(0.5, 0.5, 0.5);
      const img = m.map?.image as CanvasImageSource | undefined;
      if (img) {
        try {
          cctx.clearRect(0, 0, 8, 8);
          cctx.drawImage(img, 0, 0, 8, 8);
          const d = cctx.getImageData(0, 0, 8, 8).data;
          let r = 0, g = 0, b = 0;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
          const n = d.length / 4;
          // sRGB→linear-ish and lift saturation so the bounce reads as a colour
          c.setRGB(r / n / 255, g / n / 255, b / n / 255).convertSRGBToLinear();
        } catch { /* keep grey */ }
      }
      seenMat.set(m.name, c);
      return c;
    };

    this.hangarRoot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
      const nm = m?.name ?? "";
      if (!/Aged_|Barrel_/.test(nm)) return; // only crates + barrels bounce colour
      box.setFromObject(mesh);
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const col = avgAlbedo(m);
      // place the bounce light low, at the container's base, tinted its colour
      const l = new THREE.PointLight(col.getHex(), 0.9, Math.max(size.x, size.z) * 2.2, 2.0);
      l.position.set(c.x, box.min.y + 0.2, c.z);
      l.castShadow = false;
      l.name = "bounce";
      this.scene.add(l);
    });
  }

  /** Resolve the landing platform + authored camera pose from the model. */
  private resolveNodes(): void {
    this.hangarRoot.updateWorldMatrix(true, true);
    const padNode = findNode(this.hangarRoot, PAD_NODE) ?? findNode(this.hangarRoot, "Hall_Floor");
    if (padNode) {
      padNode.updateWorldMatrix(true, false);
      this.padWorld.setFromMatrixPosition(padNode.matrixWorld);
    }
    // NOTE: the authored HallCam node is ignored — it exports with a broken ~173°
    // FOV (1mm lens). Hand-tuned framing: camera on the -z (interior) side aimed
    // toward +z, so you look INTO the hangar (rear wall panels, lamps, stairs,
    // crates), NOT out through the exit door (the big black wall on the +z side).
    // Slightly left (target -x) for a more dynamic angle.
    this.camPos.copy(this.padWorld).add(new THREE.Vector3(1.0, 1.9, -7.5));
    this.camTarget.copy(this.padWorld).add(new THREE.Vector3(-1.0, 1.0, 3));
  }

  private parkShip(shipTemplate: THREE.Group): void {
    const ship = shipTemplate.clone(true);
    validateModel(ship, "ship");
    const box = new THREE.Box3().setFromObject(ship);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    // The platform is ~2 units across; size the ship to a bit under that.
    const shipSpan = 2.2;
    const scale = shipSpan / maxDim;
    ship.scale.setScalar(scale);
    ship.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });
    this.shipRecenter.copy(center).multiplyScalar(-scale);
    this.shipLift = (size.y * scale) / 2 + 0.05;
    this.ship = ship;
    this.parkAt(this.padWorld);
    this.scene.add(ship);
  }

  /** Place the parked ship at a world point (keeping its recentre + lift). */
  private parkAt(p: THREE.Vector3): void {
    if (!this.ship) return;
    this.ship.position.copy(this.shipRecenter).add(p);
    this.ship.position.y += this.shipLift;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Attach the canvas to the DOM (full-screen, above Pixi, below the menu). */
  show(host: HTMLElement = document.body): void {
    const c = this.canvas;
    c.style.cssText = [
      "position:fixed", "inset:0", "width:100%", "height:100%",
      "z-index:3", "pointer-events:none", "background:#05070d",
    ].join(";");
    if (c.parentElement !== host) host.appendChild(c);
    this.resize();
    this.frameParked();
    this.startLoop();
  }

  hide(): void {
    this.stopLoop();
    this.canvas.remove();
  }

  private startLoop(): void {
    if (this.raf) return;
    this.lastT = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.lastT) / 1000); // clamp backgrounded tabs
      this.lastT = now;
      this.pump(dt);
      if (HangarScene.postFx && this.composer) this.renderComposed();
      else this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private pump(dt: number): void {
    if (this.anim) {
      const a = this.anim;
      a.t = Math.min(1, a.t + dt / a.dur);
      if (a.kind === "intro") this.applyIntro(a.t);
      else this.applyOutro(a.t);
      if (a.t >= 1) { const r = a.resolve; this.anim = null; r(); }
    }
    this.combat?.update(dt);
  }

  // ── Framing + cinematics ─────────────────────────────────────────────────

  /** Point the camera into the hangar from the resolved framing pose. */
  private frameParked(): void {
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  /** Static parked framing. */
  showParked(): void {
    this.parkAt(this.padWorld);
    this.frameParked();
  }

  /** The ship's start point for a fly-in: out toward the hangar mouth (-z),
   *  raised, so it descends onto the platform. */
  private mouthPoint(): THREE.Vector3 {
    // The room's opening faces roughly -z (toward the camera / hangar mouth).
    return this.padWorld.clone().add(new THREE.Vector3(0, 1.6, -9));
  }

  playIntro(): Promise<void> {
    if (!this.ship) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.anim = { t: 0, dur: 2.6, kind: "intro", resolve };
    });
  }

  playOutro(): Promise<void> {
    if (!this.ship) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.anim = { t: 0, dur: 2.2, kind: "outro", resolve };
    });
  }

  private applyIntro(t: number): void {
    if (!this.ship) return;
    const e = smoothstep(t);
    const from = this.mouthPoint();
    const to = this.padWorld;
    const p = from.clone().lerp(to, e);
    this.ship.position.copy(this.shipRecenter).add(p);
    this.ship.position.y += this.shipLift;
    // Camera eases from a wide "coming in" angle to the parked framing.
    const camFrom = this.padWorld.clone().add(new THREE.Vector3(-1.5, 4.5, -11));
    this.camera.position.copy(camFrom.lerp(this.camPos, e));
    this.camera.lookAt(this.ship.position);
  }

  private applyOutro(t: number): void {
    if (!this.ship) return;
    const e = smoothstep(t);
    const from = this.padWorld;
    const to = this.mouthPoint();
    const p = from.clone().lerp(to, e);
    this.ship.position.copy(this.shipRecenter).add(p);
    this.ship.position.y += this.shipLift;
    this.camera.lookAt(this.ship.position);
  }

  // ── Resize / teardown ───────────────────────────────────────────────────────

  private onResize = (): void => this.resize();

  private resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(w, h);
      this.bloomComposer?.setSize(w, h);
      const pr = Math.min(window.devicePixelRatio, 2);
      this.fxaaPass?.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    }
  }

  // ── Dynamic combat lights (Phase G) ───────────────────────────────────────
  // Public hooks the combat system calls to throw real dynamic light onto the
  // hulls: a laser bolt's red glow, an explosion's orange bloom, a hit's flash.
  // Scene-agnostic — the same CombatLights class serves the world layer too.

  /** Spawn a combat light at a world point. See CombatLights for kinds/tuning. */
  spawnCombatLight(
    kind: CombatLightKind,
    pos: THREE.Vector3,
    opts?: { color?: number; peakScale?: number; distanceScale?: number },
  ): void {
    this.combat?.spawn(kind, pos, opts);
  }

  /** Harness-only: toggle a looping demo that fires lasers/hits/explosions
   *  around the parked ship so the dynamic lighting is visible in isolation. */
  toggleCombatDemo(on: boolean): void {
    if (this.demoTimer) { clearInterval(this.demoTimer); this.demoTimer = 0; }
    if (!on || !this.combat) return;
    let n = 0;
    const near = () =>
      this.padWorld.clone().add(new THREE.Vector3(
        (Math.sin(n * 1.7) * 1.6),
        0.4 + Math.abs(Math.cos(n * 0.9)) * 0.8,
        (Math.cos(n * 1.3) * 1.6),
      ));
    this.demoTimer = window.setInterval(() => {
      n++;
      // Mostly laser bolts, an occasional hit flash, a rarer explosion.
      const roll = n % 8;
      if (roll === 0) this.spawnCombatLight("explosion", near(), { peakScale: 0.5, distanceScale: 0.4 });
      else if (roll % 3 === 0) this.spawnCombatLight("hit", near());
      else this.spawnCombatLight("laser", near());
    }, 140);
  }

  // ── Renderer debug overlay (Phase F) ──────────────────────────────────────
  // Reports the live state of the PBR pipeline so the render setup is auditable
  // at a glance: renderer info, IBL/PMREM, tone mapping, and per-material +
  // per-light census. Read by the harness overlay (and `window.__hangar`).
  getDebugInfo(): HangarDebugInfo {
    const info = this.renderer.info;
    const tmName =
      this.renderer.toneMapping === THREE.AgXToneMapping ? "AgX"
      : this.renderer.toneMapping === THREE.ACESFilmicToneMapping ? "ACESFilmic"
      : this.renderer.toneMapping === THREE.NeutralToneMapping ? "Neutral"
      : this.renderer.toneMapping === THREE.CineonToneMapping ? "Cineon"
      : this.renderer.toneMapping === THREE.ReinhardToneMapping ? "Reinhard"
      : this.renderer.toneMapping === THREE.LinearToneMapping ? "Linear"
      : "None";

    // Light census.
    let dir = 0, point = 0, spot = 0, hemi = 0, ambient = 0, rectArea = 0;
    // Material census — sample distinct MeshStandardMaterials.
    const seen = new Set<THREE.Material>();
    const mats: HangarDebugInfo["materials"] = [];
    this.scene.traverse((o) => {
      const l = o as THREE.Light;
      if (l.isLight) {
        if ((l as THREE.DirectionalLight).isDirectionalLight) dir++;
        else if ((l as THREE.RectAreaLight).isRectAreaLight) rectArea++;
        else if ((l as THREE.PointLight).isPointLight) point++;
        else if ((l as THREE.SpotLight).isSpotLight) spot++;
        else if ((l as THREE.HemisphereLight).isHemisphereLight) hemi++;
        else if ((l as THREE.AmbientLight).isAmbientLight) ambient++;
      }
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mm of list) {
          if (!mm || seen.has(mm)) continue;
          seen.add(mm);
          const sm = mm as THREE.MeshStandardMaterial;
          if (sm.isMeshStandardMaterial && mats.length < 24) {
            mats.push({
              name: sm.name || "(unnamed)",
              type: sm.type,
              metalness: +sm.metalness.toFixed(2),
              roughness: +sm.roughness.toFixed(2),
              envMapIntensity: +(sm.envMapIntensity ?? 1).toFixed(2),
              maps: [
                sm.map && "base", sm.normalMap && "normal",
                sm.roughnessMap && "rough", sm.metalnessMap && "metal",
                sm.aoMap && "ao", sm.emissiveMap && "emissive",
              ].filter(Boolean) as string[],
            });
          }
        }
      }
    });

    return {
      renderer: {
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        textures: info.memory.textures,
        geometries: info.memory.geometries,
        programs: info.programs?.length ?? 0,
      },
      env: {
        pmremActive: !!this.envPmrem,
        environmentInstalled: !!this.scene.environment,
        envKind: HangarScene.envKind,
        envIntensity: (this.scene as unknown as { environmentIntensity?: number })
          .environmentIntensity ?? 1,
      },
      tone: {
        mode: tmName,
        exposure: +this.renderer.toneMappingExposure.toFixed(2),
        outputColorSpace: this.renderer.outputColorSpace,
      },
      lights: { directional: dir, point, spot, hemisphere: hemi, ambient, rectArea },
      combatLightsActive: this.combat?.activeCount ?? 0,
      postFx: {
        enabled: HangarScene.postFx && !!this.composer,
        bloomStrength: +(this.bloomPass?.strength ?? 0).toFixed(2),
        bloomThreshold: +(this.bloomPass?.threshold ?? 0).toFixed(2),
        bloomRadius: +(this.bloomPass?.radius ?? 0).toFixed(2),
        fxaa: !!this.fxaaPass,
      },
      materials: mats,
    };
  }

  dispose(): void {
    this.stopLoop();
    if (this.demoTimer) { clearInterval(this.demoTimer); this.demoTimer = 0; }
    this.combat?.dispose();
    this.combat = null;
    this.composer?.dispose();
    this.bloomComposer?.dispose();
    this.composer = null;
    this.bloomComposer = null;
    this.bloomPass = null;
    this.fxaaPass = null;
    window.removeEventListener("resize", this.onResize);
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose?.();
        const m = mesh.material;
        (Array.isArray(m) ? m : [m]).forEach((mm) => mm?.dispose?.());
      }
    });
    this.scene.environment?.dispose?.();
    this.envPmrem?.dispose();
    this.envPmrem = null;
    this.renderer.dispose();
    this.canvas.remove();
  }
}

/** The single hangar scene while docked, or null. */
export let activeHangarScene: HangarScene | null = null;
export function setActiveHangarScene(s: HangarScene | null): void {
  activeHangarScene = s;
}
