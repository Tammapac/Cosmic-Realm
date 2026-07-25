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
//
// OPT-IN, not a build-time switch. The flow is unfinished — docking currently
// ends in a blackout because the hangar scene does not exist yet — so it must
// not reach players who did not ask for it. But it also has to be testable on
// the live site, which is where this project is actually played. A URL flag
// gives both: the default stays false for everyone, and
//
//     https://cosmicrealm.net/?docking-flow
//
// turns it on for that one browser. Same mechanism as ?hud-editor / ?dock-test.
//
// Read ONCE at module load and frozen into a const: three-station-layer.ts picks
// its model pool from this at module scope, so a value that could change later
// would leave the layer loading one station model and the docking code assuming
// another.
function readDockingFlowFlag(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("docking-flow");
}

export const ENABLE_NEW_DOCKING_FLOW = readDockingFlowFlag();

// ── Shared 3D scene ─────────────────────────────────────────────────────────
// The world used to be drawn by THREE separate WebGLRenderers — one for
// stations, one for enemies (a duplicate module instance via ?instance=enemy),
// one for the player + other players. Three renderers means three depth
// buffers, so nothing in one could ever occlude anything in another; the
// stacking you saw was purely the order their canvases were composited in.
//
// With this on, all four object groups live in ONE scene, under ONE camera, in
// ONE renderer.render() call, sharing ONE depth buffer:
//
//     worldScene
//     ├── stationsGroup
//     ├── playerShipsGroup
//     ├── enemyShipsGroup
//     └── npcGroup
//
// That is what makes a real 3D docking shot possible — the ship can be occluded
// by the hangar roof because the roof is now genuinely in front of it in z.
//
// OPT-IN, not a build-time switch — same reasoning as ENABLE_NEW_DOCKING_FLOW
// above. The merge is verified (8/8 depth tests, screenshots) but it changes
// how stations look for EVERY player (they route through the ship layer's light
// rig now, so a touch warmer/brighter), and the point of merging is to unlock a
// docking shot that does not exist yet. So it must be testable on the live site
// without being forced on everyone. The default stays false; append
//
//     https://cosmicrealm.net/?shared-scene
//
// to turn it on for that one browser. Same mechanism as ?docking-flow.
//
// Read ONCE at module load and frozen into a const: three-ship-layer.ts and
// three-station-layer.ts branch on this at module init, so a value that could
// change later would leave one layer owning a renderer and the other adopting a
// shared one — a torn state with no single depth buffer.
//
// Every branch this gates is an `if`; with the flag off the old three-renderer
// stack runs verbatim, nothing was deleted.
function readSharedSceneFlag(): boolean {
  if (typeof window === "undefined") return false;
  const p = new URLSearchParams(window.location.search);
  // ?depth-test IS the harness for this feature, so it always forces it on —
  // otherwise the harness would boot the old three-renderer stack and prove
  // nothing about the merge it exists to verify.
  return p.has("shared-scene") || p.has("depth-test");
}

export const ENABLE_SHARED_3D_SCENE = readSharedSceneFlag();

// How far above the world plane the ship groups float, in scene units per unit
// of camera zoom.
//
// Not cosmetic — load-bearing. cosmic_station.glb has its origin at the BOTTOM
// of the model and is never recentred, so a station occupies scene y −528…+1400
// while a ship spans ±51…±102 around y=0. Sharing a depth buffer without this
// lift would bury every ship inside the hull of any station it flew near, for
// the whole 1843-px footprint — not a docking effect, just an invisible ship.
//
// 1500 clears the tallest station with margin. The docking sequence ramps the
// lift back down to 0 (see setShipLiftFactor) so the ship descends INTO the
// station geometry exactly when it is supposed to be swallowed by it.
export const SHARED_3D_SHIP_LIFT = 1500;

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
