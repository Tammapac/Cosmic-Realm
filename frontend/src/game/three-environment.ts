// three-environment.ts — shared IBL setup for the ship + station layers.
//
// Builds a prefiltered environment map via PMREMGenerator. Prefers a real HDR
// file (richer, cinematic reflections) when the active quality tier allows it
// and the file loads; otherwise falls back to the procedural RoomEnvironment
// (0 KB, always available). The HDR loads asynchronously — the scene gets the
// RoomEnvironment immediately and is upgraded in place once the HDR arrives, so
// there is never a frame without IBL.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { getRendererSettings } from "./RendererSettings";

/**
 * Install IBL on `scene`. Returns the PMREM generator so the caller can dispose
 * it on teardown. Sets scene.environment (+ environmentIntensity) immediately
 * with RoomEnvironment, then swaps in the HDR if configured & available.
 */
export function loadEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): THREE.PMREMGenerator {
  const s = getRendererSettings();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  // Immediate procedural fallback so IBL is never missing.
  const room = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = room;
  (scene as any).environmentIntensity = s.environmentIntensity;

  if (s.useHDREnvironment && s.hdrEnvUrl) {
    new HDRLoader().load(
      s.hdrEnvUrl,
      (hdr) => {
        try {
          hdr.mapping = THREE.EquirectangularReflectionMapping;
          const env = pmrem.fromEquirectangular(hdr).texture;
          // dispose the room fallback we no longer need
          const old = scene.environment;
          scene.environment = env;
          (scene as any).environmentIntensity = s.environmentIntensity;
          hdr.dispose();
          if (old && old !== env) old.dispose();
        } catch {
          /* keep the RoomEnvironment fallback on any error */
        }
      },
      undefined,
      () => {
        // 404 / decode error → silently keep RoomEnvironment.
      },
    );
  }

  return pmrem;
}

// ── Bright viewport IBL ──────────────────────────────────────────────────────
// The shared 3D scene lights every model from ONE environment. The default
// RoomEnvironment / space HDR is deliberately dark and cinematic, which is why
// the GLBs — the near-black metallic enemy hulls worst of all — rendered as
// silhouettes: a metal reflects its environment, and a dark environment gives it
// nothing to reflect. No amount of exposure or key-light fixes that (it clips
// the bright emissive bits first). The real lever is the environment itself.
//
// This installs a BRIGHT, neutral gradient environment — sky-grey overhead,
// mid-grey at the horizon, darker underneath — the way an editor viewport is
// lit. It fills the shadow side and gives the metal something bright to reflect,
// so every model reads in the round without turning flat. Procedural (a 512×256
// canvas → PMREM), so it costs nothing to ship and never 404s.
//
// `brightness` (0..1) is the gradient's own level; `intensity` scales the IBL on
// top and CAN exceed 1 to push the whole scene brighter than the gradient alone
// allows (the gradient maxes at sRGB white). Returns the PMREM generator for
// disposal.
export function installBrightViewportEnv(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  brightness = 1.0,
  intensity = 1.0,
): THREE.PMREMGenerator {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  const hi = Math.round(Math.min(1, brightness) * 255);
  const mid = Math.round(Math.min(1, brightness) * 200);
  const lo = Math.round(Math.min(1, brightness) * 120);
  // A hair of cool blue overhead so hulls pick up a subtle space tint rather
  // than reading as neutral studio grey.
  g.addColorStop(0.0, `rgb(${hi},${hi},${Math.min(255, hi + 12)})`);
  g.addColorStop(0.5, `rgb(${mid},${mid},${mid})`);
  g.addColorStop(1.0, `rgb(${lo},${lo},${lo})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const old = scene.environment;
  scene.environment = pmrem.fromEquirectangular(tex).texture;
  (scene as any).environmentIntensity = intensity;

  tex.dispose();
  if (old) old.dispose();
  return pmrem;
}

// ── Studio IBL (AAA PBR) ─────────────────────────────────────────────────────
// The reflection/IBL source for the professional PBR pipeline. NOT the space
// background — this is an INVISIBLE studio environment, the way Blender's
// Material Preview lights a model: a bright soft sky, a few large soft "softbox"
// light panels, and a darker floor. That gives metals something rich and soft to
// reflect (the whole point of PBR) without any of them reading as a mirror or as
// the flat 3-stop gradient the old bright-viewport env used.
//
// Two builders share one installer:
//   • "studio" — procedural, equirectangular, painted with radial soft panels so
//     reflections have shape and gradient, not a flat wash. 0 KB, never 404s.
//   • "hdr"    — a real .hdr file via HDRLoader (async; keeps the studio until it
//     arrives). Used only for A/B comparison against the procedural studio.
//
// Returns the PMREM generator so the caller can dispose it on teardown. The
// caller decides scene.background separately (this never touches background).

/** Paint a neutral studio into an equirect canvas: sky, softboxes, floor. */
function paintStudioEquirect(w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d")!;

  // Vertical base gradient: bright cool sky at top → neutral horizon → dark floor.
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0.00, "#dfe6f0"); // sky, slightly cool
  base.addColorStop(0.45, "#aab2be"); // upper horizon
  base.addColorStop(0.55, "#8f97a3"); // horizon line
  base.addColorStop(0.75, "#4a4f57"); // floor falloff
  base.addColorStop(1.00, "#2a2d33"); // dark floor
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Soft light panels (softboxes) — LARGE, broad radial highlights so reflections
  // read as soft diffuse glow across every surface (floor, walls, ship, crates,
  // barrels), never sharp mirror shapes. Screen blend + a wide falloff so there
  // are no hard edges to reflect.
  ctx.globalCompositeOperation = "lighter";
  const panel = (cx: number, cy: number, r: number, peak: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    // Gentle centre, long soft tail = broad glow, not a bright hot spot.
    g.addColorStop(0, `rgba(255,255,255,${peak})`);
    g.addColorStop(0.4, `rgba(255,255,255,${peak * 0.5})`);
    g.addColorStop(0.75, `rgba(255,255,255,${peak * 0.15})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  // Bigger, softer panels than before — key (upper-left), fill (upper-right), wash.
  panel(w * 0.28, h * 0.22, h * 0.85, 0.42);
  panel(w * 0.72, h * 0.28, h * 0.75, 0.26);
  panel(w * 0.50, h * 0.10, h * 0.60, 0.20);
  ctx.globalCompositeOperation = "source-over";

  // Blur the whole equirect so EVERY reflection is soft regardless of a surface's
  // roughness — this is the global lever that stops all objects (not just the
  // floor) from showing sharp reflected lights. A big blur radius = diffuse glow.
  const blurred = document.createElement("canvas");
  blurred.width = w; blurred.height = h;
  const bctx = blurred.getContext("2d")!;
  bctx.filter = `blur(${Math.round(h * 0.05)}px)`;
  bctx.drawImage(cv, 0, 0);
  bctx.filter = "none";
  return blurred;
}

export type EnvKind = "studio" | "hdr";

export function installStudioEnv(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  opts: { kind?: EnvKind; hdrUrl?: string; intensity?: number } = {},
): THREE.PMREMGenerator {
  const { kind = "studio", hdrUrl = "/assets/hdr/space_env_1k.hdr", intensity = 1.0 } = opts;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  // Always install the procedural studio first, so IBL is never missing even if
  // the HDR is still loading or fails.
  const cv = paintStudioEquirect(1024, 512);
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.environment = pmrem.fromEquirectangular(tex).texture;
  (scene as any).environmentIntensity = intensity;
  tex.dispose();

  if (kind === "hdr") {
    new HDRLoader().load(
      hdrUrl,
      (hdr) => {
        try {
          hdr.mapping = THREE.EquirectangularReflectionMapping;
          const env = pmrem.fromEquirectangular(hdr).texture;
          const old = scene.environment;
          scene.environment = env;
          hdr.dispose();
          if (old && old !== env) old.dispose();
        } catch { /* keep the studio on any error */ }
      },
      undefined,
      () => { /* 404/decode → keep the studio */ },
    );
  }

  return pmrem;
}
