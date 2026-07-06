import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ThreeNebulaBackground } from "./three-nebula-background";
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
} from "./renderer-config";

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
};

interface ShipHardpoints {
  thrusters: THREE.Object3D[];
  muzzles: THREE.Object3D[];
  weapons: THREE.Object3D[];
  debugMarkers?: THREE.Mesh[];
}

// Model-local (canonical, un-rotated, un-scaled) hardpoint offsets. These are
// captured once at template load and never change. The projectile spawn code
// uses these plus the authoritative (worldX, worldY, angle) to compute the
// muzzle world position analytically — decoupled from the Three.js render
// pipeline's per-frame lerp/interpolation state.
//
// x/z are in **model space** (Three.js convention): model +X = sideways,
// model +Z = forward. Y is discarded (top-down projection).
interface ModelLocalHardpoints {
  muzzles: { x: number; z: number }[];
  weapons: { x: number; z: number }[];
}

interface Ship3D {
  lastYRot: number;
  wrapper: THREE.Group;
  model: THREE.Group;
  hardpoints: ShipHardpoints;
  engineGlows: THREE.Sprite[];
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

const loadedModels = new Map<string, THREE.Group>();
const loadingModels = new Set<string>();
const failedModels = new Set<string>();
const activeShips = new Map<string, Ship3D>();
const activeThisFrame = new Set<string>();

let cameraZoom = 1;
let renderFrameCount = 0;
let lastFrameTime = 0;
let frameDt = 1 / 60;

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

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

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

  // Lighting - enhanced dramatic contrast for stronger shading
  // Ambient: very low intensity for deeper shadows
  const ambient = new THREE.AmbientLight(0x303050, 0.2);
  scene.add(ambient);

  // Main sun: brighter warm light from upper-right for strong highlights
  const sun = new THREE.DirectionalLight(0xfff8f0, 2.6);
  sun.position.set(100, 300, -80);
  scene.add(sun);

  // Rim/fill: cooler blue light from opposite side for edge definition
  const fill = new THREE.DirectionalLight(0x6699ff, 0.7);
  fill.position.set(-80, 150, 100);
  scene.add(fill);

  window.addEventListener("resize", onResize);
  console.log("[Three.js] INIT OK canvas:", w, "x", h);
}

function onResize(): void {
  if (!renderer || !camera) return;
  const canvas = renderer.domElement;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h);
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

function collectHardpoints(model: THREE.Group, shipClass: string): ShipHardpoints {
  const thrusters: THREE.Object3D[] = [];
  const muzzles: THREE.Object3D[] = [];
  const weapons: THREE.Object3D[] = [];

  const allObjects: string[] = [];

  // Traverse and collect hardpoints
  model.traverse((child) => {
    allObjects.push(child.name || "(unnamed)");

    const name = child.name.toLowerCase();

    if (name.startsWith("hp_thruster_")) {
      thrusters.push(child);
    } else if (name.startsWith("hp_muzzle_")) {
      muzzles.push(child);
    } else if (name.startsWith("hp_weapon_")) {
      weapons.push(child);
    }
  });

  // Canonical order: sort by name so hardpointIndex maps stably across all clients.
  const byName = (a: THREE.Object3D, b: THREE.Object3D) => a.name.localeCompare(b.name);
  thrusters.sort(byName);
  muzzles.sort(byName);
  weapons.sort(byName);

  // Debug logging
  console.log(`[Three.js] ${shipClass} - All objects in GLB:`, allObjects);
  console.log(`[Three.js] ${shipClass} - Hardpoints found:`);
  console.log(`  Thrusters (${thrusters.length}):`, thrusters.map(t => t.name));
  console.log(`  Muzzles (${muzzles.length}):`, muzzles.map(m => m.name));
  console.log(`  Weapons (${weapons.length}):`, weapons.map(w => w.name));

  if (thrusters.length === 0) {
    console.warn(`[Three.js] ${shipClass} - NO thruster hardpoints found!`);
  }
  if (muzzles.length === 0) {
    console.warn(`[Three.js] ${shipClass} - NO muzzle hardpoints found!`);
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
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            // Convert MeshBasicMaterial (unlit) to MeshStandardMaterial (lit)
            if (mesh.material.type === 'MeshBasicMaterial') {
              const oldMat = mesh.material as THREE.MeshBasicMaterial;
              const newMat = new THREE.MeshStandardMaterial({
                map: oldMat.map,
                color: oldMat.color,
                transparent: oldMat.transparent,
                opacity: oldMat.opacity,
                side: oldMat.side,
                roughness: 0.6,  // Slightly shiny for specular highlights
                metalness: 0.2,  // Bit of metallic reflection
              });
              mesh.material = newMat;
              oldMat.dispose();
            }

            // Ensure proper color space and shading properties
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;

            // Set good default shading properties if they exist
            if (mat.roughness !== undefined) mat.roughness = Math.max(0.5, Math.min(0.7, mat.roughness));
            if (mat.metalness !== undefined) mat.metalness = Math.max(0.1, Math.min(0.3, mat.metalness));

            // Remove excessive emissive glow that can wash out lighting
            if (mat.emissive) mat.emissive.set(0x000000);
            if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0;

            mat.needsUpdate = true;
          }
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Collect hardpoints from the GLB model
      const hardpoints = collectHardpoints(model, shipClass);
      model.userData.hardpoints = hardpoints;

      // Snapshot model-local hardpoint positions with the template at the origin
      // and no rotation/scale applied. These are the canonical offsets used by
      // getShipMuzzleWorldPositionsAt() to compute the world position of each
      // muzzle analytically from (worldX, worldY, angle) — bypassing the render
      // pipeline's per-frame transform lerp.
      model.updateMatrixWorld(true);
      const _localTmp = new THREE.Vector3();
      const localHardpoints: ModelLocalHardpoints = { muzzles: [], weapons: [] };
      for (const hp of hardpoints.muzzles) {
        hp.getWorldPosition(_localTmp);
        localHardpoints.muzzles.push({ x: _localTmp.x, z: _localTmp.z });
      }
      for (const hp of hardpoints.weapons) {
        hp.getWorldPosition(_localTmp);
        localHardpoints.weapons.push({ x: _localTmp.x, z: _localTmp.z });
      }
      model.userData.localHardpoints = localHardpoints;

      // Store raw size for scaling later
      model.userData.maxDim = maxDim;
      loadedModels.set(shipClass, model);
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

// Reusable vector to avoid allocation
const tempVec3 = new THREE.Vector3();

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

// Analytic muzzle/weapon world positions computed from the authoritative ship
// state (worldX, worldY, angle), independent of the Three.js render pipeline.
//
// This is the correct entry point for projectile spawn logic. The alternative,
// getShipMuzzleWorldPositions(), reads the live Three.js wrapper transform,
// which is set on each pixiRender() from the (possibly stale) render-loop view
// of ship position/camera and rotates via a lerped ship.lastYRot. When a
// projectile:spawn socket event arrives between renders, the wrapper transform
// is one frame behind and the muzzle world position drifts, producing a
// visible offset that grows with local player camera motion and with the
// angular gap between authoritative angle and the on-screen rotation.
//
// Here we compute the muzzle position purely from:
//   - worldX/worldY: the ship's authoritative world position at fire time
//   - angle:         the ship's authoritative heading at fire time
//   - the model-local hardpoint offsets captured once at GLB load
//   - worldUnitsPerModelUnit: cached from the last updateShip3D() call, which
//     is stable per (shipClass, sizeScale) — so even a one-frame-old value is
//     correct as long as ship class hasn't changed.
//
// Rotation math mirrors updateShip3D()'s Three.js Y rotation of (-angle + π):
//   cos(-angle + π) = -cos(angle)
//   sin(-angle + π) =  sin(angle)
// so a model-local hardpoint at (mx, mz) rotates to:
//   mx_rot = -mx·cos(angle) + mz·sin(angle)
//   mz_rot = -mx·sin(angle) - mz·cos(angle)
// scaled by worldUnitsPerModelUnit and offset by (worldX, worldY).
export function getShipMuzzleWorldPositionsAt(
  entityId: string,
  worldX: number,
  worldY: number,
  angle: number,
): {
  muzzles: { x: number; y: number }[];
  weapons: { x: number; y: number }[];
} | null {
  const ship = activeShips.get(entityId);
  if (!ship) return null;
  const localHp = ship.model.userData.localHardpoints as ModelLocalHardpoints | undefined;
  if (!localHp) return null;
  const s = ship.worldUnitsPerModelUnit;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const dbg = (window as any).__DEBUG_HARDPOINTS;

  const project = (mx: number, mz: number, label: string, idx: number): { x: number; y: number } => {
    const dx = (-mx * ca + mz * sa) * s;
    const dy = (-mx * sa - mz * ca) * s;
    const wx = worldX + dx;
    const wy = worldY + dy;
    if (dbg) {
      console.log(`[HP:analytic] entityId=${entityId} ${label}[${idx}] modelLocal=(${mx.toFixed(2)},${mz.toFixed(2)}) angle=${angle.toFixed(3)} scale=${s.toFixed(3)} shipWorld=(${worldX.toFixed(1)},${worldY.toFixed(1)}) muzzleWorld=(${wx.toFixed(1)},${wy.toFixed(1)}) delta=(${dx.toFixed(1)},${dy.toFixed(1)})`);
    }
    return { x: wx, y: wy };
  };

  const muzzles = localHp.muzzles.map((m, i) => project(m.x, m.z, "muzzle", i));
  const weapons = localHp.weapons.map((w, i) => project(w.x, w.z, "weapon", i));
  return { muzzles, weapons };
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
): void {
  if (!scene || !loadedModels.has(shipClass)) return;

  let ship = activeShips.get(entityId);
  if (!ship) {
    const template = loadedModels.get(shipClass)!;
    const model = template.clone();

    // Clone hardpoint references (they move with the cloned model)
    const templateHardpoints = template.userData.hardpoints as ShipHardpoints;
    const hardpoints: ShipHardpoints = {
      thrusters: [],
      muzzles: [],
      weapons: [],
    };

    // Find cloned hardpoints by name matching
    if (templateHardpoints) {
      model.traverse((child) => {
        const name = child.name.toLowerCase();
        if (name.startsWith("hp_thruster_")) hardpoints.thrusters.push(child);
        else if (name.startsWith("hp_muzzle_")) hardpoints.muzzles.push(child);
        else if (name.startsWith("hp_weapon_")) hardpoints.weapons.push(child);
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
      // Create circular glow texture
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(68, 136, 255, 1)');
      gradient.addColorStop(0.5, 'rgba(68, 136, 255, 0.5)');
      gradient.addColorStop(1, 'rgba(68, 136, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(glowSize, glowSize, 1); // Glow size - tiny and subtle

      // Position relative to thruster
      thruster.add(sprite);
      engineGlows.push(sprite);
    }

    // Tilt the model slightly toward camera for 3D depth feel
    const wrapper = new THREE.Group();
    wrapper.rotation.x = -0.85;
    wrapper.add(model);
    scene.add(wrapper);

    ship = {
      wrapper, model, hardpoints, engineGlows,
      lastYRot: -angle + Math.PI,
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
  ship.model.rotation.set(0, ship.lastYRot, 0);
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
  if (ship && scene) {
    scene.remove(ship.wrapper);
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
  const now = performance.now() / 1000;
  if (lastFrameTime > 0) frameDt = Math.min(0.1, now - lastFrameTime);
  lastFrameTime = now;
  renderer.render(scene, camera);
  renderFrameCount++;
  if (renderFrameCount === 1 || renderFrameCount % 300 === 0) {
    console.log("[Three.js] Frame:", renderFrameCount, "ships:", activeShips.size, "models:", loadedModels.size, "loading:", loadingModels.size);
  }
}

export function destroy3DLayer(): void {
  if (nebulaBackground) {
    nebulaBackground.destroy();
    nebulaBackground = null;
  }

  if (renderer) {
    renderer.dispose();
    renderer = null;
    scene = null;
    camera = null;
    initialized = false;
  }
  activeShips.clear();
  activeStations.clear();
  loadedModels.clear();
  loadingModels.clear();
  failedModels.clear();
  window.removeEventListener("resize", onResize);
  renderFrameCount = 0;
}
