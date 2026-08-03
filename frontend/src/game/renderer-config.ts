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
// ?hangar is the umbrella flag for the full 3D docking experience: it turns on
// the docking cinematic (this flag), the shared 3D scene (below), AND the new
// HangarScene (ENABLE_HANGAR_3D_SCENE, further down). One switch instead of
// three, because the pieces are useless apart — the cinematic needs the shared
// depth buffer, and the hangar scene needs the cinematic's state machine. So
// every reader below ORs it in.
function readHangarFlag(): boolean {
  if (typeof window === "undefined") return false;
  const p = new URLSearchParams(window.location.search);
  // ?hangar-test is the isolated harness for the hangar scene; it must force the
  // whole stack on the same way ?depth-test forces the shared scene.
  if (p.has("hangar") || p.has("hangar-test")) return true;
  // FULL ROLLOUT: the 3D docking experience is now the default for EVERY player —
  // no ?hangar needed. ?no-hangar is the emergency opt-out (reverts that browser to
  // the old 2D dock) in case a client hits a problem in the field.
  return !p.has("no-hangar");
}

function readDockingFlowFlag(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("docking-flow") || readHangarFlag();
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
  // nothing about the merge it exists to verify. ?hangar implies it too.
  return p.has("shared-scene") || p.has("depth-test") || readHangarFlag();
}

export const ENABLE_SHARED_3D_SCENE = readSharedSceneFlag();

// ── World PBR look ──────────────────────────────────────────────────────────
// The HANGAR's calibrated grade on the shared WORLD renderer, applied to EVERY
// model — stations, the player ship, enemies, NPCs: AgX tone mapping (not ACES),
// the Space-HDRI studio environment for soft reflections, and a real GTAO
// screen-space AO pass over the whole world scene.
//
// NOW GLOBAL / default-ON (verified on the stations first via ?station-pbr).
// ?no-station-pbr is the emergency opt-out back to the old ACES + bright-gradient
// look — GTAO over many NPCs is the one perf risk, so a client that struggles can
// disable it in the field.
function readWorldPbrFlag(): boolean {
  if (typeof window === "undefined") return false;
  const p = new URLSearchParams(window.location.search);
  if (p.has("station-pbr")) return true;     // explicit on (kept for symmetry)
  return !p.has("no-station-pbr");           // default ON; ?no-station-pbr disables
}
export const ENABLE_WORLD_PBR = readWorldPbrFlag();

// ── New skill-tree UI (?newskills) ──────────────────────────────────────────
// Gates the redesigned React-Flow skill tree (src/features/skills). OFF by
// default — the existing SkillTreePanel / Hangar SkillsTab stay the live UI
// until the new one is finished + verified. Opt-in with ?newskills. Purely
// presentational: it reuses the same SKILL_NODES catalog, buySkillRank/
// resetSkills mutations, and skills/skillPoints store fields — no backend or
// skill-id change.
function readNewSkillsFlag(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("newskills");
}
export const ENABLE_NEW_SKILLS = readNewSkillsFlag();

// ── Native PixiJS UI layer (?pixi-ui) ───────────────────────────────────────
// Gates the native, renderer-drawn HUD (src/game/hud/*) that replaces the
// React/CSS combat HUD with PixiJS-drawn armor plates, energy shaders and
// stateful components. OFF by default: the React HUD stays live until the
// native slice reaches parity and is verified. Opt-in with ?pixi-ui. When on,
// the native combat HUD mounts into uiLayer and the React combat elements
// (TopPanel/Hotbar/resource bars) are suppressed; everything else stays React
// until later slices. Reads the same `state` singleton — no gameplay change.
function readPixiUiFlag(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("pixi-ui");
}
export const ENABLE_PIXI_UI = readPixiUiFlag();

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

// ── 3D hangar scene (the docking payoff) ────────────────────────────────────
// Gates ONLY the new HangarScene module (src/game/scene/HangarScene.ts) and its
// wiring into the docking state machine: a separate 3D scene with its OWN
// perspective camera that flies the ship through the hangar door, parks it on
// the landing pad, and shows the station interior behind the 2D menu. It rides
// on top of ENABLE_NEW_DOCKING_FLOW (the state machine) and ENABLE_SHARED_3D_SCENE
// (the depth-shared world it débuts from), both of which ?hangar already turns on.
//
// Separate from those two on purpose: with this off but ?docking-flow/?shared-scene
// on, docking still runs and still ends in the old blackout — this flag is the one
// thing that swaps that blackout for the real hangar. Deletable in isolation.
export const ENABLE_HANGAR_3D_SCENE = readHangarFlag();

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
