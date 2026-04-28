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
  CargoBox, Drone, ZONES, STATIONS, PORTALS, DUNGEONS, SHIP_CLASSES,
  MAP_RADIUS, FACTIONS, ShipClassId, EnemyType, rankFor, Station,
  ZoneId,
} from "./types";
import {
  drawShipPixels, drawEnemy, shadeHex, drawProjectile, drawParticle,
  drawStation, drawPortal, drawAsteroid, drawCargoBox, drawFloater,
  drawOtherPlayer, drawNpcShip, drawDrone, drawShip, drawHealthBar,
  drawHullShieldBars, drawRift, px, STATION_COLOR, STATION_GLYPH,
} from "./render";
import { DEBUG_OVERLAY } from "./renderer-config";

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
let floaterLayer: PIXI.Container;
let uiLayer: PIXI.Container;

// Offscreen canvas for texture baking
let bakeCanvas: HTMLCanvasElement;
let bakeCtx: CanvasRenderingContext2D;

// ══════════════════════════════════════════════════════════════════════════
// TEXTURE CACHE
// ══════════════════════════════════════════════════════════════════════════

const texCache = new Map<string, PIXI.Texture>();

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
  const key = `ship-${shipClass}-${scale.toFixed(1)}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  const cls = SHIP_CLASSES[shipClass];
  const sz = Math.ceil(60 * scale);
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
  drawShipPixels(ctx, shipClass, c, a, hi, dk, scale);

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  texCache.set(key, tex);
  return tex;
}

function getEnemyTex(e: Enemy): PIXI.Texture {
  const varSeed = (e.id.charCodeAt(0) + e.id.charCodeAt(e.id.length - 1)) % 3;
  const key = `enemy-${e.type}-${e.color}-${e.size}-${e.isBoss ? 1 : 0}-${varSeed}`;
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
  const key = `asteroid-${a.yields}-${a.size}`;
  let tex = texCache.get(key);
  if (tex) return tex;

  const canvasSz = Math.ceil(a.size * 3) + 20;
  const c2 = document.createElement("canvas");
  c2.width = canvasSz;
  c2.height = canvasSz;
  const ctx = c2.getContext("2d")!;

  // drawAsteroid draws at a.pos, so we create a fake with pos at center
  const fakeAsteroid = { ...a, pos: { x: canvasSz / 2, y: canvasSz / 2 }, rotation: 0 };
  drawAsteroid(ctx, fakeAsteroid);

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.NEAREST });
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

// ══════════════════════════════════════════════════════════════════════════
// SPRITE POOLS
// ══════════════════════════════════════════════════════════════════════════

interface EnemySpriteData {
  container: PIXI.Container;
  body: PIXI.Sprite;
  healthBar: PIXI.Graphics;
  nameText: PIXI.Text;
  selectionRing?: PIXI.Graphics;
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
let lastPlayerShipClass: ShipClassId | null = null;

// ══════════════════════════════════════════════════════════════════════════
// BACKGROUND
// ══════════════════════════════════════════════════════════════════��═══════

type Star = { x: number; y: number; size: number; color: string; speed: number };
const STAR_LAYERS_DEF = [
  { count: 220, speed: 0.1, size: 1, color: "#3a4980" },
  { count: 130, speed: 0.3, size: 1, color: "#7a8ad8" },
  { count: 65, speed: 0.55, size: 2, color: "#e8f0ff" },
];
let stars: Star[][] = [];
let nebulae: { x: number; y: number; r: number; c: string }[] = [];
let lastZone: string = "";
let bgGraphics: PIXI.Graphics | null = null;
let starGraphics: PIXI.Graphics | null = null;

function initStars(w: number, h: number): void {
  stars = [];
  for (const layer of STAR_LAYERS_DEF) {
    const arr: Star[] = [];
    for (let i = 0; i < layer.count; i++) {
      arr.push({
        x: Math.random() * w * 2,
        y: Math.random() * h * 2,
        size: layer.size,
        color: layer.color,
        speed: layer.speed,
      });
    }
    stars.push(arr);
  }
}

function regenNebula(zone: ZoneId): void {
  nebulae = [];
  const z = ZONES[zone];
  // Match Canvas2D: 18 nebulae, random positions, zone-based colors
  for (let i = 0; i < 18; i++) {
    nebulae.push({
      x: (Math.random() - 0.5) * 6000,
      y: (Math.random() - 0.5) * 6000,
      r: 300 + Math.random() * 600,
      c: i % 2 === 0 ? z.bgHueA : z.bgHueB,
    });
  }
  // Create nebula sprites
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
  // Set global defaults for pixel-art sharpness
  PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
  PIXI.settings.ROUND_PIXELS = true;

  app = new PIXI.Application({
    resizeTo: container,
    backgroundColor: 0x020414,
    antialias: false,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  // CSS pixel-art sharpness
  const view = app.view as HTMLCanvasElement;
  view.style.imageRendering = "pixelated";
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
  floaterLayer = new PIXI.Container();
  uiLayer = new PIXI.Container();

  // World layer contains all game entities
  worldLayer.addChild(trailLayer);
  worldLayer.addChild(asteroidLayer);
  worldLayer.addChild(stationLayer);
  worldLayer.addChild(enemyLayer);
  worldLayer.addChild(playerLayer);
  worldLayer.addChild(projectileLayer);
  worldLayer.addChild(effectsLayer);
  worldLayer.addChild(floaterLayer);

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
  playerNameText = null;
  playerBars = null;
  lastPlayerShipClass = null;

  // Destroy textures
  for (const [, tex] of texCache) {
    tex.destroy(true);
  }
  texCache.clear();

  app.destroy(true, { children: true });
  app = null;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN RENDER LOOP
// ══════════════════════════════════════════════════════════════════════════

export function pixiRender(): void {
  if (!app) return;

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
  syncTrailParticles(cam, halfW, halfH);

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
  syncEffectParticles(cam, halfW, halfH);

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

  // ── Debug ───────────────────────────────────────────────────────────
  if (DEBUG_OVERLAY && debugText) {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime > 1000) {
      fps = frameCount;
      frameCount = 0;
      lastFpsTime = now;
    }
    const cam = state.player.pos;
    const zoom = state.cameraZoom;
    debugText.text = [
      `FPS: ${fps}  |  Renderer: PixiJS WebGL`,
      `Cam: ${Math.round(cam.x)},${Math.round(cam.y)} Zoom: ${zoom.toFixed(2)}`,
      `Screen: ${w}x${h} DPR: ${(app!.renderer.resolution).toFixed(1)}`,
      `Enemies: ${enemySprites.size}/${state.enemies.length}`,
      `Proj: ${projectileSprites.size}/${state.projectiles.length}  Part: ${particleSprites.size}/${state.particles.length}`,
      `Others: ${otherPlayerSprites.size}  NPCs: ${npcSprites.size}  Textures: ${texCache.size}`,
    ].join("\n");
  }
}

// ══════════════════════════════════════════════════════════════════════════
// BACKGROUND RENDERING
// ══════════════════════════════════════════════════════════════════════════

function renderBackground(w: number, h: number, cam: { x: number; y: number }): void {
  if (!bgGraphics || !starGraphics) return;

  const z = ZONES[state.player.zone];

  // Background color
  bgGraphics.clear();
  bgGraphics.beginFill(PIXI.utils.string2hex(z.bgHueB));
  bgGraphics.drawRect(0, 0, w, h);
  bgGraphics.endFill();
  // Top gradient overlay
  bgGraphics.beginFill(PIXI.utils.string2hex(z.bgHueA), 0.5);
  bgGraphics.drawRect(0, 0, w, h / 2);
  bgGraphics.endFill();

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

  // Stars (parallax layers)
  starGraphics.clear();
  if (stars.length === 0) initStars(w, h);
  for (let li = 0; li < stars.length; li++) {
    const layer = stars[li];
    const sp = STAR_LAYERS_DEF[li].speed;
    const sz = STAR_LAYERS_DEF[li].size;
    const color = PIXI.utils.string2hex(STAR_LAYERS_DEF[li].color);
    starGraphics.beginFill(color);
    for (const s of layer) {
      const sx = ((s.x - cam.x * sp) % w + w * 1.5) % w;
      const sy = ((s.y - cam.y * sp) % h + h * 1.5) % h;
      starGraphics.drawRect(sx, sy, sz, sz);
    }
    starGraphics.endFill();
  }
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
        fontFamily: "Courier New",
        fontSize: 14,
        fill: e.color,
        stroke: "#000000",
        strokeThickness: 3,
        fontWeight: "bold",
      });
      nameText.anchor.set(0.5, 1);
      container.addChild(nameText);

      enemyLayer.addChild(container);
      data = { container, body, healthBar, nameText };
      enemySprites.set(e.id, data);
    }

    // Update position & rotation
    data.container.visible = true;
    data.container.position.set(Math.round(e.pos.x), Math.round(e.pos.y));
    data.body.rotation = e.angle + Math.PI / 2;

    // Hit flash effect
    if (e.hitFlash && e.hitFlash > 0) {
      data.body.alpha = 0.7 + 0.3 * Math.sin(e.hitFlash * 10);
    } else {
      data.body.alpha = 1;
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

    // Name
    if (e.isBoss) {
      data.nameText.text = "◆ DREADNOUGHT ◆";
      data.nameText.style.fill = "#ff8a4e";
      data.nameText.position.set(0, -e.size - 18);
    } else if (e.name) {
      data.nameText.text = e.name;
      data.nameText.position.set(0, -e.size - 16);
    } else {
      data.nameText.text = "";
    }

    // Selection ring
    if (state.selectedWorldTarget?.kind === "enemy" && state.selectedWorldTarget.id === e.id) {
      if (!data.selectionRing) {
        data.selectionRing = new PIXI.Graphics();
        data.container.addChildAt(data.selectionRing, 0);
      }
      data.selectionRing.clear();
      data.selectionRing.lineStyle(3, 0xff3b4d);
      data.selectionRing.drawCircle(0, 0, e.size + 14);
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

function syncProjectiles(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  const activeIds = new Set<string>();

  for (const pr of state.projectiles) {
    if (Math.abs(pr.pos.x - cam.x) > halfW + 20 || Math.abs(pr.pos.y - cam.y) > halfH + 20) {
      activeIds.add(pr.id);
      const existing = projectileSprites.get(pr.id);
      if (existing) existing.sprite.visible = false;
      continue;
    }

    activeIds.add(pr.id);
    let data = projectileSprites.get(pr.id);

    if (!data) {
      // Bake projectile texture using existing Canvas2D code
      const canvasSz = Math.max(pr.size * 3, 30) + 20;
      const c2 = document.createElement("canvas");
      c2.width = canvasSz;
      c2.height = canvasSz;
      const ctx2d = c2.getContext("2d")!;
      const fakePr = { ...pr, pos: { x: canvasSz / 2, y: canvasSz / 2 }, vel: { x: 1, y: 0 } };
      drawProjectile(ctx2d, fakePr);
      const tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      projectileLayer.addChild(sprite);
      data = { sprite };
      projectileSprites.set(pr.id, data);
    }

    data.sprite.visible = true;
    data.sprite.position.set(pr.pos.x, pr.pos.y);
    data.sprite.rotation = Math.atan2(pr.vel.y, pr.vel.x);
  }

  // Remove dead projectiles
  for (const [id, data] of projectileSprites) {
    if (!activeIds.has(id)) {
      projectileLayer.removeChild(data.sprite);
      data.sprite.destroy();
      projectileSprites.delete(id);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PARTICLE SYNC
// ══════════════════════════════════════════════════════════════════════════

function syncTrailParticles(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  // Trails are rendered in trailLayer
  const activeIds = new Set<string>();

  for (const pa of state.particles) {
    if (pa.kind !== "trail" && pa.kind !== "engine") continue;
    if (Math.abs(pa.pos.x - cam.x) > halfW + 30 || Math.abs(pa.pos.y - cam.y) > halfH + 30) continue;

    activeIds.add(pa.id);
    let data = particleSprites.get(pa.id);

    if (!data) {
      const tex = getGlowTex(Math.max(4, Math.ceil(pa.size * 2)));
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.blendMode = PIXI.BLEND_MODES.ADD;
      trailLayer.addChild(sprite);
      data = { sprite };
      particleSprites.set(pa.id, data);
    }

    const a = Math.max(0, Math.min(1, pa.ttl / pa.maxTtl));
    const baseAlpha = pa.alpha ?? 1;
    data.sprite.visible = true;
    data.sprite.position.set(pa.pos.x, pa.pos.y);
    data.sprite.alpha = a * a * 0.6 * baseAlpha;
    data.sprite.tint = PIXI.utils.string2hex(pa.color);
    data.sprite.scale.set(a * pa.size / Math.max(4, Math.ceil(pa.size * 2)));
  }
}

function syncEffectParticles(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  const activeIds = new Set<string>();

  for (const pa of state.particles) {
    if (pa.kind === "trail" || pa.kind === "engine") continue;
    if (Math.abs(pa.pos.x - cam.x) > halfW + pa.size || Math.abs(pa.pos.y - cam.y) > halfH + pa.size) continue;

    const key = `fx-${pa.id}`;
    activeIds.add(key);
    let data = particleSprites.get(key);

    if (!data) {
      const r = Math.max(4, Math.ceil(pa.size));
      const tex = getGlowTex(r);
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
    data.sprite.tint = PIXI.utils.string2hex(pa.color);

    const r = Math.max(4, Math.ceil(pa.size));
    if (pa.kind === "ring") {
      const t = 1 - a;
      data.sprite.alpha = a * 0.8;
      data.sprite.scale.set(t * pa.size / r);
    } else if (pa.kind === "flash") {
      const t = 1 - a;
      data.sprite.alpha = a * a * 0.9;
      data.sprite.scale.set(pa.size * (0.3 + t * 0.7) / r);
    } else if (pa.kind === "fireball") {
      const t = 1 - a;
      data.sprite.alpha = a * 0.85;
      data.sprite.scale.set(pa.size * (0.3 + t * 0.85) / r);
    } else if (pa.kind === "spark") {
      data.sprite.alpha = a * 0.9;
      data.sprite.scale.set(a * pa.size / r);
    } else if (pa.kind === "debris") {
      data.sprite.alpha = a * 0.7;
      data.sprite.scale.set(pa.size / r);
    } else if (pa.kind === "smoke") {
      data.sprite.alpha = a * 0.4;
      data.sprite.scale.set(pa.size * (1 + (1 - a) * 0.5) / r);
    } else if (pa.kind === "ember") {
      data.sprite.alpha = a * a;
      data.sprite.scale.set(a * pa.size / r);
    } else {
      data.sprite.alpha = a;
      data.sprite.scale.set(a * pa.size / r);
    }
    if (pa.rot !== undefined) {
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
    playerBody = new PIXI.Sprite(getShipTex(p.shipClass, 1));
    playerBody.anchor.set(0.5);
    playerContainer.addChild(playerBody);

    playerBars = new PIXI.Graphics();
    playerContainer.addChild(playerBars);

    const rank = rankFor(p.honor);
    playerNameText = new PIXI.Text(p.name, {
      fontFamily: "Courier New",
      fontSize: 13,
      fill: "#e8f0ff",
      stroke: "#000000",
      strokeThickness: 2,
      fontWeight: "bold",
    });
    playerNameText.anchor.set(0.5, 0);
    playerContainer.addChild(playerNameText);

    playerLayer.addChild(playerContainer);
    lastPlayerShipClass = p.shipClass;
  }

  // Update ship texture if class changed
  if (lastPlayerShipClass !== p.shipClass) {
    playerBody!.texture = getShipTex(p.shipClass, 1);
    lastPlayerShipClass = p.shipClass;
  }

  playerContainer.visible = true;

  // Shield ring
  if (p.shield > 0) {
    if (!playerContainer.getChildByName("shieldRing")) {
      const ring = new PIXI.Graphics();
      ring.name = "shieldRing";
      playerContainer.addChildAt(ring, 0);
    }
    const ring = playerContainer.getChildByName("shieldRing") as PIXI.Graphics;
    ring.clear();
    ring.lineStyle(2, 0x4ee2ff, 0.3 + 0.3 * Math.sin(state.tick * 4));
    ring.drawCircle(0, 0, 22);
    ring.visible = true;
  } else {
    const ring = playerContainer.getChildByName("shieldRing") as PIXI.Graphics;
    if (ring) ring.visible = false;
  }
  playerContainer.position.set(Math.round(p.pos.x), Math.round(p.pos.y));
  playerBody!.rotation = p.angle + Math.PI / 2;

  // Hull/Shield bars
  const es = effectiveStats();
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

  // Name
  playerNameText!.position.set(0, 30);
  playerNameText!.text = p.name;
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
      const body = new PIXI.Sprite(getShipTex(o.shipClass, 1));
      body.anchor.set(0.5);
      container.addChild(body);

      const bars = new PIXI.Graphics();
      container.addChild(bars);

      const nameText = new PIXI.Text(o.name, {
        fontFamily: "Courier New",
        fontSize: 11,
        fill: "#7a8ad8",
        stroke: "#000000",
        strokeThickness: 2,
        fontWeight: "bold",
      });
      nameText.anchor.set(0.5, 0);
      container.addChild(nameText);

      playerLayer.addChild(container);
      data = { container, body, nameText, bars };
      otherPlayerSprites.set(o.id, data);
    }

    data.container.visible = true;
    data.container.position.set(Math.round(o.pos.x), Math.round(o.pos.y));
    data.body.rotation = o.angle + Math.PI / 2;

    // Update texture if ship class changed
    const expectedTex = getShipTex(o.shipClass, 1);
    if (data.body.texture !== expectedTex) {
      data.body.texture = expectedTex;
    }

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

    // Name with faction color
    const factionColor = o.faction ? FACTIONS[o.faction as keyof typeof FACTIONS]?.color ?? "#7a8ad8" : "#7a8ad8";
    data.nameText.style.fill = factionColor;
    data.nameText.text = o.name;
    data.nameText.position.set(0, 24);
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
        fontFamily: "Courier New",
        fontSize: 10,
        fill: npc.color,
        stroke: "#000000",
        strokeThickness: 2,
      });
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

const asteroidSprites = new Map<string, PIXI.Sprite>();

function syncAsteroids(cam: { x: number; y: number }, halfW: number, halfH: number): void {
  const activeIds = new Set<string>();

  for (const a of state.asteroids) {
    if (a.zone !== state.player.zone) continue;
    if (Math.abs(a.pos.x - cam.x) > halfW + a.size || Math.abs(a.pos.y - cam.y) > halfH + a.size) continue;

    activeIds.add(a.id);
    let sprite = asteroidSprites.get(a.id);

    if (!sprite) {
      const tex = getAsteroidTex(a);
      sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      asteroidLayer.addChild(sprite);
      asteroidSprites.set(a.id, sprite);
    }

    sprite.visible = true;
    sprite.position.set(a.pos.x, a.pos.y);
    sprite.rotation = a.rotation;
  }

  for (const [id, sprite] of asteroidSprites) {
    if (!activeIds.has(id)) {
      asteroidLayer.removeChild(sprite);
      sprite.destroy();
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

    if (stationSpritesMap.has(st.id)) continue;

    // Create station visual using Canvas2D texture baking
    const container = new PIXI.Container();
    container.position.set(st.pos.x, st.pos.y);

    // Bake station body texture using existing Canvas2D code
    const canvasSz = 220;
    const c2 = document.createElement("canvas");
    c2.width = canvasSz;
    c2.height = canvasSz;
    const ctx2d = c2.getContext("2d")!;
    // drawStation draws at x,y so center it
    drawStation(ctx2d, canvasSz / 2, canvasSz / 2, "", st.kind, 0, st);
    const tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
    const stBody = new PIXI.Sprite(tex);
    stBody.anchor.set(0.5);
    container.addChild(stBody);

    // Station name (separate so it stays crisp)
    const accent = STATION_COLOR[st.kind] || "#4ee2ff";
    const stName = new PIXI.Text(st.name, {
      fontFamily: "Courier New",
      fontSize: 16,
      fill: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
      fontWeight: "bold",
    });
    stName.anchor.set(0.5, 1);
    stName.position.set(0, -68);
    container.addChild(stName);

    // Station kind label
    const glyph = STATION_GLYPH[st.kind] || "□";
    const kindLabel = new PIXI.Text(`${glyph} ${st.kind.toUpperCase()}`, {
      fontFamily: "Courier New",
      fontSize: 12,
      fill: accent,
      stroke: "#000000",
      strokeThickness: 2,
      fontWeight: "bold",
    });
    kindLabel.anchor.set(0.5, 1);
    kindLabel.position.set(0, -48);
    container.addChild(kindLabel);

    // Dock label
    const dockLabel = new PIXI.Text("[ DOCK ]", {
      fontFamily: "Courier New",
      fontSize: 12,
      fill: accent,
      stroke: "#000000",
      strokeThickness: 2,
      fontWeight: "bold",
    });
    dockLabel.anchor.set(0.5, 0);
    dockLabel.position.set(0, 72);
    container.addChild(dockLabel);

    stationLayer.addChild(container);
    stationSpritesMap.set(st.id, container);
  }

  // Remove old stations
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
      // Update animation
      const cont = portalSpritesMap.get(key)!;
      const ring = cont.getChildAt(0) as PIXI.Graphics;
      ring.clear();
      ring.lineStyle(2, 0x4ee2ff, 0.6 + 0.2 * Math.sin(state.tick * 3));
      ring.drawCircle(0, 0, 16);
      ring.lineStyle(1, 0x4ee2ff, 0.3);
      ring.drawCircle(0, 0, 22);
      continue;
    }

    const container = new PIXI.Container();
    container.position.set(po.pos.x, po.pos.y);

    const ring = new PIXI.Graphics();
    ring.lineStyle(2, 0x4ee2ff, 0.6);
    ring.drawCircle(0, 0, 16);
    container.addChild(ring);

    const label = new PIXI.Text(ZONES[po.toZone].name, {
      fontFamily: "Courier New",
      fontSize: 9,
      fill: "#4ee2ff",
      stroke: "#000000",
      strokeThickness: 2,
    });
    label.anchor.set(0.5, 0);
    label.position.set(0, 26);
    container.addChild(label);

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
        fontFamily: "Courier New",
        fontSize: f.bold ? 16 : 12,
        fill: f.color,
        stroke: "#000000",
        strokeThickness: 2,
        fontWeight: f.bold ? "bold" : "normal",
      });
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

  // Impact point
  miningLaserGraphics.lineStyle(0);
  miningLaserGraphics.beginFill(0xffffff, 0.9);
  miningLaserGraphics.drawCircle(ta.pos.x, ta.pos.y, 3 + pulse * 2);
  miningLaserGraphics.endFill();

  // Impact ring
  const ringR = 6 + pulse * 4 + Math.sin(t * 20) * 2;
  miningLaserGraphics.lineStyle(1.5, 0x44ffcc, 0.5 + 0.3 * Math.sin(t * 15));
  miningLaserGraphics.drawCircle(ta.pos.x, ta.pos.y, ringR);
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
        fontFamily: "Courier New",
        fontSize: 10,
        fill: d.color,
        stroke: "#000000",
        strokeThickness: 2,
      });
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
    ring.lineStyle(active ? 3 : 2, color, pulse);
    ring.drawCircle(0, 0, 14);
    ring.lineStyle(1, color, pulse * 0.5);
    ring.drawCircle(0, 0, 20);
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
  for (let i = 0; i < state.player.drones.length; i++) {
    const d = state.player.drones[i];
    activeIds.add(i);

    let g = droneSprites.get(i);
    if (!g) {
      g = new PIXI.Graphics();
      playerLayer.addChild(g);
      droneSprites.set(i, g);
    }

    g.clear();
    g.position.set(d.pos.x, d.pos.y);

    // Simple drone shape
    const color = 0x4ee2ff;
    g.beginFill(color, 0.8);
    g.drawCircle(0, 0, 4);
    g.endFill();
    g.lineStyle(1, color, 0.5);
    g.drawCircle(0, 0, 7);
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
