// three-postfx.ts — optional EffectComposer post-processing for the 3D layers.
//
// The ship/station layers draw transparent WebGL overlays onto a PixiJS 2D
// world (orthographic, top-down). When the active quality tier enables
// post-processing, this module builds an EffectComposer that renders the main
// scene through: RenderPass → GTAO (AO) → UnrealBloom (soft emissive glow) →
// FXAA → vignette → OutputPass. The composer writes into a caller-supplied
// render target (the layer's outlineRT) so the layer's existing outline /
// selection / FX passes keep compositing on top, unchanged.
//
// Everything is gated by RendererSettings, so low tiers skip this entirely and
// fall back to the layer's cheap inline pipeline. GTAO/SSR only turn on where
// the tier allows.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { getRendererSettings } from "./RendererSettings";

export type PostFX = {
  composer: EffectComposer;
  bloom: UnrealBloomPass | null;
  gtao: GTAOPass | null;
  fxaa: ShaderPass | null;
  vignette: ShaderPass | null;
  setSize(w: number, h: number): void;
  render(dt: number): void;
  dispose(): void;
};

/**
 * Build the post-processing chain for a layer, or return null if the tier
 * disables it (caller then uses its own inline pipeline).
 *
 * @param target  the render target to composite into (the layer's outlineRT),
 *                so downstream outline/FX passes read the post-processed image.
 *                Pass null to render straight to screen.
 */
export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  bufW: number,
  bufH: number,
  target: THREE.WebGLRenderTarget | null,
): PostFX | null {
  const s = getRendererSettings();
  if (!s.postProcessing) return null;

  const composer = new EffectComposer(renderer, target ?? undefined);
  composer.renderToScreen = target === null;
  composer.setSize(bufW, bufH);

  // 1) base scene
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2) GTAO ambient occlusion — soft contact darkening in crevices.
  let gtao: GTAOPass | null = null;
  if (s.gtao) {
    gtao = new GTAOPass(scene, camera, bufW, bufH);
    // GTAO param names vary by three version; set defensively.
    const g: any = gtao;
    if (g.output !== undefined && (GTAOPass as any).OUTPUT?.Default !== undefined) {
      g.output = (GTAOPass as any).OUTPUT.Default;
    }
    try {
      g.updateGtaoMaterial?.({ radius: s.gtaoRadius, distanceExponent: 1, thickness: 1, scale: s.gtaoIntensity });
    } catch { /* older API — leave defaults */ }
    if (g.blendIntensity !== undefined) g.blendIntensity = s.gtaoIntensity;
    composer.addPass(gtao);
  }

  // 3) UnrealBloom — very soft, high threshold so ONLY emissive cores/thrusters
  //    bloom (hulls never emit, so they don't glow). AAA restraint.
  let bloom: UnrealBloomPass | null = null;
  if (s.bloom) {
    bloom = new UnrealBloomPass(
      new THREE.Vector2(bufW, bufH),
      s.bloomStrength,
      s.bloomRadius,
      s.bloomThreshold,
    );
    composer.addPass(bloom);
  }

  // 4) FXAA — cheap edge AA on the composited result.
  let fxaa: ShaderPass | null = null;
  if (s.fxaa) {
    fxaa = new ShaderPass(FXAAShader);
    fxaa.material.uniforms["resolution"].value.set(1 / bufW, 1 / bufH);
    composer.addPass(fxaa);
  }

  // 5) subtle vignette (high/ultra only).
  let vignette: ShaderPass | null = null;
  if (s.vignette) {
    vignette = new ShaderPass(VignetteShader);
    vignette.material.uniforms["offset"].value = 1.15;
    vignette.material.uniforms["darkness"].value = s.vignetteAmount;
    composer.addPass(vignette);
  }

  // 6) output (tone map + color space handled by renderer; OutputPass ensures
  //    correct final encoding when rendering through the composer).
  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,
    gtao,
    fxaa,
    vignette,
    setSize(w: number, h: number) {
      composer.setSize(w, h);
      if (fxaa) fxaa.material.uniforms["resolution"].value.set(1 / w, 1 / h);
      if (gtao) (gtao as any).setSize?.(w, h);
      if (bloom) (bloom as any).setSize?.(w, h);
    },
    render(dt: number) {
      composer.render(dt);
    },
    dispose() {
      composer.dispose();
    },
  };
}
