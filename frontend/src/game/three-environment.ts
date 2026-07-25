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
// `brightness` is the overall level (1.0 = the value chosen in the viewport
// A/B). Returns the PMREM generator for disposal.
export function installBrightViewportEnv(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  brightness = 1.0,
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
  // Intensity 1.0: the gradient already carries the brightness, so this is a
  // straight 1:1 — no extra multiplier to reason about.
  (scene as any).environmentIntensity = 1.0;

  tex.dispose();
  if (old) old.dispose();
  return pmrem;
}
