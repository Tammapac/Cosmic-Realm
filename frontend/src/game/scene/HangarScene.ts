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
import { LandingSmoke } from "./LandingSmoke";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
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

/** Max emissiveIntensity for the emissive fixtures. Raised to 5 so the wall
 *  Screens, ceiling lamp panels and deck strips read as WHOLE glowing faces
 *  (the user wanted them to light up as full surfaces, not tiny points) while the
 *  hue still survives (8+ clips to white). */
const EMISSIVE_CAP = 5.0;

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
const GLOSS_TUNING: Record<string, { roughMul: number; envI: number; roughSet?: number; metalSet?: number }> = {
  // Reflections should be BROAD + SOFT: high roughness → the PMREM samples its
  // blurrier mips (wide diffuse glow, no sharp mirror). The baked roughness map is
  // kept for surface variation. For the floor/platform, roughSet/metalSet pin the
  // spec values (rough ~0.42, metal ~0.45, envI 1.2) so they read as wet/polished
  // with broad soft reflections — not a mirror (spec #6).
  // The DECK floor was reflecting too hard — matter it (rough 0.42->0.6, envI
  // 1.2->0.9) so it's a soft sheen, not a mirror. Only the floor; the platform +
  // hull keep their polished look.
  Hall_Floor_Mat: { roughMul: 1.0, envI: 0.9, roughSet: 0.6, metalSet: 0.4 },  // deck
  SS_Hull_DarkMetal: { roughMul: 1.0, envI: 1.2, roughSet: 0.42, metalSet: 0.45 }, // platform/hull
  Hall_Wall: { roughMul: 1.0, envI: 0.9 },         // walls
  // Containers + barrels: painted-metal look — catch light, soft wide highlights,
  // NOT chrome (spec values). roughSet/metalSet pin absolute PBR; roughness never
  // below 0.25 so nothing reads as a mirror. Painted crates get a light metalness
  // for sheen; worn/rusty ones stay more matte + less metallic.
  // — lackierte Container — a touch glossier now (rough 0.4->0.32, envI 1.35->1.5)
  //   so they reflect a bit more without turning to chrome.
  Aged_Orange: { roughMul: 1.0, envI: 1.5, roughSet: 0.32, metalSet: 0.3 },
  Aged_Blue: { roughMul: 1.0, envI: 1.5, roughSet: 0.32, metalSet: 0.3 },
  Aged_Green: { roughMul: 1.0, envI: 1.5, roughSet: 0.32, metalSet: 0.3 },
  Aged_Orange2: { roughMul: 1.0, envI: 1.5, roughSet: 0.32, metalSet: 0.3 },
  Aged_Blue2: { roughMul: 1.0, envI: 1.5, roughSet: 0.32, metalSet: 0.3 },
  // — abgenutzter Metallcontainer — a hair glossier too
  Aged_Rust: { roughMul: 1.0, envI: 1.55, roughSet: 0.32, metalSet: 0.44 },
  // — Fässer: glossier so they catch the lights instead of reading matte. Barrel_Red
  // lackiert; Barrel_Mil abgenutzt aber jetzt mit deutlich mehr Reflexion (war zu matt).
  Barrel_Red: { roughMul: 1.0, envI: 1.8, roughSet: 0.28, metalSet: 0.4 },
  Barrel_Mil: { roughMul: 1.0, envI: 1.7, roughSet: 0.34, metalSet: 0.35 },
  // The ship hull (authored PBR): lower roughness + higher envI so it actually
  // CATCHES the environment — it read dead/flat before. NOTE this only reflects the
  // env map, never the scene: a ship mirror-image on the deck needs planar
  // reflection (a separate step), which MeshStandardMaterial can't do.
  Material_0: { roughMul: 0.26, envI: 2.3 },
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

// Per-class hangar footprint (world units for the ship's longest HORIZONTAL axis).
// Bigger ship class → bigger number, so a Skimmer MK1 reads smaller than an Apex
// Destroyer regardless of its model's raw export scale. The pad is ~8u across; the
// biggest capital ships fill most of it. Fitting the horizontal span (not maxDim)
// stops a tall antenna/fin from shrinking a ship's apparent size.
const SHIP_HANGAR_SPAN: Record<string, number> = {
  skimmer: 2.4,   // MK1 starter — smallest
  wasp: 2.6,
  reaver: 2.8,
  marauder: 3.0,
  specter: 3.0,
  phalanx: 3.4,
  apex: 3.6,      // Destroyer — clearly bigger than the Skimmer
  eclipse: 3.8,
  obsidian: 3.8,
  harbinger: 4.0,
  vanguard: 4.0,
  titan: 4.4,
  colossus: 4.6,
  leviathan: 4.8, // Dreadnought
  sovereign: 5.0, // Flagship — largest
};
const DEFAULT_HANGAR_SPAN = 3.0;

function hangarSpan(shipClass: string): number {
  return SHIP_HANGAR_SPAN[shipClass] ?? DEFAULT_HANGAR_SPAN;
}

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

// The barrel base-colour textures have dark AO/dirt WEDGES baked into the albedo
// (a bad Blender unwrap/AO-into-albedo bake) that read as ugly triangular shadow
// patches on the cylinder — not a lighting problem, it's painted into the texture.
// Lift the shadows in-engine: raise dark pixels toward mid-tone so the wedges fade
// while the surface colour + detail survive. Cached per source image so a shared
// material is processed once.
const _liftCache = new WeakMap<TexImageSource, THREE.CanvasTexture>();
function liftTextureShadows(
  src: THREE.Texture, lift = 0.34, sat = 1.7,
): THREE.CanvasTexture | null {
  const img = src.image as (TexImageSource & { width: number; height: number }) | undefined;
  if (!img || !img.width || !img.height) return null;
  const cached = _liftCache.get(img);
  if (cached) return cached;
  const cv = document.createElement("canvas");
  cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img as CanvasImageSource, 0, 0);
  const id = ctx.getImageData(0, 0, cv.width, cv.height);
  const d = id.data;
  // Global black-point lift flattens the baked-in dark wedges (raising the low end
  // so the triangles fade). That washes colour toward grey, so re-saturate around
  // each pixel's luma to bring the barrel's colour back. Together: no triangles,
  // colour preserved.
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    r = lift + (1 - lift) * r;
    g = lift + (1 - lift) * g;
    b = lift + (1 - lift) * b;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    r = luma + (r - luma) * sat;
    g = luma + (g - luma) * sat;
    b = luma + (b - luma) * sat;
    d[i] = Math.round(Math.max(0, Math.min(1, r)) * 255);
    d[i + 1] = Math.round(Math.max(0, Math.min(1, g)) * 255);
    d[i + 2] = Math.round(Math.max(0, Math.min(1, b)) * 255);
  }
  ctx.putImageData(id, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = src.colorSpace;
  tex.wrapS = src.wrapS; tex.wrapT = src.wrapT;
  tex.flipY = src.flipY;
  tex.needsUpdate = true;
  _liftCache.set(img, tex);
  return tex;
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
  // Baked AO/GI lightmap (uv1): push its strength up a touch so the contact
  // shading (where crates/objects darken the deck) reads clearly.
  if (m.aoMap) m.aoMapIntensity = 1.5;

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

  // Per-material PBR tuning (GLOSS_TUNING). A listed material gets its pinned
  // roughSet/metalSet + envI so it reads as painted-metal / wet-polished as
  // intended — this now applies WHETHER OR NOT the material has a roughness map
  // (the containers/barrels mostly have none, but still need the spec values). A
  // present roughness map is KEPT and multiplies against the roughSet base for
  // surface variation. Non-listed materials with a rough map get the flat glossy
  // default; matte non-listed props are untouched.
  // Normalise the lookup name: glTF dedups shared materials across ship exports as
  // "Material_0.022" etc. Strip the ".NNN" suffix so EVERY ship's hull material
  // (all named Material_0*) gets the SAME skimmer tuning — otherwise the other
  // ships keep their exported roughness 1.0 and read dead/matte ("no light").
  const key = (m.name ?? "").replace(/\.\d+$/, "");
  const t = GLOSS_TUNING[key];
  if (t) {
    if (t.roughSet !== undefined) m.roughness = t.roughSet;      // absolute base
    else if (m.roughnessMap) m.roughness = t.roughMul;           // scale the map
    else m.roughness = t.roughMul;                               // no map: pin it
    if (t.metalSet !== undefined) m.metalness = t.metalSet;
    m.envMapIntensity = t.envI;
  } else if (m.roughnessMap) {
    m.envMapIntensity = GLOSSY_ENV_INTENSITY;
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
  // The container frame (corner posts + ribs) shares SS_Hull_DarkMetal with the
  // whole scene (platform, stairs, pipes…). Those frame elements read flatter and
  // darker than the glossy crate bodies — same dull dark-metal, but the user wants
  // the crate FRAMES to reflect like the panels they hold. Give ONLY the container
  // frame meshes a single shared gloss-boosted clone (rough↓, envI↑), leaving the
  // shared platform/stair metal untouched. Built lazily on first frame mesh.
  let frameGloss: THREE.MeshStandardMaterial | null = null;
  const isContainerFrame = (name: string) =>
    /^Cont_.*_corner_/.test(name) || /^Cont_.*_r\d/.test(name);

  root.traverse((o) => {
    const light = o as THREE.Light;
    if (light.isLight) { if (hideLights) light.visible = false; return; }
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Barrel bodies (Barrel_0..3, not the _lid/_ring children which share the
    // scene-wide SS_Hull_DarkMetal): (1) FrontSide — they're closed cylinders, no
    // need to render inner faces; (2) lift the dark AO wedges baked into their base
    // colour so they don't read as ugly triangular shadows. The lift cache keeps a
    // shared material's map processed once.
    if (/^Barrel_\d+$/.test(mesh.name)) {
      const bm = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mm of bm) {
        const m = mm as THREE.MeshStandardMaterial;
        m.side = THREE.FrontSide;
        if (m.map) {
          const lifted = liftTextureShadows(m.map);
          if (lifted) { m.map = lifted; m.needsUpdate = true; }
        }
      }
    }
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

    // Reassign container frame meshes to the glossier clone (post-validate so the
    // clone inherits the validated base values, then we sharpen its reflection).
    if (!Array.isArray(mesh.material) && isContainerFrame(mesh.name)) {
      const src = mesh.material as THREE.MeshStandardMaterial;
      if (src.isMeshStandardMaterial && src.name === "SS_Hull_DarkMetal") {
        if (!frameGloss) {
          frameGloss = src.clone();
          frameGloss.name = "SS_Hull_DarkMetal_CrateFrame";
          frameGloss.roughness = 0.28;       // sharper reflection than the 0.42 base
          frameGloss.envMapIntensity = 1.6;  // catch more of the env, like the bodies
          frameGloss.needsUpdate = true;
        }
        mesh.material = frameGloss;
      }
    }
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
  hangarLights: {
    name: string; type: string; color: string; intensity: number; distance: number;
    decay: number; pos: [number, number, number]; dir: [number, number, number] | null;
    visible: boolean; camDist: number;
  }[];
  combatLightsActive: number;
  postFx: { enabled: boolean; ssao: boolean; bloomStrength: number; bloomThreshold: number; bloomRadius: number; fxaa: boolean };
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
  private smoke: LandingSmoke | null = null;
  /** Guards the one-shot touchdown smoke burst during an intro. */
  private smokeFired = false;
  /** Handle for a running combat-demo interval, so it can be stopped. */
  private demoTimer = 0;

  // ── Post-processing ───────────────────────────────────────────────────────
  private composer: EffectComposer | null = null;
  private bloomComposer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private gtaoPass: GTAOPass | null = null;
  private fxaaPass: ShaderPass | null = null;
  // Selective emissive bloom is OFF by default. Even layer-isolated + at low
  // strength, on THIS deck — long emissive guide-strips + many bright fixture
  // highlights — the bloom smears into a scene-wide milky wash (verified by A/B).
  // Opt-in via ?bloom for A/B only.
  static bloomOn =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("bloom");
  // Real screen-space AO (GTAO / ground-truth ambient occlusion) — ON by default;
  // this replaces the old fake blob contact shadows. ?noao disables for A/B.
  static ssaoOn =
    typeof window === "undefined" ||
    !new URLSearchParams(window.location.search).has("noao");
  /** True when the composer is needed (AO and/or bloom). */
  static get postFx(): boolean {
    return HangarScene.ssaoOn || HangarScene.bloomOn;
  }

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

  /** Turntable pivot at the pad centre. The round platform meshes (+ the parked
   *  ship during the intro) are children, so rotating this spins them together. */
  private platformPivot: THREE.Group | null = null;
  /** Final platform yaw (radians) so the ship's nose ends toward the +Z exit. */
  private exitYaw = 0;

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
  // AgX (as in Blender). Exposure 1.05 (per spec): the local light rig — not a
  // raised exposure — carries the brightness. Do NOT push exposure up to
  // compensate for lamp reach; fix the rig instead.
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
    this.smoke = new LandingSmoke(this.scene);
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

    // — optional bloom-only composer (renders to its own target) —
    if (HangarScene.bloomOn) {
      const bloomComposer = new EffectComposer(this.renderer);
      bloomComposer.renderToScreen = false;
      bloomComposer.setPixelRatio(pr);
      bloomComposer.setSize(w, h);
      bloomComposer.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new UnrealBloomPass(size, 0.07, 0.2, 0.0);
      bloomComposer.addPass(bloom);
      this.bloomPass = bloom;
      this.bloomComposer = bloomComposer;
    }

    // — final composer: RenderPass → [GTAO] → [bloom mix] → OutputPass → FXAA —
    const finalComposer = new EffectComposer(this.renderer);
    finalComposer.setPixelRatio(pr);
    finalComposer.setSize(w, h);
    finalComposer.addPass(new RenderPass(this.scene, this.camera));

    // Real screen-space AO (GTAO). Darkens creases/contacts where geometry meets —
    // the ship on the deck, crates on the floor, ribs, stair base — replacing the
    // fake blob shadows. Radius/scale tuned for the ~10-unit room; soft, not heavy.
    if (HangarScene.ssaoOn) {
      const gtao = new GTAOPass(this.scene, this.camera, w, h);
      gtao.output = GTAOPass.OUTPUT.Default;
      // three 0.184 exposes updateGtaoMaterial({radius,scale,...}) + blendIntensity.
      const g = gtao as unknown as {
        blendIntensity: number;
        updateGtaoMaterial?: (o: Record<string, number>) => void;
      };
      g.blendIntensity = 1.0; // light-moderate — reads clearly in the container
                              //   seams/creases without darkening the whole room
      g.updateGtaoMaterial?.({
        radius: 0.5,          // small-ish radius → container seams, stair steps,
                              //   barrel rings get occluded, not big flat areas
        distanceExponent: 1,
        thickness: 1,
        scale: 1.1,          // occlusion strength
        distanceFallOff: 0.5,
      });
      finalComposer.addPass(gtao);
      this.gtaoPass = gtao;
    }

    if (HangarScene.bloomOn && this.bloomComposer) {
      const mixPass = new ShaderPass(
        new THREE.ShaderMaterial({
          uniforms: {
            baseTexture: { value: null },
            bloomTexture: { value: this.bloomComposer.renderTarget2.texture },
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
    }

    finalComposer.addPass(new OutputPass());

    const fxaa = new ShaderPass(FXAAShader);
    fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    finalComposer.addPass(fxaa);
    this.fxaaPass = fxaa;

    this.composer = finalComposer;
  }

  /** Render the post-FX chain. If bloom is on, render the bloom-only pass first. */
  private renderComposed(): void {
    if (!this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.bloomComposer) {
      // bloom: render emissive-only layer to the bloom target, then composite.
      this.camera.layers.set(BLOOM_LAYER);
      this.bloomComposer.render();
      this.camera.layers.enableAll();
    }
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
    scene.buildPlatformPivot(); // turntable pivot owning the round platform meshes
    scene.buildStripLights(); // local lights on the emissive deck strips
    scene.buildBounceLights(); // coloured bounce from crates/barrels (fake GI)
    // (fake blob contact shadows removed — real screen-space AO handles contact
    //  shading now, see the GTAO pass in the composer.)
    scene.parkShip(shipGLB.scene, shipClass);
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

    // ONE shadow-casting directional key so the ship, stairs + crates throw real
    // cast shadows on the deck (RectAreaLights can't cast shadows). The frustum is
    // widened to ±10 so it covers the WHOLE room (stairs + side containers were
    // outside the old ±5 box and cast nothing). Aimed from high front-right.
    const shadowKey = new THREE.DirectionalLight(0xdfe8ff, 1.2);
    shadowKey.position.set(3, 12, -2);
    shadowKey.target.position.set(0, 0, -1); // ~pad centre
    shadowKey.castShadow = true;
    shadowKey.shadow.mapSize.set(2048, 2048);
    const scam = shadowKey.shadow.camera;
    scam.left = -10; scam.right = 10; scam.top = 10; scam.bottom = -10;
    scam.near = 1; scam.far = 40;
    scam.updateProjectionMatrix();
    shadowKey.shadow.bias = -0.0004;
    shadowKey.shadow.normalBias = 0.04;
    this.scene.add(shadowKey);
    this.scene.add(shadowKey.target);
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

    // Rim light (spec #9): a weak COOL directional from above-right, no shadow,
    // just to catch edges — the stair steps, railings and upper platform read as
    // contours without a strong front light. Kept dim so it only rims.
    const rim = new THREE.DirectionalLight(0xbcd4ff, 0.6);
    rim.position.set(7, 8, -5); // above + right, from behind the props
    rim.target.position.copy(this.padWorld);
    rim.castShadow = false;
    this.scene.add(rim);
    this.scene.add(rim.target);
  }

  /**
   * Local lights on the emissive fixtures. Every Hall_Cyan / Hall_Amber mesh (deck
   * strips, platform ring, rails, wall Screens, ceiling Lamp panels, PadLights,
   * WallStripes) gets its own short-range shadowless coloured PointLight, so the
   * deck/wall/ship/crates actually catch cyan/amber light. A big flat RING mesh has
   * its bbox centre in the MIDDLE, so it's distributed around the perimeter.
   * (This is the "many small fixture lights" rig the user preferred — we refine it,
   * not replace it.)
   */
  private buildStripLights(): void {
    this.hangarRoot.updateWorldMatrix(true, true);
    const pad = this.padWorld;
    const tmp = new THREE.Box3();
    // Per-fixture light COLOUR must match the visible lamp's emissive (spec #13).
    // The GLB has exactly two emitters: Hall_Cyan (cyan 0.1,0.7,1.0) and Hall_Amber
    // (orange 1.0,0.6,0.2). We sub-tag by mesh ROLE for the calibrated hues but the
    // family colour always tracks the emissive — a cyan strip never emits orange.
    const cyan: THREE.Vector3[] = [];       // deck strips, rails, DeckMarks
    const cyanRing: THREE.Vector3[] = [];   // PlatformRing perimeter
    const cyanPanel: THREE.Vector3[] = [];  // rear-wall Screens + ceiling Lamp panels
    const amber: THREE.Vector3[] = [];      // pad lights, tank valves
    const wallStripeMeshes: { c: THREE.Vector3; size: THREE.Vector3 }[] = []; // long side-wall bars → RectAreaLights

    this.hangarRoot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const nm = ((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material)?.name ?? "";
      const isCyan = /Hall_Cyan/.test(nm);
      const isAmber = /Hall_Amber/.test(nm);
      if (!isCyan && !isAmber) return;
      tmp.setFromObject(mesh);
      const c = tmp.getCenter(new THREE.Vector3());
      const size = tmp.getSize(new THREE.Vector3());
      const n = mesh.name;
      if (isCyan) {
        if (/PlatformRing/.test(n) || (Math.max(size.x, size.z) > 4 && size.y < 1)) {
          // distribute AROUND the ring perimeter (bbox centre is in the middle)
          const rx = size.x * 0.42, rz = size.z * 0.42, N = 12;
          for (let i = 0; i < N; i++) {
            const a = (i / N) * Math.PI * 2;
            cyanRing.push(new THREE.Vector3(c.x + Math.cos(a) * rx, c.y, c.z + Math.sin(a) * rz));
          }
        } else if (/Screen_|Lamp\d+_panel/.test(n)) cyanPanel.push(c);
        else cyan.push(c);
      } else {
        if (/WallStripe/.test(n)) {
          // A WallStripe is one long emissive bar (≈14u) on a side wall. It should
          // light as a WHOLE STRIP, not a row of point-dots — so it becomes ONE
          // RectAreaLight spanning its full length, facing into the room. The
          // containers then catch + bounce the warm light across their faces the
          // way the blue wall lamps do. (RectAreaLights are collected + built after
          // the traverse, since they need RectAreaLightUniformsLib.init().)
          wallStripeMeshes.push({ c, size });
        } else amber.push(c);
      }
    });

    const addLights = (
      pts: THREE.Vector3[], hex: number, intensity: number, range: number, lift = 0.15,
    ) => {
      for (const p of pts) {
        const l = new THREE.PointLight(hex, intensity, range, 2.0);
        l.position.copy(p);
        l.position.y += lift;
        l.castShadow = false;
        l.name = "strip";
        this.scene.add(l);
      }
    };

    // Colours calibrated to the emissive per spec #13:
    //   cyan strips/rails → cool cyan; ring → same but softer+wider; panels →
    //   cool-white-cyan. amber pad/valves → yellow-amber; wall stripes → orange.
    // The FLOOR-level lights are lifted ~0.65 off the deck so their reflection on
    // the glossy floor spreads into a soft wash instead of a sharp mirror-dot (the
    // bright blue/white specks the user wanted gone) — they still light the deck.
    addLights(cyan, 0xbfefff, 1.8, 4.5, 0.65);           // FloorMarker cyan
    // Platform ring: brighter + longer range so it actually throws cyan onto the
    // ship + crates around the pad (before it was too dim/short to reach them).
    addLights(cyanRing, 0xc8f7ff, 3.6, 10, 0.7);
    addLights(cyanPanel, 0xd8f8ff, 2.4, 6.5, 0.0);       // rear panels / ceiling lamps (cool white)
    addLights(amber, 0xffcc66, 1.6, 4.5, 0.65);          // pad lights / valves (yellow-amber)
    // side wall stripes (orange) — ONE RectAreaLight per bar, spanning its full
    // length + facing into the room, so the whole strip lights as a surface (not
    // point-dots) and the containers catch + bounce it like the blue wall lamps.
    RectAreaLightUniformsLib.init();
    for (const w of wallStripeMeshes) {
      const len = Math.max(w.size.x, w.size.z);
      const ra = new THREE.RectAreaLight(0xffb05e, 6, len, 0.6);
      const inboardX = Math.sign(pad.x - w.c.x) || 0;
      ra.position.set(w.c.x + inboardX * 0.15, w.c.y, w.c.z);
      ra.lookAt(pad.x, w.c.y, w.c.z); // face into the room toward the containers
      ra.name = "wallStripeArea";
      this.scene.add(ra);
    }

    // ── Platform FILL: one big, very weak light above the pad to bind the ring
    // pools into connected illumination (NOT a global ambient — a positioned,
    // decaying point light). Cyan-white to match the ring. ──
    const fill = new THREE.PointLight(0xa9eaff, 6, 16, 2.0);
    fill.position.set(pad.x, pad.y + 4.5, pad.z);
    fill.castShadow = false;
    fill.name = "strip";
    this.scene.add(fill);

    // ── Ring THROW toward the crate clusters: the perimeter ring lights (decay 2)
    // die within ~2m and never reach the containers ~5-6m out, so the crates never
    // catch the ring's cyan. Add a few wider, slower-decaying cyan lights on the
    // ring's outer edge, lifted and pushed toward each crate cluster, so the cyan
    // actually carries across the gap and washes the container faces. Sampled from
    // the crate centres so it tracks the model, not hardcoded. ──
    const crateCentres: THREE.Vector3[] = [];
    this.hangarRoot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && /^Cont_[A-F]$/.test(mesh.name)) {
        tmp.setFromObject(mesh);
        crateCentres.push(tmp.getCenter(new THREE.Vector3()));
      }
    });
    for (const cc of crateCentres) {
      // Position the throw light on the ring edge, on the line pad→crate, lifted to
      // the crate's mid-height so it rakes the vertical faces. decay 1.4 + range 16
      // so it carries the ~5m to the crate without blowing out the pad.
      const dir = new THREE.Vector3(cc.x - pad.x, 0, cc.z - pad.z);
      const gap = dir.length() || 1;
      dir.normalize();
      const l = new THREE.PointLight(0xbfeeff, 3.2, 16, 1.4);
      l.position.set(
        pad.x + dir.x * Math.min(3.6, gap * 0.55),
        cc.y + 0.3,
        pad.z + dir.z * Math.min(3.6, gap * 0.55),
      );
      l.castShadow = false;
      l.name = "ringThrow";
      this.scene.add(l);
    }

    // ── Under-platform cyan glow (spec #7): weak cyan lights just below the ring
    // so the deck underside + adjacent structures catch cyan, as in the reference. ──
    this.hangarRoot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!/PlatformRing/.test(mesh.name)) return;
      tmp.setFromObject(mesh);
      const c = tmp.getCenter(new THREE.Vector3());
      const s = tmp.getSize(new THREE.Vector3());
      const rx = s.x * 0.4, rz = s.z * 0.4, N = 6;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + 0.5;
        const u = new THREE.PointLight(0xbfefff, 2.2, 5.0, 2.0);
        u.position.set(c.x + Math.cos(a) * rx, c.y - 0.35, c.z + Math.sin(a) * rz);
        u.castShadow = false;
        u.name = "strip";
        this.scene.add(u);
      }
    });

    // ── Rear-wall panels: RectAreaLights in FRONT of the cool-cyan Screen panels,
    // aimed at the platform, so the rear wall (structure + pipes) reads without hard
    // hotspots (spec #2). Broad + soft. Grouped in pairs to keep the count sane. ──
    RectAreaLightUniformsLib.init();
    const screens: THREE.Vector3[] = [];
    this.hangarRoot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && /Screen_/.test(mesh.name)) {
        tmp.setFromObject(mesh);
        screens.push(tmp.getCenter(new THREE.Vector3()));
      }
    });
    for (let i = 0; i < screens.length; i += 2) {
      const a = screens[i];
      const b = screens[i + 1] ?? a;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, cz = (a.z + b.z) / 2;
      const toward = Math.sign(pad.z - cz) || -1; // toward the pad
      const ra = new THREE.RectAreaLight(0xd8f8ff, 6, 3.0, 0.8);
      ra.position.set(cx, cy, cz + toward * 0.5); // just in front of the panels
      ra.lookAt(pad.x, cy, pad.z);                 // aim into the room, never at the wall
      ra.name = "wallArea";
      this.scene.add(ra);
    }
  }

  /**
   * Container bounce fill (spec #1/#8): the crates don't self-illuminate, but their
   * colour should bleed dezent onto the deck + surroundings the way Cycles GI does.
   * Grouped by colour FAMILY (so it reads as soft ambient bleed, not per-crate
   * lamps): each family gets one very-low-intensity, LARGE-range, shadowless fill at
   * the group's front-lower position. Colours per spec, tinted to the family.
   */
  private buildBounceLights(): void {
    this.hangarRoot.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    const pad = this.padWorld;
    // spec colours: blue / orange(+rust) / green. Low intensity, big radius.
    const groups: Record<string, { pts: THREE.Vector3[]; hex: number; intensity: number; distance: number }> = {
      blue: { pts: [], hex: 0x3d78b8, intensity: 3.0, distance: 8 },
      orange: { pts: [], hex: 0xc46d2e, intensity: 3.0, distance: 8 },
      green: { pts: [], hex: 0x4f8b68, intensity: 2.2, distance: 7 },
    };
    this.hangarRoot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const nm = ((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material)?.name ?? "";
      // Rust reads as warm/orange; Mil barrel stays neutral (skip).
      const key = /Blue/.test(nm) ? "blue"
        : /Orange|Rust/.test(nm) ? "orange"
        : /Green/.test(nm) ? "green" : null;
      if (!key) return;
      box.setFromObject(mesh);
      groups[key].pts.push(box.getCenter(new THREE.Vector3()).setY(box.min.y));
    });
    for (const g of Object.values(groups)) {
      if (!g.pts.length) continue;
      const cx = g.pts.reduce((s, v) => s + v.x, 0) / g.pts.length;
      const cy = g.pts.reduce((s, v) => s + v.y, 0) / g.pts.length;
      const cz = g.pts.reduce((s, v) => s + v.z, 0) / g.pts.length;
      const towardX = Math.sign(pad.x - cx) || 0;
      const towardZ = Math.sign(pad.z - cz) || 0;
      const l = new THREE.PointLight(g.hex, g.intensity, g.distance, 2.0);
      // in front of + a touch below the faces so it bleeds onto the deck, not inside
      l.position.set(cx + towardX * 1.0, cy + 0.5, cz + towardZ * 1.0);
      l.castShadow = false;
      l.name = "bounce";
      this.scene.add(l);
    }
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
    // Raised + to the right for an overview angle looking down into the ring.
    // Pulled further back + up (out toward the -Z mouth) so more of the hangar is
    // in frame — the parked/establishing shot shows the full room, not just the pad.
    this.camPos.copy(this.padWorld).add(new THREE.Vector3(2.5, 4.2, -11.5));
    this.camTarget.copy(this.padWorld).add(new THREE.Vector3(-0.5, 1.0, 3));
  }

  /**
   * Build the turntable: a Group pivot at the pad centre that owns the round
   * platform meshes (LandingPlatform, PlatformRing, DeckMark_*). Rotating the pivot
   * spins the whole platform; during the intro the ship is parented in too so the
   * platform carries it round like a real turntable. Meshes are reparented with
   * their world transform preserved (attach()), so nothing visibly moves at build.
   */
  private buildPlatformPivot(): void {
    const pivot = new THREE.Group();
    pivot.name = "PlatformPivot";
    pivot.position.copy(this.padWorld);
    this.scene.add(pivot);
    const names = /^(LandingPlatform|PlatformRing|DeckMark_)/;
    const movers: THREE.Object3D[] = [];
    this.hangarRoot.traverse((o) => {
      if (o !== this.hangarRoot && names.test(o.name)) movers.push(o);
    });
    for (const m of movers) pivot.attach(m); // attach() keeps world transform
    this.platformPivot = pivot;
  }

  private parkShip(shipTemplate: THREE.Group, shipClass = "skimmer"): void {
    const ship = shipTemplate.clone(true);
    validateModel(ship, "ship");
    const box = new THREE.Box3().setFromObject(ship);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Normalise by the HORIZONTAL footprint (max of length/width), NOT maxDim: a
    // tall dorsal fin/antenna would otherwise inflate maxDim and shrink the ship's
    // apparent size, which is why the Skimmer looked bigger than the Apex. Then
    // scale to the per-class target span so class sizes are consistent + ordered
    // (Skimmer < Apex < Leviathan …).
    const footprint = Math.max(size.x, size.z) || 1;
    const scale = hangarSpan(shipClass) / footprint;
    ship.scale.setScalar(scale);
    ship.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });
    this.shipRecenter.copy(center).multiplyScalar(-scale);
    this.shipLift = (size.y * scale) / 2 + 0.05;
    // Orientation model (verified in-scene): the model's nose is its +X axis, which
    // maps to world +Z at ship yaw -π/2, and to world -Z at yaw +π/2.
    // Intro choreography: the ship flies in NOSE-FIRST toward the -Z wall, lands,
    // then the platform spins EXACTLY 180° so the nose ends toward the +Z exit.
    // (Flipped 180° from the first pass — the ships were flying in backwards.)
    // The PARKED (settled) orientation is therefore nose +Z.
    this.exitYaw = -Math.PI / 2; // settled: nose toward the +Z exit
    ship.rotation.y = this.exitYaw;
    this.ship = ship;
    this.parkAt(this.padWorld);
    this.scene.add(ship);
    // (No fake contact-shadow blob — real screen-space AO grounds the ship now.)
    this.addShipFill();
  }

  /**
   * Dedicated soft fill on the parked ship so it catches more light than the room
   * rig alone gives it (the ship sits low in the pad well, shadowed from the wall
   * fixtures). Two shadowless point lights keyed to the ship's own position: a cool
   * key from front-above-left and a warm-neutral fill from the right, both
   * short-range so they touch the ship + pad but don't wash the whole hangar.
   */
  private addShipFill(): void {
    if (!this.ship) return;
    const box = new THREE.Box3().setFromObject(this.ship);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z) || 2;

    const key = new THREE.PointLight(0xdfe8ff, 5.0, span * 5, 2.0); // cool key
    key.position.set(c.x - span * 0.7, c.y + span * 1.4, c.z - span * 0.9);
    key.castShadow = false;
    key.name = "shipFill";
    this.scene.add(key);

    const fill = new THREE.PointLight(0xfff0dc, 3.0, span * 5, 2.0); // warm fill
    fill.position.set(c.x + span * 1.0, c.y + span * 0.8, c.z + span * 0.6);
    fill.castShadow = false;
    fill.name = "shipFill";
    this.scene.add(fill);
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
      if (a.t >= 1) {
        // Intro ends with the pivot at yaw 0; hand the ship back to the scene so
        // parkAt/outro keep working in world space, and snap to the clean park pose.
        if (a.kind === "intro") this.finishIntro();
        const r = a.resolve; this.anim = null; r();
      }
    }
    this.combat?.update(dt);
    this.smoke?.update(dt);
  }

  // ── Framing + cinematics ─────────────────────────────────────────────────

  /** Point the camera into the hangar from the resolved framing pose. */
  private frameParked(): void {
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  /** Static parked framing. */
  showParked(): void {
    this.finishIntro(); // ensure the ship is scene-owned, not left in the pivot
    this.parkAt(this.padWorld);
    this.frameParked();
  }

  /**
   * Return the ship from the turntable pivot to the scene and snap it to the clean
   * parked pose (nose +Z). Idempotent — safe to call when already scene-owned.
   */
  private finishIntro(): void {
    if (!this.ship) return;
    if (this.platformPivot) this.platformPivot.rotation.y = 0;
    if (this.ship.parent && this.ship.parent !== this.scene) {
      this.scene.attach(this.ship); // back to world space
    }
    this.ship.rotation.set(0, this.exitYaw, 0);
    this.parkAt(this.padWorld);
  }

  /** The ship's entry point: out toward the hangar mouth (-z), at hover height, so
   *  it glides straight in over the deck (not a steep descent). */
  private mouthPoint(): THREE.Vector3 {
    return this.padWorld.clone().add(new THREE.Vector3(0, 1.2, -9.5));
  }

  /** Turntable sweep for the intro: EXACTLY 180°. The ship lands nose-first at the
   *  +Z wall (pivot yaw π), then the platform spins to yaw 0 so the nose ends
   *  toward the -Z exit. */
  private static readonly TURN = Math.PI;

  playIntro(): Promise<void> {
    if (!this.ship || !this.platformPivot) return Promise.resolve();
    // Start the turntable at π so the ship lands NOSE-FIRST toward the +Z wall; the
    // settle beat then spins it exactly 180° (π→0) so the nose ends toward the -Z
    // exit. Parent the ship into the pivot and set its LOCAL yaw so that at pivot=π
    // its world yaw is -π/2 (nose +Z); after the 180° turn the world yaw is +π/2
    // (nose -Z) = the settled park orientation.
    this.platformPivot.rotation.y = HangarScene.TURN;
    this.platformPivot.add(this.ship);
    // Local yaw = exitYaw; combined with the pivot's π start it gives the entry
    // facing, and after the 180° turn (pivot→0) the ship settles at exitYaw.
    this.ship.rotation.set(0, this.exitYaw, 0);
    this.smokeFired = false; // arm the one-shot touchdown smoke
    return new Promise<void>((resolve) => {
      this.anim = { t: 0, dur: 3.2, kind: "intro", resolve };
    });
  }

  playOutro(): Promise<void> {
    if (!this.ship) return Promise.resolve();
    this.smokeFired = false; // arm the one-shot lift-off smoke
    return new Promise<void>((resolve) => {
      this.anim = { t: 0, dur: 2.2, kind: "outro", resolve };
    });
  }

  /**
   * Fly-in: (1) t 0→0.7 straight nose-first glide from the -Z mouth to the pad,
   * chase-cam flying in behind the ship with the full hangar ahead; (2) touchdown
   * as it reaches the pad; (3) t 0.7→1 the platform + ship turntable-rotate exactly
   * 180° (pivot yaw π→0) so the nose ends toward the -Z exit, camera easing to a
   * wide establishing shot so the whole rotation reads.
   */
  private applyIntro(t: number): void {
    if (!this.ship || !this.platformPivot) return;
    const pad = this.padWorld;

    // ── Ship glide (beat 1-2): straight from the mouth to the rest pose on the pad.
    // The ship is a pivot child, so convert the desired WORLD point into pivot-local
    // (the pivot is rotated 180° during the glide). ──
    const glide = smoothstep(Math.min(1, t / 0.7)); // reaches pad by t=0.7
    const restWorld = pad.clone(); restWorld.y += this.shipLift; // rest height
    const worldPos = this.mouthPoint().lerp(restWorld, glide);
    this.platformPivot.updateWorldMatrix(true, false);
    const local = this.platformPivot.worldToLocal(worldPos.clone());
    // keep the recenter offset (baked so bbox centre sits on the point)
    this.ship.position.copy(this.shipRecenter).add(local);

    // ── Touchdown smoke: one soft burst under the ship as it sets down (~t 0.62,
    // just before the glide fully settles) so the thrusters kick up smoke on the
    // pad. Ring radius + strength scale with the ship's footprint (bigger ship →
    // more smoke). ──
    if (!this.smokeFired && t >= 0.62 && this.smoke) {
      this.smokeFired = true;
      const foot = Math.max(this.shipLift * 2, 1.2);
      this.smoke.burst(
        new THREE.Vector3(pad.x, pad.y + 0.02, pad.z),
        1.0 + foot * 0.6,
        0.9 + foot * 0.5,
      );
    }

    // ── Turntable (beat 3): pivot yaw eases exactly 180° (π → 0). ──
    const turn = smoothstep(Math.max(0, (t - 0.7) / 0.3));
    this.platformPivot.rotation.y = HangarScene.TURN * (1 - turn);

    // ── Camera: chase-cam behind the ship (-Z, low) during the glide, easing to
    // the wide establishing pose during the turn so the full hangar + rotation
    // are visible. ──
    const camBeat = smoothstep(t);
    const chase = pad.clone().add(new THREE.Vector3(0, 2.2, -11)); // behind + low
    const wide = this.camPos;                                       // parked overview
    this.camera.position.copy(chase.lerp(wide, camBeat));
    const look = pad.clone().add(new THREE.Vector3(0, 1.0, 2)); // into the hangar
    this.camera.lookAt(look);
  }

  private applyOutro(t: number): void {
    if (!this.ship) return;
    const pad = this.padWorld;
    // Lift-off smoke: one burst on the pad as the thrusters spool up at the very
    // start of departure, before the ship clears the deck. Scaled by ship size.
    if (!this.smokeFired && t >= 0.02 && this.smoke) {
      this.smokeFired = true;
      const foot = Math.max(this.shipLift * 2, 1.2);
      this.smoke.burst(
        new THREE.Vector3(pad.x, pad.y + 0.02, pad.z),
        1.0 + foot * 0.6,
        0.9 + foot * 0.5,
      );
    }
    const e = smoothstep(t);
    const from = pad;
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
    const hangarLights: HangarDebugInfo["hangarLights"] = [];
    const camPos = this.camera.position;
    const RIG_NAMES = /^(strip|bounce)$/;
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
        // Per-light detail for the RIG lights (spec debug list).
        if (RIG_NAMES.test(l.name) && hangarLights.length < 40) {
          const pl = l as THREE.PointLight;
          const dir3 = (l as THREE.SpotLight).target
            ? (l as THREE.SpotLight).target.position.clone().sub(l.position).normalize()
            : null;
          hangarLights.push({
            name: l.name, type: l.type,
            color: "#" + (l.color?.getHexString?.() ?? "ffffff"),
            intensity: +(l.intensity ?? 0).toFixed(1),
            distance: +((pl.distance ?? 0)).toFixed(1),
            decay: +((pl.decay ?? 0)).toFixed(1),
            pos: [+l.position.x.toFixed(1), +l.position.y.toFixed(1), +l.position.z.toFixed(1)],
            dir: dir3 ? [+dir3.x.toFixed(2), +dir3.y.toFixed(2), +dir3.z.toFixed(2)] : null,
            visible: l.visible,
            camDist: +l.position.distanceTo(camPos).toFixed(1),
          });
        }
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
      hangarLights,
      combatLightsActive: this.combat?.activeCount ?? 0,
      postFx: {
        enabled: HangarScene.postFx && !!this.composer,
        ssao: !!this.gtaoPass,
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
    this.smoke?.dispose();
    this.smoke = null;
    this.composer?.dispose();
    this.bloomComposer?.dispose();
    this.gtaoPass?.dispose?.();
    this.composer = null;
    this.bloomComposer = null;
    this.bloomPass = null;
    this.gtaoPass = null;
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
