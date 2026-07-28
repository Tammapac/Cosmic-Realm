// ─────────────────────────────────────────────────────────────────────────────
// RendererSettings — single source of truth for the Three.js rendering quality.
//
// The game draws its 3D ships/stations as transparent WebGL overlays on top of a
// PixiJS 2D world (orthographic, top-down). This module centralises every
// renderer / lighting / post-processing tunable so the look can be tuned in one
// place and scaled per GPU. The three-ship-layer and three-station-layer read
// their config from here instead of hard-coded literals.
//
// Design goals (Blender-Eevee-like premium PBR): ACES filmic, sRGB, IBL via
// PMREM (HDR when available, RoomEnvironment fallback), soft PCF shadows, a very
// soft bloom that only emissives trigger, subtle GTAO/SSR/FXAA, optional light
// cinematic fog. Everything is gated per quality tier so low-end hardware stays
// smooth.
// ─────────────────────────────────────────────────────────────────────────────

export type QualityTier = "low" | "medium" | "high" | "ultra";

export type RendererSettings = {
  tier: QualityTier;

  // ── Renderer / color management ──
  toneMappingExposure: number;      // ACES filmic exposure
  maxPixelRatio: number;            // cap devicePixelRatio
  anisotropy: number;               // texture anisotropy cap (clamped to GPU max)

  // ── Image-based lighting ──
  useHDREnvironment: boolean;       // load a real .hdr via PMREM (else RoomEnvironment)
  hdrEnvUrl: string | null;
  environmentIntensity: number;     // scene.environmentIntensity multiplier

  // ── Shadows ──
  shadowsEnabled: boolean;
  shadowMapSize: number;            // per-light shadow resolution
  shadowBias: number;
  shadowNormalBias: number;

  // ── Post-processing master ──
  postProcessing: boolean;          // use EffectComposer at all (else legacy inline pipeline)

  // ── Bloom (very soft, AAA — only emissives should trigger it) ──
  bloom: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;           // high threshold so ONLY emissive cores/thrusters bloom

  // ── Ambient occlusion (GTAO) ──
  gtao: boolean;
  gtaoRadius: number;
  gtaoIntensity: number;

  // ── Screen-space reflections (expensive; ortho top-down gain is modest) ──
  ssr: boolean;

  // ── Anti-aliasing (post) ──
  fxaa: boolean;

  // ── Subtle cinematic grade ──
  vignette: boolean;
  vignetteAmount: number;

  // ── Optional light atmospheric fog (depth cue only, off by default) ──
  fog: boolean;
  fogColor: number;
  fogDensity: number;
};

// ── Per-tier presets ────────────────────────────────────────────────────────
const HDR_ENV_URL = "/assets/hdr/space_env_1k.hdr";

const PRESETS: Record<QualityTier, RendererSettings> = {
  low: {
    tier: "low",
    toneMappingExposure: 0.9,
    maxPixelRatio: 1,
    anisotropy: 1,
    useHDREnvironment: false,
    hdrEnvUrl: null,
    environmentIntensity: 0.42,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    shadowBias: -0.0006,
    shadowNormalBias: 0.7,
    postProcessing: false,        // low uses the cheap legacy inline pipeline
    bloom: false,
    bloomStrength: 0.35,
    bloomRadius: 0.4,
    bloomThreshold: 0.9,
    gtao: false,
    gtaoRadius: 0.25,
    gtaoIntensity: 0.8,
    ssr: false,
    fxaa: false,
    vignette: false,
    vignetteAmount: 0,
    fog: false,
    fogColor: 0x0a1424,
    fogDensity: 0,
  },
  medium: {
    tier: "medium",
    toneMappingExposure: 0.88,
    maxPixelRatio: 1.5,
    anisotropy: 4,
    useHDREnvironment: true,
    hdrEnvUrl: HDR_ENV_URL,
    environmentIntensity: 0.46,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    shadowBias: -0.0005,
    shadowNormalBias: 0.6,
    postProcessing: true,
    bloom: true,
    bloomStrength: 0.42,
    bloomRadius: 0.55,
    bloomThreshold: 0.85,
    gtao: false,                  // GTAO off on medium (perf)
    gtaoRadius: 0.25,
    gtaoIntensity: 0.85,
    ssr: false,
    fxaa: true,
    vignette: false,
    vignetteAmount: 0,
    fog: false,
    fogColor: 0x0a1424,
    fogDensity: 0.00008,
  },
  high: {
    tier: "high",
    toneMappingExposure: 0.86,
    maxPixelRatio: 2,
    anisotropy: 8,
    useHDREnvironment: true,
    hdrEnvUrl: HDR_ENV_URL,
    environmentIntensity: 0.5,
    shadowsEnabled: true,
    shadowMapSize: 4096,
    shadowBias: -0.0004,
    shadowNormalBias: 0.6,
    postProcessing: true,
    bloom: true,
    bloomStrength: 0.45,
    bloomRadius: 0.6,
    bloomThreshold: 0.82,
    gtao: true,
    gtaoRadius: 0.3,
    gtaoIntensity: 0.9,
    ssr: false,                   // SSR still off by default on high (ortho gain small)
    fxaa: true,
    vignette: true,
    vignetteAmount: 0.28,
    fog: false,
    fogColor: 0x0a1424,
    fogDensity: 0.0001,
  },
  ultra: {
    tier: "ultra",
    toneMappingExposure: 0.85,
    maxPixelRatio: 2,
    anisotropy: 16,
    useHDREnvironment: true,
    hdrEnvUrl: HDR_ENV_URL,
    environmentIntensity: 0.55,
    shadowsEnabled: true,
    shadowMapSize: 4096,
    shadowBias: -0.00035,
    shadowNormalBias: 0.55,
    postProcessing: true,
    bloom: true,
    bloomStrength: 0.48,
    bloomRadius: 0.65,
    bloomThreshold: 0.8,
    gtao: true,
    gtaoRadius: 0.32,
    gtaoIntensity: 0.95,
    ssr: true,                    // SSR only at ultra
    fxaa: true,
    vignette: true,
    vignetteAmount: 0.3,
    fog: true,
    fogColor: 0x0a1424,
    fogDensity: 0.00012,
  },
};

// ── GPU / hardware auto-detection ────────────────────────────────────────────
// Best-effort tier guess from the unmasked GPU string + memory + cores + DPR.
// Deliberately conservative: unknown hardware lands on "medium".
function detectTier(): QualityTier {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!gl) return "low";

    let gpu = "";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (dbg) gpu = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "").toLowerCase();

    const mem = (navigator as any).deviceMemory ?? 4;       // GB, may be undefined
    const cores = navigator.hardwareConcurrency ?? 4;
    const mobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

    // Known weak GPUs / integrated → low
    if (
      mobile ||
      /(swiftshader|llvmpipe|software|apple gpu \(|mali-4|adreno 3|adreno 4|powervr|intel.*(hd|uhd) graphics (5|6)\d\d)/i.test(gpu) ||
      mem <= 2
    ) {
      return "low";
    }

    // Strong discrete GPUs → ultra
    if (
      /(rtx (30|40|50)|rtx 20[7-9]0|radeon rx (6|7|9)\d\d\d|rx 6[89]00|rx 7\d00|apple m[1-9] (pro|max|ultra)|arc a7)/i.test(gpu) &&
      mem >= 8 && cores >= 8
    ) {
      return "ultra";
    }

    // Mid-high discrete / recent integrated → high
    if (
      /(rtx|gtx 16|gtx 10[6-9]0|radeon rx|arc a|apple m[1-9]|geforce)/i.test(gpu) &&
      mem >= 6
    ) {
      return "high";
    }

    // Everything else with a real GPU → medium
    return "medium";
  } catch {
    return "medium";
  }
}

// ── Public accessor + override ───────────────────────────────────────────────
let _tier: QualityTier | null = null;
let _override: QualityTier | null = null;

/** localStorage override key, so it survives reloads and can be set from console. */
const LS_KEY = "cr-render-tier";

function readOverride(): QualityTier | null {
  if (_override) return _override;
  try {
    const v = localStorage.getItem(LS_KEY) as QualityTier | null;
    if (v && v in PRESETS) return v;
  } catch { /* ignore */ }
  return null;
}

/** Resolve the active tier (override → cached detection). */
export function getQualityTier(): QualityTier {
  const ov = readOverride();
  if (ov) return ov;
  if (!_tier) _tier = detectTier();
  return _tier;
}

/** The resolved settings object for the active tier. */
// ?station-pbr forces GTAO on regardless of tier — the world-PBR test wants the
// hangar's contact-AO look on stations even on medium/low GPUs. Read once.
const _worldPbr =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("station-pbr");

export function getRendererSettings(): RendererSettings {
  const s = PRESETS[getQualityTier()];
  if (_worldPbr && !s.gtao) {
    // Force GTAO on for the station-PBR test (the hangar preset's blendIntensity 1.5,
    // radius 0.7). Cloned so the shared preset object is not mutated.
    return { ...s, gtao: true, gtaoRadius: 0.7, gtaoIntensity: 1.5 };
  }
  return s;
}

/** Force a tier at runtime (persisted). Call `window.__RENDER_TIER("ultra")`. */
export function setQualityTier(tier: QualityTier): void {
  _override = tier;
  try { localStorage.setItem(LS_KEY, tier); } catch { /* ignore */ }
}

/** Raw presets (for tooling / the material-debug panel). */
export { PRESETS as RENDERER_PRESETS };

// Console hook so the look can be A/B-tested live without a rebuild.
if (typeof window !== "undefined") {
  (window as any).__RENDER_TIER = (t?: QualityTier) => {
    if (t) { setQualityTier(t); return `tier set to ${t} (reload to apply)`; }
    return getQualityTier();
  };
}
