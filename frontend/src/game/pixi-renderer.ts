// pixi-renderer.ts — PixiJS WebGL renderer for Cosmic Realm
// Replaces Canvas 2D render.ts for GPU-accelerated performance

import * as PIXI from "pixi.js";
import {
  Asteroid, CargoBox, Drone, DUNGEONS, Enemy, FACTIONS, Floater, MAP_RADIUS,
  NpcShip, OtherPlayer, Particle, PORTALS, Projectile, SHIP_CLASSES,
  STATIONS, ShipClassId, Station, ZONES, rankFor, type ZoneId, type EnemyType,
} from "./types";
import { state } from "./store";
import { effectiveStats } from "./loop";

// ══════════════════════════════════════════════════════════════════════════
// Application & Layers
// ══════════════════════════════════════════════════════════════════════════
let app: PIXI.Application | null = null;
let bgContainer: PIXI.Container;
let worldContainer: PIXI.Container;
let trailParticleContainer: PIXI.ParticleContainer;
let fxParticleContainer: PIXI.ParticleContainer;
let uiContainer: PIXI.Container;
let overlayContainer: PIXI.Container;

// ══════════════════════════════════════════════════════════════════════════
// Texture & Sprite Caches
// ══════════════════════════════════════════════════════════════════════════
const texCache = new Map<string, PIXI.Texture>();
let circleTexture: PIXI.Texture;
let glowTexture: PIXI.Texture;

const enemySprites = new Map<string, PIXI.Container>();
const otherSprites = new Map<string, PIXI.Container>();
const npcSprites = new Map<string, PIXI.Container>();
const projSprites = new Map<string, PIXI.Sprite>();
const asteroidSprites = new Map<string, PIXI.Container>();
const cargoSprites = new Map<string, PIXI.Sprite>();
const floaterTexts = new Map<string, PIXI.Text>();

let playerSprite: PIXI.Sprite | null = null;
let playerShieldGfx: PIXI.Graphics;
let mapBoundaryGfx: PIXI.Graphics;
let beamGfx: PIXI.Graphics;
let targetGfx: PIXI.Graphics;
let overlayGfx: PIXI.Graphics;

// Star / nebula data
type StarData = { x: number; y: number; size: number; color: number; speed: number; sprite: PIXI.Sprite };
const starLayers: StarData[][] = [];
const nebulaSprites: PIXI.Sprite[] = [];
let currentBgZone: string = "";

// Sprite pools for particles
const trailPool: PIXI.Sprite[] = [];
const fxPool: PIXI.Sprite[] = [];
let activeTrails = 0;
let activeFx = 0;

// Station/portal/rift containers
const stationGfxMap = new Map<string, PIXI.Container>();
const portalGfxMap = new Map<string, PIXI.Container>();
const riftGfxMap = new Map<string, PIXI.Container>();
const droneSprites = new Map<string, PIXI.Sprite>();

// ══════════════════════════════════════════════════════════════════════════
// Color Utilities
// ══════════════════════════════════════════════════════════════════════════
function cssHex(c: string): number {
  return parseInt(c.replace("#", ""), 16);
}

function shade(hex: number, f: number): number {
  let r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
  if (f > 0) { r = Math.min(255, r + (255 - r) * f | 0); g = Math.min(255, g + (255 - g) * f | 0); b = Math.min(255, b + (255 - b) * f | 0); }
  else { r = Math.max(0, r * (1 + f) | 0); g = Math.max(0, g * (1 + f) | 0); b = Math.max(0, b * (1 + f) | 0); }
  return (r << 16) | (g << 8) | b;
}

function hexStr(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}

// ══════════════════════════════════════════════════════════════════════════
// Initialization
// ══════════════════════════════════════════════════════════════════════════
export function initPixi(container: HTMLElement): void {
  app = new PIXI.Application({
    resizeTo: container,
    backgroundColor: 0x050510,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  container.appendChild(app.view as HTMLCanvasElement);

  // Layer hierarchy
  bgContainer = new PIXI.Container();
  worldContainer = new PIXI.Container();
  worldContainer.sortableChildren = true;
  uiContainer = new PIXI.Container();
  overlayContainer = new PIXI.Container();

  trailParticleContainer = new PIXI.ParticleContainer(4000, {
    position: true, scale: true, tint: true, alpha: true, rotation: false,
  });
  trailParticleContainer.zIndex = -1;

  fxParticleContainer = new PIXI.ParticleContainer(4000, {
    position: true, scale: true, tint: true, alpha: true, rotation: true,
  });
  fxParticleContainer.zIndex = 50;

  worldContainer.addChild(trailParticleContainer);
  worldContainer.addChild(fxParticleContainer);

  app.stage.addChild(bgContainer);
  app.stage.addChild(worldContainer);
  app.stage.addChild(uiContainer);
  app.stage.addChild(overlayContainer);

  // Generate base textures
  circleTexture = genCircleTex(16, 0xffffff);
  glowTexture = genGlowTex(32, 0xffffff);

  // Graphics objects
  mapBoundaryGfx = new PIXI.Graphics();
  mapBoundaryGfx.zIndex = -2;
  worldContainer.addChild(mapBoundaryGfx);

  playerShieldGfx = new PIXI.Graphics();
  playerShieldGfx.zIndex = 30;
  worldContainer.addChild(playerShieldGfx);

  beamGfx = new PIXI.Graphics();
  beamGfx.zIndex = 35;
  worldContainer.addChild(beamGfx);

  targetGfx = new PIXI.Graphics();
  targetGfx.zIndex = 40;
  worldContainer.addChild(targetGfx);

  overlayGfx = new PIXI.Graphics();
  overlayContainer.addChild(overlayGfx);

  // Pre-allocate particle sprites
  for (let i = 0; i < 2000; i++) {
    const s = new PIXI.Sprite(circleTexture);
    s.anchor.set(0.5);
    s.visible = false;
    trailParticleContainer.addChild(s);
    trailPool.push(s);
  }
  for (let i = 0; i < 2000; i++) {
    const s = new PIXI.Sprite(circleTexture);
    s.anchor.set(0.5);
    s.visible = false;
    fxParticleContainer.addChild(s);
    fxPool.push(s);
  }

  // Generate stars
  initStars();
}

export function destroyPixi(): void {
  if (app) {
    app.destroy(true, { children: true, texture: true });
    app = null;
  }
  texCache.clear();
  enemySprites.clear();
  otherSprites.clear();
  npcSprites.clear();
  projSprites.clear();
  asteroidSprites.clear();
}

// ══════════════════════════════════════════════════════════════════════════
// Texture Generation
// ══════════════════════════════════════════════════════════════════════════
function genCircleTex(r: number, color: number): PIXI.Texture {
  const canvas = document.createElement("canvas");
  const sz = (r + 2) * 4;
  canvas.width = sz;
  canvas.height = sz;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(sz / 2, sz / 2, r * 2, 0, Math.PI * 2);
  ctx.fill();
  return PIXI.Texture.from(canvas);
}

function genGlowTex(r: number, color: number): PIXI.Texture {
  const canvas = document.createElement("canvas");
  const sz = r * 4;
  canvas.width = sz;
  canvas.height = sz;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, r * 2);
  grad.addColorStop(0, `rgba(255,255,255,0.6)`);
  grad.addColorStop(0.3, `rgba(255,255,255,0.2)`);
  grad.addColorStop(1, `rgba(255,255,255,0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, sz, sz);
  return PIXI.Texture.from(canvas);
}

function getShipTexture(type: string, color: string, size: number, isBoss: boolean): PIXI.Texture {
  const key = `ship-${type}-${color}-${size}-${isBoss}`;
  if (texCache.has(key)) return texCache.get(key)!;

  const canvas = document.createElement("canvas");
  const pad = isBoss ? 24 : 12;
  const texSz = (size + pad) * 3;
  canvas.width = texSz;
  canvas.height = texSz;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(texSz / 2, texSz / 2);

  const s = size / 10;
  const c = cssHex(color);
  const dk = hexStr(shade(c, -0.4));
  const md = hexStr(shade(c, -0.15));
  const lt = hexStr(shade(c, 0.3));

  ctx.shadowColor = color;
  ctx.shadowBlur = isBoss ? 16 : 8;

  drawShipCanvas(ctx, type as EnemyType, s, color, dk, md, lt);

  // Engine glow
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = color;
  if (type === "scout" || type === "wraith") {
    ctx.beginPath(); ctx.arc(0, 8 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
  } else if (type === "titan" || type === "overlord" || type === "dread") {
    for (const ox of [-4 * s, 0, 4 * s]) {
      ctx.beginPath(); ctx.arc(ox, 12 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.beginPath(); ctx.arc(-2 * s, 10 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2 * s, 10 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = PIXI.Texture.from(canvas);
  texCache.set(key, tex);
  return tex;
}

function drawShipCanvas(ctx: CanvasRenderingContext2D, type: EnemyType, s: number, c: string, dk: string, md: string, lt: string): void {
  ctx.fillStyle = c;
  ctx.strokeStyle = dk;
  ctx.lineWidth = 1;

  switch (type) {
    case "scout": {
      ctx.beginPath();
      ctx.moveTo(0, -13 * s);
      ctx.lineTo(3 * s, -5 * s);
      ctx.lineTo(10 * s, 3 * s);
      ctx.lineTo(8 * s, 5 * s);
      ctx.lineTo(3 * s, 4 * s);
      ctx.lineTo(1.5 * s, 8 * s);
      ctx.lineTo(-1.5 * s, 8 * s);
      ctx.lineTo(-3 * s, 4 * s);
      ctx.lineTo(-8 * s, 5 * s);
      ctx.lineTo(-10 * s, 3 * s);
      ctx.lineTo(-3 * s, -5 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Center panel
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(0, -9 * s);
      ctx.lineTo(1.5 * s, -2 * s);
      ctx.lineTo(1.5 * s, 4 * s);
      ctx.lineTo(0, 6 * s);
      ctx.lineTo(-1.5 * s, 4 * s);
      ctx.lineTo(-1.5 * s, -2 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "raider": {
      ctx.beginPath();
      ctx.moveTo(0, -11 * s);
      ctx.lineTo(4 * s, -3 * s);
      ctx.lineTo(12 * s, 4 * s);
      ctx.lineTo(10 * s, 7 * s);
      ctx.lineTo(4 * s, 5 * s);
      ctx.lineTo(2 * s, 9 * s);
      ctx.lineTo(-2 * s, 9 * s);
      ctx.lineTo(-4 * s, 5 * s);
      ctx.lineTo(-10 * s, 7 * s);
      ctx.lineTo(-12 * s, 4 * s);
      ctx.lineTo(-4 * s, -3 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = md;
      ctx.beginPath();
      ctx.moveTo(0, -7 * s);
      ctx.lineTo(2 * s, 0);
      ctx.lineTo(2 * s, 5 * s);
      ctx.lineTo(-2 * s, 5 * s);
      ctx.lineTo(-2 * s, 0);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "destroyer": {
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.lineTo(5 * s, -2 * s);
      ctx.lineTo(7 * s, 5 * s);
      ctx.lineTo(5 * s, 10 * s);
      ctx.lineTo(-5 * s, 10 * s);
      ctx.lineTo(-7 * s, 5 * s);
      ctx.lineTo(-5 * s, -2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dk;
      ctx.fillRect(-3 * s, -5 * s, 6 * s, 10 * s);
      // Weapon pods
      ctx.fillStyle = lt;
      ctx.fillRect(-6.5 * s, 0, 2 * s, 4 * s);
      ctx.fillRect(4.5 * s, 0, 2 * s, 4 * s);
      break;
    }
    case "voidling": {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -12 * s);
      ctx.lineTo(6 * s, 0);
      ctx.lineTo(0, 12 * s);
      ctx.lineTo(-6 * s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = lt;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, -7 * s);
      ctx.lineTo(3 * s, 0);
      ctx.lineTo(0, 7 * s);
      ctx.lineTo(-3 * s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      // Core glow
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case "dread": {
      ctx.beginPath();
      ctx.moveTo(0, -14 * s);
      ctx.lineTo(6 * s, -6 * s);
      ctx.lineTo(9 * s, 2 * s);
      ctx.lineTo(8 * s, 10 * s);
      ctx.lineTo(4 * s, 13 * s);
      ctx.lineTo(-4 * s, 13 * s);
      ctx.lineTo(-8 * s, 10 * s);
      ctx.lineTo(-9 * s, 2 * s);
      ctx.lineTo(-6 * s, -6 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.lineTo(4 * s, -2 * s);
      ctx.lineTo(4 * s, 8 * s);
      ctx.lineTo(-4 * s, 8 * s);
      ctx.lineTo(-4 * s, -2 * s);
      ctx.closePath();
      ctx.fill();
      // Side guns
      ctx.fillStyle = lt;
      ctx.fillRect(-8.5 * s, -1 * s, 2 * s, 6 * s);
      ctx.fillRect(6.5 * s, -1 * s, 2 * s, 6 * s);
      break;
    }
    case "sentinel": {
      // Hexagonal shield shape
      const hr = 10 * s;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const px = Math.cos(a) * hr;
        const py = Math.sin(a) * hr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Inner hex
      ctx.fillStyle = dk;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const px = Math.cos(a) * hr * 0.55;
        const py = Math.sin(a) * hr * 0.55;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      // Core
      ctx.fillStyle = lt;
      ctx.beginPath();
      ctx.arc(0, 0, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "wraith": {
      // Sleek crescent/stealth
      ctx.beginPath();
      ctx.moveTo(0, -14 * s);
      ctx.lineTo(2 * s, -8 * s);
      ctx.lineTo(8 * s, 0);
      ctx.lineTo(6 * s, 6 * s);
      ctx.lineTo(2 * s, 8 * s);
      ctx.lineTo(0, 6 * s);
      ctx.lineTo(-2 * s, 8 * s);
      ctx.lineTo(-6 * s, 6 * s);
      ctx.lineTo(-8 * s, 0);
      ctx.lineTo(-2 * s, -8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.lineTo(1.5 * s, -4 * s);
      ctx.lineTo(1.5 * s, 4 * s);
      ctx.lineTo(0, 5 * s);
      ctx.lineTo(-1.5 * s, 4 * s);
      ctx.lineTo(-1.5 * s, -4 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "titan": {
      // Massive fortress
      ctx.beginPath();
      ctx.moveTo(0, -16 * s);
      ctx.lineTo(8 * s, -8 * s);
      ctx.lineTo(12 * s, 0);
      ctx.lineTo(12 * s, 8 * s);
      ctx.lineTo(6 * s, 16 * s);
      ctx.lineTo(-6 * s, 16 * s);
      ctx.lineTo(-12 * s, 8 * s);
      ctx.lineTo(-12 * s, 0);
      ctx.lineTo(-8 * s, -8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dk;
      ctx.fillRect(-6 * s, -6 * s, 12 * s, 16 * s);
      // Turrets
      ctx.fillStyle = lt;
      ctx.fillRect(-11 * s, -2 * s, 3 * s, 8 * s);
      ctx.fillRect(8 * s, -2 * s, 3 * s, 8 * s);
      ctx.fillRect(-3 * s, -12 * s, 6 * s, 4 * s);
      break;
    }
    case "overlord": {
      // Crown/star shape
      ctx.beginPath();
      ctx.moveTo(0, -18 * s);
      ctx.lineTo(5 * s, -8 * s);
      ctx.lineTo(14 * s, -4 * s);
      ctx.lineTo(8 * s, 4 * s);
      ctx.lineTo(10 * s, 14 * s);
      ctx.lineTo(0, 10 * s);
      ctx.lineTo(-10 * s, 14 * s);
      ctx.lineTo(-8 * s, 4 * s);
      ctx.lineTo(-14 * s, -4 * s);
      ctx.lineTo(-5 * s, -8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.lineTo(5 * s, 0);
      ctx.lineTo(0, 8 * s);
      ctx.lineTo(-5 * s, 0);
      ctx.closePath();
      ctx.fill();
      // Core eye
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(0, -1 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    default: {
      // Generic triangle
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.lineTo(6 * s, 8 * s);
      ctx.lineTo(-6 * s, 8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

function getPlayerTexture(shipClass: ShipClassId): PIXI.Texture {
  const key = `player-${shipClass}`;
  if (texCache.has(key)) return texCache.get(key)!;

  const canvas = document.createElement("canvas");
  const sz = 80;
  canvas.width = sz;
  canvas.height = sz;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(sz / 2, sz / 2);

  const s = 1.2;
  ctx.shadowColor = "#4ee2ff";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#e8f0ff";
  ctx.strokeStyle = "#7a8ad8";
  ctx.lineWidth = 1;

  // All player ships: arrow shape scaled by class
  const classDef = SHIP_CLASSES[shipClass];
  const scale = classDef ? Math.sqrt(classDef.hullMax / 200) * 0.6 + 0.7 : 1;

  ctx.beginPath();
  ctx.moveTo(0, -14 * s * scale);
  ctx.lineTo(4 * s * scale, -4 * s * scale);
  ctx.lineTo(10 * s * scale, 4 * s * scale);
  ctx.lineTo(3 * s * scale, 6 * s * scale);
  ctx.lineTo(2 * s * scale, 12 * s * scale);
  ctx.lineTo(-2 * s * scale, 12 * s * scale);
  ctx.lineTo(-3 * s * scale, 6 * s * scale);
  ctx.lineTo(-10 * s * scale, 4 * s * scale);
  ctx.lineTo(-4 * s * scale, -4 * s * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Center panel
  ctx.fillStyle = "#4a5a9a";
  ctx.beginPath();
  ctx.moveTo(0, -8 * s * scale);
  ctx.lineTo(2 * s * scale, 0);
  ctx.lineTo(2 * s * scale, 6 * s * scale);
  ctx.lineTo(-2 * s * scale, 6 * s * scale);
  ctx.lineTo(-2 * s * scale, 0);
  ctx.closePath();
  ctx.fill();

  // Engine glow
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#4ee2ff";
  ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.arc(-2 * s * scale, 10 * s * scale, 2 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(2 * s * scale, 10 * s * scale, 2 * s, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  const tex = PIXI.Texture.from(canvas);
  texCache.set(key, tex);
  return tex;
}

function getProjTexture(kind: string, color: string, size: number): PIXI.Texture {
  const key = `proj-${kind}-${color}-${size}`;
  if (texCache.has(key)) return texCache.get(key)!;

  const canvas = document.createElement("canvas");
  const sz = (size + 6) * 4;
  canvas.width = sz;
  canvas.height = sz;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(sz / 2, sz / 2);

  ctx.shadowColor = color;
  ctx.shadowBlur = 8;

  if (kind === "energy") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (kind === "plasma") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.5, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.7, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (kind === "rocket") {
    ctx.fillStyle = "#ffaa33";
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.5);
    ctx.lineTo(size * 0.6, size);
    ctx.lineTo(-size * 0.6, size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff4400";
    ctx.beginPath();
    ctx.arc(0, size * 0.5, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Laser default
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.4, size * 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.2, size * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.shadowBlur = 0;
  const tex = PIXI.Texture.from(canvas);
  texCache.set(key, tex);
  return tex;
}

// ══════════════════════════════════════════════════════════════════════════
// Stars & Background
// ══════════════════════════════════════════════════════════════════════════
const STAR_LAYER_DEFS = [
  { count: 220, speed: 0.1, size: 1, color: 0x3a4980 },
  { count: 130, speed: 0.3, size: 1, color: 0x7a8ad8 },
  { count: 65, speed: 0.55, size: 2, color: 0xe8f0ff },
];

function initStars(): void {
  for (const def of STAR_LAYER_DEFS) {
    const layer: StarData[] = [];
    for (let i = 0; i < def.count; i++) {
      const s = new PIXI.Sprite(PIXI.Texture.WHITE);
      s.width = def.size;
      s.height = def.size;
      s.tint = def.color;
      bgContainer.addChild(s);
      layer.push({
        x: Math.random() * 4000 - 2000,
        y: Math.random() * 4000 - 2000,
        size: def.size, color: def.color, speed: def.speed, sprite: s,
      });
    }
    starLayers.push(layer);
  }
}

function updateBackground(w: number, h: number): void {
  const zoneId = state.player.zone as ZoneId;
  const z = ZONES[zoneId];
  if (!z) return;
  const cam = state.player.pos;

  // Update stars
  for (const layer of starLayers) {
    for (const s of layer) {
      const sx = ((s.x - cam.x * s.speed) % w + w * 1.5) % w;
      const sy = ((s.y - cam.y * s.speed) % h + h * 1.5) % h;
      s.sprite.position.set(sx, sy);
    }
  }

  // Nebulae (regenerate when zone changes)
  if (currentBgZone !== state.player.zone) {
    for (const ns of nebulaSprites) {
      bgContainer.removeChild(ns);
      ns.destroy();
    }
    nebulaSprites.length = 0;

    for (let i = 0; i < 14; i++) {
      const ns = new PIXI.Sprite(glowTexture);
      ns.anchor.set(0.5);
      const r = 300 + Math.random() * 500;
      ns.scale.set(r / 32);
      ns.tint = cssHex(i % 2 === 0 ? z.bgHueA : z.bgHueB);
      ns.alpha = 0.15;
      (ns as any)._baseX = (Math.random() - 0.5) * 6000;
      (ns as any)._baseY = (Math.random() - 0.5) * 6000;
      bgContainer.addChild(ns);
      nebulaSprites.push(ns);
    }
    currentBgZone = state.player.zone;

    // Update background color
    if (app) (app.renderer as any).backgroundColor = cssHex(z.bgHueB);
  }

  for (const ns of nebulaSprites) {
    ns.position.set(
      w / 2 + (ns as any)._baseX - cam.x * 0.05,
      h / 2 + (ns as any)._baseY - cam.y * 0.05,
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Sprite Pool Management
// ══════════════════════════════════════════════════════════════════════════
function syncEnemies(): void {
  const seen = new Set<string>();

  for (const e of state.enemies) {
    seen.add(e.id);
    let cont = enemySprites.get(e.id);
    if (!cont) {
      cont = new PIXI.Container();
      cont.zIndex = 10;

      const tex = getShipTexture(e.type, e.color, e.size, !!e.isBoss);
      const spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5);
      spr.name = "body";
      cont.addChild(spr);

      // Name text
      const nameText = new PIXI.Text(e.name ?? e.type.toUpperCase(), {
        fontFamily: "Courier New, monospace",
        fontSize: 13,
        fontWeight: "bold",
        fill: e.isBoss ? "#ffd24a" : "#ff9944",
        align: "center",
      });
      nameText.anchor.set(0.5);
      nameText.name = "name";
      nameText.position.set(0, -e.size - 22);
      cont.addChild(nameText);

      // Health bar background
      const hpBar = new PIXI.Graphics();
      hpBar.name = "hp";
      hpBar.position.set(0, -e.size - 10);
      cont.addChild(hpBar);

      worldContainer.addChild(cont);
      enemySprites.set(e.id, cont);
    }

    cont.position.set(e.pos.x, e.pos.y);
    const body = cont.getChildByName("body") as PIXI.Sprite;
    if (body) body.rotation = e.angle + Math.PI / 2;

    // Update health bar
    const hpBar = cont.getChildByName("hp") as PIXI.Graphics;
    if (hpBar && e.hullMax > 0) {
      const pct = Math.max(0, e.hull / e.hullMax);
      const bw = Math.min(40, e.size * 2);
      hpBar.clear();
      hpBar.beginFill(0x333333, 0.7);
      hpBar.drawRect(-bw / 2, 0, bw, 4);
      hpBar.endFill();
      hpBar.beginFill(pct > 0.5 ? 0x44ff66 : pct > 0.25 ? 0xffaa22 : 0xff3333);
      hpBar.drawRect(-bw / 2, 0, bw * pct, 4);
      hpBar.endFill();
    }

    // Boss telegraph
    if (e.isBoss) {
      const existing = cont.getChildByName("telegraph") as PIXI.Graphics;
      const tg = existing || new PIXI.Graphics();
      if (!existing) { tg.name = "telegraph"; cont.addChildAt(tg, 0); }
      tg.clear();
      const ta = 0.4 + 0.3 * Math.sin(state.tick * 5);
      tg.lineStyle(2, 0xff8a4e, ta);
      tg.drawCircle(0, 0, e.size + 18);
    }

    // Selection ring
    if (state.selectedWorldTarget?.kind === "enemy" && state.selectedWorldTarget.id === e.id) {
      const existing = cont.getChildByName("select") as PIXI.Graphics;
      const sg = existing || new PIXI.Graphics();
      if (!existing) { sg.name = "select"; cont.addChild(sg); }
      sg.clear();
      sg.lineStyle(3, 0xff3b4d, 1);
      sg.drawCircle(0, 0, e.size + 14);
      sg.visible = true;
    } else {
      const sg = cont.getChildByName("select") as PIXI.Graphics;
      if (sg) sg.visible = false;
    }
  }

  // Remove despawned enemies
  for (const [id, cont] of enemySprites) {
    if (!seen.has(id)) {
      worldContainer.removeChild(cont);
      cont.destroy({ children: true });
      enemySprites.delete(id);
    }
  }
}

function syncOtherPlayers(): void {
  const seen = new Set<string>();
  for (const o of state.others) {
    const sid = o.id;
    seen.add(sid);
    let cont = otherSprites.get(sid);
    if (!cont) {
      cont = new PIXI.Container();
      cont.zIndex = 20;
      const tex = getPlayerTexture(o.shipClass as ShipClassId);
      const spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5);
      spr.name = "body";
      cont.addChild(spr);
      const nameText = new PIXI.Text(o.name, {
        fontFamily: "Courier New, monospace", fontSize: 13, fontWeight: "bold",
        fill: (o as any).faction ? FACTIONS[(o as any).faction as keyof typeof FACTIONS]?.color ?? "#7a8ad8" : "#7a8ad8",
      });
      nameText.anchor.set(0.5);
      nameText.position.set(0, 30);
      cont.addChild(nameText);
      worldContainer.addChild(cont);
      otherSprites.set(sid, cont);
    }
    cont.position.set(o.pos.x, o.pos.y);
    const body = cont.getChildByName("body") as PIXI.Sprite;
    if (body) body.rotation = o.angle + Math.PI / 2;
  }
  for (const [id, cont] of otherSprites) {
    if (!seen.has(id)) {
      worldContainer.removeChild(cont);
      cont.destroy({ children: true });
      otherSprites.delete(id);
    }
  }
}

function syncNpcs(): void {
  const seen = new Set<string>();
  for (const n of state.npcShips) {
    seen.add(n.id);
    let cont = npcSprites.get(n.id);
    if (!cont) {
      cont = new PIXI.Container();
      cont.zIndex = 8;
      const tex = getShipTexture("sentinel" as EnemyType, n.color ?? "#44aaff", n.size ?? 12, false);
      const spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5);
      spr.name = "body";
      cont.addChild(spr);
      const nameText = new PIXI.Text(n.name, {
        fontFamily: "Courier New, monospace", fontSize: 11, fontWeight: "bold", fill: "#44ddff",
      });
      nameText.anchor.set(0.5);
      nameText.position.set(0, -n.size - 14);
      cont.addChild(nameText);
      worldContainer.addChild(cont);
      npcSprites.set(n.id, cont);
    }
    cont.position.set(n.pos.x, n.pos.y);
    const body = cont.getChildByName("body") as PIXI.Sprite;
    if (body) body.rotation = n.angle + Math.PI / 2;
  }
  for (const [id, cont] of npcSprites) {
    if (!seen.has(id)) {
      worldContainer.removeChild(cont);
      cont.destroy({ children: true });
      npcSprites.delete(id);
    }
  }
}

function syncProjectiles(): void {
  const seen = new Set<string>();
  for (const pr of state.projectiles) {
    seen.add(pr.id);
    let spr = projSprites.get(pr.id);
    if (!spr) {
      const kind = pr.weaponKind ?? "laser";
      const tex = getProjTexture(kind, pr.color, pr.size);
      spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5);
      spr.zIndex = 15;
      worldContainer.addChild(spr);
      projSprites.set(pr.id, spr);
    }
    spr.position.set(pr.pos.x, pr.pos.y);
    spr.rotation = Math.atan2(pr.vel.y, pr.vel.x) + Math.PI / 2;
    spr.alpha = pr.ttl < 0.3 ? pr.ttl / 0.3 : 1;
  }
  for (const [id, spr] of projSprites) {
    if (!seen.has(id)) {
      worldContainer.removeChild(spr);
      spr.destroy();
      projSprites.delete(id);
    }
  }
}

function syncParticles(): void {
  activeTrails = 0;
  activeFx = 0;

  for (const pa of state.particles) {
    const a = pa.ttl / pa.maxTtl;
    if (a <= 0) continue;

    const isTrail = pa.kind === "trail" || pa.kind === "engine";
    const pool = isTrail ? trailPool : fxPool;
    const idx = isTrail ? activeTrails++ : activeFx++;

    if (idx >= pool.length) continue;

    const s = pool[idx];
    s.visible = true;
    s.position.set(pa.pos.x, pa.pos.y);
    s.tint = cssHex(pa.color);

    if (pa.kind === "flash") {
      s.alpha = a * 0.8;
      s.scale.set(pa.size / 16 * (2 - a));
    } else if (pa.kind === "debris") {
      s.alpha = a;
      s.scale.set(pa.size / 16);
      s.rotation = (pa as any).rot ?? 0;
    } else if (pa.kind === "ember" || pa.kind === "fireball") {
      s.alpha = a * 0.9;
      s.scale.set(pa.size / 16 * (0.5 + a * 0.5));
    } else if (pa.kind === "smoke") {
      s.alpha = a * 0.4;
      s.scale.set(pa.size / 16 * (1.5 - a * 0.5));
      s.tint = 0x444444;
    } else if (isTrail) {
      s.alpha = a * ((pa as any).alpha ?? 0.5);
      s.scale.set(pa.size / 16 * (0.3 + a * 0.7));
    } else {
      // spark, ring, etc.
      s.alpha = a;
      s.scale.set(pa.size / 16);
    }
  }

  // Hide unused sprites
  for (let i = activeTrails; i < trailPool.length; i++) trailPool[i].visible = false;
  for (let i = activeFx; i < fxPool.length; i++) fxPool[i].visible = false;
}

function syncAsteroids(): void {
  const seen = new Set<string>();
  for (const a of state.asteroids) {
    if (a.zone !== state.player.zone) continue;
    seen.add(a.id);
    let cont = asteroidSprites.get(a.id);
    if (!cont) {
      cont = new PIXI.Container();
      cont.zIndex = 2;
      const g = new PIXI.Graphics();
      g.beginFill(0x888888, 0.8);
      // Draw rocky polygon
      const pts = 7;
      for (let i = 0; i < pts; i++) {
        const ang = (Math.PI * 2 / pts) * i;
        const r = a.size * (0.7 + Math.random() * 0.3);
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
      }
      g.closePath();
      g.endFill();
      g.lineStyle(1, 0x666666, 0.5);
      g.drawCircle(0, 0, a.size * 0.4);
      cont.addChild(g);

      // HP bar
      const hpBar = new PIXI.Graphics();
      hpBar.name = "hp";
      hpBar.position.set(0, -a.size - 8);
      cont.addChild(hpBar);

      worldContainer.addChild(cont);
      asteroidSprites.set(a.id, cont);
    }
    cont.position.set(a.pos.x, a.pos.y);
    const hpBar = cont.getChildByName("hp") as PIXI.Graphics;
    if (hpBar && a.hpMax > 0) {
      const pct = Math.max(0, a.hp / a.hpMax);
      const bw = 24;
      hpBar.clear();
      if (pct < 1) {
        hpBar.beginFill(0x333333, 0.6);
        hpBar.drawRect(-bw / 2, 0, bw, 3);
        hpBar.endFill();
        hpBar.beginFill(0x44aaff);
        hpBar.drawRect(-bw / 2, 0, bw * pct, 3);
        hpBar.endFill();
      }
    }
  }
  for (const [id, cont] of asteroidSprites) {
    if (!seen.has(id)) {
      worldContainer.removeChild(cont);
      cont.destroy({ children: true });
      asteroidSprites.delete(id);
    }
  }
}

function syncStations(): void {
  // Clear stations from other zones
  for (const [key, cont] of stationGfxMap) {
    const st = STATIONS.find(s => s.id === key);
    if (!st || st.zone !== state.player.zone) {
      worldContainer.removeChild(cont);
      cont.destroy({ children: true });
      stationGfxMap.delete(key);
    }
  }
  for (const st of STATIONS) {
    if (st.zone !== state.player.zone) continue;
    const key = st.id;
    if (stationGfxMap.has(key)) continue;

    const cont = new PIXI.Container();
    cont.zIndex = 3;
    cont.position.set(st.pos.x, st.pos.y);

    const g = new PIXI.Graphics();
    // Simple station shape
    g.beginFill(0x334466, 0.9);
    g.drawRect(-20, -20, 40, 40);
    g.endFill();
    g.lineStyle(2, 0x4ee2ff, 0.8);
    g.drawRect(-20, -20, 40, 40);
    g.drawCircle(0, 0, 10);
    cont.addChild(g);

    const nameText = new PIXI.Text(st.name, {
      fontFamily: "Courier New, monospace", fontSize: 12, fontWeight: "bold", fill: "#4ee2ff",
    });
    nameText.anchor.set(0.5);
    nameText.position.set(0, -30);
    cont.addChild(nameText);

    worldContainer.addChild(cont);
    stationGfxMap.set(key, cont);
  }
  // Hide stations from other zones
  for (const [key, cont] of stationGfxMap) {
    cont.visible = true; // only created for current zone
  }
}

function syncPortals(): void {
  for (const po of PORTALS) {
    if (po.fromZone !== state.player.zone) continue;
    const key = `portal-${po.fromZone}-${po.toZone}`;
    let cont = portalGfxMap.get(key);
    if (!cont) {
      cont = new PIXI.Container();
      cont.zIndex = 3;
      cont.position.set(po.pos.x, po.pos.y);

      const g = new PIXI.Graphics();
      g.name = "ring";
      cont.addChild(g);

      const nameText = new PIXI.Text(ZONES[po.toZone]?.name ?? po.toZone, {
        fontFamily: "Courier New, monospace", fontSize: 11, fontWeight: "bold", fill: "#aaddff",
      });
      nameText.anchor.set(0.5);
      nameText.position.set(0, -30);
      cont.addChild(nameText);

      worldContainer.addChild(cont);
      portalGfxMap.set(key, cont);
    }

    // Animate portal ring
    const g = cont.getChildByName("ring") as PIXI.Graphics;
    if (g) {
      g.clear();
      const t = state.tick;
      const pulse = 0.6 + 0.4 * Math.sin(t * 3);
      g.lineStyle(2, 0x4ee2ff, pulse);
      g.drawCircle(0, 0, 18);
      g.lineStyle(1, 0x4ee2ff, pulse * 0.5);
      g.drawCircle(0, 0, 24);
    }
  }
  for (const [key, cont] of portalGfxMap) {
    cont.visible = true; // only created for current zone
  }
}

function syncCargoBoxes(): void {
  const seen = new Set<string>();
  for (const cb of state.cargoBoxes) {
    seen.add(cb.id);
    let spr = cargoSprites.get(cb.id);
    if (!spr) {
      spr = new PIXI.Sprite(circleTexture);
      spr.anchor.set(0.5);
      spr.tint = cssHex(cb.color);
      spr.scale.set(0.5);
      spr.zIndex = 5;
      worldContainer.addChild(spr);
      cargoSprites.set(cb.id, spr);
    }
    spr.position.set(cb.pos.x, cb.pos.y);
    spr.alpha = 0.6 + 0.4 * Math.sin(state.tick * 4);
  }
  for (const [id, spr] of cargoSprites) {
    if (!seen.has(id)) {
      worldContainer.removeChild(spr);
      spr.destroy();
      cargoSprites.delete(id);
    }
  }
}

function syncFloaters(): void {
  const seen = new Set<string>();
  for (const f of state.floaters) {
    seen.add(f.id);
    let txt = floaterTexts.get(f.id);
    if (!txt) {
      const color = f.color;
      txt = new PIXI.Text(f.text, {
        fontFamily: "Courier New, monospace",
        fontSize: f.bold ? 18 : 14,
        fontWeight: "bold",
        fill: color,
      });
      txt.anchor.set(0.5);
      txt.zIndex = 60;
      worldContainer.addChild(txt);
      floaterTexts.set(f.id, txt);
    }
    const a = f.ttl / f.maxTtl;
    txt.position.set(f.pos.x, f.pos.y);
    txt.alpha = a;
    txt.scale.set(1 + (1 - a) * 0.3);
  }
  for (const [id, txt] of floaterTexts) {
    if (!seen.has(id)) {
      worldContainer.removeChild(txt);
      txt.destroy();
      floaterTexts.delete(id);
    }
  }
}

function renderPlayer(): void {
  const p = state.player;
  if (state.playerRespawnTimer > 0) {
    if (playerSprite) playerSprite.visible = false;
    return;
  }

  if (!playerSprite) {
    const tex = getPlayerTexture(p.shipClass as ShipClassId);
    playerSprite = new PIXI.Sprite(tex);
    playerSprite.anchor.set(0.5);
    playerSprite.zIndex = 25;
    worldContainer.addChild(playerSprite);
  }

  // Recreate texture if ship class changed
  if ((playerSprite as any)._shipClass !== p.shipClass) {
    const tex = getPlayerTexture(p.shipClass as ShipClassId);
    playerSprite.texture = tex;
    (playerSprite as any)._shipClass = p.shipClass;
  }

  playerSprite.visible = true;
  playerSprite.position.set(p.pos.x, p.pos.y);
  playerSprite.rotation = p.angle + Math.PI / 2;

  // Shield ring
  playerShieldGfx.clear();
  if (p.shield > 0) {
    const a = 0.3 + 0.3 * Math.sin(state.tick * 4);
    playerShieldGfx.lineStyle(2, 0x4ee2ff, a);
    playerShieldGfx.drawCircle(p.pos.x, p.pos.y, 22);
  }

  // Hull/shield bars
  const es = effectiveStats();
  const bw = 36;
  const by = p.pos.y - 26;
  playerShieldGfx.beginFill(0x333333, 0.5);
  playerShieldGfx.drawRect(p.pos.x - bw / 2, by, bw, 3);
  playerShieldGfx.endFill();
  const hullPct = Math.max(0, p.hull / es.hullMax);
  playerShieldGfx.beginFill(0x44ff66);
  playerShieldGfx.drawRect(p.pos.x - bw / 2, by, bw * hullPct, 3);
  playerShieldGfx.endFill();
  const shieldPct = Math.max(0, p.shield / es.shieldMax);
  playerShieldGfx.beginFill(0x333333, 0.5);
  playerShieldGfx.drawRect(p.pos.x - bw / 2, by + 4, bw, 2);
  playerShieldGfx.endFill();
  playerShieldGfx.beginFill(0x4ee2ff);
  playerShieldGfx.drawRect(p.pos.x - bw / 2, by + 4, bw * shieldPct, 2);
  playerShieldGfx.endFill();

  // Player name
  const rank = rankFor(p.honor);
  // Use a cached text (recreate only when name changes)
  if (!(playerShieldGfx as any)._nameText) {
    const nt = new PIXI.Text("", {
      fontFamily: "Courier New, monospace", fontSize: 13, fontWeight: "bold", fill: "#e8f0ff",
    });
    nt.anchor.set(0.5);
    nt.zIndex = 26;
    worldContainer.addChild(nt);
    (playerShieldGfx as any)._nameText = nt;
  }
  const nt = (playerShieldGfx as any)._nameText as PIXI.Text;
  nt.text = `${rank.symbol} ${p.name}`;
  nt.position.set(p.pos.x, p.pos.y + 32);
}

function renderMapBoundary(): void {
  mapBoundaryGfx.clear();
  mapBoundaryGfx.lineStyle(2, 0x4ee2ff, 0.15);
  mapBoundaryGfx.drawCircle(0, 0, MAP_RADIUS);
}

function renderMiningBeam(): void {
  beamGfx.clear();
  if (!state.miningTargetId) return;
  const ta = state.asteroids.find((a) => a.id === state.miningTargetId);
  if (!ta) return;
  const pp = state.player.pos;
  const t = state.tick;
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 18));

  // Outer glow
  beamGfx.lineStyle(8, 0x44ffcc, 0.25 + 0.1 * Math.sin(t * 12));
  beamGfx.moveTo(pp.x, pp.y);
  beamGfx.lineTo(ta.pos.x, ta.pos.y);

  // Core beam
  beamGfx.lineStyle(2 + pulse, 0xffffff, 0.8);
  beamGfx.moveTo(pp.x, pp.y);
  beamGfx.lineTo(ta.pos.x, ta.pos.y);

  // Inner beam
  beamGfx.lineStyle(1 + pulse * 0.5, 0x44ffcc, 0.9);
  beamGfx.moveTo(pp.x, pp.y);
  beamGfx.lineTo(ta.pos.x, ta.pos.y);

  // Impact point
  beamGfx.beginFill(0xffffff, 0.9);
  beamGfx.drawCircle(ta.pos.x, ta.pos.y, 3 + pulse * 2);
  beamGfx.endFill();
}

function renderTargetIndicator(): void {
  targetGfx.clear();
  const p = state.player;
  const dx = state.cameraTarget.x - p.pos.x;
  const dy = state.cameraTarget.y - p.pos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 20) {
    const t = state.cameraTarget;
    targetGfx.lineStyle(1, 0x4ee2ff, 0.6);
    targetGfx.drawCircle(t.x, t.y, 10);
    targetGfx.moveTo(t.x - 14, t.y);
    targetGfx.lineTo(t.x + 14, t.y);
    targetGfx.moveTo(t.x, t.y - 14);
    targetGfx.lineTo(t.x, t.y + 14);
  }
}

function renderOverlays(w: number, h: number): void {
  overlayGfx.clear();

  // Death flash
  if (state.playerDeathFlash > 0) {
    const t = state.playerDeathFlash / 0.6;
    overlayGfx.beginFill(0x000000, t * 0.72);
    overlayGfx.drawRect(0, 0, w, h);
    overlayGfx.endFill();
    overlayGfx.beginFill(0xff1a1a, t * 0.4);
    overlayGfx.drawRect(0, 0, w, h);
    overlayGfx.endFill();
  }

  // Level up flash
  if (state.levelUpFlash > 0) {
    const t = state.levelUpFlash / 1.6;
    const cx = w / 2, cy = h / 2;
    const ringR = (1 - t) * 280;
    overlayGfx.lineStyle(4, 0xffd24a, t);
    overlayGfx.drawCircle(cx, cy, ringR);
    overlayGfx.lineStyle(2, 0xff5cf0, t);
    overlayGfx.drawCircle(cx, cy, ringR * 0.7);
  }
}

// Honor floaters
function renderHonorFloaters(): void {
  // Use a container for honor texts above player
  const p = state.player;
  let hi = 0;
  for (const honor of state.recentHonor) {
    const a = honor.ttl / 1.4;
    const key = `honor-${hi}`;
    let txt = floaterTexts.get(key);
    if (!txt) {
      txt = new PIXI.Text("", {
        fontFamily: "Courier New, monospace", fontSize: 14, fontWeight: "bold", fill: "#ff5cf0",
      });
      txt.anchor.set(0.5);
      txt.zIndex = 60;
      worldContainer.addChild(txt);
      floaterTexts.set(key, txt);
    }
    txt.text = `+${honor.amount} ✪`;
    txt.alpha = a;
    txt.position.set(p.pos.x, p.pos.y - 54 - hi * 16 - (1 - a) * 24);
    txt.visible = true;
    hi++;
  }
  // Hide unused honor texts
  for (let i = hi; i < 10; i++) {
    const txt = floaterTexts.get(`honor-${i}`);
    if (txt) txt.visible = false;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Main Render Function
// ══════════════════════════════════════════════════════════════════════════
export function pixiRender(): void {
  if (!app) return;
  try {

  const w = app.screen.width;
  const h = app.screen.height;
  const p = state.player;
  const zoom = state.cameraZoom;

  // Camera transform
  let sx = 0, sy = 0;
  if (state.cameraShake > 0) {
    const m = state.cameraShake * 16;
    sx = (Math.random() - 0.5) * m;
    sy = (Math.random() - 0.5) * m;
  }
  worldContainer.position.set(w / 2 + sx, h / 2 + sy);
  worldContainer.scale.set(zoom);
  worldContainer.pivot.set(p.pos.x, p.pos.y);

  // Update all layers
  updateBackground(w, h);
  renderMapBoundary();

  syncAsteroids();
  syncStations();
  syncPortals();
  syncCargoBoxes();
  syncOtherPlayers();
  syncNpcs();
  syncEnemies();
  syncProjectiles();
  syncParticles();

  renderPlayer();
  renderMiningBeam();
  renderTargetIndicator();
  syncFloaters();
  renderHonorFloaters();
  renderOverlays(w, h);
  } catch (err) {
    console.error("[PixiRenderer]", err);
  }
}
