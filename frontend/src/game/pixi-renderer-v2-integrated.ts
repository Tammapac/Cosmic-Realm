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
import { state } from "./store";
import { effectiveStats } from "./loop";
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
  createStationVisual, updateStationAnimation,
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
let effectsLayer: PIXI.Container;
let effectsBehindLayer: PIXI.Container;
let effectsFrontLayer: PIXI.Container;
let floaterLayer: PIXI.Container;
let uiLayer: PIXI.Container;

let effectManager: EffectManager | null = null;
let lastRenderTime = 0;
let prevEnemyIds = new Set<string>();
let prevEnemyData = new Map<string, { x: number; y: number; size: number; type: string }>();
let prevProjectileData = new Map<string, { x: number; y: number; color: number; weaponKind: string; angle: number; fromPlayer: boolean }>();
let prevAsteroidIds = new Set<string>();
let prevAsteroidData = new Map<string, { x: number; y: number; size: number }>();
let prevPlayerHull = -1;
let projectileGlowGraphics: PIXI.Graphics | null = null;

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
const ROTATION_SPRITES: Partial<Record<string, { frames: number; path: string; files: string[] }>> = {
  skimmer: { frames: 32, path: "/ships/skimmer/", files: [
    "ship_01_N.png","ship_02_NbE.png","ship_03_NNE.png","ship_04_NEbN.png",
    "ship_05_NE.png","ship_06_NEbE.png","ship_07_ENE.png","ship_08_EbN.png",
    "ship_09_E.png","ship_10_EbS.png","ship_11_ESE.png","ship_12_SEbE.png",
    "ship_13_SE.png","ship_14_SEbS.png","ship_15_SSE.png","ship_16_SbE.png",
    "ship_17_S.png","ship_18_SbW.png","ship_19_SSW.png","ship_20_SWbS.png",
    "ship_21_SW.png","ship_22_SWbW.png","ship_23_WSW.png","ship_24_WbS.png",
    "ship_25_W.png","ship_26_WbN.png","ship_27_WNW.png","ship_28_NWbW.png",
    "ship_29_NW.png","ship_30_NWbN.png","ship_31_NNW.png","ship_32_NbW.png"
  ]},
};
const rotationFrameTextures = new Map<string, PIXI.Texture[]>();
const rotationFrameLoading = new Set<string>();
const directionState = new Map<string, number>();

const HYSTERESIS_DEG = 3;
const HYSTERESIS_RAD = HYSTERESIS_DEG * Math.PI / 180;

function preloadRotationSprites(): void {
  for (const [id, cfg] of Object.entries(ROTATION_SPRITES)) {
    if (!cfg || rotationFrameTextures.has(id) || rotationFrameLoading.has(id)) continue;
    rotationFrameLoading.add(id);
    const frames: (PIXI.Texture | null)[] = new Array(cfg.frames).fill(null);
    let loaded = 0;
    for (let i = 0; i < cfg.frames; i++) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const idx = i;
      img.onload = () => {
        frames[idx] = PIXI.Texture.from(img, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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
}

function hasRotationFrames(shipClass: string): boolean {
  return rotationFrameTextures.has(shipClass);
}

function angleToDirection8(angle: number, totalFrames: number, entityId: string): number {
  let a = (angle + Math.PI / 2) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  const step = (Math.PI * 2) / totalFrames;
  const rawIdx = Math.round(a / step) % totalFrames;

  const prevIdx = directionState.get(entityId);
  if (prevIdx !== undefined && prevIdx !== rawIdx) {
    const prevCenter = prevIdx * step;
    let distFromPrev = a - prevCenter;
    if (distFromPrev > Math.PI) distFromPrev -= Math.PI * 2;
    if (distFromPrev < -Math.PI) distFromPrev += Math.PI * 2;
    if (Math.abs(distFromPrev) < step / 2 + HYSTERESIS_RAD) {
      return prevIdx;
    }
  }
  directionState.set(entityId, rawIdx);
  return rawIdx;
}

function getDirectionalTex(shipClass: ShipClassId, scale: number, angle: number, entityId: string): { tex: PIXI.Texture; isDirectional: boolean } {
  const frames = rotationFrameTextures.get(shipClass);
  if (!frames) {
    return { tex: getShipTex(shipClass, scale), isDirectional: false };
  }
  const sizeScale = SHIP_SIZE_SCALE[shipClass] ?? 1;
  const finalScale = scale * sizeScale;
  const frameIdx = angleToDirection8(angle, frames.length, entityId);
  const key = "ship-" + shipClass + "-" + finalScale.toFixed(2) + "-f" + frameIdx;
  let tex = texCache.get(key);
  if (tex) return { tex, isDirectional: true };

  const spriteTex = frames[frameIdx];
  if (!spriteTex) return { tex: getShipTex(shipClass, scale), isDirectional: false };

  const img = spriteTex.baseTexture.resource as any;
  const src = img.source || img;
  const iw = src.naturalWidth || src.width;
  const ih = src.naturalHeight || src.height;

  const targetSize = Math.ceil(60 * finalScale);
  const drawSz = Math.ceil(targetSize * 1.6);
  const c2 = document.createElement("canvas");
  c2.width = drawSz;
  c2.height = drawSz;
  const ctx = c2.getContext("2d")!;
  ctx.globalAlpha = 1.0;
  ctx.drawImage(src, 0, 0, iw, ih, 0, 0, drawSz, drawSz);

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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
      const tex = PIXI.Texture.from(img, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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
  const tex = PIXI.Texture.from(bakeCanvas, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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

    tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
  texCache.set(key, tex);
  return tex;
}

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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
  texCache.set(key, tex);
  return tex;
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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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
let playerNameText: PIXI.Text | null = null;
let playerBars: PIXI.Graphics | null = null;
let playerDockedText: PIXI.Text | null = null;
let playerFactionBadge: PIXI.Container | null = null;
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

export function initPixiRenderer(container: HTMLDivElement): void {
  preloadShipSprites();
  preloadRotationSprites();
  // Round pixels for sharp rendering (no global NEAREST - text needs LINEAR)
  PIXI.settings.ROUND_PIXELS = true;

  app = new PIXI.Application({
    resizeTo: container,
    backgroundColor: 0x020414,
    antialias: true,
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
  worldLayer.addChild(playerLayer);
  worldLayer.addChild(projectileLayer);
  worldLayer.addChild(effectsLayer);
  worldLayer.addChild(effectsFrontLayer);
  worldLayer.addChild(floaterLayer);

  effectManager = new EffectManager(effectsBehindLayer, effectsFrontLayer);
  lastRenderTime = performance.now();

  app.stage.addChild(bgLayer);
  app.stage.addChild(worldLayer);
  app.stage.addChild(uiLayer);

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

  // Clean up sprite pools
  enemySprites.clear();
  projectileSprites.clear();
  particleSprites.clear();
  otherPlayerSprites.clear();
  npcSprites.clear();
  playerContainer = null;
  playerBody = null;
  playerVisual = null;
  playerNameText = null;
  playerBars = null;
  playerDockedText = null;
  playerFactionBadge = null;
  lastPlayerShipClass = null;

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

export function pixiRender(): void {
  if (!app) return;

  const now = performance.now();
  const dt = Math.min(0.1, (now - lastRenderTime) / 1000);
  lastRenderTime = now;

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

  // ── Effect Manager Update ──────────────────────────────────────────
  if (effectManager) {
    effectManager.update(dt);

    // Detect enemy deaths -> spawn scaled explosion with debris + hull fragments
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
}

// ══════════════════════════════════════════════════════════════════════════
// BACKGROUND RENDERING
// ══════════════════════════════════════════════════════════════════════════

let bgGradientSprite: PIXI.Sprite | null = null;
let bgGradientZone: string = "";

function renderBackground(w: number, h: number, cam: { x: number; y: number }): void {
  if (!bgGraphics || !starGraphics) return;

  const z = ZONES[state.player.zone];

  // Proper linear gradient matching Canvas2D: createLinearGradient(0,0,0,h)
  if (!bgGradientSprite || bgGradientZone !== state.player.zone ||
      bgGradientSprite.width !== w || bgGradientSprite.height !== h) {
    if (bgGradientSprite) {
      bgGradientSprite.parent?.removeChild(bgGradientSprite);
      bgGradientSprite.destroy(true);
    }
    const c2 = document.createElement("canvas");
    c2.width = 1;
    c2.height = Math.max(1, Math.round(h));
    const ctx = c2.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 0, c2.height);
    grad.addColorStop(0, z.bgHueA);
    grad.addColorStop(1, z.bgHueB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1, c2.height);
    const tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
    bgGradientSprite = new PIXI.Sprite(tex);
    bgGradientSprite.width = w;
    bgGradientSprite.height = h;
    bgLayer.addChildAt(bgGradientSprite, 0);
    bgGradientZone = state.player.zone;
  }

  bgGraphics.clear();

  // Nebulae as radial gradient sprites (matches Canvas2D createRadialGradient)
  // Create sprites on first render or after zone change
  if (nebulaSprites.length === 0 && nebulae.length > 0) {
    for (const n of nebulae) {
      const tex = getNebulaTex(Math.round(n.r / 50) * 50);
      const spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5);
      spr.tint = PIXI.utils.string2hex(n.c);
      spr.scale.set(n.r / (Math.round(n.r / 50) * 50));
      bgLayer.addChild(spr);
      nebulaSprites.push(spr);
    }
  }
  // Update nebula positions (parallax)
  for (let i = 0; i < nebulaSprites.length && i < nebulae.length; i++) {
    const n = nebulae[i];
    const spr = nebulaSprites[i];
    spr.x = w / 2 + (n.x - cam.x * 0.05);
    spr.y = h / 2 + (n.y - cam.y * 0.05);
    // Culling
    spr.visible = !(spr.x < -n.r || spr.x > w + n.r || spr.y < -n.r || spr.y > h + n.r);
  }

  // Stars (enhanced parallax layers with twinkle + color variation)
  if (enhancedStars.length === 0) initStars(w, h);
  renderEnhancedStars(starGraphics, enhancedStars, cam, w, h, state.tick);
}

// ══════════════════════════════════════════════════════════════════════════
// ENEMY SYNC
// ══════════════════════════════════════════════════════════════════════════

function syncEnemies(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  const activeIds = new Set<string>();

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
        fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        fontSize: 12,
        fill: e.color,
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 1,
      });
      nameText.resolution = 2;
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
      data.nameText.style.fill = e.color;
      if (data.coreGlow) data.coreGlow.tint = PIXI.utils.string2hex(e.color);
    }

    // Update position & rotation
    data.container.visible = true;
    data.container.position.set(e.pos.x, e.pos.y);
    data.body.rotation = e.angle + Math.PI / 2;

    // Animate alien core glow
    if (data.coreGlow) {
      const pulse = 0.2 + 0.15 * Math.sin(state.tick * 3 + e.size * 0.5);
      data.coreGlow.alpha = pulse;
      const scale = 0.9 + 0.1 * Math.sin(state.tick * 2.5);
      data.coreGlow.scale.set(scale);
    }

    // Animate weapon glow
    if (data.weaponGlow) {
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

    // Name (update every frame to catch changes)
    if (e.isBoss) {
      data.nameText.text = `◆ ${(e.name || "DREADNOUGHT").toUpperCase()} ◆`;
      data.nameText.style.fill = "#ff8a4e";
      data.nameText.position.set(0, -e.size - 18);
    } else if (e.name) {
      data.nameText.text = e.name;
      data.nameText.style.fill = e.color;
      data.nameText.position.set(0, -e.size - 16);
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
  const activeIds = new Set<string>();

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
      // Native PixiJS projectile visuals
      const isRocket = pr.weaponKind === "rocket" || pr.size > 4;
      const tex = isRocket ? getRocketTex() : getLaserBoltTex(Math.max(16, pr.size * 4));
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.blendMode = isRocket ? PIXI.BLEND_MODES.NORMAL : PIXI.BLEND_MODES.ADD;
      sprite.tint = PIXI.utils.string2hex(pr.color);
      if (!isRocket) {
        sprite.scale.set(1 + pr.size * 0.15, 0.8 + pr.size * 0.1);
      }
      projectileLayer.addChild(sprite);
      data = { sprite };
      projectileSprites.set(pr.id, data);

      // EffectManager muzzle flash on new projectile
      if (effectManager) {
        const angle = Math.atan2(pr.vel.y, pr.vel.x);
        const weaponType = (pr.weaponKind === "rocket" || pr.size > 4) ? "rocket" : "laser";
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
    data.sprite.rotation = Math.atan2(pr.vel.y, pr.vel.x);

    // Projectile trail particles — rockets get heavy smoke+fire, lasers get glow trail
    if (effectManager) {
      const isRocket = pr.weaponKind === "rocket" || pr.size > 4;
      const trailChance = isRocket ? 1.0 : 0.45;
      if (Math.random() < trailChance) {
        const weaponType = isRocket ? "rocket" : "laser";
        effectManager.spawnProjectileTrail(pr.pos.x, pr.pos.y, PIXI.utils.string2hex(pr.color), weaponType);
      }
      // Occasional light smoke wisp for rockets
      if (isRocket && Math.random() < 0.15) {
        effectManager.spawnSmokePuff(pr.pos.x, pr.pos.y, 3);
      }
    }
  }

  // Projectile glow overlay (drawn each frame)
  if (!projectileGlowGraphics) {
    projectileGlowGraphics = new PIXI.Graphics();
    projectileLayer.addChildAt(projectileGlowGraphics, 0);
  }
  projectileGlowGraphics.clear();
  for (const pr of state.projectiles) {
    if (Math.abs(pr.pos.x - cam.x) > halfW + 30 || Math.abs(pr.pos.y - cam.y) > halfH + 30) continue;
    const color = PIXI.utils.string2hex(pr.color);
    const isRocket = pr.weaponKind === "rocket" || pr.size > 4;
    if (isRocket) continue; // No glow overlay for rockets (uses trail instead)
    const glowR = 3 + pr.size * 0.5;
    // Subtle outer glow (much less circular/overpowering)
    projectileGlowGraphics.beginFill(color, 0.06);
    projectileGlowGraphics.drawCircle(pr.pos.x, pr.pos.y, glowR * 1.5);
    projectileGlowGraphics.endFill();
    // Tiny core highlight
    projectileGlowGraphics.beginFill(color, 0.15);
    projectileGlowGraphics.drawCircle(pr.pos.x, pr.pos.y, glowR * 0.6);
    projectileGlowGraphics.endFill();
  }

  // Detect projectile deaths — spawn differentiated effects
  if (effectManager) {
    const currentProjIds = new Set<string>();
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
        weaponKind: (pr.weaponKind === "rocket" || pr.size > 4) ? "rocket" : "laser",
        angle: Math.atan2(pr.vel.y, pr.vel.x),
        fromPlayer: pr.fromPlayer,
      });
    }
  }

  // Remove dead projectile sprites
  for (const [id, data] of projectileSprites) {
    if (!activeIds.has(id)) {
      projectileLayer.removeChild(data.sprite);
      data.sprite.destroy();
      projectileSprites.delete(id);
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

    playerBars = new PIXI.Graphics();
    playerContainer.addChild(playerBars);

    const rank = rankFor(p.honor);
    playerNameText = new PIXI.Text(p.name, {
      fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      fontSize: 12,
      fill: "#e8f0ff",
      fontWeight: "bold",
      stroke: "#000000",
      strokeThickness: 1,
    });
    playerNameText.resolution = 2;
    playerNameText.anchor.set(0.5, 0);
    playerContainer.addChild(playerNameText);

    playerFactionBadge = new PIXI.Container();
    const pbCircle = new PIXI.Graphics();
    pbCircle.name = "circle";
    playerFactionBadge.addChild(pbCircle);
    const pbLetter = new PIXI.Text("", {
      fontFamily: "Arial, sans-serif",
      fontSize: 8,
      fill: "#ffffff",
      fontWeight: "bold",
    });
    pbLetter.resolution = 2;
    pbLetter.anchor.set(0.5);
    pbLetter.name = "letter";
    playerFactionBadge.addChild(pbLetter);
    playerFactionBadge.position.set(0, 30);
    playerContainer.addChild(playerFactionBadge);

    playerDockedText = new PIXI.Text("DOCKED", {
      fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      fontSize: 11,
      fill: "#44ff88",
      fontWeight: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    });
    playerDockedText.resolution = 2;
    playerDockedText.anchor.set(0.5, 1);
    playerDockedText.position.set(0, -35);
    playerDockedText.visible = false;
    playerContainer.addChild(playerDockedText);

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

  // Update visual layers
  const speed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
  const es = effectiveStats();
  if (playerVisual) {
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

  playerContainer.position.set(p.pos.x, p.pos.y);

  // EffectManager thruster trail particles
  if (speed > 0.5 && effectManager) {
    const cls = SHIP_CLASSES[p.shipClass];
    const trailScale = cls ? Math.max(0.5, Math.min(1.2, cls.hullMax / 200)) : 1;
    effectManager.spawnThrusterTrail(p.pos.x, p.pos.y, p.angle, speed, 0x4ee2ff, 1, trailScale);
  }

  // Hull/Shield bars
  const hullPct = Math.max(0, p.hull / es.hullMax);
  const shieldPct = Math.max(0, p.shield / es.shieldMax);
  playerBars!.clear();
  playerBars!.position.set(-14, -26);
  // Hull
  playerBars!.beginFill(0x222222, 0.5);
  playerBars!.drawRect(0, 0, 28, 3);
  playerBars!.endFill();
  playerBars!.beginFill(0x44ff66);
  playerBars!.drawRect(0, 0, 28 * hullPct, 3);
  playerBars!.endFill();
  // Shield
  playerBars!.beginFill(0x222222, 0.5);
  playerBars!.drawRect(0, 4, 28, 3);
  playerBars!.endFill();
  playerBars!.beginFill(0x4ee2ff);
  playerBars!.drawRect(0, 4, 28 * shieldPct, 3);
  playerBars!.endFill();

  // Name with rank symbol on right
  const pRank = rankFor(p.honor);
  playerNameText!.text = p.name + " " + pRank.symbol;
  playerNameText!.style.fill = "#e8f0ff";
  playerNameText!.position.set(0, 30);

  // Faction badge (colored circle with letter) left of name
  if (playerFactionBadge) {
    const pFaction = p.faction ? FACTIONS[p.faction as keyof typeof FACTIONS] : null;
    if (pFaction) {
      playerFactionBadge.visible = true;
      const nameW = playerNameText!.width;
      playerFactionBadge.position.set(-nameW / 2 - 10, 36);
      const circ = playerFactionBadge.getChildByName("circle") as PIXI.Graphics;
      circ.clear();
      circ.beginFill(PIXI.utils.string2hex(pFaction.color));
      circ.drawCircle(0, 0, 6);
      circ.endFill();
      const letter = playerFactionBadge.getChildByName("letter") as PIXI.Text;
      letter.text = pFaction.tag.charAt(0);
    } else {
      playerFactionBadge.visible = false;
    }
  }

  // DOCKED label
  if (playerDockedText) {
    playerDockedText.visible = !!state.dockedAt;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// OTHER PLAYERS
// ══════════════════════════════════════════════════════════════════════════

function syncOtherPlayers(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  const activeIds = new Set<string>();

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

      const bars = new PIXI.Graphics();
      container.addChild(bars);

      const nameText = new PIXI.Text(o.name, {
        fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        fontSize: 11,
        fill: "#7a8ad8",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 1,
      });
      nameText.resolution = 2;
      nameText.anchor.set(0.5, 0);
      container.addChild(nameText);

      const badgeContainer = new PIXI.Container();
      badgeContainer.name = "factionBadge";
      const badgeCircle = new PIXI.Graphics();
      badgeCircle.name = "circle";
      badgeContainer.addChild(badgeCircle);
      const badgeLetter = new PIXI.Text("", {
        fontFamily: "Arial, sans-serif",
        fontSize: 8,
        fill: "#ffffff",
        fontWeight: "bold",
      });
      badgeLetter.resolution = 2;
      badgeLetter.anchor.set(0.5);
      badgeLetter.name = "letter";
      badgeContainer.addChild(badgeLetter);
      container.addChild(badgeContainer);

      playerLayer.addChild(container);
      data = { container, body, nameText, bars };
      otherPlayerSprites.set(o.id, data);
    }

    data.container.visible = true;
    data.container.position.set(o.pos.x, o.pos.y);

    // Update texture — use rotation frames if available
    const _oDir = getDirectionalTex(o.shipClass, 1, o.angle, o.id);
    if (data.body.texture !== _oDir.tex) {
      data.body.texture = _oDir.tex;
    }
    data.body.rotation = _oDir.isDirectional ? 0 : o.angle + Math.PI / 2;

    // Bars
    const hullPct = Math.max(0, o.hull / o.hullMax);
    const shieldPct = o.shield / Math.max(1, o.hullMax);
    data.bars.clear();
    data.bars.position.set(-14, -24);
    data.bars.beginFill(0x222222, 0.5);
    data.bars.drawRect(0, 0, 28, 3);
    data.bars.endFill();
    data.bars.beginFill(0x44ff66);
    data.bars.drawRect(0, 0, 28 * hullPct, 3);
    data.bars.endFill();

    // Name with rank symbol on right, white
    const oRank = rankFor(o.honor);
    data.nameText.style.fill = "#e8f0ff";
    data.nameText.text = o.name + " " + oRank.symbol;
    data.nameText.position.set(0, 24);

    // Faction badge (colored circle with letter) left of name
    const badge = data.container.getChildByName("factionBadge") as PIXI.Container;
    if (badge) {
      const oFaction = o.faction ? FACTIONS[o.faction as keyof typeof FACTIONS] : null;
      if (oFaction) {
        badge.visible = true;
        const nw = data.nameText.width;
        badge.position.set(-nw / 2 - 10, 30);
        const bCirc = badge.getChildByName("circle") as PIXI.Graphics;
        bCirc.clear();
        bCirc.beginFill(PIXI.utils.string2hex(oFaction.color));
        bCirc.drawCircle(0, 0, 6);
        bCirc.endFill();
        const bLetter = badge.getChildByName("letter") as PIXI.Text;
        bLetter.text = oFaction.tag.charAt(0);
      } else {
        badge.visible = false;
      }
    }

    const factionColor = o.faction ? FACTIONS[o.faction as keyof typeof FACTIONS]?.color ?? "#7a8ad8" : "#7a8ad8";
    // Animate body glow with faction color
    const otherGlow = data.container.getChildByName("bodyGlow") as PIXI.Sprite;
    if (otherGlow) {
      otherGlow.tint = PIXI.utils.string2hex(factionColor);
      otherGlow.alpha = 0.05 + 0.03 * Math.sin(state.tick * 2);
    }

    // Thruster trail for other players
    if (effectManager) {
      const spd = Math.sqrt(o.vel.x * o.vel.x + o.vel.y * o.vel.y);
      if (spd > 0.5) {
        const thrustColor = PIXI.utils.string2hex(factionColor);
        effectManager.spawnThrusterTrail(o.pos.x, o.pos.y, o.angle, spd, thrustColor);
      }
    }
  }

  // Remove left players
  for (const [id, data] of otherPlayerSprites) {
    if (!activeIds.has(id)) {
      playerLayer.removeChild(data.container);
      data.container.destroy({ children: true });
      otherPlayerSprites.delete(id);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// NPC SHIPS
// ══════════════════════════════════════════════════════════════════════════

function syncNpcs(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  const activeIds = new Set<string>();

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
      nameText.resolution = 2;
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
  const activeIds = new Set<string>();

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

const stationSpritesMap = new Map<string, PIXI.Container>();

function syncStations(): void {
  const zone = state.player.zone;
  const activeIds = new Set<string>();

  for (const st of STATIONS) {
    if (st.zone !== zone) continue;
    activeIds.add(st.id);

    if (stationSpritesMap.has(st.id)) {
      updateStationAnimation(stationSpritesMap.get(st.id)!, state.tick);
      continue;
    }

    const glyph = STATION_GLYPH[st.kind] || "□";
    const container = createStationVisual(st.name, st.kind, glyph);
    container.position.set(st.pos.x, st.pos.y);
    stationLayer.addChild(container);
    stationSpritesMap.set(st.id, container);
  }

  for (const [id, cont] of stationSpritesMap) {
    if (!activeIds.has(id)) {
      stationLayer.removeChild(cont);
      cont.destroy({ children: true });
      stationSpritesMap.delete(id);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PORTALS
// ══════════════════════════════════════════════════════════════════════════

const portalSpritesMap = new Map<string, PIXI.Container>();

function syncPortals(): void {
  const zone = state.player.zone;
  const activeIds = new Set<string>();

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
  const activeIds = new Set<string>();

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
      text.resolution = 2;
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
  const activeIds = new Set<string>();

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
  const activeIds = new Set<string>();

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
      label.resolution = 2;
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

const droneSprites = new Map<number, PIXI.Graphics>();

function syncDrones(): void {
  const activeIds = new Set<number>();
  if (!state.player.drones) return;

  for (let i = 0; i < state.player.drones.length; i++) {
    const d = state.player.drones[i];
    // Drone position is stored as runtime 'anchor' property, not 'pos'
    const anchor = (d as any).anchor as { x: number; y: number } | undefined;
    if (!anchor) continue;

    activeIds.add(i);

    let g = droneSprites.get(i);
    if (!g) {
      g = new PIXI.Graphics();
      playerLayer.addChild(g);
      droneSprites.set(i, g);
    }

    g.clear();
    g.visible = true;
    g.position.set(anchor.x, anchor.y);

    const def = (DRONE_DEFS as any)[(d as any).kind];
    const color = def ? PIXI.utils.string2hex(def.color) : 0x4ee2ff;
    const t = state.tick;
    const dPulse = 0.7 + 0.3 * Math.sin(t * 4 + i * 2);
    // Outer orbit ring
    g.lineStyle(0.5, color, dPulse * 0.3);
    g.drawCircle(0, 0, 9);
    // Core glow
    g.beginFill(color, dPulse * 0.15);
    g.drawCircle(0, 0, 6);
    g.endFill();
    // Body
    g.beginFill(color, 0.8);
    g.drawCircle(0, 0, 3.5);
    g.endFill();
    // Bright center
    g.beginFill(0xffffff, dPulse * 0.7);
    g.drawCircle(0, 0, 1.5);
    g.endFill();
  }

  for (const [i, g] of droneSprites) {
    if (!activeIds.has(i)) {
      playerLayer.removeChild(g);
      g.destroy();
      droneSprites.delete(i);
    }
  }
}

function clearZoneEntities(): void {
  // Clear stations
  for (const [, cont] of stationSpritesMap) {
    stationLayer.removeChild(cont);
    cont.destroy({ children: true });
  }
  stationSpritesMap.clear();

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
