// Renderer toggle - switch between Canvas2D and PixiJS
// Set to "pixi" to use WebGL, "canvas2d" to use legacy renderer
export let activeRenderer: "canvas2d" | "pixi" = "pixi";

export function setRenderer(r: "canvas2d" | "pixi"): void {
  activeRenderer = r;
}

export const DEBUG_OVERLAY = false;

// Fake pixel-art rendering for 3D GLB layers (ships + stations).
// Models keep their full geometry/animations — only the WebGL drawing buffer
// is rendered at 1/PIXELATE_3D_SCALE resolution and upscaled with
// nearest-neighbor, so they look like pixel-art objects in-game.
// OFF: ships/stations render at full resolution with antialiasing, ACES
// tone mapping and environment reflections — crisp, shiny, integrated.
export const PIXELATE_3D = false;
export const PIXELATE_3D_SCALE = 2.5;

// ── Isolated docking-flow feature (WIP) ─────────────────────────────────────
// When false, the game behaves EXACTLY as before — no scene manager, no docking
// cinematic, no new HangarScene. Everything behind this flag lives in
// src/game/scene/ and is deletable without touching core systems.
export const ENABLE_NEW_DOCKING_FLOW = false;

// Three.js Nebula Background Configuration
export const ENABLE_THREE_NEBULA_SHADER = false;
export const THREE_NEBULA_RENDER_SCALE = 0.5;    // Internal resolution (0.5 = half-res for performance)
export const THREE_NEBULA_PIXEL_SIZE = 4.0;      // Pixel grid size (higher = chunkier pixels)
export const THREE_NEBULA_ALPHA = 0.5;           // Overall opacity (0.0 - 1.0)
export const THREE_NEBULA_INTENSITY = 1.2;       // Brightness multiplier - much brighter
export const THREE_NEBULA_SPEED_A = 0.02;        // Layer 1 parallax speed (slow drift)
export const THREE_NEBULA_SPEED_B = 0.05;        // Layer 2 parallax speed (faster drift)
export const THREE_NEBULA_SCALE_A = 0.8;         // Layer 1 noise scale (large clouds)
export const THREE_NEBULA_SCALE_B = 2.5;         // Layer 2 noise scale (fine detail)
