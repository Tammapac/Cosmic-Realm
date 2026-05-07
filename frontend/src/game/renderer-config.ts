// Renderer toggle - switch between Canvas2D and PixiJS
// Set to "pixi" to use WebGL, "canvas2d" to use legacy renderer
export let activeRenderer: "canvas2d" | "pixi" = "pixi";

export function setRenderer(r: "canvas2d" | "pixi"): void {
  activeRenderer = r;
}

export const DEBUG_OVERLAY = false;

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
