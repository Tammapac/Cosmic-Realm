// ─────────────────────────────────────────────────────────────────────────────
// three-world-layer.ts — the ONE Three.js scene the 3D world is drawn in.
//
// Before this file existed the world was drawn by three independent
// WebGLRenderers (stations / enemies / players), each with its own Scene,
// its own OrthographicCamera and — the part that mattered — its own depth
// buffer. Depth buffers are per-framebuffer, so no amount of renderOrder or
// layer juggling could make a station occlude a ship: they were never compared.
// What looked like layering was just the order the three canvases were pasted
// on top of each other by Pixi.
//
// This module owns the single renderer, scene, camera and light rig, plus the
// four groups everything hangs off:
//
//     worldScene
//     ├── stationsGroup
//     ├── playerShipsGroup
//     ├── enemyShipsGroup
//     └── npcGroup
//
// All four are drawn in the same renderer.render(scene, camera) call. There is
// no clearDepth() between them and no renderOrder forcing one in front of
// another — occlusion is decided by real geometry. The only extra passes that
// remain are the ones the design explicitly keeps separate: the selection
// outline (a UI affordance) and the additive glow/thruster FX on FX_LAYER,
// both of which run AFTER the shared pass and neither of which clears depth.
//
// It deliberately owns nothing else. The ship layer keeps its post chain, the
// station layer keeps its door logic; both simply attach into the groups here.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from "three";
import { getRendererSettings } from "./RendererSettings";
import { loadEnvironment } from "./three-environment";
import { setMaterialAnisotropyMax } from "./space-material";
import { perfRegisterThree } from "./perf";
import { PIXELATE_3D, PIXELATE_3D_SCALE, SHARED_3D_SHIP_LIFT } from "./renderer-config";

const PIX_SCALE = PIXELATE_3D ? Math.max(1, PIXELATE_3D_SCALE) : 1;

/** The four groups of the target structure. Named so they show up in devtools. */
export const stationsGroup = new THREE.Group();
export const playerShipsGroup = new THREE.Group();
export const enemyShipsGroup = new THREE.Group();
export const npcGroup = new THREE.Group();
stationsGroup.name = "stationsGroup";
playerShipsGroup.name = "playerShipsGroup";
enemyShipsGroup.name = "enemyShipsGroup";
npcGroup.name = "npcGroup";

export interface WorldLayer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  canvas: HTMLCanvasElement;
}

let world: WorldLayer | null = null;
let sun: THREE.DirectionalLight | null = null;

/**
 * Who owns the render call this frame.
 *
 * Both the ship layer and the station layer used to end their frame with their
 * own renderer.render(). Now there is one scene, so exactly one of them may
 * drive it — otherwise the scene is drawn twice per frame, which doubles the
 * cost and makes the additive FX pass composite twice. The ship layer claims it
 * in the game; the station layer claims it in the isolated ?station-test
 * harness, where the ship layer never boots.
 */
let driver: "ships" | "stations" | null = null;

export function claimWorldRenderDriver(who: "ships" | "stations"): boolean {
  if (driver === null) driver = who;
  return driver === who;
}

export function isWorldRenderDriver(who: "ships" | "stations"): boolean {
  return driver === who;
}

/**
 * Create (or return) the shared renderer/scene/camera.
 *
 * Idempotent and order-independent on purpose: initPixiRenderer boots the
 * station layer before App.tsx gets anywhere near the ship layer, and the
 * ?station-test harness boots neither in the usual order. Whoever arrives first
 * supplies the canvas.
 */
export function ensureWorldLayer(
  canvas?: HTMLCanvasElement,
  width?: number,
  height?: number,
): WorldLayer {
  if (world) return world;

  const cvs = canvas ?? document.createElement("canvas");
  const w = width ?? (cvs.clientWidth || window.innerWidth);
  const h = height ?? (cvs.clientHeight || window.innerHeight);
  if (!cvs.width) cvs.width = w;
  if (!cvs.height) cvs.height = h;

  const renderer = new THREE.WebGLRenderer({
    canvas: cvs,
    alpha: true,
    antialias: PIX_SCALE === 1,
    premultipliedAlpha: false,
  });
  if (PIX_SCALE > 1) {
    renderer.setPixelRatio(1);
    renderer.setSize(Math.ceil(w / PIX_SCALE), Math.ceil(h / PIX_SCALE), false);
    cvs.style.imageRendering = "pixelated";
  } else {
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const rs = getRendererSettings();
  (renderer as any).useLegacyLights = false;
  setMaterialAnisotropyMax(renderer.capabilities.getMaxAnisotropy());
  perfRegisterThree(cvs.dataset?.perfName ?? "3d-world", renderer.info);
  renderer.shadowMap.enabled = rs.shadowsEnabled;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = rs.toneMappingExposure;

  const scene = new THREE.Scene();
  loadEnvironment(renderer, scene);

  // Camera geometry comes from the STATION layer, not the ship layer: it has to
  // sit above the tallest station (y ≈ 1400 · zoom, and up to 3750 once ships
  // are lifted at max zoom) or the near plane slices models open and hulls read
  // as hollow. Orthographic, so height changes nothing but the clip range, and
  // ortho depth is linear — a 0.1…20000 range costs no precision the way it
  // would under a perspective camera.
  const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 20000);
  camera.position.set(0, 8000, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, -1);

  // ── Light rig ──────────────────────────────────────────────────────────
  // One scene means one rig. These are the SHIP layer's values, because ships
  // are what the eye tracks and what the material work was tuned against; the
  // station layer's own rig was a slightly cooler, dimmer variant of the same
  // three lights, so stations shift a touch warmer and brighter than they were.
  const ambient = new THREE.AmbientLight(0x232a42, 0.12);
  scene.add(ambient);

  sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
  sun.position.set(120, 320, -90);
  sun.castShadow = rs.shadowsEnabled;
  // Twice the tier's map size, because this one shadow camera now has to span
  // BOTH the station footprint (±1400 · zoom) and the lifted ship plane, where
  // the ship layer's ±900 only had to cover ships. Without the extra
  // resolution the widened frustum would visibly coarsen hull self-shadowing.
  const mapSize = Math.min(4096, rs.shadowMapSize * 2);
  sun.shadow.mapSize.set(mapSize, mapSize);
  sun.shadow.camera.left = -2600;
  sun.shadow.camera.right = 2600;
  sun.shadow.camera.top = 2600;
  sun.shadow.camera.bottom = -2600;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 12000;
  sun.shadow.bias = rs.shadowBias;
  sun.shadow.normalBias = rs.shadowNormalBias;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x5c86d6, 0.4);
  fill.position.set(-90, 140, 110);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x9ec2ff, 0.55);
  rim.position.set(-30, -70, 210);
  scene.add(rim);

  // Order of addition is NOT draw order — the renderer sorts opaque geometry
  // front-to-back by depth on its own, and none of these groups carries a
  // renderOrder. They are added stations-first purely so the devtools tree
  // reads the way the structure is documented.
  scene.add(stationsGroup);
  scene.add(playerShipsGroup);
  scene.add(enemyShipsGroup);
  scene.add(npcGroup);

  world = { renderer, scene, camera, canvas: cvs };
  console.log("[World3D] shared scene up:", w, "x", h, "shadowMap:", mapSize);
  return world;
}

export function getWorldLayer(): WorldLayer | null {
  return world;
}

/**
 * Lift the ship groups off the world plane.
 *
 * @param factor 1 = full lift (ships clear every station), 0 = ships sit on the
 *   world plane and are occluded by station geometry like anything else.
 * @param zoom   current camera zoom — the lift is in screen pixels, and so is
 *   everything else in this scene, so it has to track zoom or the ship would
 *   sink into the hull as the player zooms in.
 */
export function setShipLift(factor: number, zoom: number): void {
  const y = SHARED_3D_SHIP_LIFT * Math.max(0, Math.min(1, factor)) * zoom;
  playerShipsGroup.position.y = y;
  enemyShipsGroup.position.y = y;
  npcGroup.position.y = y;
}

/**
 * How far the ships are lifted, 0..1. The docking sequence ramps this down so
 * the ship descends into the hangar and gets swallowed by the roof.
 */
let liftFactor = 1;
export function setShipLiftFactor(f: number): void {
  liftFactor = Math.max(0, Math.min(1, f));
}
export function getShipLiftFactor(): number {
  return liftFactor;
}

// ── Material audit ──────────────────────────────────────────────────────────
// Sharing a depth buffer only helps if the materials actually write to it. Two
// authoring habits break that, and both come in through the GLBs rather than
// from our own code:
//
//   • transparent = true with opacity 1. Three.js then skips depth writes and
//     sorts the mesh into the transparent queue, so the model becomes visible
//     through its own far side and through anything drawn after it. Under a
//     top-down camera that reads as a ship you can see the inside of.
//   • depthWrite = false on a solid hull part, same effect for the same reason.
//
// Everything genuinely translucent — additive glows, the Erix flow shell, the
// shimmer hulls, sprites — is left strictly alone: those are the effects the
// brief keeps separate, and forcing depth writes on them would make them
// occlude the ship they sit on.
//
// side is REPORTED, never changed. Blanket-flipping DoubleSide to FrontSide
// would silently delete every single-sided panel, solar array and decal whose
// normal happens to face away from a top-down camera, which is a worse bug than
// the one it fixes. If the log shows a model that needs it, fix the asset.

interface AuditResult {
  meshes: number;
  materials: number;
  fixedOpaque: number;
  fixedDepthWrite: number;
  doubleSided: number;
  translucent: number;
}

/** Additive/multiply glows — never touched; they are supposed to blend. */
function isEffectMaterial(m: THREE.Material): boolean {
  return m.blending !== THREE.NormalBlending;
}

/**
 * Bring one model's materials in line with the shared depth buffer.
 *
 * @param root  the cloned model (NOT the template — clones share materials with
 *   their template in Three.js only when the material is not re-created, and
 *   applySpaceMaterial re-creates them per instance, so this is per-instance).
 * @param label what to call it in the log.
 */
export function normalizeSharedDepth(root: THREE.Object3D, label: string): void {
  const r: AuditResult = {
    meshes: 0, materials: 0, fixedOpaque: 0,
    fixedDepthWrite: 0, doubleSided: 0, translucent: 0,
  };
  const doubleSidedNames: string[] = [];

  root.traverse((child) => {
    // Sprites are the billboard glows — FX_LAYER, additive, depthTest off by
    // design. They are one of the passes the brief explicitly keeps separate.
    if ((child as THREE.Sprite).isSprite) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    // Flow shells (Erix) are authored translucent overlays sitting ON the hull.
    if ((mesh.userData as any)?.flowShell) return;
    r.meshes++;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      r.materials++;
      if (isEffectMaterial(m)) { r.translucent++; continue; }

      if (m.side === THREE.DoubleSide) {
        r.doubleSided++;
        if (doubleSidedNames.length < 6) doubleSidedNames.push(mesh.name || "(unnamed)");
      }

      if (m.transparent) {
        // Opacity 1 with transparent set is the authoring slip described above:
        // nothing is actually see-through, but the depth buffer never learns
        // the surface is there. Anything genuinely translucent keeps its flags.
        if (m.opacity >= 0.995) {
          m.transparent = false;
          m.depthWrite = true;
          m.depthTest = true;
          m.needsUpdate = true;
          r.fixedOpaque++;
        } else {
          r.translucent++;
        }
        continue;
      }

      // Opaque from here down: the brief's baseline.
      if (!m.depthWrite) { m.depthWrite = true; r.fixedDepthWrite++; }
      if (!m.depthTest) { m.depthTest = true; r.fixedDepthWrite++; }
      if (m.opacity !== 1) m.opacity = 1;
      // renderOrder stays 0 everywhere: forcing an order is exactly the crutch
      // the shared depth buffer replaces.
      mesh.renderOrder = 0;
    }
  });

  if (r.fixedOpaque || r.fixedDepthWrite || r.doubleSided) {
    console.log(
      `[World3D] depth audit "${label}": ${r.meshes} meshes / ${r.materials} materials · ` +
      `opaque-fixed ${r.fixedOpaque} · depth-fixed ${r.fixedDepthWrite} · ` +
      `translucent kept ${r.translucent}` +
      (r.doubleSided
        ? ` · DoubleSide ${r.doubleSided} (left as authored: ${doubleSidedNames.join(", ")})`
        : ""),
    );
  }
}

export function destroyWorldLayer(): void {
  for (const g of [stationsGroup, playerShipsGroup, enemyShipsGroup, npcGroup]) {
    g.clear();
    g.position.set(0, 0, 0);
  }
  if (world) {
    world.renderer.dispose();
    world = null;
  }
  sun = null;
  driver = null;
  liftFactor = 1;
}
