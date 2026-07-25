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

/** Clamped smoothstep — zero slope at both ends, matching DockingCameraController. */
function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

// The hangar interior — a modeled room, its own GLB (from Blender HangarHall).
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
  m.needsUpdate = true;
  return {
    name: m.name || "(unnamed)", type: m.type,
    metal: +(m.metalness ?? 0).toFixed(2), rough: +(m.roughness ?? 0).toFixed(2),
    maps, missing, emissiveFixed,
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
    for (const mm of mats) {
      const m = mm as THREE.Material;
      if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        stats.push(validateMaterial(m as THREE.MeshStandardMaterial));
      }
    }
  });
  const fixed = stats.filter((s) => s.emissiveFixed).length;
  const noBase = stats.filter((s) => s.missing.includes("base")).length;
  console.log(
    `[HangarScene] validate "${label}": ${stats.length} MeshStandard mats · ` +
    `${fixed} broken-emissive fixed · ${noBase} without base map`,
  );
  if ((window as unknown as { __PBR_DEBUG?: boolean }).__PBR_DEBUG) {
    console.table(stats.map((s) => ({ ...s, maps: s.maps.join("+"), missing: s.missing.join("+") })));
  }
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
  static envKind: EnvKind = "studio";
  static envIntensity = 1.0;

  // ── Tone-mapping A/B config (Phase D) ─────────────────────────────────────
  // Blender 4.x's Material Preview uses the AgX view transform, so AgX is the
  // strongest candidate for matching it; ACESFilmic (the old default) and
  // Khronos Neutral are the alternatives. Static so the harness can compare.
  static toneMapping: THREE.ToneMapping = THREE.AgXToneMapping;
  // AgX renders midtones darker than ACES by design, so it needs a hair more
  // exposure to sit at Blender Material Preview's default brightness. 1.35 was
  // dialled in against the reference viewport (Phase D A/B).
  static toneExposure = 1.35;
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
    window.addEventListener("resize", this.onResize);
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
    scene.parkShip(shipGLB.scene);
    return scene;
  }

  private buildLights(): void {
    // Studio-lighting rig (Phase E), modelled on how Blender's Material Preview
    // lights a subject: a directional Key/Fill/Rim trio plus a Hemisphere "sky".
    //
    // NO flat AmbientLight. A large ambient lights every surface equally
    // regardless of its normal, which FLATTENS materials — the exact opposite of
    // the shaped, normal-aware look we want. The soft ambient fill instead comes
    // from (a) the studio IBL already installed in the constructor and (b) the
    // HemisphereLight below, both of which vary with surface orientation.

    // KEY — warm, strong, shadow-casting. The dominant light, high and to the
    // front-right, like the main softbox in the preview.
    const key = new THREE.DirectionalLight(0xfff2e0, 2.6);
    key.position.set(3, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.02; // kills shadow acne on the low-poly deck
    this.scene.add(key);
    this.keyLight = key;

    // FILL — cool, soft, opposite side. Lifts the shadow side without erasing it.
    const fill = new THREE.DirectionalLight(0x6f9be0, 0.9);
    fill.position.set(-6, 4, -3);
    this.scene.add(fill);

    // RIM / BACK — cool edge light from behind, separates the ship from the deck.
    const rim = new THREE.DirectionalLight(0x9ec2ff, 0.7);
    rim.position.set(0, 3, -8);
    this.scene.add(rim);

    // SKY — Hemisphere: cool sky from above, warm deck bounce from below. This is
    // the normal-aware replacement for the old flat ambient; it reads as soft
    // environmental fill without flattening the surface.
    const sky = new THREE.HemisphereLight(0xaec6ff, 0x2a2620, 0.55);
    this.scene.add(sky);
  }

  /** Resolve the landing platform + authored camera pose from the model. */
  private resolveNodes(): void {
    this.hangarRoot.updateWorldMatrix(true, true);
    const padNode = findNode(this.hangarRoot, PAD_NODE) ?? findNode(this.hangarRoot, "Hall_Floor");
    if (padNode) {
      padNode.updateWorldMatrix(true, false);
      this.padWorld.setFromMatrixPosition(padNode.matrixWorld);
    }
    // Authored camera: use its world position + the point it looks at.
    const camNode = findNode(this.hangarRoot, CAM_NODE);
    if (camNode) {
      camNode.updateWorldMatrix(true, false);
      this.camPos.setFromMatrixPosition(camNode.matrixWorld);
      // A glTF camera looks down its local -Z. Derive the target from that.
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(
        new THREE.Quaternion().setFromRotationMatrix(camNode.matrixWorld),
      );
      this.camTarget.copy(this.camPos).add(fwd.multiplyScalar(6));
    } else {
      // Fallback framing: above and in front of the pad.
      this.camPos.copy(this.padWorld).add(new THREE.Vector3(-2.8, 2.6, 5.5));
      this.camTarget.copy(this.padWorld);
    }
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
      this.renderer.render(this.scene, this.camera);
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
  }

  // ── Framing + cinematics ─────────────────────────────────────────────────

  /** Point the camera at the parked ship from the authored HallCam pose. */
  private frameParked(): void {
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.padWorld);
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
  }

  dispose(): void {
    this.stopLoop();
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
