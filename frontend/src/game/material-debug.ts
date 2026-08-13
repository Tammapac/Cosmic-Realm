/**
 * material-debug.ts — Space-material & lighting test lab.
 *
 * Toggle:  Ctrl+Alt+G  or  window.__materialDebug()  from the console.
 *
 * An isolated Three.js scene (its own renderer, NOT the game's) showing a
 * player ship, an NPC, a boss, and a station side by side under the shared
 * space-material + lighting rig. Channel switches isolate each material term
 * so we can dial in the look before touching production:
 *
 *   Base Color · Lighting only · Ambient Occlusion · Specular · Normal Map ·
 *   Roughness · Emissive · Rim Light · Final Combined
 *
 * Stats HUD: material type, metallic, roughness, active lights, shader,
 * draw calls, renderer, FPS.
 *
 * Nothing here runs in the shipped game loop unless opened. It reuses the
 * shared preset code from space-material.ts so what we see here is what the
 * production materials will do.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { applySpaceMaterial, addSpaceLightRig, type SpaceRole, type SpaceLightRig } from "./space-material";

type Channel =
  | "final" | "base" | "lighting" | "ao" | "specular"
  | "normal" | "roughness" | "emissive" | "rim";

const CHANNELS: { id: Channel; label: string }[] = [
  { id: "final", label: "Final Combined" },
  { id: "base", label: "Base Color" },
  { id: "lighting", label: "Lighting Only" },
  { id: "ao", label: "Ambient Occlusion" },
  { id: "specular", label: "Specular" },
  { id: "normal", label: "Normal Map" },
  { id: "roughness", label: "Roughness" },
  { id: "emissive", label: "Emissive" },
  { id: "rim", label: "Rim Light" },
];

// Sample models — one per role. Kept small so the lab loads fast.
const SPECIMENS: { role: SpaceRole; label: string; url: string; x: number }[] = [
  { role: "player", label: "PLAYER", url: "/models/Skimmer_MK_1.glb", x: -420 },
  { role: "npc", label: "NPC", url: "/models/enemies/enemy_raider.glb?v=18", x: -140 },
  { role: "boss", label: "BOSS", url: "/models/enemies/enemy_dread.glb?v=18", x: 160 },
  { role: "station", label: "STATION", url: "/models/stations/spacestation1.glb", x: 470 },
];

interface DebugState {
  root: HTMLDivElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rig: SpaceLightRig;
  specimens: { role: SpaceRole; group: THREE.Group; mats: THREE.MeshStandardMaterial[] }[];
  channel: Channel;
  raf: number;
  statsEl: HTMLDivElement;
  frames: number;
  lastFpsT: number;
  fps: number;
  disposed: boolean;
}

let dbg: DebugState | null = null;

// ── Channel isolation: clone each material's terms into a temporary view ─────
// We keep the originals and, per channel, swap the material's active fields so
// only the requested term contributes. Restored to "final" each switch.
function applyChannel(mats: THREE.MeshStandardMaterial[], ch: Channel): void {
  for (const m of mats) {
    // reset visibility of maps
    m.wireframe = false;
    // Restore full material first (final).
    m.emissiveIntensity = m.userData._emiI ?? 0;
    switch (ch) {
      case "final":
        break;
      case "base":
        // albedo only, no lighting influence → emulate by flat emissive of base
        break;
      case "lighting":
        break;
      case "ao":
        break;
      case "specular":
        break;
      case "normal":
        break;
      case "roughness":
        break;
      case "emissive":
        break;
      case "rim":
        break;
    }
  }
}

// The real channel visualization is done with a per-object override material so
// each term renders in isolation without permanently mutating the presets.
function makeChannelMaterial(src: THREE.MeshStandardMaterial, ch: Channel): THREE.Material {
  switch (ch) {
    case "base": {
      // Albedo unlit.
      return new THREE.MeshBasicMaterial({ map: src.map ?? null, color: src.color });
    }
    case "lighting": {
      // White material so only the light term shows (no albedo/texture).
      return new THREE.MeshStandardMaterial({
        color: 0xffffff, metalness: src.metalness, roughness: src.roughness,
        normalMap: src.normalMap, normalScale: src.normalScale?.clone(),
        envMapIntensity: (src as any).envMapIntensity ?? 1,
      });
    }
    case "ao": {
      // Show the AO/roughness detail map as greyscale albedo, unlit.
      return new THREE.MeshBasicMaterial({ map: src.aoMap ?? src.roughnessMap ?? null, color: 0xffffff });
    }
    case "roughness": {
      return new THREE.MeshBasicMaterial({ map: src.roughnessMap ?? null, color: 0xffffff });
    }
    case "normal": {
      return new THREE.MeshBasicMaterial({ map: src.normalMap ?? null, color: 0xffffff });
    }
    case "specular": {
      // Pure metal, no albedo, low roughness → highlights only.
      return new THREE.MeshStandardMaterial({
        color: 0x111111, metalness: 1.0, roughness: Math.min(0.25, src.roughness),
        envMapIntensity: 1.4, normalMap: src.normalMap, normalScale: src.normalScale?.clone(),
      });
    }
    case "emissive": {
      const e = src.emissive ? src.emissive.clone() : new THREE.Color(0x000000);
      return new THREE.MeshBasicMaterial({ color: e });
    }
    case "rim": {
      // Dark base; the rig's rim light + normal produce edge light only.
      return new THREE.MeshStandardMaterial({
        color: 0x05070c, metalness: 0.3, roughness: 0.7,
        normalMap: src.normalMap, normalScale: src.normalScale?.clone(),
      });
    }
    case "final":
    default:
      return src;
  }
}

function styleBtn(b: HTMLButtonElement, active: boolean): void {
  b.style.cssText =
    `all:unset;cursor:pointer;padding:6px 11px;font:11px/1.2 'Kenney Future Narrow',monospace;` +
    `letter-spacing:.08em;text-transform:uppercase;color:${active ? "#04070e" : "#bfeaff"};` +
    `background:${active ? "#4ee2ff" : "rgba(20,32,54,.7)"};` +
    `border:1px solid ${active ? "#4ee2ff" : "rgba(120,160,210,.4)"};` +
    `box-shadow:${active ? "0 0 10px rgba(78,226,255,.5)" : "none"};`;
}

function open(): void {
  if (dbg) return;

  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;inset:0;z-index:100000;background:" +
    "radial-gradient(1400px 700px at 62% 8%,#0c1830 0%,transparent 60%)," +
    "radial-gradient(900px 500px at 15% 92%,#150a1e 0%,transparent 60%),#04060d;";
  document.body.appendChild(root);

  const w = window.innerWidth, h = window.innerHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, w / h, 1, 5000);
  camera.position.set(0, 240, 620);
  camera.lookAt(0, 0, 0);

  // Env reflections (shared with production intent).
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Shared lighting rig (the real one from space-material.ts).
  const rig = addSpaceLightRig(scene, { shadows: true });

  // Ground catch-plane for contact shadows so grounding reads (debug only).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2200, 900),
    new THREE.ShadowMaterial({ opacity: 0.35 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -120;
  ground.receiveShadow = true;
  scene.add(ground);

  const state: DebugState = {
    root, renderer, scene, camera, rig,
    specimens: [], channel: "final", raf: 0,
    statsEl: document.createElement("div"),
    frames: 0, lastFpsT: performance.now(), fps: 0, disposed: false,
  };
  dbg = state;

  // Load specimens.
  const loader = new GLTFLoader();
  for (const spec of SPECIMENS) {
    loader.load(spec.url, (gltf) => {
      if (state.disposed) return;
      const group = new THREE.Group();
      const model = gltf.scene;
      // Normalize size to a comparable footprint.
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3(); box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetPx = spec.role === "station" ? 300 : 210;
      const s = targetPx / maxDim;
      model.scale.setScalar(s);
      const center = new THREE.Vector3(); box.getCenter(center);
      model.position.sub(center.multiplyScalar(s));

      const mats: THREE.MeshStandardMaterial[] = [];
      model.traverse((ch) => {
        const mesh = ch as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        let mat = mesh.material as THREE.MeshStandardMaterial;
        if ((mat as any).type === "MeshBasicMaterial") {
          const om = mat as any;
          mat = new THREE.MeshStandardMaterial({ map: om.map, color: om.color });
          mesh.material = mat;
        }
        applySpaceMaterial(mat, spec.role, { seed: spec.x + 7 });
        mat.userData._emiI = mat.emissiveIntensity;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // stash the final material for channel restore
        mesh.userData._finalMat = mat;
        mats.push(mat);
      });

      group.add(model);
      group.position.set(spec.x, 0, 0);
      group.rotation.x = -0.5;
      scene.add(group);
      state.specimens.push({ role: spec.role, group, mats });

      // label
      const lab = document.createElement("div");
      lab.textContent = spec.label;
      lab.style.cssText =
        "position:fixed;bottom:120px;transform:translateX(-50%);font:12px 'Kenney Future Narrow',monospace;" +
        "letter-spacing:.2em;color:#9fe0ff;text-shadow:0 1px 3px #000;pointer-events:none;";
      lab.dataset.specX = String(spec.x);
      root.appendChild(lab);
    });
  }

  // ── UI: channel buttons ──
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;left:14px;bottom:14px;display:flex;gap:6px;flex-wrap:wrap;max-width:60vw;z-index:2;";
  root.appendChild(bar);
  const btns: HTMLButtonElement[] = [];
  for (const ch of CHANNELS) {
    const b = document.createElement("button");
    b.textContent = ch.label;
    styleBtn(b, ch.id === "final");
    b.onclick = () => {
      state.channel = ch.id;
      btns.forEach((bb, i) => styleBtn(bb, CHANNELS[i].id === ch.id));
      setChannel(state, ch.id);
    };
    bar.appendChild(b);
    btns.push(b);
  }

  // ── Stats HUD ──
  state.statsEl.style.cssText =
    "position:fixed;right:14px;top:14px;z-index:2;min-width:230px;padding:12px 14px;" +
    "font:11px/1.7 'Courier New',monospace;color:#bfeaff;background:rgba(8,14,26,.82);" +
    "border:1px solid rgba(78,226,255,.35);letter-spacing:.03em;";
  root.appendChild(state.statsEl);

  // ── close hint ──
  const hint = document.createElement("div");
  hint.textContent = "Ctrl+Alt+G to close · material lab";
  hint.style.cssText =
    "position:fixed;left:14px;top:14px;z-index:2;font:11px 'Courier New',monospace;color:#5a7398;";
  root.appendChild(hint);

  const onResize = () => {
    if (!dbg) return;
    const W = window.innerWidth, H = window.innerHeight;
    renderer.setSize(W, H);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);
  (state as any)._onResize = onResize;

  loop(state);
}

// Swap every specimen's meshes to the channel material (or restore final).
function setChannel(state: DebugState, ch: Channel): void {
  for (const spec of state.specimens) {
    spec.group.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      const finalMat = mesh.userData._finalMat as THREE.MeshStandardMaterial | undefined;
      if (!finalMat) return;
      if (ch === "final") {
        mesh.material = finalMat;
      } else {
        // dispose previous channel override if any
        if (mesh.userData._chMat && mesh.userData._chMat !== finalMat) {
          (mesh.userData._chMat as THREE.Material).dispose?.();
        }
        const cm = makeChannelMaterial(finalMat, ch);
        mesh.userData._chMat = cm;
        mesh.material = cm;
      }
    });
  }
  void applyChannel;
}

function updateStats(state: DebugState): void {
  const info = state.renderer.info;
  const first = state.specimens[0]?.mats[0];
  const lights = ["key(dir)", "fill(dir)", "rim(dir)", "ambient"];
  state.statsEl.innerHTML =
    `<div style="color:#4ee2ff;letter-spacing:.16em;margin-bottom:6px">MATERIAL LAB</div>` +
    row("Renderer", "Three.js WebGL") +
    row("Shader", "MeshStandard (PBR)") +
    row("Channel", CHANNELS.find(c => c.id === state.channel)?.label ?? "") +
    row("Material", first ? "MeshStandardMaterial" : "—") +
    row("Metallic", first ? first.metalness.toFixed(2) : "—") +
    row("Roughness", first ? first.roughness.toFixed(2) : "—") +
    row("EnvMap", first ? ((first as any).envMapIntensity ?? 1).toFixed(2) : "—") +
    row("Lights", String(lights.length)) +
    `<div style="color:#7a92b8;font-size:10px;margin:2px 0 6px">${lights.join(" · ")}</div>` +
    row("Draw calls", String(info.render.calls)) +
    row("Triangles", String(info.render.triangles)) +
    row("FPS", String(state.fps));
}

function row(k: string, v: string): string {
  return `<div style="display:flex;justify-content:space-between;gap:12px">` +
    `<span style="color:#7a92b8">${k}</span><span>${v}</span></div>`;
}

function loop(state: DebugState): void {
  if (state.disposed) return;
  const now = performance.now();
  state.frames++;
  if (now - state.lastFpsT >= 500) {
    state.fps = Math.round((state.frames * 1000) / (now - state.lastFpsT));
    state.frames = 0; state.lastFpsT = now;
  }
  // Slow turntable so specular/rim/normal read as the light sweeps.
  for (const spec of state.specimens) spec.group.rotation.y += 0.004;

  // reposition labels under each specimen
  for (const el of Array.from(state.root.querySelectorAll<HTMLElement>("[data-spec-x]"))) {
    const sx = Number(el.dataset.specX);
    const v = new THREE.Vector3(sx, -110, 0).project(state.camera);
    el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + "px";
  }

  state.renderer.render(state.scene, state.camera);
  updateStats(state);
  state.raf = requestAnimationFrame(() => loop(state));
}

function close(): void {
  if (!dbg) return;
  const s = dbg; dbg = null; s.disposed = true;
  cancelAnimationFrame(s.raf);
  if ((s as any)._onResize) window.removeEventListener("resize", (s as any)._onResize);
  s.renderer.dispose();
  s.root.remove();
}

export function initMaterialDebug(): void {
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.altKey && (e.key === "g" || e.key === "G")) {
      e.preventDefault();
      if (dbg) close(); else open();
    }
  };
  window.addEventListener("keydown", onKey);
  (window as any).__materialDebug = () => { if (dbg) close(); else open(); };
}

export function destroyMaterialDebug(): void {
  close();
  delete (window as any).__materialDebug;
}
