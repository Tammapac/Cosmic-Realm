/**
 * Three.js Ship Layer — Renders 3D ship models overlaid on the PixiJS game.
 * Orthographic camera looking down, synced with PixiJS camera.
 * Only renders ships — everything else stays in PixiJS.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const SHIP_3D_MODELS: Record<string, string> = {
  apex: "/models/Apex_Destroyer.glb",
};

const ISOMETRIC_TILT = -0.7; // ~40 degrees toward camera

interface Ship3D {
  wrapper: THREE.Group;
  model: THREE.Group;
}

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let canvas3d: HTMLCanvasElement | null = null;
let initialized = false;

const loadedModels = new Map<string, THREE.Group>();
const loadingModels = new Set<string>();
const failedModels = new Set<string>();
const activeShips = new Map<string, Ship3D>();
const activeThisFrame = new Set<string>();

let modelBaseScale = 0.35;

export function init3DLayer(gameCanvas: HTMLCanvasElement): void {
  if (initialized) return;
  initialized = true;

  canvas3d = document.createElement("canvas");
  canvas3d.id = "three-ship-canvas";
  canvas3d.style.position = "absolute";
  canvas3d.style.top = "0";
  canvas3d.style.left = "0";
  canvas3d.style.width = "100%";
  canvas3d.style.height = "100%";
  canvas3d.style.pointerEvents = "none";
  canvas3d.style.zIndex = "5";

  gameCanvas.style.position = "relative";
  gameCanvas.style.zIndex = "1";

  const parent = gameCanvas.parentElement;
  if (parent) {
    parent.style.position = "relative";
    parent.appendChild(canvas3d);
  }

  const w = gameCanvas.clientWidth;
  const h = gameCanvas.clientHeight;

  renderer = new THREE.WebGLRenderer({
    canvas: canvas3d,
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();

  camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 1000);
  camera.position.set(0, 200, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, -1);

  const ambient = new THREE.AmbientLight(0x8899bb, 0.9);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(80, 200, -50);
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x4488ff, 0.5);
  rim.position.set(-60, 100, 60);
  scene.add(rim);

  window.addEventListener("resize", onResize);
  console.log("[Three.js] Ship renderer initialized");
}

function onResize(): void {
  if (!renderer || !camera || !canvas3d) return;
  const parent = canvas3d.parentElement;
  if (!parent) return;
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  renderer.setSize(w, h);
  camera.left = -w / 2;
  camera.right = w / 2;
  camera.top = h / 2;
  camera.bottom = -h / 2;
  camera.updateProjectionMatrix();
}

function loadModel(shipClass: string): void {
  const path = SHIP_3D_MODELS[shipClass];
  if (!path || loadedModels.has(shipClass) || loadingModels.has(shipClass) || failedModels.has(shipClass)) return;

  loadingModels.add(shipClass);
  console.log(`[Three.js] Loading GLB: ${path}`);

  const loader = new GLTFLoader();
  loader.load(
    path,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
          }
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      model.userData.normalizedScale = 1 / maxDim;
      model.scale.setScalar(model.userData.normalizedScale);
      loadedModels.set(shipClass, model);
      loadingModels.delete(shipClass);
      console.log(`[Three.js] GLB loaded successfully: ${shipClass} (${(maxDim).toFixed(1)} units)`);
    },
    undefined,
    (error) => {
      console.warn(`[Three.js] Failed to load model for ${shipClass}:`, error);
      loadingModels.delete(shipClass);
      failedModels.add(shipClass);
    }
  );
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
    const wrapper = new THREE.Group();
    wrapper.rotation.x = ISOMETRIC_TILT;
    wrapper.add(model);
    scene.add(wrapper);
    ship = { wrapper, model };
    activeShips.set(entityId, ship);
    console.log(`[Three.js] Using Three.js ship renderer for: ${entityId} (${shipClass})`);
  }

  const screenX = worldX - camX;
  const screenY = worldY - camY;
  ship.wrapper.position.set(screenX, 0, screenY);

  const displaySize = 85 * sizeScale * 1.6;
  const finalScale = displaySize * modelBaseScale * (ship.model.userData.normalizedScale || 1);
  ship.wrapper.scale.setScalar(finalScale);

  ship.model.rotation.set(0, -angle + Math.PI / 2, 0);
}

export function removeShip3D(entityId: string): void {
  const ship = activeShips.get(entityId);
  if (ship && scene) {
    scene.remove(ship.wrapper);
    activeShips.delete(entityId);
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
  renderer.render(scene, camera);
}

export function destroy3DLayer(): void {
  if (renderer) {
    renderer.dispose();
    canvas3d?.remove();
    renderer = null;
    scene = null;
    camera = null;
    canvas3d = null;
    initialized = false;
  }
  activeShips.clear();
  loadedModels.clear();
  loadingModels.clear();
  failedModels.clear();
}
