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
