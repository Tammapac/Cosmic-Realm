import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PIXELATE_3D, PIXELATE_3D_SCALE } from "./renderer-config";
import { STATIONS } from "./types";

// Effective downscale factor for the fake pixel-art render mode (1 = off).
// The Pixi stationSprite stretches this canvas back to screen size with
// NEAREST filtering, producing the pixelated look.
const PIX_SCALE = PIXELATE_3D ? Math.max(1, PIXELATE_3D_SCALE) : 1;

interface Station3D { wrapper: THREE.Group; model: THREE.Group; maxDim: number; }
interface StationTemplate { group: THREE.Group; maxDim: number; }

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let initialized = false;
let stationCanvas: HTMLCanvasElement | null = null;

const activeStations = new Map<string, Station3D>();
let cameraZoom = 1;
const activeThisFrame = new Set<string>();

// ── model pools ────────────────────────────────────────────────────────────
// Stations pick from the spacestation pool, factories from the factory pool.
// Models are assigned round-robin within each zone (offset by a zone hash) so
// every map mixes different models and no zone shows the same model twice.
const STATION_MODEL_URLS = [
  "/models/stations/spacestation1.glb",
  "/models/stations/spacestation2.glb",
  "/models/stations/spacestation3.glb",
];
const FACTORY_MODEL_URLS = [
  "/models/stations/factorystation.glb",
  "/models/stations/factorystation2.glb",
];

function strHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

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

function loadTemplate(url: string): void {
  if (templates.has(url) || templateLoading.has(url)) return;
  templateLoading.add(url);
  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      // Force all materials to fully opaque — walk EVERY descendant, not just meshes
      model.traverse((child: any) => {
        if (!child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of materials) {
          m.transparent = false;
          m.opacity = 1;
          m.depthWrite = true;
          m.depthTest = true;
          m.alphaTest = 0;
          m.alphaMap = null;
          m.blending = THREE.NormalBlending;
          m.premultipliedAlpha = false;
          m.needsUpdate = true;
        }
      });
      templates.set(url, { group: model, maxDim });
      templateLoading.delete(url);
      console.log("[Station3D] loaded", url, "maxDim:", maxDim.toFixed(2));
    },
    undefined,
    (err) => {
      console.error("[Station3D] GLB load failed:", url, err);
      templateLoading.delete(url);
    }
  );
}

export function initStation3DLayer(width?: number, height?: number): HTMLCanvasElement {
  if (initialized && stationCanvas) return stationCanvas;
  initialized = true;

  const w = width ?? window.innerWidth;
  const h = height ?? window.innerHeight;

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

  scene = new THREE.Scene();

  // Camera sits far above the tallest possible station so the near plane can
  // never slice a model open (the new station GLBs are tall: y ≈ maxDim, and
  // near-plane clipping made them look hollow/see-through). Orthographic, so
  // the height changes nothing but the clip range.
  camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 20000);
  camera.position.set(0, 8000, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, -1);

  const ambient = new THREE.AmbientLight(0x303050, 0.2);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff8f0, 2.6);
  sun.position.set(100, 300, -80);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x6699ff, 0.7);
  fill.position.set(-80, 150, 100);
  scene.add(fill);

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
  camera.left = -w / 2;
  camera.right = w / 2;
  camera.top = h / 2;
  camera.bottom = -h / 2;
  camera.updateProjectionMatrix();
}

export function setStationCameraZoom(z: number): void {
  cameraZoom = z;
}

export function beginStationFrame(): void {
  activeThisFrame.clear();
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
    scene.add(wrapper);
    st = { wrapper, model, maxDim: tpl.maxDim };
    activeStations.set(id, st);
  }

  const screenX = (worldX - camX) * cameraZoom;
  const screenY = (worldY - camY) * cameraZoom;
  st.wrapper.position.set(screenX, 0, screenY);

  // Constant screen size: stations ignore the mouse-wheel zoom entirely.
  // Position still tracks the world (anchored via camX/camY above) — only
  // the scale is zoom-independent, so zooming can never blow a station up
  // into the camera.
  const targetPixels = 1843;
  const finalScale = targetPixels / st.maxDim;
  st.wrapper.scale.setScalar(finalScale);

  st.model.rotation.y = -(performance.now() / 1000 / 300) * Math.PI * 2;
  activeThisFrame.add(id);
}

export function endStationFrame(): void {
  for (const [id, st] of activeStations) {
    if (!activeThisFrame.has(id)) {
      scene?.remove(st.wrapper);
      activeStations.delete(id);
    }
  }
}

export function renderStation3DLayer(): void {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
}

export function removeStation3D(id: string): void {
  const st = activeStations.get(id);
  if (st && scene) {
    scene.remove(st.wrapper);
    activeStations.delete(id);
  }
}

export function destroyStation3DLayer(): void {
  if (renderer) {
    window.removeEventListener("resize", onResize);
    renderer.dispose();
    renderer = null;
  }
  scene = null;
  camera = null;
  activeStations.clear();
  templates.clear();
  templateLoading.clear();
  stationCanvas = null;
  initialized = false;
}
