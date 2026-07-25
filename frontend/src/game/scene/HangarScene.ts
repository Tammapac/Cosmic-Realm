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

/**
 * Tame the raw hangar-interior GLB so it does not blow out. Two Blender-export
 * quirks bite here:
 *   • Floor/platform materials are pure-white metallic (colour [1,1,1], metal
 *     ≥0.9), which under any real light clips to white. Pull them to a mid grey
 *     with lower metalness so they read as a deck.
 *   • The cyan deck-guide strips carry emissive strength 8 — a floodlight, not a
 *     line. Cap it so they glow as thin markings.
 * Its imported Spot/Point lights come in at Blender's watt-scale intensity
 * (~21740!), which floods the whole bay — clamp any GLB light to something sane.
 */
function tameHangar(root: THREE.Object3D): void {
  root.traverse((o) => {
    const light = o as THREE.Light;
    if (light.isLight) {
      // Any light that survived the export is watt-scaled; clamp hard.
      if ((light as THREE.SpotLight).isSpotLight) light.intensity = 3;
      else if ((light as THREE.PointLight).isPointLight) light.intensity = Math.min(light.intensity, 2);
      else light.intensity = Math.min(light.intensity, 3);
      return;
    }
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mm of mats) {
      const m = mm as THREE.MeshStandardMaterial;
      if (!m.color) continue;
      const emSum = m.emissive ? m.emissive.r + m.emissive.g + m.emissive.b : 0;
      // Bright coloured glow strips → cap to a line, not a floodlight.
      if (emSum > 0.3 && (m.emissiveIntensity ?? 0) > 1.5) m.emissiveIntensity = 1.4;
      // Pure-white metallic floor/platform → mid grey deck.
      const lum = m.color.r * 0.299 + m.color.g * 0.587 + m.color.b * 0.114;
      if (lum > 0.85 && (m.metalness ?? 0) > 0.5) {
        m.color.setScalar(0.35);
        m.metalness = 0.4;
        m.roughness = 0.7;
      }
      m.needsUpdate = true;
    }
  });
}

/**
 * Tame a raw player-ship GLB clone. The ship models plug their albedo into the
 * emissive slot (same bug the ship layer fixes with applySpaceMaterial), so
 * without this the parked ship is a self-lit white blob. Kill the emissive and
 * give the hull sane PBR values; the ship's own texture map carries its colours.
 */
function tameShip(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mm of mats) {
      const m = mm as THREE.MeshStandardMaterial;
      if (m.emissive) { m.emissive.setScalar(0); m.emissiveIntensity = 0; m.emissiveMap = null; }
      m.metalness = 0.55;
      m.roughness = 0.55;
      m.needsUpdate = true;
    }
  });
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

  private constructor(canvas: HTMLCanvasElement, hangarRoot: THREE.Group) {
    this.canvas = canvas;
    this.hangarRoot = hangarRoot;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x05070d, 1); // opaque near-black behind the room
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
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
    tameHangar(hangarRoot);
    const canvas = document.createElement("canvas");
    const scene = new HangarScene(canvas, hangarRoot);
    scene.resolveNodes();
    scene.parkShip(shipGLB.scene);
    return scene;
  }

  private buildLights(): void {
    // The exported GLB drops Blender's AREA lamps (glTF has no area lights), so
    // this is the room's working rig. Warm key + cool fill + a soft ambient,
    // tuned brighter than the space scene because a hangar interior is lit.
    this.scene.add(new THREE.AmbientLight(0x3a4258, 0.35));
    const key = new THREE.DirectionalLight(0xfff2e0, 1.3);
    key.position.set(3, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x6f9be0, 0.5);
    fill.position.set(-6, 4, -3);
    this.scene.add(fill);
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
    tameShip(ship);
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
    this.renderer.dispose();
    this.canvas.remove();
  }
}

/** The single hangar scene while docked, or null. */
export let activeHangarScene: HangarScene | null = null;
export function setActiveHangarScene(s: HangarScene | null): void {
  activeHangarScene = s;
}
