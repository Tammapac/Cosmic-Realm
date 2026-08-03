import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRONE_3D_MODELS, PetDroneLevel } from "./types";
import { getRendererSettings } from "./RendererSettings";
import { loadEnvironment } from "./three-environment";
import { setMaterialAnisotropyMax } from "./space-material";

// Simple, standalone 3D layer for the pet drone in the live game world.
// Deliberately NOT integrated into three-ship-layer.ts (hardpoint/muzzle-ring
// system is unnecessary here — drone firing is fully server-computed) and NOT
// gated on ENABLE_SHARED_3D_SCENE (opt-in only, not the default live path).
// Mirrors three-station-layer.ts's non-shared-scene branch: its own
// transparent WebGLRenderer + fixed top-down OrthographicCamera, composited
// as a Pixi sprite by the caller — same technique, far less machinery.

// The drone model is a near-perfectly Y-symmetric sphere (4 arms 90° apart,
// no geometrically distinct "nose" — verified by sampling vertex distances
// per angle bin, all four arm clusters read within a few % of each other).
// So this offset is tuned by eye in actual gameplay, not derived from
// geometry. Player-reported baseline (fix=0): "close, just slightly
// rotated" — a quarter turn either way is the next thing to try.
const DRONE_YAW_FIX = Math.PI / 2;

interface DroneInstance {
  wrapper: THREE.Group;
  model: THREE.Group;
  maxDim: number;
  level: PetDroneLevel;
  lastYRot: number;
}

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let initialized = false;
let droneCanvas: HTMLCanvasElement | null = null;
let cameraZoom = 1;

const templates = new Map<string, { group: THREE.Group; maxDim: number }>();
const loader = new GLTFLoader();
const loading = new Set<string>();

const activeDrones = new Map<string, DroneInstance>();
const activeThisFrame = new Set<string>();

function loadTemplate(url: string): void {
  if (templates.has(url) || loading.has(url)) return;
  loading.add(url);
  loader.load(
    url,
    (gltf) => {
      const group = gltf.scene;
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
      group.position.sub(center);
      templates.set(url, { group, maxDim });
      loading.delete(url);
    },
    undefined,
    () => { loading.delete(url); },
  );
}

export function initDrone3DLayer(width?: number, height?: number): HTMLCanvasElement {
  if (initialized && droneCanvas) return droneCanvas;
  initialized = true;

  const w = width ?? window.innerWidth;
  const h = height ?? window.innerHeight;

  droneCanvas = document.createElement("canvas");
  droneCanvas.width = w;
  droneCanvas.height = h;

  renderer = new THREE.WebGLRenderer({
    canvas: droneCanvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const rs = getRendererSettings();
  (renderer as any).useLegacyLights = false;
  setMaterialAnisotropyMax(renderer.capabilities.getMaxAnisotropy());

  scene = new THREE.Scene();

  // Same fixed top-down ortho camera as the station layer: never moves, the
  // world scrolls underneath via screen-space positioning in updateDroneOnly.
  camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 20000);
  camera.position.set(0, 8000, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, -1);

  // Same tone mapping + IBL + light rig as three-ship-layer.ts /
  // three-station-layer.ts, so the drone reads as lit by the same scene
  // instead of its own dim, flatter mini rig. At the drone's on-screen size
  // (34px vs. a few hundred for a ship) the identical rig still read visibly
  // darker in-game — small objects show less lit surface area and their
  // specular highlights all but disappear — so exposure + key/fill/rim are
  // bumped up from the ship-layer baseline to compensate.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = rs.toneMappingExposure * 1.35;
  loadEnvironment(renderer, scene);

  const ambient = new THREE.AmbientLight(0x232a42, 0.22);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff2e0, 3.0);
  sun.position.set(120, 320, -90);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x5c86d6, 0.7);
  fill.position.set(-90, 140, 110);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x9ec2ff, 0.85);
  rim.position.set(-30, -70, 210);
  scene.add(rim);

  window.addEventListener("resize", onResize);
  return droneCanvas;
}

export function getDroneCanvas(): HTMLCanvasElement | null {
  return droneCanvas;
}

function onResize(): void {
  if (!renderer || !camera || !droneCanvas) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.left = -w / 2;
  camera.right = w / 2;
  camera.top = h / 2;
  camera.bottom = -h / 2;
  camera.updateProjectionMatrix();
}

export function setDroneCameraZoom(z: number): void {
  cameraZoom = z;
}

export function beginDroneFrame(): void {
  activeThisFrame.clear();
}

/**
 * Positions/creates the drone's 3D instance for this frame. worldX/worldY are
 * the drone's own anchor position (already computed each tick by
 * updatePetDrone() in loop.ts — the orbit/behind-ship formation math), not
 * the ship's position; camX/camY/zoom match every other world-space layer.
 * angle is the pilot ship's heading (state.player.angle / OtherPlayer.angle) —
 * the drone steers to match it, same -angle+PI convention three-ship-layer.ts
 * uses, but stays otherwise static (no bob, no idle spin).
 */
export function updateDroneOnly(
  id: string,
  level: PetDroneLevel,
  worldX: number,
  worldY: number,
  camX: number,
  camY: number,
  angle: number,
): void {
  if (!scene || level <= 0) return;
  const url = DRONE_3D_MODELS[level as Exclude<PetDroneLevel, 0>];
  const tpl = templates.get(url);
  if (!tpl) { loadTemplate(url); return; }

  let inst = activeDrones.get(id);
  if (!inst || inst.level !== level) {
    if (inst) {
      inst.wrapper.parent?.remove(inst.wrapper);
    }
    const model = tpl.group.clone();
    const wrapper = new THREE.Group();
    wrapper.rotation.x = -0.6;
    wrapper.add(model);
    scene.add(wrapper);
    const initialYRot = -angle + Math.PI;
    model.rotation.y = initialYRot + DRONE_YAW_FIX;
    inst = { wrapper, model, maxDim: tpl.maxDim, level, lastYRot: initialYRot };
    activeDrones.set(id, inst);
  }

  const screenX = (worldX - camX) * cameraZoom;
  const screenY = (worldY - camY) * cameraZoom;
  inst.wrapper.position.set(screenX, 0, screenY);

  const targetPixels = 34;
  const finalScale = (targetPixels * cameraZoom) / inst.maxDim;
  inst.wrapper.scale.setScalar(finalScale);

  // Steer to face the ship's heading — smoothed the same way the ship layer
  // eases its own yaw, so the turn reads as a steer rather than a snap.
  const targetYRot = -angle + Math.PI;
  let rotDiff = targetYRot - inst.lastYRot;
  while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
  while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
  inst.lastYRot += rotDiff * 0.15;
  inst.model.rotation.y = inst.lastYRot + DRONE_YAW_FIX;

  activeThisFrame.add(id);
}

export function endDroneFrame(): void {
  for (const [id, inst] of activeDrones) {
    if (!activeThisFrame.has(id)) {
      inst.wrapper.parent?.remove(inst.wrapper);
      activeDrones.delete(id);
    }
  }
}

export function removeDrone3D(id: string): void {
  const inst = activeDrones.get(id);
  if (inst) {
    inst.wrapper.parent?.remove(inst.wrapper);
    activeDrones.delete(id);
  }
}

export function renderDrone3DLayer(): void {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
}
