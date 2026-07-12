/**
 * PixiJS WebGL Renderer for Cosmic Realm
 *
 * Architecture:
 * - Uses existing Canvas2D draw functions to bake entity textures
 * - Sprite pools keyed by entity ID (create once, update position each frame)
 * - Layer hierarchy for draw order
 * - Viewport culling (skip offscreen entities)
 * - Object pooling for projectiles and particles
 * - Debug overlay showing FPS and entity counts
 */
import * as PIXI from "pixi.js";
import { initHardpointEditor, toggleHardpointEditor, isEditorActive } from "./debug/HardpointEditor";
import { DIRECTIONS_32 } from "./debug/hardpointTypes";
import { has3DModel, is3DReady, updateShip3D, setCameraZoom, beginFrame, markActive, endFrame, render3DLayer, getShipHardpointPositions, getShipMuzzleWorldPositionsAt, updateEngineGlow, updateNebulaBackground, removeShip3D, preload3DModels, getLoadingProgress, debugEnumerateAllMuzzles } from "./three-ship-layer";
import { setStationCameraZoom, beginStationFrame, updateStationOnly, endStationFrame, renderStation3DLayer, removeStation3D, initStation3DLayer } from "./three-station-layer";
// Second, independent instance of the ship layer (separate module via query
// suffix): renders ENEMY ships — with the same outline + bloom pipeline — to
// an offscreen canvas composited as a Pixi sprite BELOW names/health bars/
// projectiles/player. See vite-env.d.ts.
import {
  init3DLayer as initEnemy3DLayer,
  destroy3DLayer as destroyEnemy3DLayer,
  has3DModel as enemyHas3DModel,
  is3DReady as enemyIs3DReady,
  updateShip3D as updateEnemyShip3D,
  setCameraZoom as setEnemyCameraZoom,
  beginFrame as beginEnemyFrame,
  markActive as markEnemyActive,
  endFrame as endEnemyFrame,
  render3DLayer as renderEnemy3DLayer,
} from "./three-ship-layer?instance=enemy";
import { enemyModelKey as sharedEnemyModelKey, enemySizeScale as sharedEnemySizeScale, shipHullRadius } from "../../../lib/hitbox";
import { state } from "./store";
import { effectiveStats, getDebugSpawnBuffer } from "./loop";
import {
  Enemy, Projectile, Particle, Floater, NpcShip, OtherPlayer, Asteroid, RESOURCES,
  CargoBox, Drone, DRONE_DEFS, ZONES, STATIONS, PORTALS, DUNGEONS, SHIP_CLASSES,
  MAP_RADIUS, FACTIONS, ShipClassId, EnemyType, rankFor, Station,
  ZoneId, SHIP_SIZE_SCALE,
} from "./types";
import {
  drawShipPixels, drawEnemy, shadeHex, drawProjectile, drawParticle,
  drawStation, drawPortal, drawAsteroid, drawCargoBox, drawFloater,
  drawOtherPlayer, drawNpcShip, drawDrone, drawShip, drawHealthBar,
  drawHullShieldBars, drawRift, px, STATION_COLOR, STATION_GLYPH,
} from "./render";
import { DEBUG_OVERLAY } from "./renderer-config";
import { EffectManager } from "./pixi-effect-manager";
import {
  ShipVisualState, createShipVisual, updateShipVisual,
  triggerDamageFlash, triggerMuzzleFlash, updateMuzzleDecay, updateShipTexture,
} from "./ship-visual-renderer";
import { getShipVisualConfig as getShipVisualConfigFn } from "./ship-visual-config";
import {
  createPortalVisual, updatePortalAnimation,
  createAsteroidTexture,
  EnhancedStar, generateEnhancedStars, renderEnhancedStars,
} from "./pixi-world-visuals";

// ══════════════════════════════════════════════════════════════════════════
// PIXI APP & LAYERS
// ══════════════════════════════════════════════════════════════════════════

let app: PIXI.Application | null = null;
let bgLayer: PIXI.Container;
let worldLayer: PIXI.Container;
let trailLayer: PIXI.Container;
let asteroidLayer: PIXI.Container;
let stationLayer: PIXI.Container;
let enemyLayer: PIXI.Container;
let playerLayer: PIXI.Container;
let projectileLayer: PIXI.Container;
let projectileBehindLayer: PIXI.Container;
let effectsLayer: PIXI.Container;
let effectsBehindLayer: PIXI.Container;
let effectsFrontLayer: PIXI.Container;
let floaterLayer: PIXI.Container;
let uiLayer: PIXI.Container;

// Debug overlay for muzzle/spawn alignment verification. Rendered as a single
// PIXI.Graphics inside worldLayer so it inherits camera transform automatically.
// Populated only when window.__DEBUG_MUZZLE_MARKERS is truthy.
let debugMuzzleGfx: PIXI.Graphics | null = null;
let debugMuzzleLabels: PIXI.Container | null = null;

let stationSprite: PIXI.Sprite | null = null;
let stationTexture: PIXI.Texture | null = null;
let stationBaseTexture: PIXI.BaseTexture | null = null;

// Enemy 3D pass (second ship-layer instance) composited inside worldLayer
let enemyShipCanvas: HTMLCanvasElement | null = null;
let enemyShipSprite: PIXI.Sprite | null = null;
let enemyShipTexture: PIXI.Texture | null = null;
let enemyShipBaseTexture: PIXI.BaseTexture | null = null;

let effectManager: EffectManager | null = null;
let lastRenderTime = 0;
let prevEnemyIds = new Set<string>();
let prevEnemyData = new Map<string, { x: number; y: number; size: number; type: string }>();
let prevProjectileData = new Map<string, { x: number; y: number; color: number; weaponKind: string; angle: number; fromPlayer: boolean }>();
let prevAsteroidIds = new Set<string>();
let prevAsteroidData = new Map<string, { x: number; y: number; size: number }>();
let prevPlayerHull = -1;
let projectileGlowGraphics: PIXI.Graphics | null = null;
let projectileBehindGlowGraphics: PIXI.Graphics | null = null;

// Star field render cache — see renderBackground(). Redraw only when the
// camera moves or a few ticks pass (so twinkle keeps animating).
let _lastStarCamX = -1e9;
let _lastStarCamY = -1e9;
let _lastStarTick = -1;

// Projectile glow cache — see syncProjectiles(). Cheaper WebGL cost by
// redrawing only every other frame.
let _projGlowFrameParity = 0;

// Enemy weapon-glow throttle — see syncEnemies(). Redraws every 4th frame
// (~15 Hz). The glow is a purely cosmetic sine pulse; at 4-frame cadence
// it's indistinguishable from 60 Hz but cuts per-frame WebGL cost roughly
// by 6× enemyCount draw ops.
let _enemyGlowFrameCounter = 0;

// Projectile trail throttle — spawn one trail particle every ~50ms per
// projectile (rocket) / ~100ms (laser) instead of every frame. Previously
// spawned 45–100% chance PER FRAME PER PROJECTILE — with 10 projectiles
// on screen that was 300–600 pooled particle acquisitions per second.
const _lastProjTrailAt = new Map<string, number>();
const PROJ_TRAIL_INTERVAL_ROCKET_MS = 40;
const PROJ_TRAIL_INTERVAL_LASER_MS = 100;
const PROJ_ROCKET_SMOKE_INTERVAL_MS = 150;

// Reusable Sets — cleared at the start of each per-frame sync to avoid
// allocating on every RAF. Each function owns its own Set so nested loops
// remain safe.
const _reuseEnemySyncIds = new Set<string>();
const _reuseProjSyncIds = new Set<string>();
const _reuseProjDeathIds = new Set<string>();
const _reuseAsteroidSyncIds = new Set<string>();
const _reuseOtherPlayerSyncIds = new Set<string>();
const _reuseNpcSyncIds = new Set<string>();
const _reuseCargoSyncIds = new Set<string>();
const _reuseParticleAllIds = new Set<string>();
const _reuseDroneSyncIds = new Set<string>();
const _reuseFloaterSyncIds = new Set<string>();
const _reusePortalSyncIds = new Set<string>();
const _reuseDungeonSyncIds = new Set<string>();

// Offscreen canvas for texture baking
let bakeCanvas: HTMLCanvasElement;
let bakeCtx: CanvasRenderingContext2D;

// ══════════════════════════════════════════════════════════════════════════
// TEXTURE CACHE
// ══════════════════════════════════════════════════════════════════════════

const texCache = new Map<string, PIXI.Texture>();

const SHIP_SPRITES: Partial<Record<ShipClassId, string>> = {
  skimmer: "/ships/skimmer.png",
  wasp: "/ships/wasp.png",
  vanguard: "/ships/vanguard.png",
  reaver: "/ships/reaver.png",
  obsidian: "/ships/obsidian.png",
  marauder: "/ships/marauder.png",
  phalanx: "/ships/phalanx.png",
  titan: "/ships/titan.png",
  leviathan: "/ships/leviathan.png",
  specter: "/ships/specter.png",
  colossus: "/ships/colossus.png",
  harbinger: "/ships/harbinger.png",
  eclipse: "/ships/eclipse.png",
  sovereign: "/ships/sovereign.png",
  apex: "/ships/apex.png",
};
const shipSpriteTextures = new Map<string, PIXI.Texture>();
const shipSpriteLoading = new Set<string>();

// ── 8-DIRECTION SPRITE SYSTEM ──────────────────────────────────────────
// Pre-rendered rotation frames. sprite.rotation = 0 always; only texture swaps.
// Hysteresis prevents flicker at direction boundaries.
// ── Directional Sprite Import System ──
// To add a new ship: 1) Drop 8/16/32 sprites into /public/ships/{shipClass}/
//   Named: ship_01_N.png, ship_02_NbE.png, ... (standard compass, 1-based)
//   2) Add one line to DIRECTIONAL_SHIPS below
//   3) Rebuild. Done.
const DIR_32 = ["N","NbE","NNE","NEbN","NE","NEbE","ENE","EbN","E","EbS","ESE","SEbE","SE","SEbS","SSE","SbE","S","SbW","SSW","SWbS","SW","SWbW","WSW","WbS","W","WbN","WNW","NWbW","NW","NWbN","NNW","NbW"];
const DIR_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const DIR_8  = ["N","NE","E","SE","S","SW","W","NW"];

function getDirNames(frames: number): string[] {
  if (frames === 32) return DIR_32;
  if (frames === 16) return DIR_16;
  if (frames === 8) return DIR_8;
  return DIR_32;
}

function buildSpriteFiles(frames: number): string[] {
  const dirs = getDirNames(frames);
  return dirs.map((d, i) => `ship_${String(i + 1).padStart(2, "0")}_${d}.png`);
}

// ── Ship Registry ── Add new directional ships here ──
// ── Per-ship directional sprite config ──
// frames: number of sprite frames (8, 16, or 32)
// frame0DirectionDeg: compass direction of frame 0 in degrees (0=N, 90=E, 180=S, 270=W)
//   -> Change this if the ship points in the wrong direction (rotated)
// clockwise: true if frames go clockwise (N->E->S->W), false if counter-clockwise
//   -> Change this if the ship appears mirrored (left/right swapped)
const DIRECTIONAL_SHIPS: { id: string; frames: number; frame0DirectionDeg: number; clockwise: boolean }[] = [
  { id: "skimmer", frames: 32, frame0DirectionDeg: 180, clockwise: false },
  { id: "wasp", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "vanguard", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "reaver", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "obsidian", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "marauder", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "phalanx", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "titan", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "leviathan", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "specter", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "colossus", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "harbinger", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "eclipse", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "sovereign", frames: 32, frame0DirectionDeg: 0, clockwise: true },
  { id: "apex", frames: 32, frame0DirectionDeg: 0, clockwise: true },
];

const ROTATION_SPRITES: Partial<Record<string, {
  frames: number; path: string; files: string[];
  frame0DirectionDeg: number; clockwise: boolean;
}>> = {};
for (const ship of DIRECTIONAL_SHIPS) {
  ROTATION_SPRITES[ship.id] = {
    frames: ship.frames,
    path: `/ships/${ship.id}/`,
    files: buildSpriteFiles(ship.frames),
    frame0DirectionDeg: ship.frame0DirectionDeg,
    clockwise: ship.clockwise,
  };
}
// ── Ship Hardpoint Config ──
// Local coordinates: ship points North (up) in base frame
//   x negative = left,  x positive = right
//   y negative = front/nose,  y positive = rear/engines
// Tune these offsets per ship to match engine and weapon barrel positions.
interface ShipHardpoints {
  thrusters: { x: number; y: number }[];
  weapons: { x: number; y: number }[];
}

const SHIP_HARDPOINTS: Partial<Record<string, ShipHardpoints>> = {
  // ── Skimmer ──
  skimmer: {
    thrusters: [
      { x: -8, y: 14 },   // left engine
      { x: 8, y: 14 },    // right engine
    ],
    weapons: [
      { x: -10, y: -8 },  // left weapon mount
      { x: 10, y: -8 },   // right weapon mount
    ],
  },
  // ── Wasp ──
  wasp: {
    thrusters: [
      { x: -12, y: 12 },  // left engine
      { x: 12, y: 12 },   // right engine
    ],
    weapons: [
      { x: -14, y: -6 },  // left weapon mount
      { x: 14, y: -6 },   // right weapon mount
    ],
  },
  // ── Vanguard ──
  vanguard: {
    thrusters: [
      { x: -10, y: 16 },  // left engine
      { x: 10, y: 16 },   // right engine
    ],
    weapons: [
      { x: -12, y: -10 }, // left weapon mount
      { x: 12, y: -10 },  // right weapon mount
    ],
  },
  // ── Reaver ──
  reaver: {
    thrusters: [
      { x: -8, y: 14 },   // left engine
      { x: 8, y: 14 },    // right engine
    ],
    weapons: [
      { x: -10, y: -10 }, // left weapon mount
      { x: 10, y: -10 },  // right weapon mount
    ],
  },
  // ── Obsidian ──
  obsidian: {
    thrusters: [
      { x: -10, y: 14 },  // left engine
      { x: 10, y: 14 },   // right engine
    ],
    weapons: [
      { x: -12, y: -8 },  // left weapon mount
      { x: 12, y: -8 },   // right weapon mount
    ],
  },
  // ── Marauder ──
  marauder: {
    thrusters: [
      { x: -10, y: 16 },  // left engine
      { x: 10, y: 16 },   // right engine
    ],
    weapons: [
      { x: -14, y: -8 },  // left weapon mount
      { x: 14, y: -8 },   // right weapon mount
    ],
  },
  // ── Phalanx ──
  phalanx: {
    thrusters: [
      { x: -12, y: 16 },  // left engine
      { x: 12, y: 16 },   // right engine
    ],
    weapons: [
      { x: -14, y: -10 }, // left weapon mount
      { x: 14, y: -10 },  // right weapon mount
    ],
  },
  // ── Titan ──
  titan: {
    thrusters: [
      { x: -14, y: 18 },  // left engine
      { x: 14, y: 18 },   // right engine
    ],
    weapons: [
      { x: -16, y: -12 }, // left weapon mount
      { x: 16, y: -12 },  // right weapon mount
    ],
  },
  // ── Leviathan ──
  leviathan: {
    thrusters: [
      { x: -16, y: 20 },  // left engine
      { x: 16, y: 20 },   // right engine
    ],
    weapons: [
      { x: -18, y: -14 }, // left weapon mount
      { x: 18, y: -14 },  // right weapon mount
    ],
  },
  // ── Specter ──
  specter: {
    thrusters: [
      { x: -10, y: 14 },  // left engine
      { x: 10, y: 14 },   // right engine
    ],
    weapons: [
      { x: -12, y: -8 },  // left weapon mount
      { x: 12, y: -8 },   // right weapon mount
    ],
  },
  // ── Colossus ──
  colossus: {
    thrusters: [
      { x: -14, y: 18 },  // left engine
      { x: 14, y: 18 },   // right engine
    ],
    weapons: [
      { x: -16, y: -12 }, // left weapon mount
      { x: 16, y: -12 },  // right weapon mount
    ],
  },
  // ── Harbinger ──
  harbinger: {
    thrusters: [
      { x: -10, y: 14 },  // left engine
      { x: 10, y: 14 },   // right engine
    ],
    weapons: [
      { x: -12, y: -10 }, // left weapon mount
      { x: 12, y: -10 },  // right weapon mount
    ],
  },
  // ── Eclipse ──
  eclipse: {
    thrusters: [
      { x: -12, y: 16 },  // left engine
      { x: 12, y: 16 },   // right engine
    ],
    weapons: [
      { x: -14, y: -10 }, // left weapon mount
      { x: 14, y: -10 },  // right weapon mount
    ],
  },
  // ── Sovereign ──
  sovereign: {
    thrusters: [
      { x: -16, y: 20 },  // left engine
      { x: 16, y: 20 },   // right engine
    ],
    weapons: [
      { x: -18, y: -14 }, // left weapon mount
      { x: 18, y: -14 },  // right weapon mount
    ],
  },
  // ── Apex ──
  apex: {
    thrusters: [
      { x: -14, y: 18 },  // left engine
      { x: 14, y: 18 },   // right engine
    ],
    weapons: [
      { x: -16, y: -12 }, // left weapon mount
      { x: 16, y: -12 },  // right weapon mount
    ],
  },
};

// Rotate a local hardpoint offset by the ship's visual angle
function rotatePoint(lx: number, ly: number, angle: number): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: lx * cos - ly * sin, y: lx * sin + ly * cos };
}

// Convert ship-local hardpoint to world position
function localToWorldHardpoint(shipX: number, shipY: number, localX: number, localY: number, shipAngle: number): { x: number; y: number } {
  const visualAngle = shipAngle + Math.PI / 2;
  const rotated = rotatePoint(localX, localY, visualAngle);
  return { x: shipX + rotated.x, y: shipY + rotated.y };
}

// ── Live hardpoint data from editor (localStorage) ──
interface EditorHardpoint {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  layer: string;
}
interface EditorDirectionData {
  hardpoints: EditorHardpoint[];
}
interface EditorShipData {
  shipId: string;
  directions: Record<string, EditorDirectionData>;
}

const editorHpCache = new Map<string, EditorShipData | null>();
let editorHpCacheTime = 0;

function loadEditorHardpoints(ship: string): EditorShipData | null {
  const now = Date.now();
  if (now - editorHpCacheTime < 5000 && editorHpCache.has(ship)) {
    return editorHpCache.get(ship) || null;
  }
  try {
    const raw = localStorage.getItem(`hardpoint-editor:${ship}`);
    if (!raw) { editorHpCache.set(ship, null); return null; }
    const parsed = JSON.parse(raw) as EditorShipData;
    editorHpCache.set(ship, parsed);
    editorHpCacheTime = now;
    return parsed;
  } catch { editorHpCache.set(ship, null); return null; }
}

function getEditorHardpointsByType(ship: string, frameIdx: number, type: string): { x: number; y: number }[] {
  const data = loadEditorHardpoints(ship);
  if (!data) return [];
  const dirKey = DIRECTIONS_32[frameIdx];
  if (!dirKey) return [];
  const dir = data.directions[dirKey];
  if (!dir || !dir.hardpoints) return [];
  const sizeScale = SHIP_SIZE_SCALE[ship as ShipClassId] ?? 1;
  const scaleFactor = Math.ceil(85 * sizeScale * 1.6) / 256;
  return dir.hardpoints
    .filter(hp => hp.type === type)
    .map(hp => ({ x: hp.x * scaleFactor, y: (hp.y - (hp.z || 0)) * scaleFactor }));
}

function getPlayerFrameIndex(shipClass: string, angle: number): number {
  const cfg = ROTATION_SPRITES[shipClass];
  if (!cfg) return 0;
  const frames = rotationFrameTextures.get(shipClass);
  const totalFrames = frames ? frames.length : 32;
  return angleToDirectionFrame(angle, totalFrames, cfg.frame0DirectionDeg, cfg.clockwise, "player-hp");
}


function getAutoThrusters(ship: string, frameIdx: number): { x: number; y: number }[] {
  const data = loadEditorHardpoints(ship);
  if (!data) return [];
  // Find the North direction (frame 0) thruster/engineGlow data as reference
  const northKey = DIRECTIONS_32[0]; // "N"
  const northDir = data.directions[northKey];
  if (!northDir || !northDir.hardpoints) return [];
  const northThrusters = northDir.hardpoints.filter(
    (hp: EditorHardpoint) => hp.type === "thruster" || hp.type === "engineGlow"
  );
  if (northThrusters.length === 0) return [];
  // Rotate North positions by the frame angle to get current direction
  const angleStep = (2 * Math.PI) / 32;
  const rotAngle = frameIdx * angleStep;
  const sizeScale = SHIP_SIZE_SCALE[ship as ShipClassId] ?? 1;
  const scaleFactor = Math.ceil(85 * sizeScale * 1.6) / 256;
  return northThrusters.map((hp: EditorHardpoint) => {
    const sx = hp.x * scaleFactor;
    const sy = (hp.y - (hp.z || 0)) * scaleFactor;
    const cos = Math.cos(rotAngle);
    const sin = Math.sin(rotAngle);
    return { x: sx * cos - sy * sin, y: sx * sin + sy * cos };
  });
}

function getInterpolatedHardpoints(ship: string, angle: number, type: string): { x: number; y: number }[] {
  const cfg = ROTATION_SPRITES[ship];
  if (!cfg) return [];
  const totalFrames = 32;
  const screenDeg = (angle * 180) / Math.PI;
  let compassDeg = screenDeg + 90;
  compassDeg = ((compassDeg % 360) + 360) % 360;
  let frameDeg = compassDeg - cfg.frame0DirectionDeg;
  if (!cfg.clockwise) frameDeg = -frameDeg;
  frameDeg = ((frameDeg % 360) + 360) % 360;
  const step = 360 / totalFrames;
  const exactFrame = frameDeg / step;
  const frameA = Math.floor(exactFrame) % totalFrames;
  const frameB = (frameA + 1) % totalFrames;
  const t = exactFrame - Math.floor(exactFrame);
  const hpsA = getEditorHardpointsByType(ship, frameA, type);
  const hpsB = getEditorHardpointsByType(ship, frameB, type);
  if (hpsA.length === 0 && hpsB.length === 0) return [];
  if (hpsA.length === 0) return hpsB;
  if (hpsB.length === 0) return hpsA;
  const count = Math.min(hpsA.length, hpsB.length);
  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    result.push({
      x: hpsA[i].x + (hpsB[i].x - hpsA[i].x) * t,
      y: hpsA[i].y + (hpsB[i].y - hpsA[i].y) * t,
    });
  }
  return result;
}

function getInterpolatedAutoThrusters(ship: string, angle: number): { x: number; y: number }[] {
  const data = loadEditorHardpoints(ship);
  if (!data) return [];
  const northKey = DIRECTIONS_32[0];
  const northDir = data.directions[northKey];
  if (!northDir || !northDir.hardpoints) return [];
  const northThrusters = northDir.hardpoints.filter(
    (hp: EditorHardpoint) => hp.type === "thruster" || hp.type === "engineGlow"
  );
  if (northThrusters.length === 0) return [];
  const cfg = ROTATION_SPRITES[ship];
  if (!cfg) return [];
  const screenDeg = (angle * 180) / Math.PI;
  let compassDeg = screenDeg + 90;
  compassDeg = ((compassDeg % 360) + 360) % 360;
  let frameDeg = compassDeg - cfg.frame0DirectionDeg;
  if (!cfg.clockwise) frameDeg = -frameDeg;
  frameDeg = ((frameDeg % 360) + 360) % 360;
  const rotAngle = (frameDeg * Math.PI) / 180;
  const sizeScale = SHIP_SIZE_SCALE[ship as ShipClassId] ?? 1;
  const scaleFactor = Math.ceil(85 * sizeScale * 1.6) / 256;
  return northThrusters.map((hp: EditorHardpoint) => {
    const sx = hp.x * scaleFactor;
    const sy = (hp.y - (hp.z || 0)) * scaleFactor;
    const cos = Math.cos(rotAngle);
    const sin = Math.sin(rotAngle);
    return { x: sx * cos - sy * sin, y: sx * sin + sy * cos };
  });
}

const PLASMA_WAKE_SHIPS = new Set(["eclipse"]);

// Track weapon mount alternation per entity
const weaponMountIndex = new Map<string, number>();

const rotationFrameTextures = new Map<string, PIXI.Texture[]>();
const rotationFrameLoading = new Set<string>();
const directionState = new Map<string, number>();

const HYSTERESIS_DEG = 3;

function preloadRotationSprites(): void {
  const playerShip = state.player?.shipClass || "skimmer";
  loadShipSprites(playerShip);
}

function loadShipSprites(id: string): void {
  if (has3DModel(id)) return;
  const cfg = ROTATION_SPRITES[id];
  if (!cfg || rotationFrameTextures.has(id) || rotationFrameLoading.has(id)) return;
  rotationFrameLoading.add(id);
  const frames: (PIXI.Texture | null)[] = new Array(cfg.frames).fill(null);
  let loaded = 0;
  for (let i = 0; i < cfg.frames; i++) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const idx = i;
    img.onload = () => {
      frames[idx] = PIXI.Texture.from(img, { scaleMode: PIXI.SCALE_MODES.NEAREST });
      loaded++;
      if (loaded === cfg.frames) {
        rotationFrameTextures.set(id, frames as PIXI.Texture[]);
        rotationFrameLoading.delete(id);
        texCache.forEach((_, k) => { if (k.startsWith("ship-" + id + "-")) texCache.delete(k); });
        lastPlayerShipClass = "" as ShipClassId;
        for (const [, data] of otherPlayerSprites) {
          (data as any)._lastShipClass = "";
        }
      }
    };
    img.onerror = () => { loaded++; if (loaded === cfg.frames) rotationFrameLoading.delete(id); };
    img.src = cfg.path + cfg.files[i];
  }
}

function hasRotationFrames(shipClass: string): boolean {
  return rotationFrameTextures.has(shipClass);
}

function angleToDirectionFrame(
  screenAngleRad: number,
  totalFrames: number,
  frame0DirDeg: number,
  clockwise: boolean,
  entityId: string
): number {
  // Screen angle: 0 = East, PI/2 = South (Y-down coordinates)
  // Compass angle: 0 = North, 90 = East
  // Conversion: compassDeg = screenDeg + 90
  const screenDeg = (screenAngleRad * 180) / Math.PI;
  let compassDeg = screenDeg + 90;
  compassDeg = ((compassDeg % 360) + 360) % 360;

  // Offset by frame 0 direction
  let frameDeg = compassDeg - frame0DirDeg;

  // Reverse if sprites go counter-clockwise
  if (!clockwise) frameDeg = -frameDeg;

  frameDeg = ((frameDeg % 360) + 360) % 360;

  // Map degrees to frame index
  const step = 360 / totalFrames;
  const rawIdx = Math.round(frameDeg / step) % totalFrames;

  // Hysteresis: 3-degree deadzone prevents flickering at frame boundaries
  const prevIdx = directionState.get(entityId);
  if (prevIdx !== undefined && prevIdx !== rawIdx) {
    const prevCenter = prevIdx * step;
    let dist = frameDeg - prevCenter;
    if (dist > 180) dist -= 360;
    if (dist < -180) dist += 360;
    if (Math.abs(dist) < step / 2 + HYSTERESIS_DEG) {
      return prevIdx;
    }
  }
  directionState.set(entityId, rawIdx);
  return rawIdx;
}

function getDirectionalTex(shipClass: ShipClassId, scale: number, angle: number, entityId: string): { tex: PIXI.Texture; isDirectional: boolean } {
  const frames = rotationFrameTextures.get(shipClass);
  if (!frames) {
    loadShipSprites(shipClass);
    return { tex: getShipTex(shipClass, scale), isDirectional: false };
  }
  const sizeScale = SHIP_SIZE_SCALE[shipClass] ?? 1;
  const finalScale = scale * sizeScale;
  const cfg = ROTATION_SPRITES[shipClass];
  if (!cfg) return { tex: getShipTex(shipClass, scale), isDirectional: false };
  const frameIdx = angleToDirectionFrame(angle, frames.length, cfg.frame0DirectionDeg, cfg.clockwise, entityId);
  const key = "ship-" + shipClass + "-" + finalScale.toFixed(2) + "-f" + frameIdx;
  let tex = texCache.get(key);
  if (tex) return { tex, isDirectional: true };

  const spriteTex = frames[frameIdx];
  if (!spriteTex) return { tex: getShipTex(shipClass, scale), isDirectional: false };

  const img = spriteTex.baseTexture.resource as any;
  const src = img.source || img;
  const iw = src.naturalWidth || src.width;
  const ih = src.naturalHeight || src.height;

  const targetSize = Math.ceil(85 * finalScale);
  const drawSz = Math.ceil(targetSize * 1.6);
  const c2 = document.createElement("canvas");
  c2.width = drawSz;
  c2.height = drawSz;
  const ctx = c2.getContext("2d")!;
  ctx.globalAlpha = 1.0;
  ctx.drawImage(src, 0, 0, iw, ih, 0, 0, drawSz, drawSz);

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return { tex, isDirectional: true };
}

function preloadShipSprites(): void {
  for (const [id, url] of Object.entries(SHIP_SPRITES)) {
    if (shipSpriteTextures.has(id) || shipSpriteLoading.has(id)) continue;
    shipSpriteLoading.add(id);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const tex = PIXI.Texture.from(img, { scaleMode: PIXI.SCALE_MODES.NEAREST });
      shipSpriteTextures.set(id, tex);
      shipSpriteLoading.delete(id);
      texCache.forEach((_, k) => { if (k.startsWith(`ship-${id}-`)) texCache.delete(k); });
      lastPlayerShipClass = "" as ShipClassId;
      for (const [, data] of otherPlayerSprites) {
        (data as any)._lastShipClass = "";
      }
    };
    img.onerror = () => { shipSpriteLoading.delete(id); };
    img.src = url;
  }
}

function bakeTexture(
  width: number, height: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): PIXI.Texture {
  if (!bakeCanvas) {
    bakeCanvas = document.createElement("canvas");
    bakeCtx = bakeCanvas.getContext("2d")!;
  }
  bakeCanvas.width = width;
  bakeCanvas.height = height;
  bakeCtx.clearRect(0, 0, width, height);
  drawFn(bakeCtx, width, height);
  const tex = PIXI.Texture.from(bakeCanvas, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  // Must clone since we reuse bakeCanvas
  const clone = tex.clone();
  return clone;
}

function getShipTex(shipClass: ShipClassId, scale: number): PIXI.Texture {
  const sizeScale = SHIP_SIZE_SCALE[shipClass] ?? 1;
  const finalScale = scale * sizeScale;
  const key = `ship-${shipClass}-${finalScale.toFixed(2)}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  const spriteTex = shipSpriteTextures.get(shipClass);
  if (spriteTex) {
    const img = spriteTex.baseTexture.resource as any;
    const src = img.source || img;
    const iw = src.naturalWidth || src.width;
    const ih = src.naturalHeight || src.height;

    // Auto-trim: find content bounding box
    const trimC = document.createElement("canvas");
    trimC.width = iw; trimC.height = ih;
    const trimCtx = trimC.getContext("2d")!;
    trimCtx.drawImage(src, 0, 0);
    const imgData = trimCtx.getImageData(0, 0, iw, ih).data;
    let minX = iw, minY = ih, maxX = 0, maxY = 0;
    for (let y = 0; y < ih; y++) {
      for (let x = 0; x < iw; x++) {
        if (imgData[(y * iw + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const aspect = ch / cw;

    const targetSize = Math.ceil(60 * finalScale);
    const padding = 16;
    const drawW = targetSize * 1.6;
    const drawH = drawW * aspect;
    const canvasSz = Math.ceil(Math.max(drawW, drawH) + padding * 2);
    const c2 = document.createElement("canvas");
    c2.width = canvasSz;
    c2.height = canvasSz;
    const ctx = c2.getContext("2d")!;
    const dx = (canvasSz - drawW) / 2;
    const dy = (canvasSz - drawH) / 2;

    // Clean crisp ship — shader handles all lighting
    ctx.globalAlpha = 1.0;
    ctx.drawImage(src, minX, minY, cw, ch, dx, dy, drawW, drawH);

    tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
    texCache.set(key, tex);
    return tex;
  }

  const cls = SHIP_CLASSES[shipClass];
  const sz = Math.ceil(60 * finalScale);
  const canvasSz = sz * 2 + 30;

  const c2 = document.createElement("canvas");
  c2.width = canvasSz;
  c2.height = canvasSz;
  const ctx = c2.getContext("2d")!;
  ctx.translate(canvasSz / 2, canvasSz / 2);
  const c = cls.color;
  const a = cls.accent;
  const hi = "#ffffff";
  const dk = shadeHex(c, -0.45);
  drawShipPixels(ctx, shipClass, c, a, hi, dk, finalScale);

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

// EnemyType -> GLB model mapping lives in lib/hitbox.ts (enemyModelKey) so
// the rendered model and the silhouette hitbox always agree.

function enemyTexKey(e: Enemy): string {
  const varSeed = (e.id.charCodeAt(0) + e.id.charCodeAt(e.id.length - 1)) % 3;
  return `enemy-${e.type}-${e.color}-${e.size}-${e.isBoss ? 1 : 0}-${varSeed}`;
}

function getEnemyTex(e: Enemy): PIXI.Texture {
  const key = enemyTexKey(e);
  let tex = texCache.get(key);
  if (tex) return tex;

  const margin = e.isBoss ? 40 : 20;
  const canvasSz = Math.ceil(e.size * 4) + margin * 2;

  const c2 = document.createElement("canvas");
  c2.width = canvasSz;
  c2.height = canvasSz;
  const ctx = c2.getContext("2d")!;
  ctx.translate(canvasSz / 2, canvasSz / 2);

  // Draw enemy body using existing code - create a minimal fake enemy
  const fakeEnemy: Enemy = {
    ...e,
    pos: { x: 0, y: 0 },
    angle: -Math.PI / 2, // so rotation in drawEnemy becomes 0
    hitFlash: 0,
  };
  // Temporarily neutralize selectedWorldTarget so no selection ring draws
  const savedTarget = state.selectedWorldTarget;
  state.selectedWorldTarget = null;

  // The drawEnemy function does: ctx.save, translate(pos), rotate(angle+PI/2), draw, restore
  // Since we set pos=0,0 and angle=-PI/2, the rotation is 0 and body draws centered
  drawEnemy(ctx, fakeEnemy, true);

  state.selectedWorldTarget = savedTarget;

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

// Simple circle texture for particles
function getAsteroidTex(a: Asteroid): PIXI.Texture {
  const idSeed = a.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const key = `asteroid-${a.yields}-${a.size}-${idSeed % 16}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  tex = createAsteroidTexture(a.size, a.yields, idSeed);
  texCache.set(key, tex);
  return tex;
}

function getCircleTex(radius: number): PIXI.Texture {
  const key = `circle-${radius}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  const sz = (radius + 2) * 2;
  const c2 = document.createElement("canvas");
  c2.width = sz;
  c2.height = sz;
  const ctx = c2.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(sz / 2, sz / 2, radius, 0, Math.PI * 2);
  ctx.fill();

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

// Glow circle for particle effects
// Radial gradient texture for nebulae (matches Canvas2D createRadialGradient)
function getNebulaTex(radius: number): PIXI.Texture {
  const key = `nebula-${radius}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  const sz = radius * 2 + 4;
  const c2 = document.createElement("canvas");
  c2.width = sz;
  c2.height = sz;
  const ctx = c2.getContext("2d")!;
  const cx = sz / 2, cy = sz / 2;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grd.addColorStop(0, "rgba(255,255,255,0.33)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

function getGlowTex(radius: number): PIXI.Texture {
  const key = `glow-${radius}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  const sz = (radius + 8) * 2;
  const c2 = document.createElement("canvas");
  c2.width = sz;
  c2.height = sz;
  const ctx = c2.getContext("2d")!;
  const grd = ctx.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, radius);
  grd.addColorStop(0, "#ffffff");
  grd.addColorStop(0.4, "#ffffffaa");
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(sz / 2, sz / 2, radius, 0, Math.PI * 2);
  ctx.fill();

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

function getFireballTex(radius: number, color: string): PIXI.Texture {
  const key = `fireball-${radius}-${color}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  const sz = (radius + 4) * 2;
  const c2 = document.createElement("canvas");
  c2.width = sz;
  c2.height = sz;
  const ctx = c2.getContext("2d")!;
  const cx = sz / 2, cy = sz / 2;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grd.addColorStop(0, "#ffffff");
  grd.addColorStop(0.15, "#ffffa0");
  grd.addColorStop(0.4, color);
  grd.addColorStop(0.75, "#330000");
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

function getSmokeTex(radius: number): PIXI.Texture {
  const key = `smoke-${radius}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  const sz = (radius + 4) * 2;
  const c2 = document.createElement("canvas");
  c2.width = sz;
  c2.height = sz;
  const ctx = c2.getContext("2d")!;
  const cx = sz / 2, cy = sz / 2;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grd.addColorStop(0, "rgba(80,80,80,0.6)");
  grd.addColorStop(0.5, "rgba(50,50,50,0.3)");
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

function getEmberTex(radius: number, color: string): PIXI.Texture {
  const key = `ember-${radius}-${color}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  const outer = radius * 2;
  const sz = (outer + 6) * 2;
  const c2 = document.createElement("canvas");
  c2.width = sz;
  c2.height = sz;
  const ctx = c2.getContext("2d")!;
  const cx = sz / 2, cy = sz / 2;

  // Outer fire glow
  const grd1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer);
  grd1.addColorStop(0, color);
  grd1.addColorStop(0.5, color + "66");
  grd1.addColorStop(1, "transparent");
  ctx.fillStyle = grd1;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.fill();

  // Core bright
  const grd2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grd2.addColorStop(0, "#ffffff");
  grd2.addColorStop(0.4, color);
  grd2.addColorStop(1, "transparent");
  ctx.fillStyle = grd2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

function getFlashTex(radius: number, color: string): PIXI.Texture {
  const key = `flash-${radius}-${color}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  const sz = (radius + 4) * 2;
  const c2 = document.createElement("canvas");
  c2.width = sz;
  c2.height = sz;
  const ctx = c2.getContext("2d")!;
  const cx = sz / 2, cy = sz / 2;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grd.addColorStop(0, "#ffffff");
  grd.addColorStop(0.3, color);
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

function getLaserBoltTex(length: number): PIXI.Texture {
  const key = `laser-bolt-${length}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  const w = length + 8;
  const h = Math.max(8, Math.ceil(length * 0.3)) + 4;
  const c2 = document.createElement("canvas");
  c2.width = w;
  c2.height = h;
  const ctx = c2.getContext("2d")!;
  const cx = w / 2, cy = h / 2;
  const hw = length / 2, hh = h / 2 - 2;

  // Outer glow
  const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(hw, hh));
  g1.addColorStop(0, "rgba(255,255,255,0.9)");
  g1.addColorStop(0.3, "rgba(255,255,255,0.5)");
  g1.addColorStop(0.7, "rgba(255,255,255,0.15)");
  g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
  ctx.fill();

  // Core bright center
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(cx, cy, hw * 0.5, hh * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

// ── Bullet-hell projectile art (white, tinted per projectile) ─────────────
function getOrbTex(): PIXI.Texture {
  const key = "proj-orb";
  let tex = texCache.get(key);
  if (tex) return tex;
  const s = 48;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.95)");
  g.addColorStop(0.55, "rgba(255,255,255,0.40)");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  tex = PIXI.Texture.from(c);
  texCache.set(key, tex);
  return tex;
}

function getSpinnerTex(): PIXI.Texture {
  const key = "proj-spinner";
  let tex = texCache.get(key);
  if (tex) return tex;
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const cx = s / 2;
  // 4 rotating energy petals
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate((Math.PI / 2) * i);
    const pg = ctx.createRadialGradient(14, 0, 0, 14, 0, 15);
    pg.addColorStop(0, "rgba(255,255,255,0.9)");
    pg.addColorStop(0.6, "rgba(255,255,255,0.35)");
    pg.addColorStop(1, "transparent");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(14, 0, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // bright core
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, 13);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.8)");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cx, 13, 0, Math.PI * 2);
  ctx.fill();
  tex = PIXI.Texture.from(c);
  texCache.set(key, tex);
  return tex;
}

function getFlashBoltTex(): PIXI.Texture {
  const key = "proj-flash";
  let tex = texCache.get(key);
  if (tex) return tex;
  const s = 48;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const cx = s / 2;
  // 4-point star: long horizontal lens + short vertical lens
  for (const [rx, ry] of [[20, 3.5], [3.5, 11]] as const) {
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, Math.max(rx, ry));
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cx, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const g2 = ctx.createRadialGradient(cx, cx, 0, cx, cx, 8);
  g2.addColorStop(0, "rgba(255,255,255,1)");
  g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(cx, cx, 8, 0, Math.PI * 2);
  ctx.fill();
  tex = PIXI.Texture.from(c);
  texCache.set(key, tex);
  return tex;
}

// ── Animated projectile FX (CC0 packs: ansimuz "Warped Shooting Fx",
//    DevWizard "Pixel Art Spells" — see ASSET_LICENSES.md) ────────────────
// Frames are recolored per enemy color at load: glow tinted, white cores kept.
const FX_DEFS: Record<string, { url: string; frames: number; fw: number; fh: number; mult: number; directional: boolean; speed: number }> = {
  orb:     { url: "/assets/projectiles/orb.png",     frames: 6, fw: 16, fh: 16, mult: 3.6, directional: false, speed: 0.18 },
  crossed: { url: "/assets/projectiles/crossed.png", frames: 6, fw: 32, fh: 32, mult: 4.2, directional: false, speed: 0.22 },
  spark:   { url: "/assets/projectiles/spark.png",   frames: 5, fw: 63, fh: 32, mult: 3.2, directional: true,  speed: 0.3 },
  pulse:   { url: "/assets/projectiles/pulse.png",   frames: 4, fw: 63, fh: 32, mult: 3.4, directional: true,  speed: 0.3 },
  charged: { url: "/assets/projectiles/charged.png", frames: 6, fw: 63, fh: 48, mult: 3.4, directional: true,  speed: 0.22 },
  wave:    { url: "/assets/projectiles/wave.png",    frames: 4, fw: 95, fh: 32, mult: 3.4, directional: true,  speed: 0.22 },
  bolt:    { url: "/assets/projectiles/bolt.png",    frames: 4, fw: 48, fh: 32, mult: 3.4, directional: true,  speed: 0.25 },
  hit:     { url: "/assets/projectiles/hit.png",     frames: 5, fw: 32, fh: 32, mult: 4.0, directional: false, speed: 0.35 },
};
const FX_KIND_MAP: Record<string, string> = {
  orb: "orb", spinner: "crossed", flash: "spark",
  pulse: "pulse", charged: "charged", wave: "wave", bolt: "bolt",
};
const _fxImages = new Map<string, HTMLImageElement>();
const _fxColored = new Map<string, PIXI.Texture[]>();

function _fxImg(name: string): HTMLImageElement | null {
  let img = _fxImages.get(name);
  if (!img) {
    img = new Image();
    img.src = FX_DEFS[name].url;
    _fxImages.set(name, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function getFxFrames(name: string, colorHex: string): PIXI.Texture[] | null {
  const key = name + "|" + colorHex;
  const cached = _fxColored.get(key);
  if (cached) return cached;
  const def = FX_DEFS[name];
  if (!def) return null;
  const img = _fxImg(name);
  if (!img) return null;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const col = PIXI.utils.string2hex(colorHex);
  const cr = (col >> 16) & 255, cg = (col >> 8) & 255, cb = col & 255;
  const id = ctx.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const inten = Math.max(d[i], d[i + 1], d[i + 2]) / 255;
    const wht = Math.min(d[i], d[i + 1], d[i + 2]) / 255;
    const w2 = wht * wht; // only true whites stay white-hot
    d[i]     = Math.min(255, cr * inten + (255 - cr * inten) * w2);
    d[i + 1] = Math.min(255, cg * inten + (255 - cg * inten) * w2);
    d[i + 2] = Math.min(255, cb * inten + (255 - cb * inten) * w2);
  }
  ctx.putImageData(id, 0, 0);
  const base = PIXI.BaseTexture.from(c);
  base.scaleMode = PIXI.SCALE_MODES.NEAREST;
  const frames: PIXI.Texture[] = [];
  for (let i = 0; i < def.frames; i++) {
    frames.push(new PIXI.Texture(base, new PIXI.Rectangle(i * def.fw, 0, def.fw, def.fh)));
  }
  _fxColored.set(key, frames);
  return frames;
}

/** One-shot animated impact burst (warped hit fx) at a projectile's death. */
function spawnFxImpact(x: number, y: number, colorHex: string, size: number): void {
  const frames = getFxFrames("hit", colorHex);
  if (!frames || !projectileLayer) return;
  const a = new PIXI.AnimatedSprite(frames);
  a.anchor.set(0.5);
  a.position.set(x, y);
  a.blendMode = PIXI.BLEND_MODES.ADD;
  a.loop = false;
  a.animationSpeed = FX_DEFS.hit.speed;
  const s = Math.max(0.9, (size * FX_DEFS.hit.mult) / FX_DEFS.hit.fh);
  a.scale.set(s);
  a.onComplete = () => {
    if (a.parent) a.parent.removeChild(a);
    a.destroy();
  };
  projectileLayer.addChild(a);
  a.play();
}

function getRocketTex(): PIXI.Texture {
  const key = "rocket-body";
  let tex = texCache.get(key);
  if (tex) return tex;

  const w = 24, h = 12;
  const c2 = document.createElement("canvas");
  c2.width = w;
  c2.height = h;
  const ctx = c2.getContext("2d")!;

  // Rocket body
  ctx.fillStyle = "#cccccc";
  ctx.beginPath();
  ctx.moveTo(4, h / 2 - 3);
  ctx.lineTo(w - 4, h / 2 - 2);
  ctx.lineTo(w - 2, h / 2);
  ctx.lineTo(w - 4, h / 2 + 2);
  ctx.lineTo(4, h / 2 + 3);
  ctx.closePath();
  ctx.fill();

  // Nose cone
  ctx.fillStyle = "#ff6633";
  ctx.beginPath();
  ctx.moveTo(w - 4, h / 2 - 2);
  ctx.lineTo(w, h / 2);
  ctx.lineTo(w - 4, h / 2 + 2);
  ctx.closePath();
  ctx.fill();

  // Exhaust glow
  const g = ctx.createRadialGradient(4, h / 2, 0, 4, h / 2, 6);
  g.addColorStop(0, "rgba(255,150,50,0.8)");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 10, h);

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

function getTrailTex(radius: number): PIXI.Texture {
  const key = `trail-${radius}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  const sz = (radius + 6) * 2;
  const c2 = document.createElement("canvas");
  c2.width = sz;
  c2.height = sz;
  const ctx = c2.getContext("2d")!;
  const cx = sz / 2, cy = sz / 2;

  // Outer colored glow
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grd.addColorStop(0, "#ffffff");
  grd.addColorStop(0.3, "rgba(255,255,255,0.8)");
  grd.addColorStop(0.6, "rgba(255,255,255,0.3)");
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

// ══════════════════════════════════════════════════════════════════════════
// SPRITE POOLS
// ══════════════════════════════════════════════════════════════════════════

interface EnemySpriteData {
  container: PIXI.Container;
  body: PIXI.Sprite;
  healthBar: PIXI.Graphics;
  nameText: PIXI.Text;
  selectionRing?: PIXI.Graphics;
  texKey: string;
  coreGlow?: PIXI.Sprite;
  weaponGlow?: PIXI.Graphics;
  bossAura?: PIXI.Graphics;
}

interface ProjectileSpriteData {
  sprite: PIXI.Sprite;
}

interface ParticleSpriteData {
  sprite: PIXI.Sprite;
}

interface PlayerSpriteData {
  container: PIXI.Container;
  body: PIXI.Sprite;
  nameText: PIXI.Text;
  bars: PIXI.Graphics;
}

const enemySprites = new Map<string, EnemySpriteData>();
const projectileSprites = new Map<string, ProjectileSpriteData>();
const particleSprites = new Map<string, ParticleSpriteData>();
const otherPlayerSprites = new Map<string, PlayerSpriteData>();
const npcSprites = new Map<string, PlayerSpriteData>();

let playerContainer: PIXI.Container | null = null;
let playerBody: PIXI.Sprite | null = null;
let engineGlowGraphics: PIXI.Graphics | null = null;
let lastPlayerShipClass: ShipClassId | null = null;
let playerVisual: ShipVisualState | null = null;

// ══════════════════════════════════════════════════════════════════════════
// BACKGROUND
// ══════════════════════════════════════════════════════════════════��═══════

let enhancedStars: EnhancedStar[][] = [];
let nebulae: { x: number; y: number; r: number; c: string }[] = [];
let lastZone: string = "";
let bgGraphics: PIXI.Graphics | null = null;
let starGraphics: PIXI.Graphics | null = null;

function initStars(w: number, h: number): void {
  enhancedStars = generateEnhancedStars(w, h);
}

function regenNebula(zone: ZoneId): void {
  nebulae = [];
  const z = ZONES[zone];
  // Large background nebulae for depth
  for (let i = 0; i < 12; i++) {
    nebulae.push({
      x: (Math.random() - 0.5) * 7000,
      y: (Math.random() - 0.5) * 7000,
      r: 400 + Math.random() * 700,
      c: i % 2 === 0 ? z.bgHueA : z.bgHueB,
    });
  }
  // Medium accent nebulae (brighter, adds color variation)
  for (let i = 0; i < 8; i++) {
    nebulae.push({
      x: (Math.random() - 0.5) * 5000,
      y: (Math.random() - 0.5) * 5000,
      r: 150 + Math.random() * 300,
      c: z.bgHueA,
    });
  }
  // Small bright nebula clusters
  for (let i = 0; i < 5; i++) {
    nebulae.push({
      x: (Math.random() - 0.5) * 4000,
      y: (Math.random() - 0.5) * 4000,
      r: 80 + Math.random() * 150,
      c: z.bgHueA,
    });
  }
  clearNebulaSprites();
}

let nebulaSprites: PIXI.Sprite[] = [];

function clearNebulaSprites(): void {
  for (const s of nebulaSprites) {
    s.parent?.removeChild(s);
    s.destroy();
  }
  nebulaSprites = [];
}

// ═══════════════════════════════════════════════════════════════════��══════
// DEBUG
// ════════════════════════════════════════════════════════════════���═════════

let debugText: PIXI.Text | null = null;
let frameCount = 0;
let lastFpsTime = 0;
let fps = 0;

// ══════════════════════════════════════════════════════════════════════════
// INIT / DESTROY
// ══════════════════════════════════════════════════════════════════════════

let _labelOverlay: HTMLDivElement | null = null;
// Per-frame DOM label blocks for OTHER players (built in syncOtherPlayers,
// flushed together with the local player's block in syncPlayer). DOM labels
// live above the Three.js canvases and don't scale with camera zoom.
let _otherLabelHtml = "";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Name row: faction dot + pilot name + honor-rank icon (PNG GUI/ranks).
function shipLabelHtml(
  sx: number, syTop: number, name: string,
  faction: { color: string; tag: string } | null,
  rank: { index: number; name: string },
  hullPct: number | null,
  extra: string,
): string {
  const dot = faction
    ? `<span style="flex:none;width:8px;height:8px;border-radius:50%;background:${faction.color};box-shadow:0 0 4px ${faction.color};" title="${faction.tag}"></span>`
    : "";
  // Fixed landscape badge box so every rank insignia renders at a readable,
  // consistent size directly right of the name.
  const rankImg = `<img src="/assets/ui/ranks/rank_${String(rank.index + 1).padStart(2, "0")}.png" style="flex:none;height:16px;width:28px;object-fit:contain;filter:drop-shadow(0 1px 2px #000) drop-shadow(0 0 3px rgba(0,0,0,0.8));" title="${rank.name}"/>`;
  const bar = hullPct != null
    ? `<div style="width:46px;height:3px;background:rgba(0,0,0,0.55);margin:0 auto 3px;"><div style="width:${Math.round(hullPct * 100)}%;height:100%;background:#44ff66;"></div></div>`
    : "";
  return `<div style="position:absolute;left:${Math.round(sx)}px;top:${Math.round(syTop)}px;transform:translate(-50%,0);pointer-events:none;">
    ${bar}
    <div style="display:flex;align-items:center;justify-content:center;gap:5px;font-family:'Kenney Future Narrow','Courier New',monospace;font-size:13px;font-weight:bold;color:#e8f0ff;text-shadow:0 0 3px #000,0 1px 2px #000;white-space:nowrap;letter-spacing:0.05em;">${dot}<span>${escapeHtml(name)}</span>${rankImg}${extra}</div>
  </div>`;
}

export function initPixiRenderer(container: HTMLDivElement, labelOverlay?: HTMLDivElement): void {
  if (labelOverlay) _labelOverlay = labelOverlay;
  preloadShipSprites();
  preloadRotationSprites();
  preload3DModels(state.player?.shipClass || undefined);
  // Round pixels for sharp rendering (no global NEAREST - text needs LINEAR)
  PIXI.settings.ROUND_PIXELS = true;

  app = new PIXI.Application({
    resizeTo: container,
    backgroundColor: 0x020414,
    backgroundAlpha: 0,
    antialias: false,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  const view = app.view as HTMLCanvasElement;
  container.appendChild(view);


  // Layer hierarchy
  bgLayer = new PIXI.Container();
  worldLayer = new PIXI.Container();
  trailLayer = new PIXI.Container();
  asteroidLayer = new PIXI.Container();
  stationLayer = new PIXI.Container();
  enemyLayer = new PIXI.Container();
  playerLayer = new PIXI.Container();
  projectileLayer = new PIXI.Container();
  projectileBehindLayer = new PIXI.Container();
  effectsLayer = new PIXI.Container();
  effectsBehindLayer = new PIXI.Container();
  effectsFrontLayer = new PIXI.Container();
  floaterLayer = new PIXI.Container();
  uiLayer = new PIXI.Container();

  // World layer contains all game entities
  worldLayer.addChild(trailLayer);
  worldLayer.addChild(effectsBehindLayer);
  worldLayer.addChild(asteroidLayer);
  worldLayer.addChild(stationLayer);
  worldLayer.addChild(enemyLayer);
  worldLayer.addChild(projectileBehindLayer);
  worldLayer.addChild(playerLayer);
  worldLayer.addChild(projectileLayer);
  worldLayer.addChild(effectsLayer);
  worldLayer.addChild(effectsFrontLayer);
  worldLayer.addChild(floaterLayer);

  // Debug muzzle marker overlay — always the topmost child of worldLayer so
  // dots draw above sprites but under UI. Empty until __DEBUG_MUZZLE_MARKERS.
  debugMuzzleGfx = new PIXI.Graphics();
  debugMuzzleLabels = new PIXI.Container();
  worldLayer.addChild(debugMuzzleGfx);
  worldLayer.addChild(debugMuzzleLabels);

  effectManager = new EffectManager(effectsBehindLayer, effectsFrontLayer);

  lastRenderTime = performance.now();

  app.stage.addChild(bgLayer);
  app.stage.addChild(worldLayer);
  app.stage.addChild(uiLayer);

  // Bootstrap the Three.js station renderer to its own offscreen canvas, then
  // insert a Pixi sprite between bgLayer and worldLayer so the station renders
  // above the bg parallax but below enemies/player/projectiles/effects.
  const stationCanvas = initStation3DLayer(app.screen.width, app.screen.height);
  stationBaseTexture = new PIXI.BaseTexture(stationCanvas, {
    scaleMode: PIXI.SCALE_MODES.NEAREST,
    alphaMode: PIXI.ALPHA_MODES.UNPACK, // Three.js emits straight alpha; Pixi premultiplies on upload
  });
  stationTexture = new PIXI.Texture(stationBaseTexture);
  stationSprite = new PIXI.Sprite(stationTexture);
  stationSprite.width = app.screen.width;
  stationSprite.height = app.screen.height;
  // Insert between bgLayer (index 0) and worldLayer (index 1)
  app.stage.addChildAt(stationSprite, 1);

  // Enemy 3D pass: offscreen ship-layer instance → Pixi sprite INSIDE
  // worldLayer, right below the 2D enemy layer (which holds names/health
  // bars/fallback bodies). Result: enemy models render above stations and
  // asteroids but below names, projectiles, effects and the player, who
  // stays on the top DOM canvas. The sprite is screen-sized; each frame it
  // is counter-scaled against the world transform so it stays screen-aligned.
  enemyShipCanvas = document.createElement("canvas");
  enemyShipCanvas.width = window.innerWidth;
  enemyShipCanvas.height = window.innerHeight;
  initEnemy3DLayer(enemyShipCanvas);
  enemyShipBaseTexture = new PIXI.BaseTexture(enemyShipCanvas, {
    scaleMode: PIXI.SCALE_MODES.NEAREST,
    alphaMode: PIXI.ALPHA_MODES.UNPACK,
  });
  enemyShipTexture = new PIXI.Texture(enemyShipBaseTexture);
  enemyShipSprite = new PIXI.Sprite(enemyShipTexture);
  enemyShipSprite.anchor.set(0.5, 0.5);
  worldLayer.addChildAt(enemyShipSprite, worldLayer.getChildIndex(enemyLayer));

  // Initialize hardpoint editor (F9 to toggle)
  initHardpointEditor(app, state.player?.shipClass || "skimmer");

  // Background graphics
  bgGraphics = new PIXI.Graphics();
  bgLayer.addChild(bgGraphics);
  starGraphics = new PIXI.Graphics();
  bgLayer.addChild(starGraphics);

  // Debug overlay
  if (DEBUG_OVERLAY) {
    debugText = new PIXI.Text("", {
      fontFamily: "Courier New",
      fontSize: 12,
      fill: "#00ff00",
      stroke: "#000000",
      strokeThickness: 2,
    });
    debugText.position.set(10, 10);
    uiLayer.addChild(debugText);
  }

  initStars(app.screen.width, app.screen.height);
  lastZone = "";
}

export function destroyPixiRenderer(): void {
  if (!app) return;

  // Tear down the enemy 3D pass (sprite + texture + its ship-layer instance)
  if (enemyShipSprite) {
    enemyShipSprite.parent?.removeChild(enemyShipSprite);
    enemyShipSprite.destroy();
    enemyShipSprite = null;
  }
  if (enemyShipTexture) {
    enemyShipTexture.destroy(true);
    enemyShipTexture = null;
    enemyShipBaseTexture = null;
  }
  destroyEnemy3DLayer();
  enemyShipCanvas = null;

  // Tear down the station sprite + texture (the Three.js layer keeps its own lifecycle)
  if (stationSprite) {
    stationSprite.parent?.removeChild(stationSprite);
    stationSprite.destroy();
    stationSprite = null;
  }
  if (stationTexture) {
    stationTexture.destroy(true); // also disposes base texture
    stationTexture = null;
  }
  stationBaseTexture = null;

  // Clean up sprite pools
  enemySprites.clear();
  projectileSprites.clear();
  particleSprites.clear();
  otherPlayerSprites.clear();
  npcSprites.clear();
  playerContainer = null;
  playerBody = null;
  playerVisual = null;
  lastPlayerShipClass = null;
  if (_labelOverlay) _labelOverlay.innerHTML = "";

  // Destroy effect manager
  if (effectManager) {
    effectManager.destroy();
    effectManager = null;
  }
  prevEnemyIds.clear();
  prevEnemyData.clear();

  // Destroy gradient sprite
  if (bgGradientSprite) {
    bgGradientSprite.destroy(true);
    bgGradientSprite = null;
  }
  bgGradientZone = "";

  // Destroy textures
  for (const [, tex] of texCache) {
    tex.destroy(true);
  }
  texCache.clear();

  app.destroy(true, { children: true });
  app = null;
}

export function triggerPlayerDamageFlash(isShield: boolean): void {
  if (playerVisual) triggerDamageFlash(playerVisual, isShield);
}
export function triggerPlayerMuzzleFlash(): void {
  if (playerVisual) triggerMuzzleFlash(playerVisual);
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN RENDER LOOP
// ══════════════════════════════════════════════════════════════════════════

// Frame profiling (opt-in via window.__DEBUG_PERF = true). Tracks a rolling
// FPS + logs any frame that spends >20ms in pixiRender. Zero cost when off.
let _perfFrameCount = 0;
let _perfLastReport = 0;
let _perfWorstFrame = 0;

export function pixiRender(): void {
  if (!app) return;
  // Skip heavy game render when hardpoint editor is active
  if (isEditorActive()) { lastRenderTime = performance.now(); return; }

  const now = performance.now();
  const dt = Math.min(0.1, (now - lastRenderTime) / 1000);
  lastRenderTime = now;

  const _perfEnabled = typeof window !== "undefined" && (window as any).__DEBUG_PERF;
  const _perfFrameStart = _perfEnabled ? now : 0;

  const w = app.screen.width;
  const h = app.screen.height;
  const cam = state.player.pos;
  const zoom = state.cameraZoom;

  // Zone change
  if (lastZone !== state.player.zone) {
    regenNebula(state.player.zone);
    lastZone = state.player.zone;
    // Clear entity pools on zone change
    clearZoneEntities();
    clearNebulaSprites();
  }

  // Camera shake
  let sx = 0, sy = 0;
  if (state.cameraShake > 0) {
    const m = state.cameraShake * 16;
    sx = (Math.random() - 0.5) * m;
    sy = (Math.random() - 0.5) * m;
  }

  // Viewport culling bounds
  const cullMargin = 150;
  const halfW = w / 2 / zoom + cullMargin;
  const halfH = h / 2 / zoom + cullMargin;

  // ── 3D Layer frame start ──
  setCameraZoom(zoom);
  setStationCameraZoom(zoom);
  setEnemyCameraZoom(zoom);
  beginFrame();
  beginStationFrame();
  beginEnemyFrame();

  // ── Background ──────────────────────────────────────────────────────
  renderBackground(w, h, cam);

  // ── World transform (camera) ────────────────────────────────────────
  worldLayer.position.set(w / 2 + sx, h / 2 + sy);
  worldLayer.scale.set(zoom);
  worldLayer.pivot.set(cam.x, cam.y);

  // ── Trail particles ───────────────────────────────���─────────────────
  // syncTrailParticles disabled — EffectManager handles all trails
  // syncTrailParticles(cam, halfW, halfH);

  // ── Asteroids ───────────────────────────────────────────────────────
  syncAsteroids(cam, halfW, halfH);

  // ── Stations & Portals ──────────────────────────────────────────────
  syncStations();
  syncPortals();

  // ── Enemies ─────────────────────────────────────────────────────────
  syncEnemies(cam, halfW, halfH);

  // ── Other Players ───────────────────────────────────────────────────
  syncOtherPlayers(cam, halfW, halfH);

  // ── NPC Ships ───────────────────────────────────────────────────────
  syncNpcs(cam, halfW, halfH);

  // ── Projectiles ─────────────────────────────────────────────────────
  syncProjectiles(cam, halfW, halfH);

  // ── Debug: muzzle & spawn alignment markers ────────────────────────
  syncDebugMuzzleMarkers();

  // ── Effect particles ────────────────────────────────────────────────
  // syncEffectParticles disabled — EffectManager handles all VFX
  // syncEffectParticles(cam, halfW, halfH);

  // ── Player ──────────────────────────────────────────────────────────
  syncPlayer();

  // ── Map boundary ────────────────────────────────────────────────────
  syncMapBoundary();

  // ── Cargo boxes ────────────────────────────────────────────────────
  syncCargoBoxes(cam, halfW, halfH);

  // ── Dungeon rifts ──────────────────────────────────────────────────
  syncDungeonRifts();

  // ── Mining laser beam ────────────────────────────────────────────
  syncMiningLaser();

  // ── Move target ────────────────────────────────────────────────────
  syncMoveTarget();

  // ── Player drones ──────────────────────────────────────────────────
  syncDrones();

  // ── Floaters ────────────────────────────────────────────────────────
  syncFloaters(cam, halfW, halfH);

  // ── Screen-space overlays ───────────────────────────────────────────
  renderOverlays(w, h);

  // ── 3D Layer cleanup + render ──
  endFrame();
  endStationFrame();
  endEnemyFrame();
  // updateNebulaBackground(cam.x, cam.y); — disabled, using sprite layers
  renderStation3DLayer();
  // Push updated Three.js station pixels into the Pixi sprite texture
  if (stationBaseTexture) stationBaseTexture.update();
  // Keep the sprite matched to the Pixi viewport size
  if (stationSprite && stationSprite.width !== app!.screen.width) {
    stationSprite.width = app!.screen.width;
    stationSprite.height = app!.screen.height;
  }
  // Enemy 3D pass: render offscreen, sync pixels, and counter-transform the
  // sprite against worldLayer (pivot=cam, scale=zoom) so it stays screen-aligned.
  renderEnemy3DLayer();
  if (enemyShipBaseTexture && enemyShipCanvas) {
    if (enemyShipBaseTexture.width !== enemyShipCanvas.width || enemyShipBaseTexture.height !== enemyShipCanvas.height) {
      enemyShipBaseTexture.setRealSize(enemyShipCanvas.width, enemyShipCanvas.height);
    }
    enemyShipBaseTexture.update();
  }
  if (enemyShipSprite) {
    enemyShipSprite.position.set(cam.x, cam.y);
    enemyShipSprite.width = w / zoom;
    enemyShipSprite.height = h / zoom;
  }
  render3DLayer();

  // ── Effect Manager Update ──────────────────────────────────────────
  if (effectManager) {
    effectManager.update(dt);

    // Detect enemy deaths -> spawn scaled explosion with debris + hull fragments
    // Note: currentEnemyIds is stored across frames as `prevEnemyIds`, so a
    // fresh Set is required here (do not reuse a module-level Set).
    const currentEnemyIds = new Set<string>();
    for (const e of state.enemies) currentEnemyIds.add(e.id);
    for (const id of prevEnemyIds) {
      if (!currentEnemyIds.has(id)) {
        const prev = prevEnemyData.get(id);
        if (prev) {
          const explosionType = prev.size > 20 ? "large" : prev.size > 10 ? "medium" : "small";
          effectManager.spawnExplosion(prev.x, prev.y, prev.size * 2.5, explosionType);
          // Extra debris + smoke for all enemies
          effectManager.spawnDebrisBurst(prev.x, prev.y, Math.ceil(prev.size / 2), [0x556677, 0x778899, 0x99aabb, 0x445566, 0x667788]);
          effectManager.spawnSmokePuff(prev.x, prev.y, prev.size * 1.2);
          // Even more for larger enemies
          if (prev.size > 15) {
            effectManager.spawnDebrisBurst(prev.x, prev.y, Math.ceil(prev.size / 2), [0x778899, 0x99aabb, 0x556677]);
            effectManager.spawnSmokePuff(prev.x, prev.y, prev.size * 0.8);
          }
        }
      }
    }
    prevEnemyIds = currentEnemyIds;
    prevEnemyData.clear();
    for (const e of state.enemies) {
      prevEnemyData.set(e.id, { x: e.pos.x, y: e.pos.y, size: e.size, type: e.type });
    }

    // Detect asteroid deaths -> spawn heavy debris + smoke + sparks
    // Note: currentAsteroidIds is stored across frames as `prevAsteroidIds`,
    // so a fresh Set is required (do not reuse a module-level Set).
    const currentAsteroidIds = new Set<string>();
    for (const a of state.asteroids) {
      if (a.zone === state.player.zone) currentAsteroidIds.add(a.id);
    }
    for (const id of prevAsteroidIds) {
      if (!currentAsteroidIds.has(id)) {
        const prev = prevAsteroidData.get(id);
        if (prev) {
          // Smoke-only asteroid destruction (no sparks, no fire)
          effectManager.spawnSmokePuff(prev.x, prev.y, prev.size * 4);
          effectManager.spawnSmokePuff(prev.x, prev.y, prev.size * 3);
          effectManager.spawnSmokePuff(prev.x + (Math.random()-0.5)*15, prev.y + (Math.random()-0.5)*15, prev.size * 3);
          effectManager.spawnSmokePuff(prev.x + (Math.random()-0.5)*20, prev.y + (Math.random()-0.5)*20, prev.size * 2.5);
          effectManager.spawnSmokePuff(prev.x + (Math.random()-0.5)*10, prev.y + (Math.random()-0.5)*10, prev.size * 2);
        }
      }
    }
    prevAsteroidIds = currentAsteroidIds;
    prevAsteroidData.clear();
    for (const a of state.asteroids) {
      if (a.zone === state.player.zone) {
        prevAsteroidData.set(a.id, { x: a.pos.x, y: a.pos.y, size: a.size });
      }
    }

    // Player hit detection — spawn hit flash + debris when hull drops
    const currentHull = state.player.hull;
    if (prevPlayerHull > 0 && currentHull < prevPlayerHull && state.playerRespawnTimer <= 0) {
      const p = state.player;
      effectManager.spawnHitEffect(p.pos.x, p.pos.y, p.angle + Math.PI, "laser", 0xff4444, p.shield > 0);
      // Extra debris flying from player on hit
      effectManager.spawnDebrisBurst(p.pos.x, p.pos.y, 4, [0x556677, 0x778899, 0x667788, 0x445566]);
    }
    prevPlayerHull = currentHull;
  }

  // ── Debug ───────────────────────────────────────────────────────────
  if (DEBUG_OVERLAY && debugText) {
    frameCount++;
    const now2 = performance.now();
    if (now2 - lastFpsTime > 1000) {
      fps = frameCount;
      frameCount = 0;
      lastFpsTime = now2;
    }
    const cam2 = state.player.pos;
    const zoom2 = state.cameraZoom;
    const vfxTotal = effectManager ? effectManager.debugActiveTotal : 0;
    const vfxSparks = effectManager ? effectManager.debugActiveSparks : 0;
    const vfxSmoke = effectManager ? effectManager.debugActiveSmoke : 0;
    const vfxTrails = effectManager ? effectManager.debugActiveTrails : 0;
    debugText.text = [
      `FPS: ${fps}  |  Renderer: PixiJS WebGL`,
      `Cam: ${Math.round(cam2.x)},${Math.round(cam2.y)} Zoom: ${zoom2.toFixed(2)}`,
      `Screen: ${w}x${h} DPR: ${(app!.renderer.resolution).toFixed(1)}`,
      `Enemies: ${enemySprites.size}/${state.enemies.length}`,
      `Proj: ${projectileSprites.size}/${state.projectiles.length}  Part: ${particleSprites.size}/${state.particles.length}`,
      `Others: ${otherPlayerSprites.size}  NPCs: ${npcSprites.size}  Textures: ${texCache.size}`,
      `VFX: ${vfxTotal} (spark:${vfxSparks} smoke:${vfxSmoke} trail:${vfxTrails})`,
    ].join("\n");
  }

  // ── Perf profiling (opt-in via window.__DEBUG_PERF) ───────────────────
  if (_perfEnabled) {
    const frameTime = performance.now() - _perfFrameStart;
    if (frameTime > _perfWorstFrame) _perfWorstFrame = frameTime;
    if (frameTime > 20) {
      console.warn(`[Perf] slow frame: ${frameTime.toFixed(1)}ms — enemies:${state.enemies.length} proj:${state.projectiles.length} particles:${state.particles.length} others:${state.others.length}`);
    }
    _perfFrameCount++;
    if (now - _perfLastReport > 1000) {
      console.log(`[Perf] ${_perfFrameCount} fps, worstFrame:${_perfWorstFrame.toFixed(1)}ms — enemies:${state.enemies.length} proj:${state.projectiles.length} particles:${state.particles.length} others:${state.others.length}`);
      _perfFrameCount = 0;
      _perfWorstFrame = 0;
      _perfLastReport = now;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// BACKGROUND RENDERING — Pixellab pixel art parallax
// ══════════════════════════════════════════════════════════════════════════

// Keys are the zone labels (folder names for sprites: /bg/1-1/, /bg/1-2/, etc.)
// Internal zone IDs (alpha, nebula, ...) are mapped to labels in _bgZoneLabel().
const BG_ZONE_CFG: Record<string, { fill: string; wx: number; wy: number; pSpeed: number; pSize: number; glow: string }> = {
  // Earth faction (1-x)
  "1-1": { fill: "#060e2e", wx:  1200, wy:  -900, pSpeed: 0.14, pSize: 2048, glow: "#3366cc" },
  // wx/wy deliberately spread across different quadrants/distances so each map's
  // planet appears somewhere else; pSize varies (bigger, unique planets since v4).
  "1-2": { fill: "#120832", wx: -3800, wy: -2200, pSpeed: 0.16, pSize: 460, glow: "#7722aa" },
  "1-3": { fill: "#200610", wx:  4600, wy:  1500, pSpeed: 0.20, pSize: 380, glow: "#cc2233" },
  "1-4": { fill: "#030e12", wx:   900, wy:  4200, pSpeed: 0.22, pSize: 310, glow: "#006655" },
  "1-5": { fill: "#160c04", wx: -2600, wy:  3400, pSpeed: 0.18, pSize: 420, glow: "#cc6600" },
  // Mars faction (2-x)
  "2-1": { fill: "#1a0802", wx:  3200, wy: -3800, pSpeed: 0.17, pSize: 450, glow: "#cc4400" },
  "2-2": { fill: "#1c0a02", wx: -4800, wy:   800, pSpeed: 0.22, pSize: 340, glow: "#884422" },
  "2-3": { fill: "#16040e", wx:  1800, wy:  2600, pSpeed: 0.19, pSize: 400, glow: "#aa0033" },
  "2-4": { fill: "#16021a", wx: -1200, wy: -4600, pSpeed: 0.21, pSize: 370, glow: "#660066" },
  "2-5": { fill: "#0a0220", wx:  5200, wy:  -700, pSpeed: 0.15, pSize: 500, glow: "#5500cc" },
  // Venus faction (3-x)
  "3-1": { fill: "#0a1606", wx: -3400, wy: -3600, pSpeed: 0.18, pSize: 430, glow: "#44aa22" },
  "3-2": { fill: "#0e1a04", wx:  2400, wy:  4400, pSpeed: 0.21, pSize: 350, glow: "#88cc00" },
  "3-3": { fill: "#0a1800", wx: -5000, wy:  2000, pSpeed: 0.16, pSize: 470, glow: "#22cc44" },
  "3-4": { fill: "#041206", wx:   700, wy: -3000, pSpeed: 0.23, pSize: 320, glow: "#00aa66" },
  "3-5": { fill: "#081402", wx:  3800, wy:  2900, pSpeed: 0.19, pSize: 410, glow: "#66dd00" },
  // Danger zones (4-x)
  "4-1": { fill: "#180408", wx: -2000, wy:  4800, pSpeed: 0.18, pSize: 440, glow: "#ff2244" },
  "4-2": { fill: "#1a0206", wx:  4400, wy: -2600, pSpeed: 0.20, pSize: 390, glow: "#ff4400" },
  "4-3": { fill: "#160008", wx: -4400, wy: -1400, pSpeed: 0.16, pSize: 480, glow: "#cc0066" },
  "4-4": { fill: "#120010", wx:  1400, wy:  3800, pSpeed: 0.22, pSize: 355, glow: "#aa00cc" },
  "4-5": { fill: "#0e0016", wx:  -900, wy: -5200, pSpeed: 0.17, pSize: 430, glow: "#6600ff" },
  // Debug
  "DBG": { fill: "#001a00", wx:     0, wy:     0, pSpeed: 0.20, pSize: 200, glow: "#00ff00" },
};

// Maps internal zone id -> label (folder name)
const _bgZoneIdToLabel: Record<string, string> = {
  alpha:"1-1", nebula:"1-2", crimson:"1-3", void:"1-4", forge:"1-5",
  corona:"2-1", fracture:"2-2", abyss:"2-3", marsdepth:"2-4", maelstrom:"2-5",
  venus1:"3-1", venus2:"3-2", venus3:"3-3", venus4:"3-4", venus5:"3-5",
  danger1:"4-1", danger2:"4-2", danger3:"4-3", danger4:"4-4", danger5:"4-5",
  debug:"DBG",
};

function _bgHexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

let _bgZoneActive = "";
let _bgFillSprite: PIXI.Sprite | null = null;
let _bgStarsTile: PIXI.TilingSprite | null = null;
let _bgNebulaTile: PIXI.TilingSprite | null = null;
let _bgPlanetSprite: PIXI.Sprite | null = null;
let _bgNebulaTopTile: PIXI.TilingSprite | null = null;
let _bgDustTile: PIXI.TilingSprite | null = null;
let _bgDebrisTile: PIXI.TilingSprite | null = null;
let _bgAstSprites: { spr: PIXI.Sprite; u: number; v: number; rotSpeed: number; rot0: number }[] = [];
let _bgDriftX = 0;
let _bgDriftY = 0;

// Deterministic per-zone RNG so asteroid layouts are stable across sessions
function _bgSeededRng(label: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < label.length; i++) { h ^= label.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

function _bgDestroyLayers(): void {
  for (const s of [_bgFillSprite, _bgStarsTile, _bgNebulaTile, _bgPlanetSprite, _bgNebulaTopTile, _bgDustTile, _bgDebrisTile]) {
    if (s) { s.parent?.removeChild(s); s.destroy({ texture: false, baseTexture: false }); }
  }
  for (const a of _bgAstSprites) {
    a.spr.parent?.removeChild(a.spr);
    a.spr.destroy({ texture: false, baseTexture: false });
  }
  _bgAstSprites = [];
  _bgFillSprite = null; _bgStarsTile = null; _bgNebulaTile = null;
  _bgPlanetSprite = null; _bgNebulaTopTile = null; _bgDustTile = null;
  _bgDebrisTile = null;
  _bgDriftX = 0; _bgDriftY = 0;
}

function _bgBuildSprites(
  zone: string, w: number, h: number,
  sTex: PIXI.Texture, nTex: PIXI.Texture,
  pTex: PIXI.Texture, dTex: PIXI.Texture,
  dustTex: PIXI.Texture, debrisTex: PIXI.Texture,
  res: number,
): void {
  const label = _bgZoneIdToLabel[zone] ?? zone;
  const cfg = BG_ZONE_CFG[label] ?? BG_ZONE_CFG["1-1"];

  // Insert all bg sprites at index 0, in reverse order so the final order is:
  // 0: fill, 1: stars, 2: nebula, 3: nebula-top, 4: dust, 5: planet, 6: debris,
  // then bgGraphics/starGraphics on top.
  // We insert debris first (lowest priority addChildAt call) through fill last (index 0).

  _bgDebrisTile = new PIXI.TilingSprite(debrisTex, w, h);
  _bgDebrisTile.tileScale.set(1 / res);
  bgLayer.addChildAt(_bgDebrisTile, 0);

  _bgPlanetSprite = new PIXI.Sprite(dTex);
  _bgPlanetSprite.anchor.set(0.5);
  bgLayer.addChildAt(_bgPlanetSprite, 0);

  _bgDustTile = new PIXI.TilingSprite(dustTex, w, h);
  _bgDustTile.alpha = 0.16;
  _bgDustTile.tileScale.set(1 / res);
  bgLayer.addChildAt(_bgDustTile, 0);

  _bgNebulaTopTile = new PIXI.TilingSprite(pTex, w, h);
  _bgNebulaTopTile.alpha = 0.12;
  _bgNebulaTopTile.tileScale.set(1 / res);
  _bgNebulaTopTile.filters = [new PIXI.ColorMatrixFilter()];
  bgLayer.addChildAt(_bgNebulaTopTile, 0);

  _bgNebulaTile = new PIXI.TilingSprite(nTex, w, h);
  _bgNebulaTile.alpha = 0.52;
  _bgNebulaTile.tileScale.set(1 / res);
  _bgNebulaTile.filters = [new PIXI.ColorMatrixFilter()];
  bgLayer.addChildAt(_bgNebulaTile, 0);

  _bgStarsTile = new PIXI.TilingSprite(sTex, w, h);
  _bgStarsTile.tileScale.set(1 / res);
  _bgStarsTile.filters = [new PIXI.ColorMatrixFilter()];
  bgLayer.addChildAt(_bgStarsTile, 0);

  // Fill goes at index 0 last — pushes everything else up by 1
  const fc = document.createElement("canvas"); fc.width = 1; fc.height = 1;
  const fx = fc.getContext("2d")!;
  fx.fillStyle = cfg.fill; fx.fillRect(0, 0, 1, 1);
  _bgFillSprite = new PIXI.Sprite(PIXI.Texture.from(fc, { scaleMode: PIXI.SCALE_MODES.NEAREST }));
  _bgFillSprite.width = w; _bgFillSprite.height = h;
  bgLayer.addChildAt(_bgFillSprite, 0);

  // Final order: 0=fill, 1=stars(L1), 2=nebula(L2), 3=nebula-top(L3), 4=dust(L5),
  //              5=planet(L4), 6=debris(L6), 7+=bgGraphics/starGraphics
}

function _bgBuildLayers(zone: string, w: number, h: number): void {
  _bgDestroyLayers();
  _bgZoneActive = zone;
  const label = _bgZoneIdToLabel[zone] ?? zone;
  const base = `/bg/${label}`;

  const urls = [
    `${base}/Layer1_${label}.png`,
    `${base}/Layer2_${label}.png`,
    `${base}/Layer3_${label}.png?v=2`,
    `${base}/Layer4_${label}.png`,
    `${base}/Layer5_${label}.png`, // space dust / haze (optional, tiled)
    `${base}/Layer6_${label}.png`, // foreground debris / asteroids (optional, tiled)
  ];

  console.log("[bg] loading zone", zone, "label", label, "urls", urls);

  Promise.all(urls.map(u =>
    (PIXI.Texture as any).fromURL(u, { scaleMode: PIXI.SCALE_MODES.NEAREST })
      .then((t: PIXI.Texture) => {
        t.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
        console.log("[bg] loaded OK:", u, t.width, "x", t.height);
        return t;
      })
      .catch((e: any) => { console.warn("[bg] FAILED:", u, e?.message ?? e); return PIXI.Texture.EMPTY; })
  )).then(([sTex, nTex, pTex, dTex, dustTex, debrisTex]) => {
    console.log("[bg] all loaded, building sprites for zone", zone);
    if (_bgZoneActive !== zone) { console.log("[bg] zone changed, skipping"); return; }
    _bgBuildSprites(zone, w, h, sTex as PIXI.Texture, nTex as PIXI.Texture, pTex as PIXI.Texture, dTex as PIXI.Texture, dustTex as PIXI.Texture, debrisTex as PIXI.Texture, app ? app.renderer.resolution : 1);
  });

  // Rotating foreground asteroids (ast1..4_<label>.png, optional per map).
  // Individual sprites so each can spin — a baked tile can't rotate its contents.
  const astUrls = [1, 2, 3, 4].map(i => `${base}/ast${i}_${label}.png`);
  Promise.all(astUrls.map(u =>
    (PIXI.Texture as any).fromURL(u, { scaleMode: PIXI.SCALE_MODES.NEAREST })
      .catch(() => null)
  )).then((texs: (PIXI.Texture | null)[]) => {
    if (_bgZoneActive !== zone) return;
    const valid = texs.filter((t): t is PIXI.Texture => !!t);
    if (valid.length === 0 || !bgGraphics) return;
    const rnd = _bgSeededRng(label);
    const count = label.startsWith("4-") ? 8 : 5;
    for (let i = 0; i < count; i++) {
      const spr = new PIXI.Sprite(valid[Math.floor(rnd() * valid.length)]);
      spr.anchor.set(0.5);
      spr.scale.set(0.4 + rnd() * 1.2);
      spr.alpha = 0.5 + rnd() * 0.45;
      // insert just below bgGraphics so asteroids stay part of the background stack
      bgLayer.addChildAt(spr, bgLayer.getChildIndex(bgGraphics));
      _bgAstSprites.push({
        spr,
        u: rnd(), v: rnd(),
        rotSpeed: (rnd() < 0.5 ? -1 : 1) * (0.08 + rnd() * 0.22), // slow but visible spin, rad/s
        rot0: rnd() * Math.PI * 2,
      });
    }
  });
}
function renderBackground(w: number, h: number, cam: { x: number; y: number }): void {
  if (!bgGraphics || !starGraphics) return;

  const zone = state.player.zone;
  const label = _bgZoneIdToLabel[zone] ?? zone;
  const cfg = BG_ZONE_CFG[label] ?? BG_ZONE_CFG["1-1"];
  const t = state.tick / 60;

  if (_bgZoneActive !== zone) _bgBuildLayers(zone, w, h);

  bgGraphics.clear();

  // Advance slow autonomous drift (makes layers feel alive even when camera is still)
  _bgDriftX += 0.08;
  _bgDriftY += 0.04;

  const res = app ? app.renderer.resolution : 1;

  if (_bgFillSprite) { _bgFillSprite.width = w; _bgFillSprite.height = h; }

  if (_bgStarsTile) {
    _bgStarsTile.width = w; _bgStarsTile.height = h;
    _bgStarsTile.tilePosition.x = Math.round((-cam.x * 0.05 + _bgDriftX * 0.5) * res) / res;
    _bgStarsTile.tilePosition.y = Math.round((-cam.y * 0.05 + _bgDriftY * 0.5) * res) / res;
    _bgStarsTile.alpha = 1.0;
  }

  if (_bgNebulaTile) {
    _bgNebulaTile.width = w; _bgNebulaTile.height = h;
    _bgNebulaTile.tilePosition.x = Math.round((-cam.x * 0.12 + _bgDriftX * 0.3) * res) / res;
    _bgNebulaTile.tilePosition.y = Math.round((-cam.y * 0.12 + _bgDriftY * 0.3) * res) / res;
  }

  if (_bgNebulaTopTile) {
    _bgNebulaTopTile.width = w; _bgNebulaTopTile.height = h;
    _bgNebulaTopTile.tilePosition.x = Math.round((-cam.x * 0.08 + _bgDriftX * 0.2) * res) / res;
    _bgNebulaTopTile.tilePosition.y = Math.round((-cam.y * 0.08 + _bgDriftY * 0.2) * res) / res;
    _bgNebulaTopTile.alpha = 0.2;
  }

  if (_bgDustTile) {
    // L5: space dust / haze — medium-fast, kept faint
    _bgDustTile.width = w; _bgDustTile.height = h;
    _bgDustTile.tilePosition.x = Math.round((-cam.x * 0.18 + _bgDriftX * 0.4) * res) / res;
    _bgDustTile.tilePosition.y = Math.round((-cam.y * 0.18 + _bgDriftY * 0.4) * res) / res;
    _bgDustTile.alpha = 0.16;
  }

  if (_bgDebrisTile) {
    // L6: foreground debris / asteroids — fastest band, sparse art keeps it calm
    _bgDebrisTile.width = w; _bgDebrisTile.height = h;
    _bgDebrisTile.tilePosition.x = Math.round((-cam.x * 0.30 + _bgDriftX * 0.5) * res) / res;
    _bgDebrisTile.tilePosition.y = Math.round((-cam.y * 0.30 + _bgDriftY * 0.5) * res) / res;
    _bgDebrisTile.alpha = 0.9;
  }

  if (_bgAstSprites.length > 0) {
    // Rotating foreground asteroids — fastest parallax band, individual slow spin.
    // Positions wrap on a region slightly larger than the screen so sprites
    // leave one edge fully before re-entering the other.
    const M = 160;
    const wrapW = w + M * 2, wrapH = h + M * 2;
    const scrollX = -cam.x * 0.30 + _bgDriftX * 0.5;
    const scrollY = -cam.y * 0.30 + _bgDriftY * 0.5;
    for (const a of _bgAstSprites) {
      a.spr.x = ((a.u * wrapW + scrollX) % wrapW + wrapW) % wrapW - M;
      a.spr.y = ((a.v * wrapH + scrollY) % wrapH + wrapH) % wrapH - M;
      a.spr.rotation = a.rot0 + t * a.rotSpeed;
    }
  }

  if (_bgPlanetSprite) {
    // Planet: world-space position — moves with camera like any game object
    const px = Math.round(w / 2 + (cfg.wx - cam.x) * cfg.pSpeed);
    const py = Math.round(h / 2 + (cfg.wy - cam.y) * cfg.pSpeed);
    _bgPlanetSprite.x = px;
    _bgPlanetSprite.y = py;
    _bgPlanetSprite.width = cfg.pSize;
    _bgPlanetSprite.height = cfg.pSize;
    _bgPlanetSprite.alpha = 1.0;
  }

  if (enhancedStars.length === 0) initStars(w, h);
  // Star field is 860 draw calls per frame — cache and only re-render when
  // camera moves meaningfully or every ~4 frames for the twinkle animation.
  // This trims a stable 30–50% off frame time.
  const camDx = cam.x - _lastStarCamX;
  const camDy = cam.y - _lastStarCamY;
  const tickDelta = state.tick - _lastStarTick;
  if (Math.abs(camDx) > 1.5 || Math.abs(camDy) > 1.5 || tickDelta >= 4) {
    renderEnhancedStars(starGraphics, enhancedStars, cam, w, h, state.tick);
    _lastStarCamX = cam.x;
    _lastStarCamY = cam.y;
    _lastStarTick = state.tick;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ENEMY SYNC
// ══════════════════════════════════════════════════════════════════════════

function syncEnemies(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  _reuseEnemySyncIds.clear();
  const activeIds = _reuseEnemySyncIds;
  _enemyGlowFrameCounter = (_enemyGlowFrameCounter + 1) & 3; // 0-3 cycle
  const drawWeaponGlowThisFrame = _enemyGlowFrameCounter === 0;

  for (const e of state.enemies) {
    // Viewport culling
    if (Math.abs(e.pos.x - cam.x) > halfW + e.size || Math.abs(e.pos.y - cam.y) > halfH + e.size) {
      // Hide if exists
      const existing = enemySprites.get(e.id);
      if (existing) existing.container.visible = false;
      activeIds.add(e.id);
      continue;
    }

    activeIds.add(e.id);
    let data = enemySprites.get(e.id);
    const currentTexKey = enemyTexKey(e);

    if (!data) {
      // Create new enemy sprite
      const container = new PIXI.Container();
      const tex = getEnemyTex(e);
      const body = new PIXI.Sprite(tex);
      body.anchor.set(0.5);
      container.addChild(body);

      const healthBar = new PIXI.Graphics();
      container.addChild(healthBar);

      const nameText = new PIXI.Text(e.name || "", {
        fontFamily: '"Kenney Future Narrow", "Courier New", monospace',
        fontSize: 16,
        fill: "#ff3344",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 2,
        letterSpacing: 1,
      });
      nameText.resolution = 4;
      nameText.anchor.set(0.5, 1);
      container.addChild(nameText);

      enemyLayer.addChild(container);
      data = { container, body, healthBar, nameText, texKey: currentTexKey };

      // Alien core glow (additive blend behind body)
      const coreGlowSize = e.isBoss ? 20 : 8 + e.size * 0.3;
      const coreGlow = new PIXI.Sprite(getGlowTex(Math.ceil(coreGlowSize)));
      coreGlow.anchor.set(0.5);
      coreGlow.blendMode = PIXI.BLEND_MODES.ADD;
      coreGlow.tint = PIXI.utils.string2hex(e.color);
      coreGlow.alpha = 0.3;
      container.addChildAt(coreGlow, 0);
      data.coreGlow = coreGlow;

      // Boss aura ring
      if (e.isBoss) {
        const bossAura = new PIXI.Graphics();
        container.addChildAt(bossAura, 0);
        data.bossAura = bossAura;
      }

      // Weapon glow indicators (small glowing dots at front)
      const weaponGlow = new PIXI.Graphics();
      container.addChild(weaponGlow);
      data.weaponGlow = weaponGlow;

      enemySprites.set(e.id, data);
    } else if (data.texKey !== currentTexKey) {
      data.body.texture = getEnemyTex(e);
      data.texKey = currentTexKey;
      if (data.coreGlow) data.coreGlow.tint = PIXI.utils.string2hex(e.color);
    }

    // Update position & rotation
    data.container.visible = true;
    data.container.position.set(e.pos.x, e.pos.y);
    data.body.rotation = e.angle + Math.PI / 2;

    // 3D model swap: when the GLB is ready, hide the 2D body and drive the
    // enemy ship layer instead (health bar/name/auras stay in Pixi).
    // Model choice (incl. pirates on player hulls) comes from lib/hitbox's
    // enemyModelKey — the SAME mapping the silhouette hitboxes use, so what
    // you see is exactly what you hit.
    const enemyModelKey = sharedEnemyModelKey(e.type, e.id);
    const enemyUse3D = !!enemyModelKey && enemyHas3DModel(enemyModelKey) && enemyIs3DReady(enemyModelKey);
    if (enemyUse3D) {
      data.body.visible = false;
      if (data.coreGlow) data.coreGlow.visible = false;
      updateEnemyShip3D("enemy:" + e.id, enemyModelKey, e.pos.x, e.pos.y, e.angle, e.size / 15.2, cam.x, cam.y);
      markEnemyActive("enemy:" + e.id);
    } else {
      data.body.visible = true;
      if (data.coreGlow) data.coreGlow.visible = true;
    }

    // Animate alien core glow
    if (data.coreGlow) {
      const pulse = 0.2 + 0.15 * Math.sin(state.tick * 3 + e.size * 0.5);
      data.coreGlow.alpha = pulse;
      const scale = 0.9 + 0.1 * Math.sin(state.tick * 2.5);
      data.coreGlow.scale.set(scale);
    }

    // Animate weapon glow — throttled to every 4th frame (see _enemyGlowFrameCounter)
    if (data.weaponGlow && drawWeaponGlowThisFrame) {
      data.weaponGlow.clear();
      const wColor = PIXI.utils.string2hex(e.color);
      const wPulse = 0.4 + 0.4 * Math.sin(state.tick * 5 + e.pos.x * 0.01);
      const wOff = e.size * 0.6;
      data.weaponGlow.beginFill(0xffffff, wPulse * 0.6);
      data.weaponGlow.drawCircle(-wOff * 0.4, -wOff, 1.2);
      data.weaponGlow.drawCircle(wOff * 0.4, -wOff, 1.2);
      data.weaponGlow.endFill();
      data.weaponGlow.beginFill(wColor, wPulse * 0.3);
      data.weaponGlow.drawCircle(-wOff * 0.4, -wOff, 2.5);
      data.weaponGlow.drawCircle(wOff * 0.4, -wOff, 2.5);
      data.weaponGlow.endFill();
    }

    // Animate boss aura
    if (data.bossAura && e.isBoss) {
      data.bossAura.clear();
      const auraPulse = 0.3 + 0.2 * Math.sin(state.tick * 2);
      data.bossAura.lineStyle(2, PIXI.utils.string2hex(e.color), auraPulse);
      data.bossAura.drawCircle(0, 0, e.size + 8 + Math.sin(state.tick * 1.5) * 3);
      data.bossAura.lineStyle(1, 0xffffff, auraPulse * 0.3);
      data.bossAura.drawCircle(0, 0, e.size + 14 + Math.sin(state.tick * 2.5) * 2);
    }

    // Hit flash effect - bright white flash + shake
    if (e.hitFlash && e.hitFlash > 0) {
      const intensity = Math.min(1, e.hitFlash * 3);
      data.body.alpha = 1;
      data.body.tint = PIXI.utils.rgb2hex([
        1,
        0.7 + intensity * 0.3,
        0.7 + intensity * 0.3,
      ]);
      // Micro-shake on hit
      data.container.position.set(
        e.pos.x + (Math.random() - 0.5) * intensity * 3,
        e.pos.y + (Math.random() - 0.5) * intensity * 3
      );
      // Cinematic laser hit effect on enemy edge facing the player
      if (effectManager && e.hitFlash > 0.2) {
        const eventId = `hit-${e.id}-${Math.floor(state.tick * 10)}`;
        if (!effectManager.hasProcessed(eventId)) {
          effectManager.markProcessed(eventId);
          // Direction from player to enemy = where projectiles hit
          const pp = state.player.pos;
          const hitAngle = Math.atan2(e.pos.y - pp.y, e.pos.x - pp.x);
          // Place hit at enemy edge (not center)
          const edgeDist = e.size * (0.7 + Math.random() * 0.3);
          const spread = (Math.random() - 0.5) * 0.8;
          const hx = e.pos.x - Math.cos(hitAngle + spread) * edgeDist;
          const hy = e.pos.y - Math.sin(hitAngle + spread) * edgeDist;
          effectManager.spawnCinematicLaserHit(hx, hy, hitAngle, PIXI.utils.string2hex(e.color), 0);
        }
      }
    } else {
      data.body.alpha = 1;
      data.body.tint = 0xffffff;
    }

    // Health bar
    const barW = e.isBoss ? 64 : 28;
    const pct = Math.max(0, Math.min(1, e.hull / e.hullMax));
    data.healthBar.clear();
    data.healthBar.position.set(-barW / 2, -e.size - 10);
    // Background
    data.healthBar.beginFill(0x222222, 0.7);
    data.healthBar.drawRect(0, 0, barW, 4);
    data.healthBar.endFill();
    // Fill
    const hpColor = pct > 0.5 ? 0x44ff66 : pct > 0.25 ? 0xffd24a : 0xff3b4d;
    data.healthBar.beginFill(hpColor);
    data.healthBar.drawRect(0, 0, barW * pct, 4);
    data.healthBar.endFill();

    // Name — constant screen size at any zoom (counter-scaled against the
    // world transform) and offset by the ship's silhouette radius so it
    // clears the hull. Red for every enemy; bosses keep their amber flair.
    const zoomN = state.cameraZoom;
    const eHullKey = sharedEnemyModelKey(e.type, e.id);
    const rWorldN = eHullKey
      ? shipHullRadius(eHullKey, sharedEnemySizeScale(e.size)) * 0.66
      : e.size + 10;
    data.nameText.scale.set(1 / zoomN);
    if (e.isBoss) {
      data.nameText.text = `◆ ${(e.name || "DREADNOUGHT").toUpperCase()} ◆`;
      data.nameText.style.fill = "#ff8a4e";
      data.nameText.position.set(0, -(rWorldN + 14 / zoomN));
    } else if (e.name) {
      data.nameText.text = e.name;
      data.nameText.position.set(0, -(rWorldN + 10 / zoomN));
    } else {
      data.nameText.text = "";
    }

    // Selection ring (animated pulse)
    if (state.selectedWorldTarget?.kind === "enemy" && state.selectedWorldTarget.id === e.id) {
      if (!data.selectionRing) {
        data.selectionRing = new PIXI.Graphics();
        data.container.addChildAt(data.selectionRing, 0);
      }
      data.selectionRing.clear();
      const pulse = 0.6 + 0.4 * Math.sin(state.tick * 5);
      const ringR = e.size + 12 + Math.sin(state.tick * 3) * 2;
      data.selectionRing.lineStyle(2, 0xff3b4d, pulse);
      data.selectionRing.drawCircle(0, 0, ringR);
      data.selectionRing.lineStyle(1, 0xff3b4d, pulse * 0.4);
      data.selectionRing.drawCircle(0, 0, ringR + 4);
      data.selectionRing.visible = true;
    } else if (data.selectionRing) {
      data.selectionRing.visible = false;
    }
  }

  // Remove sprites for dead enemies
  for (const [id, data] of enemySprites) {
    if (!activeIds.has(id)) {
      enemyLayer.removeChild(data.container);
      data.container.destroy({ children: true });
      enemySprites.delete(id);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PROJECTILE SYNC
// ══════════════════════════════════════════════════════════════════════════

const muzzleFlashes = new Map<string, { g: PIXI.Graphics; ttl: number }>();

function syncProjectiles(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  _reuseProjSyncIds.clear();
  const activeIds = _reuseProjSyncIds;

  for (const pr of state.projectiles) {
    if (Math.abs(pr.pos.x - cam.x) > halfW + 30 || Math.abs(pr.pos.y - cam.y) > halfH + 30) {
      activeIds.add(pr.id);
      const existing = projectileSprites.get(pr.id);
      if (existing) existing.sprite.visible = false;
      continue;
    }

    activeIds.add(pr.id);
    let data = projectileSprites.get(pr.id);

    if (!data) {
      // Projectile visuals: animated FX sprites (CC0 packs, recolored per
      // enemy) with procedural canvas art as instant fallback while loading.
      const kind = pr.weaponKind;
      const isRocket = kind === "rocket";
      const fxName = !pr.fromPlayer ? FX_KIND_MAP[kind] : undefined;
      const fxFrames = fxName ? getFxFrames(fxName, pr.color) : null;
      if (fxFrames && fxName) {
        const def = FX_DEFS[fxName];
        const anim = new PIXI.AnimatedSprite(fxFrames);
        anim.anchor.set(0.5);
        anim.blendMode = PIXI.BLEND_MODES.ADD;
        anim.animationSpeed = def.speed;
        anim.gotoAndPlay(Math.floor(Math.random() * def.frames));
        anim.scale.set(Math.max(0.5, (pr.size * def.mult) / def.fh));
        data = { sprite: anim, kind, fx: true, fxDir: def.directional } as any;
        projectileSprites.set(pr.id, data);
      } else {
      let tex: PIXI.Texture;
      let baseScale = 1;
      if (isRocket) {
        tex = getRocketTex();
      } else if (kind === "orb") {
        tex = getOrbTex();
        baseScale = (pr.size * 3.4) / 48;
      } else if (kind === "spinner") {
        tex = getSpinnerTex();
        baseScale = (pr.size * 3.8) / 64;
      } else if (kind === "flash") {
        tex = getFlashBoltTex();
        baseScale = (pr.size * 4.2) / 48;
      } else {
        tex = getLaserBoltTex(Math.max(16, pr.size * 4));
      }
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.blendMode = isRocket ? PIXI.BLEND_MODES.NORMAL : PIXI.BLEND_MODES.ADD;
      sprite.tint = PIXI.utils.string2hex(pr.color);
      if (kind === "orb" || kind === "spinner" || kind === "flash") {
        sprite.scale.set(baseScale);
      } else if (!isRocket) {
        sprite.scale.set(1 + pr.size * 0.15, 0.8 + pr.size * 0.1);
      }
      data = {
        sprite,
        kind,
        baseScale,
        phase: Math.random() * Math.PI * 2,
        spin: (pr.id.charCodeAt(pr.id.length - 1) % 2 === 0 ? 1 : -1),
      } as any;
      projectileSprites.set(pr.id, data);
      }

      // EffectManager muzzle flash at the projectile's own spawn position.
      // The projectile is already anchored at the correct GLB hardpoint
      // (Phase 2.2/2.6 tilt-corrected math), so we just fire the flash there
      // instead of recomputing / re-cycling muzzle indices. This eliminates
      // the double-flash offset and drops the legacy weaponMountIndex logic.
      // Only for freshly fired projectiles (ttl > 1.2s = just spawned) so
      // resumed-flight projectiles don't emit spurious flashes.
      if (effectManager && pr.ttl > 1.2) {
        const angle = Math.atan2(pr.vel.y, pr.vel.x);
        const weaponType = pr.weaponKind === "rocket" ? "rocket" : "laser";
        const color = PIXI.utils.string2hex(pr.color);
        if (weaponType === "rocket") {
          effectManager.spawnRocketLaunch(pr.pos.x, pr.pos.y, angle);
        } else {
          effectManager.spawnMuzzleFlash(pr.pos.x, pr.pos.y, angle, weaponType, color);
        }
      }
    }

    data.sprite.visible = true;
    data.sprite.position.set(pr.pos.x, pr.pos.y);
    const dKind = (data as any).kind;
    if ((data as any).fx) {
      // animated FX sprite: directional shots face their velocity, orbs and
      // spinners carry their motion in the animation frames themselves
      if ((data as any).fxDir) {
        data.sprite.rotation = Math.atan2(pr.vel.y, pr.vel.x);
      }
    } else if (dKind === "spinner") {
      // spinning energy orb: time-driven rotation, not flight direction
      data.sprite.rotation += 0.16 * (data as any).spin;
    } else if (dKind === "orb") {
      // pulsing energy ball
      const p = 1 + 0.13 * Math.sin(performance.now() * 0.012 + (data as any).phase);
      data.sprite.scale.set((data as any).baseScale * p);
    } else if (dKind === "flash") {
      data.sprite.rotation = Math.atan2(pr.vel.y, pr.vel.x);
      data.sprite.alpha = 0.78 + 0.22 * Math.random(); // energy flicker
    } else {
      data.sprite.rotation = Math.atan2(pr.vel.y, pr.vel.x);
    }
    const projGoingNorth = pr.vel.y < 0;
    const targetLayer = projGoingNorth ? projectileLayer : projectileBehindLayer;
    if (data.sprite.parent !== targetLayer) {
      if (data.sprite.parent) data.sprite.parent.removeChild(data.sprite);
      targetLayer.addChild(data.sprite);
    }

    // Projectile trail particles — throttled per-projectile timers instead of
    // per-frame random chance. Prevents burst allocations when many projectiles
    // are on screen.
    if (effectManager && !(FX_KIND_MAP[pr.weaponKind] && !pr.fromPlayer)) {
      const isRocket = pr.weaponKind === "rocket";
      const nowMs = performance.now();
      const last = _lastProjTrailAt.get(pr.id) ?? 0;
      const interval = isRocket ? PROJ_TRAIL_INTERVAL_ROCKET_MS : PROJ_TRAIL_INTERVAL_LASER_MS;
      if (nowMs - last >= interval) {
        const weaponType = isRocket ? "rocket" : "laser";
        effectManager.spawnProjectileTrail(pr.pos.x, pr.pos.y, PIXI.utils.string2hex(pr.color), weaponType);
        _lastProjTrailAt.set(pr.id, nowMs);
      }
      // Occasional light smoke wisp for rockets — also throttled
      if (isRocket) {
        const smokeKey = pr.id + "s";
        const lastSmoke = _lastProjTrailAt.get(smokeKey) ?? 0;
        if (nowMs - lastSmoke >= PROJ_ROCKET_SMOKE_INTERVAL_MS) {
          effectManager.spawnSmokePuff(pr.pos.x, pr.pos.y, 3);
          _lastProjTrailAt.set(smokeKey, nowMs);
        }
      }
    }
  }

  // Projectile glow overlay — redraw every other frame to halve WebGL cost.
  // At 60fps, a 2-frame refresh (~33ms) is imperceptible for a soft glow.
  if (!projectileGlowGraphics) {
    projectileGlowGraphics = new PIXI.Graphics();
    projectileLayer.addChildAt(projectileGlowGraphics, 0);
  }
  if (!projectileBehindGlowGraphics) {
    projectileBehindGlowGraphics = new PIXI.Graphics();
    projectileBehindLayer.addChildAt(projectileBehindGlowGraphics, 0);
  }
  _projGlowFrameParity = (_projGlowFrameParity + 1) & 1;
  if (_projGlowFrameParity === 0) {
    projectileGlowGraphics.clear();
    projectileBehindGlowGraphics.clear();
    for (const pr of state.projectiles) {
      if (Math.abs(pr.pos.x - cam.x) > halfW + 30 || Math.abs(pr.pos.y - cam.y) > halfH + 30) continue;
      const color = PIXI.utils.string2hex(pr.color);
      const isRocket = pr.weaponKind === "rocket";
      if (isRocket) continue;
      const glowR = 3 + pr.size * 0.5;
      const glowTarget = pr.vel.y < 0 ? projectileGlowGraphics : projectileBehindGlowGraphics;
      glowTarget.beginFill(color, 0.06);
      glowTarget.drawCircle(pr.pos.x, pr.pos.y, glowR * 1.5);
      glowTarget.endFill();
      glowTarget.beginFill(color, 0.15);
      glowTarget.drawCircle(pr.pos.x, pr.pos.y, glowR * 0.6);
      glowTarget.endFill();
    }
  }

  // Detect projectile deaths — spawn differentiated effects
  if (effectManager) {
    _reuseProjDeathIds.clear();
    const currentProjIds = _reuseProjDeathIds;
    for (const pr of state.projectiles) currentProjIds.add(pr.id);
    for (const [id, prev] of prevProjectileData) {
      if (!currentProjIds.has(id)) {
        if (prev.weaponKind === "rocket") {
          if (prev.fromPlayer) {
            effectManager.spawnMiniExplosion(prev.x, prev.y);
          } else {
            // Enemy rocket hit — smaller impact (just sparks + small flash)
            effectManager.spawnSparkBurst(prev.x, prev.y, Math.random() * Math.PI * 2, 8, 0xff6622);
            effectManager.spawnSmokePuff(prev.x, prev.y, 12);
          }
        } else if (!prev.fromPlayer && FX_KIND_MAP[prev.weaponKind]) {
          // bullet-hell shot fizzle: animated ring burst in the shot's color
          spawnFxImpact(prev.x, prev.y, PIXI.utils.hex2string(prev.color), (prev as any).size ?? 4);
        } else {
          effectManager.spawnCinematicLaserHit(prev.x, prev.y, prev.angle, prev.color);
        }
      }
    }
    prevProjectileData.clear();
    for (const pr of state.projectiles) {
      prevProjectileData.set(pr.id, {
        x: pr.pos.x,
        y: pr.pos.y,
        color: PIXI.utils.string2hex(pr.color),
        weaponKind: pr.weaponKind === "rocket" ? "rocket" : (FX_KIND_MAP[pr.weaponKind] ? pr.weaponKind : "laser"),
        angle: Math.atan2(pr.vel.y, pr.vel.x),
        fromPlayer: pr.fromPlayer,
        size: pr.size,
      } as any);
    }
  }

  // Remove dead projectile sprites and their trail-throttle timers
  for (const [id, data] of projectileSprites) {
    if (!activeIds.has(id)) {
      if (data.sprite.parent) data.sprite.parent.removeChild(data.sprite);
      data.sprite.destroy();
      projectileSprites.delete(id);
      _lastProjTrailAt.delete(id);
      _lastProjTrailAt.delete(id + "s");
    }
  }

  // Animate muzzle flashes
  for (const [id, flash] of muzzleFlashes) {
    flash.ttl--;
    if (flash.ttl <= 0) {
      effectsLayer.removeChild(flash.g);
      flash.g.destroy();
      muzzleFlashes.delete(id);
    } else {
      flash.g.alpha = flash.ttl / 8;
      flash.g.scale.set(1 + (1 - flash.ttl / 8) * 0.5);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PARTICLE SYNC
// ══════════════════════════════════════════════════════════════════════════

function syncTrailParticles(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  const activeIds = new Set<string>();

  for (const pa of state.particles) {
    if (pa.kind !== "trail" && pa.kind !== "engine") continue;
    if (Math.abs(pa.pos.x - cam.x) > halfW + 40 || Math.abs(pa.pos.y - cam.y) > halfH + 40) continue;

    activeIds.add(pa.id);
    let data = particleSprites.get(pa.id);

    if (!data) {
      const r = Math.max(8, Math.ceil(pa.size * 3));
      const tex = getTrailTex(r);
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.blendMode = PIXI.BLEND_MODES.ADD;
      trailLayer.addChild(sprite);
      data = { sprite };
      particleSprites.set(pa.id, data);
    }

    const a = Math.max(0, Math.min(1, pa.ttl / pa.maxTtl));
    const baseAlpha = pa.alpha ?? 1;
    const r = Math.max(8, Math.ceil(pa.size * 3));
    data.sprite.visible = true;
    data.sprite.position.set(pa.pos.x, pa.pos.y);
    data.sprite.tint = PIXI.utils.string2hex(pa.color);

    // Engine particles: bright core with animated flicker
    if (pa.kind === "engine") {
      const flicker = 0.85 + 0.15 * Math.sin(state.tick * 30 + pa.pos.x * 0.1);
      data.sprite.alpha = a * 0.9 * baseAlpha * flicker;
      data.sprite.scale.set(a * pa.size * 2.2 / r);
    } else {
      // Trail: smooth fade with glow
      data.sprite.alpha = a * a * 0.8 * baseAlpha;
      data.sprite.scale.set(a * pa.size * 1.8 / r);
    }
  }
}

function syncEffectParticles(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  const activeIds = new Set<string>();

  for (const pa of state.particles) {
    if (pa.kind === "trail" || pa.kind === "engine") continue;
    if (Math.abs(pa.pos.x - cam.x) > halfW + pa.size * 3 || Math.abs(pa.pos.y - cam.y) > halfH + pa.size * 3) continue;

    const key = `fx-${pa.id}`;
    activeIds.add(key);
    let data = particleSprites.get(key);

    if (!data) {
      let tex: PIXI.Texture;
      const r = Math.max(4, Math.ceil(pa.size));

      if (pa.kind === "fireball") {
        tex = getFireballTex(Math.max(12, r * 3), pa.color);
      } else if (pa.kind === "smoke") {
        tex = getSmokeTex(Math.max(10, r * 3));
      } else if (pa.kind === "ember") {
        tex = getEmberTex(Math.max(6, r * 2), pa.color);
      } else if (pa.kind === "flash") {
        tex = getFlashTex(Math.max(10, r * 3), pa.color);
      } else if (pa.kind === "ring") {
        tex = getGlowTex(Math.max(6, r * 2));
      } else if (pa.kind === "spark") {
        tex = getEmberTex(Math.max(4, r), pa.color);
      } else {
        tex = getGlowTex(Math.max(4, r));
      }

      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      if (pa.kind !== "debris" && pa.kind !== "smoke") {
        sprite.blendMode = PIXI.BLEND_MODES.ADD;
      }
      effectsLayer.addChild(sprite);
      data = { sprite };
      particleSprites.set(key, data);
    }

    const a = Math.max(0, Math.min(1, pa.ttl / pa.maxTtl));
    data.sprite.visible = true;
    data.sprite.position.set(pa.pos.x, pa.pos.y);

    if (pa.kind === "ring") {
      const t = 1 - a;
      const r = Math.max(4, Math.ceil(pa.size));
      data.sprite.tint = PIXI.utils.string2hex(pa.color);
      data.sprite.alpha = a * 0.9;
      data.sprite.scale.set(t * pa.size / r);
    } else if (pa.kind === "flash") {
      const t = 1 - a;
      const r = Math.max(6, Math.ceil(pa.size) * 2);
      data.sprite.alpha = a * a * 0.9;
      data.sprite.scale.set(pa.size * (0.2 + t * 0.8) / r);
    } else if (pa.kind === "fireball") {
      const t = 1 - a;
      const r = Math.max(8, Math.ceil(pa.size) * 2);
      data.sprite.alpha = a * 0.85;
      data.sprite.scale.set(pa.size * (0.3 + t * 0.85) / r);
    } else if (pa.kind === "spark") {
      const r = Math.max(4, Math.ceil(pa.size));
      data.sprite.tint = PIXI.utils.string2hex(pa.color);
      data.sprite.alpha = a * 0.9;
      data.sprite.scale.set(a * pa.size / r);
    } else if (pa.kind === "debris") {
      // Debris: use Graphics for jagged polygon shape (recreated each frame)
      data.sprite.visible = false;
      if (!data.sprite.parent) continue;
      let dg = data.sprite.parent.getChildByName(`debris-${pa.id}`) as PIXI.Graphics;
      if (!dg) {
        dg = new PIXI.Graphics();
        dg.name = `debris-${pa.id}`;
        effectsLayer.addChild(dg);
      }
      dg.clear();
      dg.position.set(pa.pos.x, pa.pos.y);
      dg.rotation = pa.rot ?? 0;
      const s = pa.size * (0.4 + a * 0.6);
      // Fire glow (simulate shadowBlur with outer shape)
      dg.beginFill(0xff6600, a * 0.3);
      dg.drawCircle(0, 0, s * 1.5);
      dg.endFill();
      // Jagged polygon body
      const color = PIXI.utils.string2hex(pa.color);
      dg.beginFill(color, a);
      dg.moveTo(-s * 0.8, -s * 0.3);
      dg.lineTo(-s * 0.2, -s * 0.7);
      dg.lineTo(s * 0.5, -s * 0.5);
      dg.lineTo(s * 0.9, -s * 0.1);
      dg.lineTo(s * 0.6, s * 0.6);
      dg.lineTo(-s * 0.1, s * 0.7);
      dg.lineTo(-s * 0.7, s * 0.3);
      dg.closePath();
      dg.endFill();
      // Hot core
      dg.beginFill(0xffd24a, a * 0.5);
      dg.moveTo(-s * 0.3, -s * 0.1);
      dg.lineTo(s * 0.2, -s * 0.25);
      dg.lineTo(s * 0.35, s * 0.15);
      dg.lineTo(-s * 0.1, s * 0.3);
      dg.closePath();
      dg.endFill();
    } else if (pa.kind === "smoke") {
      const t = 1 - a;
      const r = Math.max(10, Math.ceil(pa.size) * 3);
      data.sprite.tint = PIXI.utils.string2hex(pa.color);
      data.sprite.alpha = a * 0.55;
      data.sprite.scale.set(pa.size * (0.5 + t * 1.2) / r);
    } else if (pa.kind === "ember") {
      const r = Math.max(6, Math.ceil(pa.size) * 2);
      data.sprite.alpha = a * 0.95;
      data.sprite.scale.set((0.4 + a * 0.6) * pa.size * 2.0 / (r * 2));
    } else {
      const r = Math.max(4, Math.ceil(pa.size));
      data.sprite.tint = PIXI.utils.string2hex(pa.color);
      data.sprite.alpha = a;
      data.sprite.scale.set(a * pa.size / r);
    }
    if (pa.rot !== undefined && pa.kind !== "debris") {
      data.sprite.rotation = pa.rot;
    }
  }

  // Remove dead particles (both trail and effect)
  const allParticleIds = new Set<string>();
  for (const pa of state.particles) {
    if (pa.kind === "trail" || pa.kind === "engine") {
      allParticleIds.add(pa.id);
    } else {
      allParticleIds.add(`fx-${pa.id}`);
    }
  }
  for (const [id, data] of particleSprites) {
    if (!allParticleIds.has(id)) {
      data.sprite.parent?.removeChild(data.sprite);
      data.sprite.destroy();
      particleSprites.delete(id);
    }
  }
  // Also clean up debris graphics
  for (let i = effectsLayer.children.length - 1; i >= 0; i--) {
    const child = effectsLayer.children[i];
    if (child.name && child.name.startsWith("debris-")) {
      const paId = child.name.replace("debris-", "");
      if (!allParticleIds.has(`fx-${paId}`)) {
        effectsLayer.removeChild(child);
        child.destroy();
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PLAYER SYNC
// ══════════════════════════════════════════════════════════════════════════

function syncPlayer(): void {
  const p = state.player;
  if (state.playerRespawnTimer > 0) {
    if (playerContainer) playerContainer.visible = false;
    if (_labelOverlay) _labelOverlay.innerHTML = "";
    return;
  }

  if (!playerContainer) {
    playerContainer = new PIXI.Container();

    const shipTex = getShipTex(p.shipClass, 1);
    playerVisual = createShipVisual(shipTex, p.shipClass);
    playerContainer.addChild(playerVisual.container);
    playerBody = playerVisual.baseSprite;

    // Hitbox silhouette
    const hitboxRing = new PIXI.Graphics();
    hitboxRing.name = "hitboxRing";
    playerContainer.addChildAt(hitboxRing, 0);

    playerLayer.addChild(playerContainer);
    lastPlayerShipClass = p.shipClass;
  }

  // Update ship texture if class changed
  if (lastPlayerShipClass !== p.shipClass) {
    const newTex = getShipTex(p.shipClass, 1);
    if (playerVisual) {
      updateShipTexture(playerVisual, newTex);
      playerVisual.shipClass = p.shipClass;
      playerVisual.config = getShipVisualConfigFn(p.shipClass);
    }
    lastPlayerShipClass = p.shipClass;
  }

  playerContainer.visible = true;
  playerContainer.position.set(p.pos.x, p.pos.y);
  const use3D = has3DModel(p.shipClass) && is3DReady(p.shipClass);
  if (use3D && playerVisual) {
    playerVisual.container.visible = false;
    const cam = state.player.pos;
    const sizeScale = SHIP_SIZE_SCALE[p.shipClass] ?? 1;
    updateShip3D("player", p.shipClass, p.pos.x, p.pos.y, p.angle, sizeScale, cam.x, cam.y);
    markActive("player");
  } else if (playerVisual) {
    playerVisual.container.visible = true;
  }

  // Update visual layers
  const speed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
  const es = effectiveStats();
  if (playerVisual && !use3D) {
    const _dirTex = getDirectionalTex(p.shipClass, 1, p.angle, "player");
    updateShipVisual(
      playerVisual,
      _dirTex.tex,
      _dirTex.isDirectional ? 0 : p.angle + Math.PI / 2,
      p.vel.x, p.vel.y, speed,
      state.tick, 1 / 60,
      p.shield, es.shieldMax,
    );
    updateMuzzleDecay(playerVisual, 1 / 60);
  }

  // Hitbox silhouette
  const hitboxRing = playerContainer.getChildByName("hitboxRing") as PIXI.Graphics;
  if (hitboxRing) {
    const hitR = 12 * (SHIP_SIZE_SCALE[p.shipClass] ?? 1);
    hitboxRing.clear();
    hitboxRing.lineStyle(1, 0x4ee2ff, 0.15);
    hitboxRing.drawCircle(0, 0, hitR);
  }

  // Hide hardcoded engine glow sprites for directional ships (they don't rotate with the sprite)
  if (playerVisual && playerVisual.engineContainer) {
    const hasDirectional = hasRotationFrames(p.shipClass);
    if (hasDirectional) {
      playerVisual.engineContainer.visible = false;
      playerVisual.cockpitGlow.visible = false;
      for (const wg of playerVisual.weaponGlows) wg.visible = false;
    }
  }

  // Resolve local player's thruster color from their faction so local and remote
  // views of the same faction look identical. Factionless players fall back to
  // cyan (matches the pre-Phase-4 hardcoded behavior).
  const localFactionColorStr = p.faction
    ? (FACTIONS[p.faction as keyof typeof FACTIONS]?.color ?? "#4ee2ff")
    : "#4ee2ff";
  const localThrustColor = PIXI.utils.string2hex(localFactionColorStr);

  // EffectManager thruster trail particles from hardpoints (GLB first, then editor data fallback)
  if (speed > 0.5 && effectManager) {
    const cls = SHIP_CLASSES[p.shipClass];
    const trailScale = cls ? Math.max(0.5, Math.min(1.2, cls.hullMax / 200)) : 1;

    // Tilt-corrected analytic hardpoints: same math the projectile spawn uses,
    // so trails come out of the visible thruster nozzles at every rotation.
    const glbHardpoints = getShipMuzzleWorldPositionsAt("player", p.pos.x, p.pos.y, p.angle);

    if (glbHardpoints && glbHardpoints.thrusters.length > 0) {
      // One trail per GLB thruster hardpoint. All hp_thruster_* nodes emit.
      for (const t of glbHardpoints.thrusters) {
        effectManager.spawnThrusterTrail(t.x, t.y, p.angle, speed, localThrustColor, 1, trailScale);
      }
    } else if (PLASMA_WAKE_SHIPS.has(p.shipClass)) {
      // Fallback: Plasma wake for special ships
      const sizeScale = SHIP_SIZE_SCALE[p.shipClass] ?? 1;
      const shipWidth = 85 * sizeScale * 0.7;
      effectManager.spawnPlasmaWake(p.pos.x, p.pos.y, p.angle, speed, shipWidth, localThrustColor);
    } else {
      // Fallback: 2D hardpoints from editor/static data
      let allThrusters = [
        ...getInterpolatedHardpoints(p.shipClass, p.angle, "thruster"),
        ...getInterpolatedHardpoints(p.shipClass, p.angle, "engineGlow"),
      ];
      if (allThrusters.length === 0) {
        allThrusters = getInterpolatedAutoThrusters(p.shipClass, p.angle);
      }
      if (allThrusters.length > 0) {
        for (const t of allThrusters) {
          effectManager.spawnThrusterTrail(p.pos.x + t.x, p.pos.y + t.y, p.angle, speed, localThrustColor, 1, trailScale);
        }
      }
    }
  }

  // Engine glow at thruster hardpoint positions.
  // Updated every frame regardless of speed so the glow can fully turn off
  // when the ship is standing still (no sticky opacity carried over).
  if (effectManager) {
    const cam = state.player.pos;
    const glbHardpoints = getShipHardpointPositions("player", cam.x, cam.y);

    if (glbHardpoints && glbHardpoints.thrusters.length > 0) {
      // For 3D ships with GLB hardpoints, use Three.js engine glow (rendered in 3D scene)
      updateEngineGlow("player", speed);
    } else {
      // Fallback to 2D PixiJS engine glow for non-3D ships
      const thrustI = Math.min(1, speed / 80);
      const glowInFront = Math.sin(p.angle) < 0;
      let glowThrusters2 = [
        ...getInterpolatedHardpoints(p.shipClass, p.angle, "thruster"),
        ...getInterpolatedHardpoints(p.shipClass, p.angle, "engineGlow"),
      ];
      if (glowThrusters2.length === 0) {
        glowThrusters2 = getInterpolatedAutoThrusters(p.shipClass, p.angle);
      }
      if (glowThrusters2.length > 0 && thrustI > 0) {
        for (const t of glowThrusters2) {
          effectManager.spawnEngineGlow(p.pos.x + t.x, p.pos.y + t.y, thrustI, 0x4488ff, glowInFront);
        }
      }
    }
  }

  // HTML overlay labels — above the 3D canvases, constant screen size at any
  // zoom. The vertical offset follows the ship's rendered silhouette radius
  // so bars/name always clear the hull. Other players' blocks were collected
  // in syncOtherPlayers; flush everything in one write.
  if (_labelOverlay) {
    const zoom = state.cameraZoom;
    const w2 = app!.screen.width;
    const h2 = app!.screen.height;
    // Player is always at the camera center in world space
    const sx = w2 / 2;
    const sy = h2 / 2;
    const rPx = shipHullRadius(p.shipClass, SHIP_SIZE_SCALE[p.shipClass] ?? 1) * zoom * 0.66 + 8;

    const hullPct = Math.max(0, p.hull / es.hullMax);
    const shieldPct = Math.max(0, p.shield / es.shieldMax);
    const pRank = rankFor(p.honor);
    const pFaction = p.faction ? FACTIONS[p.faction as keyof typeof FACTIONS] : null;
    const barW = 56;
    const hullW = Math.round(barW * hullPct);
    const shieldW = Math.round(barW * shieldPct);

    const selfBars = `
      <div style="position:absolute;left:${sx}px;top:${Math.round(sy - rPx)}px;transform:translate(-50%,-100%);pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:2px;">
        <div style="width:${barW}px;height:4px;background:rgba(0,0,0,0.5);border-radius:2px;overflow:hidden;">
          <div style="width:${hullW}px;height:100%;background:#44ff66;border-radius:2px;"></div>
        </div>
        <div style="width:${barW}px;height:4px;background:rgba(0,0,0,0.5);border-radius:2px;overflow:hidden;">
          <div style="width:${shieldW}px;height:100%;background:#4ee2ff;border-radius:2px;"></div>
        </div>
      </div>`;
    const dockedTag = state.dockedAt ? ' <span style="color:#44ff88">DOCKED</span>' : "";
    const selfName = shipLabelHtml(sx, sy + rPx, p.name, pFaction, pRank, null, dockedTag);

    _labelOverlay.innerHTML = _otherLabelHtml + selfBars + selfName;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// OTHER PLAYERS
// ══════════════════════════════════════════════════════════════════════════

function syncOtherPlayers(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  _reuseOtherPlayerSyncIds.clear();
  const activeIds = _reuseOtherPlayerSyncIds;
  _otherLabelHtml = "";

  for (const o of state.others) {
    if (Math.abs(o.pos.x - cam.x) > halfW + 30 || Math.abs(o.pos.y - cam.y) > halfH + 30) {
      activeIds.add(o.id);
      const existing = otherPlayerSprites.get(o.id);
      if (existing) existing.container.visible = false;
      continue;
    }

    activeIds.add(o.id);
    let data = otherPlayerSprites.get(o.id);

    if (!data) {
      const container = new PIXI.Container();

      // Subtle body glow underlay
      const otherGlow = new PIXI.Sprite(getGlowTex(14));
      otherGlow.anchor.set(0.5);
      otherGlow.blendMode = PIXI.BLEND_MODES.ADD;
      otherGlow.alpha = 0.06;
      otherGlow.name = "bodyGlow";
      container.addChild(otherGlow);

      const body = new PIXI.Sprite(getShipTex(o.shipClass, 1));
      body.anchor.set(0.5);
      container.addChild(body);

      // Name/faction/rank + hull bar are DOM overlay labels now (constant
      // screen size, above the 3D canvases) — no Pixi text/bars attached.
      const bars = new PIXI.Graphics(); // kept for the shared sprite type
      const nameText = new PIXI.Text("", {});

      playerLayer.addChild(container);
      data = { container, body, nameText, bars };
      otherPlayerSprites.set(o.id, data);
    }

    data.container.visible = true;
    data.container.position.set(o.pos.x, o.pos.y);

    // Check 3D FIRST to skip unnecessary sprite loading
    const use3D = has3DModel(o.shipClass) && is3DReady(o.shipClass);

    // Update texture only if NOT using 3D
    if (!use3D) {
      const _oDir = getDirectionalTex(o.shipClass, 1, o.angle, o.id);
      if (data.body.texture !== _oDir.tex) {
        data.body.texture = _oDir.tex;
      }
      data.body.rotation = _oDir.isDirectional ? 0 : o.angle + Math.PI / 2;
    }

    // DOM overlay label: hull bar + faction dot + name + rank icon, at
    // constant screen size below the ship (in front of the 3D model).
    const oRank = rankFor(o.honor);
    const oFaction = o.faction ? FACTIONS[o.faction as keyof typeof FACTIONS] : null;
    const zoomL = state.cameraZoom;
    const sxL = (o.pos.x - cam.x) * zoomL + app!.screen.width / 2;
    const syL = (o.pos.y - cam.y) * zoomL + app!.screen.height / 2;
    const rPxL = shipHullRadius(o.shipClass, SHIP_SIZE_SCALE[o.shipClass] ?? 1) * zoomL * 0.66 + 8;
    const hullPct = Math.max(0, Math.min(1, o.hull / Math.max(1, o.hullMax)));
    _otherLabelHtml += shipLabelHtml(sxL, syL + rPxL, o.name, oFaction, oRank, hullPct, "");

    const factionColor = o.faction ? FACTIONS[o.faction as keyof typeof FACTIONS]?.color ?? "#7a8ad8" : "#7a8ad8";
    // Animate body glow with faction color
    const otherGlow = data.container.getChildByName("bodyGlow") as PIXI.Sprite;
    if (otherGlow) {
      otherGlow.tint = PIXI.utils.string2hex(factionColor);
      otherGlow.alpha = 0.05 + 0.03 * Math.sin(state.tick * 2);
    }

    // 3D rendering already checked above
    
    if (use3D) {
      // Hide PixiJS ship sprite when using 3D (keep UI elements visible)
      if (data && data.body) {
        data.body.visible = false;
        const bodyGlow = data.container.getChildByName("bodyGlow");
        if (bodyGlow) bodyGlow.visible = false;
      }
      
      // Update Three.js 3D ship
      const sizeScale = SHIP_SIZE_SCALE[o.shipClass] ?? 1;
      updateShip3D(o.id, o.shipClass, o.pos.x, o.pos.y, o.angle, sizeScale, cam.x, cam.y);
      markActive(o.id);
    } else if (data && data.body) {
      // Ensure PixiJS sprite is visible for non-3D ships
      data.body.visible = true;
    }

    // Thruster trail + engine glow for other players.
    // Trail spawning is gated by speed (no trail when standing still), but the
    // engine-glow opacity must be updated every frame regardless — otherwise the
    // glow sticks at its last opacity when the ship stops.
    if (effectManager) {
      const spd = Math.sqrt(o.vel.x * o.vel.x + o.vel.y * o.vel.y);
      const thrustColor = PIXI.utils.string2hex(factionColor);

      if (spd > 0.5) {
        // Tilt-corrected analytic hardpoints (same math as the projectile
        // spawn) so remote trails come out of the visible thruster nozzles.
        const glbHardpoints = getShipMuzzleWorldPositionsAt(o.id, o.pos.x, o.pos.y, o.angle);

        if (glbHardpoints && glbHardpoints.thrusters.length > 0) {
          // One trail per GLB thruster hardpoint — all hp_thruster_* emit.
          for (const t of glbHardpoints.thrusters) {
            effectManager.spawnThrusterTrail(t.x, t.y, o.angle, spd, thrustColor);
          }
        } else if (PLASMA_WAKE_SHIPS.has(o.shipClass)) {
          // Plasma wake fallback
          const oSizeScale = SHIP_SIZE_SCALE[o.shipClass] ?? 1;
          const oShipWidth = 85 * oSizeScale * 0.7;
          effectManager.spawnPlasmaWake(o.pos.x, o.pos.y, o.angle, spd, oShipWidth, thrustColor);
        } else {
          // 2D hardpoint fallback
          let oAllThrusters = [
            ...getInterpolatedHardpoints(o.shipClass, o.angle, "thruster"),
            ...getInterpolatedHardpoints(o.shipClass, o.angle, "engineGlow"),
          ];
          if (oAllThrusters.length === 0) {
            oAllThrusters = getInterpolatedAutoThrusters(o.shipClass, o.angle);
          }
          if (oAllThrusters.length > 0) {
            for (const t of oAllThrusters) {
              effectManager.spawnThrusterTrail(o.pos.x + t.x, o.pos.y + t.y, o.angle, spd, thrustColor);
            }
          }
        }
      }

      // Always drive the engine glow opacity — passing spd=0 turns it fully off.
      if (use3D) {
        updateEngineGlow(o.id, spd);
      }
    }

  }

  // Remove left players
  for (const [id, data] of otherPlayerSprites) {
    if (!activeIds.has(id)) {
      playerLayer.removeChild(data.container);
      data.container.destroy({ children: true });
      otherPlayerSprites.delete(id);
      // IMPORTANT: Also remove the 3D ship instance
      removeShip3D(id);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// NPC SHIPS
// ══════════════════════════════════════════════════════════════════════════

function syncNpcs(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  _reuseNpcSyncIds.clear();
  const activeIds = _reuseNpcSyncIds;

  for (const npc of state.npcShips) {
    if (Math.abs(npc.pos.x - cam.x) > halfW + 30 || Math.abs(npc.pos.y - cam.y) > halfH + 30) {
      activeIds.add(npc.id);
      const existing = npcSprites.get(npc.id);
      if (existing) existing.container.visible = false;
      continue;
    }

    activeIds.add(npc.id);
    let data = npcSprites.get(npc.id);

    if (!data) {
      const container = new PIXI.Container();
      // NPC ships use sentinel shape at their size
      const tex = getShipTex("vanguard", npc.size / 12);
      const body = new PIXI.Sprite(tex);
      body.anchor.set(0.5);
      body.tint = PIXI.utils.string2hex(npc.color);
      container.addChild(body);

      const bars = new PIXI.Graphics();
      container.addChild(bars);

      const nameText = new PIXI.Text(npc.name, {
        fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        fontSize: 10,
        fill: npc.color,
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 1,
      });
      nameText.resolution = 4;
      nameText.anchor.set(0.5, 0);
      container.addChild(nameText);

      playerLayer.addChild(container);
      data = { container, body, nameText, bars };
      npcSprites.set(npc.id, data);
    }

    data.container.visible = true;
    data.container.position.set(npc.pos.x, npc.pos.y);
    data.body.rotation = npc.angle + Math.PI / 2;

    // Health bar
    const pct = Math.max(0, npc.hull / npc.hullMax);
    data.bars.clear();
    data.bars.position.set(-12, -npc.size - 6);
    data.bars.beginFill(0x222222, 0.5);
    data.bars.drawRect(0, 0, 24, 3);
    data.bars.endFill();
    data.bars.beginFill(0x4ee2ff);
    data.bars.drawRect(0, 0, 24 * pct, 3);
    data.bars.endFill();

    data.nameText.position.set(0, npc.size + 4);

    // Thruster trail for NPCs
    if (effectManager && npc.vel) {
      const spd = Math.sqrt(npc.vel.x * npc.vel.x + npc.vel.y * npc.vel.y);
      if (spd > 0.3) {
        effectManager.spawnThrusterTrail(npc.pos.x, npc.pos.y, npc.angle, spd, PIXI.utils.string2hex(npc.color), 0.65);
      }
    }
  }

  for (const [id, data] of npcSprites) {
    if (!activeIds.has(id)) {
      playerLayer.removeChild(data.container);
      data.container.destroy({ children: true });
      npcSprites.delete(id);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ASTEROIDS
// ══════════════════════════════════════════════════════════════════════════

const asteroidSprites = new Map<string, PIXI.Container>();

function syncAsteroids(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  _reuseAsteroidSyncIds.clear();
  const activeIds = _reuseAsteroidSyncIds;

  for (const a of state.asteroids) {
    if (a.zone !== state.player.zone) continue;
    if (Math.abs(a.pos.x - cam.x) > halfW + a.size || Math.abs(a.pos.y - cam.y) > halfH + a.size) continue;

    activeIds.add(a.id);
    let sprite = asteroidSprites.get(a.id);

    if (!sprite) {
      const tex = getAsteroidTex(a);
      // Container for glow + asteroid
      const container = new PIXI.Container() as PIXI.Container & { glowSprite?: PIXI.Sprite };
      // Subtle glow behind
      const glowR = a.size * 1.3;
      const glow = new PIXI.Sprite(getGlowTex(Math.ceil(glowR)));
      glow.anchor.set(0.5);
      glow.alpha = 0.15;
      glow.tint = 0xddccaa;
      glow.blendMode = PIXI.BLEND_MODES.ADD;
      container.addChild(glow);
      container.glowSprite = glow;
      // Main asteroid
      const mainSprite = new PIXI.Sprite(tex);
      mainSprite.anchor.set(0.5);
      container.addChild(mainSprite);
      asteroidLayer.addChild(container);
      sprite = container;
      asteroidSprites.set(a.id, sprite);
    }

    sprite.visible = true;
    sprite.position.set(a.pos.x, a.pos.y);
    if (sprite.children.length > 1) {
      sprite.children[1].rotation = a.rotation;
    }
  }

  for (const [id, sprite] of asteroidSprites) {
    if (!activeIds.has(id)) {
      asteroidLayer.removeChild(sprite);
      sprite.destroy({ children: true });
      asteroidSprites.delete(id);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// STATIONS
// ═════════════════════════════════════════════════════════════════════════���

const stationActiveIds = new Set<string>();
const _reuseStationCurrentIds = new Set<string>();

function syncStations(): void {
  const zone = state.player.zone;
  _reuseStationCurrentIds.clear();
  const currentIds = _reuseStationCurrentIds;

  const cam = state.player.pos;

  for (const st of STATIONS) {
    if (st.zone !== zone) continue;
    currentIds.add(st.id);
    stationActiveIds.add(st.id);
    updateStationOnly(st.id, st.pos.x, st.pos.y, cam.x, cam.y);
  }

  for (const id of stationActiveIds) {
    if (!currentIds.has(id)) {
      removeStation3D(id);
      stationActiveIds.delete(id);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PORTALS
// ══════════════════════════════════════════════════════════════════════════

const portalSpritesMap = new Map<string, PIXI.Container>();

function syncPortals(): void {
  const zone = state.player.zone;
  _reusePortalSyncIds.clear();
  const activeIds = _reusePortalSyncIds;

  for (const po of PORTALS) {
    if (po.fromZone !== zone) continue;
    const key = po.id;
    activeIds.add(key);

    if (portalSpritesMap.has(key)) {
      updatePortalAnimation(portalSpritesMap.get(key)!, state.tick);
      continue;
    }

    const container = createPortalVisual(ZONES[po.toZone].name);
    container.position.set(po.pos.x, po.pos.y);
    stationLayer.addChild(container);
    portalSpritesMap.set(key, container);
  }

  for (const [id, cont] of portalSpritesMap) {
    if (!activeIds.has(id)) {
      stationLayer.removeChild(cont);
      cont.destroy({ children: true });
      portalSpritesMap.delete(id);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// FLOATERS (Damage/XP/Credit numbers)
// ══════════════════════════════════════════════════════════════════════════

const floaterTexts = new Map<string, PIXI.Text>();

function syncFloaters(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  _reuseFloaterSyncIds.clear();
  const activeIds = _reuseFloaterSyncIds;

  for (const f of state.floaters) {
    if (Math.abs(f.pos.x - cam.x) > halfW + 50 || Math.abs(f.pos.y - cam.y) > halfH + 50) continue;
    activeIds.add(f.id);

    let text = floaterTexts.get(f.id);
    if (!text) {
      text = new PIXI.Text(f.text, {
        fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        fontSize: f.bold ? 15 : 12,
        fill: f.color,
        fontWeight: f.bold ? "bold" : "normal",
        stroke: "#000000",
        strokeThickness: f.bold ? 1.5 : 1,
      });
      text.resolution = 4;
      text.anchor.set(0.5);
      floaterLayer.addChild(text);
      floaterTexts.set(f.id, text);
    }

    const a = Math.max(0, f.ttl / f.maxTtl);
    text.visible = true;
    text.position.set(f.pos.x, f.pos.y);
    text.alpha = a;
    text.scale.set(f.scale * (0.8 + 0.2 * a));
  }

  for (const [id, text] of floaterTexts) {
    if (!activeIds.has(id)) {
      floaterLayer.removeChild(text);
      text.destroy();
      floaterTexts.delete(id);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN OVERLAYS (death flash, level up)
// ══════════════════════════════════════════════════════════════════════════

let deathOverlay: PIXI.Graphics | null = null;
let levelOverlay: PIXI.Container | null = null;

function renderOverlays(w: number, h: number): void {
  // Death flash
  if (state.playerDeathFlash > 0) {
    if (!deathOverlay) {
      deathOverlay = new PIXI.Graphics();
      uiLayer.addChild(deathOverlay);
    }
    const t = state.playerDeathFlash / 0.6;
    deathOverlay.clear();
    deathOverlay.beginFill(0x000000, t * 0.72);
    deathOverlay.drawRect(0, 0, w, h);
    deathOverlay.endFill();
    deathOverlay.beginFill(0xff1a1a, t * 0.55);
    deathOverlay.drawRect(0, 0, w, h);
    deathOverlay.endFill();
    deathOverlay.visible = true;
  } else if (deathOverlay) {
    deathOverlay.visible = false;
  }

  // Level up flash
  if (state.levelUpFlash > 0) {
    if (!levelOverlay) {
      levelOverlay = new PIXI.Container();
      uiLayer.addChild(levelOverlay);
    }
    const t = state.levelUpFlash / 1.6;
    // Simple ring effect
    const g = levelOverlay.getChildAt(0) as PIXI.Graphics || new PIXI.Graphics();
    if (!levelOverlay.children.length) levelOverlay.addChild(g);
    g.clear();
    g.lineStyle(4, 0xffd24a, t);
    const ringR = (1 - t) * 280;
    g.drawCircle(w / 2, h / 2, ringR);
    levelOverlay.visible = true;
  } else if (levelOverlay) {
    levelOverlay.visible = false;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// MINING LASER BEAM
// ══════════════════════════════════════════════════════════════════════════

let miningLaserGraphics: PIXI.Graphics | null = null;

function syncMiningLaser(): void {
  if (!state.miningTargetId) {
    if (miningLaserGraphics) miningLaserGraphics.visible = false;
    return;
  }

  const ta = state.asteroids.find((a: Asteroid) => a.id === state.miningTargetId);
  if (!ta) {
    if (miningLaserGraphics) miningLaserGraphics.visible = false;
    return;
  }

  if (!miningLaserGraphics) {
    miningLaserGraphics = new PIXI.Graphics();
    worldLayer.addChild(miningLaserGraphics);
  }

  miningLaserGraphics.visible = true;
  miningLaserGraphics.clear();

  const pp = state.player.pos;
  const t = state.tick;
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 18));

  // Outer glow beam
  miningLaserGraphics.lineStyle(14, 0x44ffcc, 0.3 + 0.15 * Math.sin(t * 12));
  miningLaserGraphics.moveTo(pp.x, pp.y);
  miningLaserGraphics.lineTo(ta.pos.x, ta.pos.y);

  // Core beam
  miningLaserGraphics.lineStyle(3 + pulse, 0xffffff, 0.85);
  miningLaserGraphics.moveTo(pp.x, pp.y);
  miningLaserGraphics.lineTo(ta.pos.x, ta.pos.y);

  // Inner cyan beam
  miningLaserGraphics.lineStyle(1.5 + pulse * 0.5, 0x44ffcc, 0.9);
  miningLaserGraphics.moveTo(pp.x, pp.y);
  miningLaserGraphics.lineTo(ta.pos.x, ta.pos.y);

  // Impact point (brighter, larger)
  miningLaserGraphics.lineStyle(0);
  miningLaserGraphics.beginFill(0xffffff, 1.0);
  miningLaserGraphics.drawCircle(ta.pos.x, ta.pos.y, 4 + pulse * 3);
  miningLaserGraphics.endFill();
  // Outer glow at impact (bigger)
  miningLaserGraphics.beginFill(0x44ffcc, 0.4 + pulse * 0.3);
  miningLaserGraphics.drawCircle(ta.pos.x, ta.pos.y, 12 + pulse * 6);
  miningLaserGraphics.endFill();
  // Secondary warm glow
  miningLaserGraphics.beginFill(0xaaffee, 0.15 + pulse * 0.1);
  miningLaserGraphics.drawCircle(ta.pos.x, ta.pos.y, 18 + pulse * 8);
  miningLaserGraphics.endFill();

  // Impact ring (larger, more visible)
  const ringR = 8 + pulse * 6 + Math.sin(t * 20) * 3;
  miningLaserGraphics.lineStyle(2, 0x44ffcc, 0.6 + 0.3 * Math.sin(t * 15));
  miningLaserGraphics.drawCircle(ta.pos.x, ta.pos.y, ringR);
  // Second ring
  miningLaserGraphics.lineStyle(1.5, 0xffffff, 0.3 + 0.2 * Math.sin(t * 25));
  miningLaserGraphics.drawCircle(ta.pos.x, ta.pos.y, ringR + 6);
  // Third outer ring
  miningLaserGraphics.lineStyle(1, 0x44ffcc, 0.15 + 0.15 * Math.sin(t * 18));
  miningLaserGraphics.drawCircle(ta.pos.x, ta.pos.y, ringR + 12);

  // Energized sparkles flying around impact (large, visible from distance)
  if (effectManager) {
    // Big energy sparkles orbiting impact
    if (Math.random() < 0.6) {
      const orbitAngle = state.tick * 8 + Math.random() * Math.PI * 2;
      const orbitR = 8 + Math.random() * 12;
      const sx = ta.pos.x + Math.cos(orbitAngle) * orbitR;
      const sy = ta.pos.y + Math.sin(orbitAngle) * orbitR;
      const outAngle = orbitAngle + Math.PI * 0.5 + (Math.random() - 0.5) * 1.5;
      const spd = 40 + Math.random() * 60;
      // Use spawnSparkBurst but with a single large spark
      for (let i = 0; i < 2; i++) {
        const sparkAngle = outAngle + (Math.random() - 0.5) * 1.2;
        effectManager.spawnSparkBurst(
          sx + (Math.random() - 0.5) * 6,
          sy + (Math.random() - 0.5) * 6,
          sparkAngle, 1, 0x44ffcc
        );
      }
    }
    // Larger energy particles that drift outward (visible from far)
    if (Math.random() < 0.35) {
      const a = Math.random() * Math.PI * 2;
      effectManager.spawnSparkBurst(
        ta.pos.x + Math.cos(a) * 6,
        ta.pos.y + Math.sin(a) * 6,
        a, 3, 0x66ffdd
      );
    }
    // Occasional rock chips from mining (sparks, not debris - avoids fire trail)
    if (Math.random() < 0.12) {
      effectManager.spawnSparkBurst(ta.pos.x, ta.pos.y, Math.random() * Math.PI * 2, 3, 0x8a7060);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MAP BOUNDARY
// ══════════════════════════════════════════════════════════════════════════

let mapBoundaryGraphics: PIXI.Graphics | null = null;

function syncMapBoundary(): void {
  if (!mapBoundaryGraphics) {
    mapBoundaryGraphics = new PIXI.Graphics();
    worldLayer.addChildAt(mapBoundaryGraphics, 0);
  }
  mapBoundaryGraphics.clear();
  mapBoundaryGraphics.lineStyle(2, 0x4ee2ff, 0.15);
  mapBoundaryGraphics.drawCircle(0, 0, MAP_RADIUS);
}

// ══════════════════════════════════════════════════════════════════════════
// MOVE TARGET INDICATOR
// ══════════════════════════════════════════════════════════════════════════

let moveTargetGraphics: PIXI.Graphics | null = null;

function syncMoveTarget(): void {
  const p = state.player;
  const dx = state.cameraTarget.x - p.pos.x;
  const dy = state.cameraTarget.y - p.pos.y;

  if (Math.sqrt(dx * dx + dy * dy) > 20) {
    if (!moveTargetGraphics) {
      moveTargetGraphics = new PIXI.Graphics();
      worldLayer.addChild(moveTargetGraphics);
    }
    moveTargetGraphics.visible = true;
    moveTargetGraphics.clear();
    moveTargetGraphics.position.set(state.cameraTarget.x, state.cameraTarget.y);

    // Crosshair circle
    moveTargetGraphics.lineStyle(1, 0x4ee2ff, 0.6);
    moveTargetGraphics.drawCircle(0, 0, 10);
    // Cross lines
    moveTargetGraphics.moveTo(-14, 0);
    moveTargetGraphics.lineTo(14, 0);
    moveTargetGraphics.moveTo(0, -14);
    moveTargetGraphics.lineTo(0, 14);
  } else if (moveTargetGraphics) {
    moveTargetGraphics.visible = false;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// CARGO BOXES
// ══════════════════════════════════════════════════════════════════════════

const cargoBoxSprites = new Map<string, PIXI.Graphics>();

function syncCargoBoxes(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  _reuseCargoSyncIds.clear();
  const activeIds = _reuseCargoSyncIds;

  for (const cb of state.cargoBoxes) {
    if (Math.abs(cb.pos.x - cam.x) > halfW + 20 || Math.abs(cb.pos.y - cam.y) > halfH + 20) continue;
    activeIds.add(cb.id);

    let g = cargoBoxSprites.get(cb.id);
    if (!g) {
      g = new PIXI.Graphics();
      worldLayer.addChild(g);
      cargoBoxSprites.set(cb.id, g);
    }

    g.clear();
    g.position.set(cb.pos.x, cb.pos.y);

    const color = PIXI.utils.string2hex(cb.color);
    const t = state.tick;
    const bob = Math.sin(t * 3 + cb.pos.x * 0.01) * 2;

    // Outer glow ring
    g.lineStyle(1, color, 0.2 + 0.1 * Math.sin(t * 4));
    g.drawCircle(0, bob, 12);

    // Box shape (diamond rotated)
    g.lineStyle(1.5, color, 0.9);
    g.beginFill(color, 0.4);
    g.moveTo(0, -6 + bob);
    g.lineTo(6, 0 + bob);
    g.lineTo(0, 6 + bob);
    g.lineTo(-6, 0 + bob);
    g.closePath();
    g.endFill();

    // Inner highlight
    g.beginFill(0xffffff, 0.4);
    g.moveTo(0, -3 + bob);
    g.lineTo(3, 0 + bob);
    g.lineTo(0, 3 + bob);
    g.lineTo(-3, 0 + bob);
    g.closePath();
    g.endFill();

    // Tractor beam to player if close
    const pl = state.player;
    const dist = Math.hypot(cb.pos.x - pl.pos.x, cb.pos.y - pl.pos.y);
    if (dist < 120 && dist > 10) {
      g.lineStyle(2, color, 0.4 * (1 - dist / 120));
      g.moveTo(pl.pos.x - cb.pos.x, pl.pos.y - cb.pos.y + 10);
      g.lineTo(0, 0);
    }
  }

  for (const [id, g] of cargoBoxSprites) {
    if (!activeIds.has(id)) {
      worldLayer.removeChild(g);
      g.destroy();
      cargoBoxSprites.delete(id);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// DUNGEON RIFTS
// ══════════════════════════════════════════════════════════════════════════

const riftSprites = new Map<string, PIXI.Container>();

function syncDungeonRifts(): void {
  const zone = state.player.zone;
  _reuseDungeonSyncIds.clear();
  const activeIds = _reuseDungeonSyncIds;

  for (const d of Object.values(DUNGEONS)) {
    if (d.zone !== zone) continue;
    activeIds.add(d.id);

    let cont = riftSprites.get(d.id);
    if (!cont) {
      cont = new PIXI.Container();
      cont.position.set(d.pos.x, d.pos.y);

      const label = new PIXI.Text(d.name, {
        fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        fontSize: 10,
        fill: d.color,
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 1,
      });
      label.resolution = 4;
      label.anchor.set(0.5, 0);
      label.position.set(0, 22);
      cont.addChild(label);

      worldLayer.addChild(cont);
      riftSprites.set(d.id, cont);
    }

    // Update animated ring
    if (cont.children.length < 2) {
      const ring = new PIXI.Graphics();
      cont.addChildAt(ring, 0);
    }
    const ring = cont.getChildAt(0) as PIXI.Graphics;
    ring.clear();
    const active = state.dungeon?.id === d.id;
    const color = PIXI.utils.string2hex(d.color);
    const pulse = 0.6 + 0.3 * Math.sin(state.tick * 4);
    // Outer energy ring
    ring.lineStyle(1, color, pulse * 0.3);
    ring.drawCircle(0, 0, 24);
    // Main structural ring
    ring.lineStyle(active ? 3 : 2, color, pulse);
    ring.drawCircle(0, 0, 14);
    // Inner energy field
    ring.beginFill(color, pulse * 0.04);
    ring.drawCircle(0, 0, 14);
    ring.endFill();
    // Rotating energy arcs
    for (let i = 0; i < 3; i++) {
      const a = state.tick * 2 + (i / 3) * Math.PI * 2;
      ring.lineStyle(1.5, color, pulse * 0.5);
      ring.arc(0, 0, 18, a, a + 0.8);
      ring.moveTo(0, 0);
    }
    // Light nodes
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const nx = Math.cos(a) * 14;
      const ny = Math.sin(a) * 14;
      const nPulse = Math.sin(state.tick * 3 + i * 1.5) > 0.2 ? 0.8 : 0.2;
      ring.beginFill(0xffffff, nPulse);
      ring.drawCircle(nx, ny, 1.2);
      ring.endFill();
    }
  }

  for (const [id, cont] of riftSprites) {
    if (!activeIds.has(id)) {
      worldLayer.removeChild(cont);
      cont.destroy({ children: true });
      riftSprites.delete(id);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PLAYER DRONES
// ══════════════════════════════════════════════════════════════════════════

const droneSprites = new Map<string, PIXI.Graphics>();

function drawDroneSprite(g: PIXI.Graphics, kind: string, indexHash: number): void {
  const def = (DRONE_DEFS as any)[kind];
  const color = def ? PIXI.utils.string2hex(def.color) : 0x4ee2ff;
  const t = state.tick;
  const dPulse = 0.7 + 0.3 * Math.sin(t * 4 + indexHash * 2);
  g.clear();
  g.lineStyle(0.5, color, dPulse * 0.3);
  g.drawCircle(0, 0, 9);
  g.beginFill(color, dPulse * 0.15);
  g.drawCircle(0, 0, 6);
  g.endFill();
  g.beginFill(color, 0.8);
  g.drawCircle(0, 0, 3.5);
  g.endFill();
  g.beginFill(0xffffff, dPulse * 0.7);
  g.drawCircle(0, 0, 1.5);
  g.endFill();
}

// ══════════════════════════════════════════════════════════════════════════
// DEBUG MUZZLE / SPAWN ALIGNMENT MARKERS
// ══════════════════════════════════════════════════════════════════════════
//
// Toggled at runtime via `window.__DEBUG_MUZZLE_MARKERS = true`. Draws:
//   * cyan hollow circle at each analytic muzzle world position (per ship)
//   * magenta filled dot at each recent projectile spawn (fading over 1.5s)
//   * white line connecting each recent spawn to its corresponding analytic
//     muzzle, so you can visually read the delta/offset in world units
//   * small text label under each spawn showing:
//       entityId  ring:index  Δ=<distance in world units>  angle=<deg>
//
// Gameplay code untouched. The graphics container is cleared each frame and
// costs zero when the flag is off.
function syncDebugMuzzleMarkers(): void {
  if (!debugMuzzleGfx || !debugMuzzleLabels) return;
  const flagOn = typeof window !== "undefined" && !!(window as any).__DEBUG_MUZZLE_MARKERS;
  debugMuzzleGfx.clear();
  if (!flagOn) {
    if (debugMuzzleLabels.children.length) debugMuzzleLabels.removeChildren();
    return;
  }

  const muzzles = debugEnumerateAllMuzzles();
  const spawns = getDebugSpawnBuffer();
  const now = performance.now();

  // Muzzle rings — cyan hollow circle sized so a stroke is visible even at
  // small zooms; we rely on worldLayer.scale for auto-zoom of the ring size.
  debugMuzzleGfx.lineStyle(1.5, 0x00ffff, 0.9);
  for (const m of muzzles) {
    debugMuzzleGfx.drawCircle(m.worldX, m.worldY, 4);
    // Small cross at the exact center pixel
    debugMuzzleGfx.moveTo(m.worldX - 1.5, m.worldY);
    debugMuzzleGfx.lineTo(m.worldX + 1.5, m.worldY);
    debugMuzzleGfx.moveTo(m.worldX, m.worldY - 1.5);
    debugMuzzleGfx.lineTo(m.worldX, m.worldY + 1.5);
  }

  // Recent spawn dots + connector lines to analytic muzzle.
  const muzzleKey = (entityId: string, ring: "muzzle" | "weapon" | "thruster", index: number) =>
    `${entityId}:${ring}:${index}`;
  const muzzleByKey = new Map<string, typeof muzzles[number]>();
  for (const m of muzzles) muzzleByKey.set(muzzleKey(m.entityId, m.ring, m.index), m);

  // Rebuild labels each frame (cheap for < 200 spawns)
  debugMuzzleLabels.removeChildren();

  for (const s of spawns) {
    const alpha = Math.max(0, Math.min(1, (s.expiresAt - now) / 1500));
    // Spawn dot
    debugMuzzleGfx.beginFill(0xff00ff, alpha);
    debugMuzzleGfx.drawCircle(s.spawnX, s.spawnY, 2.5);
    debugMuzzleGfx.endFill();

    // Line from spawn to analytic muzzle if we can identify it
    const m = muzzleByKey.get(muzzleKey(s.entityId, s.ring, s.index));
    if (m) {
      debugMuzzleGfx.lineStyle(0.8, 0xffffff, alpha * 0.7);
      debugMuzzleGfx.moveTo(s.spawnX, s.spawnY);
      debugMuzzleGfx.lineTo(m.worldX, m.worldY);
      // Reset lineStyle so subsequent circles don't inherit
      debugMuzzleGfx.lineStyle(1.5, 0x00ffff, 0.9);
    }

    // Label — small text just below the spawn.
    const delta = m ? Math.hypot(s.spawnX - m.worldX, s.spawnY - m.worldY) : NaN;
    const angleDeg = m ? (m.lastYRot * 180 / Math.PI).toFixed(0) : "?";
    const labelText = m
      ? `${s.entityId} ${s.ring}[${s.index}] ${m.nodeName} Δ=${delta.toFixed(1)} yaw=${angleDeg}°`
      : `${s.entityId} ${s.ring}[${s.index}] (${s.source}) no-hp-match`;
    const label = new PIXI.Text(labelText, {
      fontFamily: "monospace",
      fontSize: 8,
      fill: 0xffff00,
      stroke: 0x000000,
      strokeThickness: 2,
    });
    label.resolution = 4;
    label.position.set(s.spawnX + 4, s.spawnY + 4);
    label.alpha = alpha;
    debugMuzzleLabels.addChild(label);
  }
}

function syncDrones(): void {
  const activeIds = new Set<string>();

  // Local player drones — key: "player:<index>"
  if (state.player.drones) {
    for (let i = 0; i < state.player.drones.length; i++) {
      const d = state.player.drones[i];
      const anchor = (d as any).anchor as { x: number; y: number } | undefined;
      if (!anchor) continue;
      const key = `player:${i}`;
      activeIds.add(key);
      let g = droneSprites.get(key);
      if (!g) {
        g = new PIXI.Graphics();
        playerLayer.addChild(g);
        droneSprites.set(key, g);
      }
      g.visible = true;
      g.position.set(anchor.x, anchor.y);
      drawDroneSprite(g, (d as any).kind, i);
    }
  }

  // Remote player drones — key: "<remoteId>:<index>"
  for (const o of state.others) {
    if (!o.drones || o.drones.length === 0) continue;
    for (let i = 0; i < o.drones.length; i++) {
      const d = o.drones[i];
      if (!d.anchor) continue;
      const key = `${o.id}:${i}`;
      activeIds.add(key);
      let g = droneSprites.get(key);
      if (!g) {
        g = new PIXI.Graphics();
        playerLayer.addChild(g);
        droneSprites.set(key, g);
      }
      g.visible = true;
      g.position.set(d.anchor.x, d.anchor.y);
      drawDroneSprite(g, d.kind, i);
    }
  }

  for (const [key, g] of droneSprites) {
    if (!activeIds.has(key)) {
      playerLayer.removeChild(g);
      g.destroy();
      droneSprites.delete(key);
    }
  }
}

function clearZoneEntities(): void {
  // Clear stations (Three.js)
  for (const id of stationActiveIds) {
    removeStation3D(id);
  }
  stationActiveIds.clear();

  // Clear portals
  for (const [, cont] of portalSpritesMap) {
    stationLayer.removeChild(cont);
    cont.destroy({ children: true });
  }
  portalSpritesMap.clear();

  // Clear asteroids
  for (const [, sprite] of asteroidSprites) {
    asteroidLayer.removeChild(sprite);
    sprite.destroy();
  }
  asteroidSprites.clear();

  // Clear dungeon rifts
  for (const [, cont] of riftSprites) {
    worldLayer.removeChild(cont);
    cont.destroy({ children: true });
  }
  riftSprites.clear();

  // Clear cargo boxes
  for (const [, g] of cargoBoxSprites) {
    worldLayer.removeChild(g);
    g.destroy();
  }
  cargoBoxSprites.clear();

  // Clear texture cache for zone-specific textures
  // (enemies may have different colors in different zones)
}
