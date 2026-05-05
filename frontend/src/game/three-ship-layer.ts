import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const SHIP_3D_MODELS: Record<string, string> = {
  apex: "/models/Apex_Destroyer.glb",
};

interface Ship3D {
  wrapper: THREE.Group;
  model: THREE.Group;
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
    // Tilt the model slightly toward camera for 3D depth feel
    const wrapper = new THREE.Group();
    wrapper.rotation.x = -0.85;
    wrapper.add(model);
    scene.add(wrapper);
    ship = { wrapper, model };
    activeShips.set(entityId, ship);
    console.log("[Three.js] SHIP CREATED:", entityId, shipClass);
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

  // Rotation: game angle 0=east(+X), PI/2=south(+Z), PI=west(-X)
  // Three.js Y-rotation: 0=facing+Z, PI/2=facing-X, PI=facing-Z
  // To map game-east to Three.js: Y-rot = -(angle) + offset
  // Model default facing: test and adjust this offset
  ship.model.rotation.set(0, -angle + Math.PI, 0);

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
  renderFrameCount++;
  if (renderFrameCount === 1 || renderFrameCount % 300 === 0) {
    console.log("[Three.js] Frame:", renderFrameCount, "ships:", activeShips.size, "models:", loadedModels.size, "loading:", loadingModels.size);
  }
}

export function destroy3DLayer(): void {
  if (renderer) {
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
