import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { PIXELATE_3D, PIXELATE_3D_SCALE } from "./renderer-config";
import { STATIONS } from "./types";
import { applySpaceMaterial } from "./space-material";
import { perfRegisterThree } from "./perf";

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

// Silhouette outline + emissive bloom pass — same pixel-art treatment the
// ship layers get (three-ship-layer.ts): stations render into an offscreen
// target, then a fullscreen blit paints 1 buffer-pixel of black wherever a
// transparent pixel touches an opaque one, and adds blurred bright-pass
// bloom so lit windows/lamps bleed light.
let outlineRT: THREE.WebGLRenderTarget | null = null;
let outlineScene: THREE.Scene | null = null;
let outlineCamera: THREE.OrthographicCamera | null = null;
let outlineMat: THREE.ShaderMaterial | null = null;
let bloomRTA: THREE.WebGLRenderTarget | null = null;
let bloomRTB: THREE.WebGLRenderTarget | null = null;
let brightMat: THREE.ShaderMaterial | null = null;
let blurMat: THREE.ShaderMaterial | null = null;
let fsQuad: THREE.Mesh | null = null;

const OUTLINE_FRAG = `
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  if (c.a < 0.5) {
    float n = texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).a;
    n = max(n, texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).a);
    n = max(n, texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).a);
    n = max(n, texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).a);
    if (n > 0.5) c = vec4(0.0, 0.0, 0.0, 1.0);
  }
  vec3 b = texture2D(tBloom, vUv).rgb * 0.85;
  c.rgb += b;
  c.a = max(c.a, min(1.0, (b.r + b.g + b.b) * 1.4));
  gl_FragColor = c;
  #include <colorspace_fragment>
}`;

const BRIGHT_FRAG = `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float l = max(max(c.r, c.g), c.b) * c.a;
  float f = smoothstep(0.72, 0.95, l);
  gl_FragColor = vec4(c.rgb * f, 1.0);
}`;

const BLUR_FRAG = `
uniform sampler2D tDiffuse;
uniform vec2 dir;
varying vec2 vUv;
void main() {
  vec3 acc = texture2D(tDiffuse, vUv).rgb * 0.227027;
  acc += texture2D(tDiffuse, vUv + dir * 1.3846).rgb * 0.3162162;
  acc += texture2D(tDiffuse, vUv - dir * 1.3846).rgb * 0.3162162;
  acc += texture2D(tDiffuse, vUv + dir * 3.2308).rgb * 0.0702703;
  acc += texture2D(tDiffuse, vUv - dir * 3.2308).rgb * 0.0702703;
  gl_FragColor = vec4(acc, 1.0);
}`;

const QUAD_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function setupOutlinePass(bufW: number, bufH: number): void {
  const hw = Math.max(1, Math.floor(bufW / 2));
  const hh = Math.max(1, Math.floor(bufH / 2));
  outlineRT = new THREE.WebGLRenderTarget(bufW, bufH, { depthBuffer: true, format: THREE.RGBAFormat });
  bloomRTA = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false, format: THREE.RGBAFormat });
  bloomRTB = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false, format: THREE.RGBAFormat });
  bloomRTA.texture.minFilter = bloomRTA.texture.magFilter = THREE.LinearFilter;
  bloomRTB.texture.minFilter = bloomRTB.texture.magFilter = THREE.LinearFilter;
  brightMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: outlineRT.texture } },
    vertexShader: QUAD_VERT, fragmentShader: BRIGHT_FRAG,
    blending: THREE.NoBlending, depthTest: false, depthWrite: false,
  });
  blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG,
    blending: THREE.NoBlending, depthTest: false, depthWrite: false,
  });
  outlineMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: outlineRT.texture },
      tBloom: { value: bloomRTA.texture },
      texel: { value: new THREE.Vector2(1 / bufW, 1 / bufH) },
    },
    vertexShader: QUAD_VERT, fragmentShader: OUTLINE_FRAG,
    blending: THREE.NoBlending, depthTest: false, depthWrite: false, transparent: true,
  });
  outlineScene = new THREE.Scene();
  outlineCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), outlineMat);
  fsQuad.frustumCulled = false;
  outlineScene.add(fsQuad);
}

function resizeOutlinePass(bufW: number, bufH: number): void {
  if (!outlineRT || !outlineMat) return;
  outlineRT.setSize(bufW, bufH);
  const hw = Math.max(1, Math.floor(bufW / 2));
  const hh = Math.max(1, Math.floor(bufH / 2));
  if (bloomRTA) bloomRTA.setSize(hw, hh);
  if (bloomRTB) bloomRTB.setSize(hw, hh);
  (outlineMat.uniforms.texel.value as THREE.Vector2).set(1 / bufW, 1 / bufH);
}

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
      // Apply the shared dark space-metal material to the station hull so it
      // reads as a heavy metallic structure (panels, seams, wear, AO) instead
      // of the old forced-matte grey block (rough≥0.88/metal≤0.08). Emissive
      // window/light materials are preserved so they can glow.
      const seed = strHash(url);
      let stHull = 0, stEmis = 0;
      model.traverse((child: any) => {
        if (!child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const geo = child.geometry as THREE.BufferGeometry | undefined;
        if (geo && geo.attributes && geo.attributes.uv && !geo.attributes.uv2) {
          geo.setAttribute("uv2", geo.attributes.uv);
        }
        for (let mi = 0; mi < materials.length; mi++) {
          let m = materials[mi];
          if (m.type === "MeshBasicMaterial") {
            const up = new THREE.MeshStandardMaterial({ map: m.map, color: m.color, roughness: 0.6, metalness: 0.5 });
            m.dispose?.(); materials[mi] = up; m = up;
          }
          m.transparent = false;
          m.opacity = 1;
          m.depthWrite = true;
          m.depthTest = true;
          m.alphaTest = 0;
          m.alphaMap = null;
          m.blending = THREE.NormalBlending;
          m.premultipliedAlpha = false;
          // Only STRONGLY emissive materials (real windows/lights) are kept as
          // Kill the broken white/grey emissive export (albedo plugged into the
          // emissive slot → self-lit flat hull), same bug as the ships.
          const emHsl = { h: 0, s: 0, l: 0 };
          if (m.emissive) m.emissive.getHSL(emHsl);
          const emSum = m.emissive ? (m.emissive.r + m.emissive.g + m.emissive.b) : 0;
          if (emSum > 0.35 && emHsl.s < 0.25) {
            m.emissive = new THREE.Color(0x000000); m.emissiveIntensity = 0; m.emissiveMap = null;
          }
          // Only a genuine COLORED emissive (real windows/lights) is kept.
          const strongEmissive = !!m.emissive &&
            emSum > 0.35 && emHsl.s >= 0.25 &&
            (m.emissiveIntensity ?? 1) > 0.3;
          if (strongEmissive) { m.needsUpdate = true; stEmis++; continue; }
          applySpaceMaterial(m as THREE.MeshStandardMaterial, "station", { seed });
          stHull++;
        }
        if (Array.isArray(child.material)) child.material = materials;
        // Modules cast + receive shadows on each other (real depth between them).
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
      });
      templates.set(url, { group: model, maxDim });
      templateLoading.delete(url);
      console.log("[Station3D] loaded", url, "maxDim:", maxDim.toFixed(2), `(${stHull} hull mats, ${stEmis} emissive kept)`);
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
  perfRegisterThree("3d-station", renderer.info);
  // Real inter-module shadows (modules occlude each other under the key light).
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const dbSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  setupOutlinePass(dbSize.x, dbSize.y);

  scene = new THREE.Scene();

  // Camera sits far above the tallest possible station so the near plane can
  // never slice a model open (the new station GLBs are tall: y ≈ maxDim, and
  // near-plane clipping made them look hollow/see-through). Orthographic, so
  // the height changes nothing but the clip range.
  camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 20000);
  camera.position.set(0, 8000, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, -1);

  // Station lighting is deliberately dimmer and cooler than the ship layer:
  // the warm 2.6-intensity sun lit the big hull plates so bright they crossed
  // the bloom threshold and shimmered — a light source that read as alien to
  // the dark galaxy. Cool starlight key + faint blue fill keeps stations
  // moody and embedded in the scene.
  // Filmic tone mapping + soft environment reflections — matches the ship
  // layer so stations shine subtly and sit in the same light as the world.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88; // stations stay moody, embedded in the dark
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  (scene as any).environmentIntensity = 0.55; // metallic hull needs more reflection

  // Deeper directional contrast so the station reads as a heavy 3D structure
  // (bright lit side, dark shadow side, deep module gaps) instead of a flat,
  // uniformly-lifted grey block. Lower ambient is the key change.
  const ambient = new THREE.AmbientLight(0x232840, 0.16);
  scene.add(ambient);

  // Strong cool key from the upper-right, shadow-casting so modules occlude
  // each other (real inter-module shadows).
  const sun = new THREE.DirectionalLight(0xe6ecff, 1.9);
  sun.position.set(120, 320, -90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1400; sun.shadow.camera.right = 1400;
  sun.shadow.camera.top = 1400; sun.shadow.camera.bottom = -1400;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 6000;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.0;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x5c86d6, 0.32);
  fill.position.set(-90, 140, 110);
  scene.add(fill);

  // Grazing rim so panel edges + antennae catch light against the dark.
  const rim = new THREE.DirectionalLight(0x9ec2ff, 0.45);
  rim.position.set(-30, -70, 210);
  scene.add(rim);

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
  const dbSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  resizeOutlinePass(dbSize.x, dbSize.y);
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

  // Stations scale with the camera zoom like every other world object. The
  // camera sits at y=8000 (far above the tallest station at max zoom 2.5),
  // so zooming in can never push a model through the near plane — the hull
  // always renders solid, top to bottom.
  const targetPixels = 1843;
  const finalScale = (targetPixels * cameraZoom) / st.maxDim;
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
  if (outlineRT && outlineScene && outlineCamera && fsQuad && brightMat && blurMat && outlineMat && bloomRTA && bloomRTB) {
    // Pass 1: stations → offscreen target
    renderer.setRenderTarget(outlineRT);
    renderer.clear();
    renderer.render(scene, camera);

    // Pass 2: bloom — extract bright emissives, blur H+V twice at half res
    fsQuad.material = brightMat;
    renderer.setRenderTarget(bloomRTA);
    renderer.render(outlineScene, outlineCamera);
    fsQuad.material = blurMat;
    const bw = bloomRTA.width, bh = bloomRTA.height;
    for (let i = 0; i < 2; i++) {
      blurMat.uniforms.tDiffuse.value = bloomRTA.texture;
      (blurMat.uniforms.dir.value as THREE.Vector2).set(1 / bw, 0);
      renderer.setRenderTarget(bloomRTB);
      renderer.render(outlineScene, outlineCamera);
      blurMat.uniforms.tDiffuse.value = bloomRTB.texture;
      (blurMat.uniforms.dir.value as THREE.Vector2).set(0, 1 / bh);
      renderer.setRenderTarget(bloomRTA);
      renderer.render(outlineScene, outlineCamera);
    }

    // Pass 3: blit with 1px black outline + additive bloom
    fsQuad.material = outlineMat;
    renderer.setRenderTarget(null);
    renderer.render(outlineScene, outlineCamera);
  } else {
    renderer.render(scene, camera);
  }
}

export function removeStation3D(id: string): void {
  const st = activeStations.get(id);
  if (st && scene) {
    scene.remove(st.wrapper);
    activeStations.delete(id);
  }
}

export function destroyStation3DLayer(): void {
  if (outlineRT) { outlineRT.dispose(); outlineRT = null; outlineScene = null; outlineCamera = null; outlineMat = null; }
  if (bloomRTA) { bloomRTA.dispose(); bloomRTA = null; }
  if (bloomRTB) { bloomRTB.dispose(); bloomRTB = null; }
  brightMat = null;
  blurMat = null;
  fsQuad = null;
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
