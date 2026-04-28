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
  Enemy, Projectile, Particle, Floater, NpcShip, OtherPlayer, Asteroid,
  CargoBox, Drone, ZONES, STATIONS, PORTALS, DUNGEONS, SHIP_CLASSES,
  MAP_RADIUS, FACTIONS, ShipClassId, EnemyType, rankFor, Station,
  ZoneId,
} from "./types";
import {
  drawShipPixels, drawEnemy, shadeHex, drawProjectile, drawParticle,
  drawStation, drawPortal, drawAsteroid, drawCargoBox, drawFloater,
  drawOtherPlayer, drawNpcShip, drawDrone, drawShip, drawHealthBar,
  drawHullShieldBars, drawRift,
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

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
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
  drawEnemy(ctx, fakeEnemy);

  state.selectedWorldTarget = savedTarget;

  tex = PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR });
  texCache.set(key, tex);
  return tex;
}

// Simple circle texture for particles
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
  const seed = zone.charCodeAt(0) * 137;
  for (let i = 0; i < 5; i++) {
    const rx = ((seed * (i + 1) * 7919) % 10000) / 10000;
    const ry = ((seed * (i + 1) * 104729) % 10000) / 10000;
    const rr = ((seed * (i + 1) * 3571) % 10000) / 10000;
    const colors = ["#4ee2ff", "#ff5cf0", "#ffd24a", "#5cff8a", "#7a8ad8"];
    nebulae.push({
      x: (rx - 0.5) * 4000,
      y: (ry - 0.5) * 4000,
      r: 80 + rr * 200,
      c: colors[i % colors.length],
    });
  }
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
  app = new PIXI.Application({
    resizeTo: container,
    backgroundColor: 0x020414,
    antialias: false,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  container.appendChild(app.view as HTMLCanvasElement);

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
    debugText.text = [
      `FPS: ${fps}`,
      `Enemies: ${enemySprites.size}/${state.enemies.length}`,
      `Projectiles: ${projectileSprites.size}/${state.projectiles.length}`,
      `Particles: ${particleSprites.size}/${state.particles.length}`,
      `Others: ${otherPlayerSprites.size}/${state.others.length}`,
      `Textures: ${texCache.size}`,
    ].join("\n");
  }
}

// ══════════════════════════════════════════════════════════════════════════
// BACKGROUND RENDERING
// ══════════════════════════════════════════════════════════════════════════

function renderBackground(w: number, h: number, cam: { x: number; y: number }): void {
  if (!bgGraphics || !starGraphics) return;

  const z = ZONES[state.player.zone];

  // Gradient background
  bgGraphics.clear();
  // Use solid color approximation (PixiJS doesn't have CSS-style gradients easily)
  bgGraphics.beginFill(PIXI.utils.string2hex(z.bgHueB));
  bgGraphics.drawRect(0, 0, w, h);
  bgGraphics.endFill();

  // Nebulae (parallax, behind everything)
  for (const n of nebulae) {
    const nsx = w / 2 + (n.x - cam.x * 0.05);
    const nsy = h / 2 + (n.y - cam.y * 0.05);
    if (nsx < -n.r || nsx > w + n.r || nsy < -n.r || nsy > h + n.r) continue;
    bgGraphics.beginFill(PIXI.utils.string2hex(n.c), 0.2);
    bgGraphics.drawCircle(nsx, nsy, n.r);
    bgGraphics.endFill();
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
        fontSize: 11,
        fill: e.color,
        stroke: "#000000",
        strokeThickness: 2,
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
    data.container.position.set(e.pos.x, e.pos.y);
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
      const tex = getGlowTex(Math.max(pr.size, 4));
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      projectileLayer.addChild(sprite);
      data = { sprite };
      projectileSprites.set(pr.id, data);
    }

    data.sprite.visible = true;
    data.sprite.position.set(pr.pos.x, pr.pos.y);
    data.sprite.rotation = Math.atan2(pr.vel.y, pr.vel.x);
    data.sprite.tint = PIXI.utils.string2hex(pr.color);
    data.sprite.scale.set(pr.size / 6);
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
      const tex = getCircleTex(Math.max(2, Math.ceil(pa.size)));
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      trailLayer.addChild(sprite);
      data = { sprite };
      particleSprites.set(pa.id, data);
    }

    const a = Math.max(0, Math.min(1, pa.ttl / pa.maxTtl));
    const baseAlpha = pa.alpha ?? 1;
    data.sprite.visible = true;
    data.sprite.position.set(pa.pos.x, pa.pos.y);
    data.sprite.alpha = a * a * 0.5 * baseAlpha;
    data.sprite.tint = PIXI.utils.string2hex(pa.color);
    data.sprite.scale.set(a * pa.size / Math.max(2, Math.ceil(pa.size)));
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
      const r = Math.max(3, Math.ceil(pa.size));
      const tex = pa.kind === "ring" ? getCircleTex(r) : getGlowTex(r);
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      effectsLayer.addChild(sprite);
      data = { sprite };
      particleSprites.set(key, data);
    }

    const a = Math.max(0, Math.min(1, pa.ttl / pa.maxTtl));
    data.sprite.visible = true;
    data.sprite.position.set(pa.pos.x, pa.pos.y);
    data.sprite.tint = PIXI.utils.string2hex(pa.color);

    if (pa.kind === "ring") {
      const t = 1 - a;
      data.sprite.alpha = a * 0.9;
      data.sprite.scale.set(t * pa.size / Math.max(3, Math.ceil(pa.size)));
    } else if (pa.kind === "flash" || pa.kind === "fireball") {
      const t = 1 - a;
      const sz = pa.size * (0.2 + t * 0.8);
      data.sprite.alpha = a * a;
      data.sprite.scale.set(sz / Math.max(3, Math.ceil(pa.size)));
    } else {
      // spark, debris, smoke, ember
      data.sprite.alpha = a;
      data.sprite.scale.set(a * pa.size / Math.max(3, Math.ceil(pa.size)));
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
  playerContainer.position.set(p.pos.x, p.pos.y);
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
    data.container.position.set(o.pos.x, o.pos.y);
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
      const tex = getCircleTex(Math.max(4, a.size));
      sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.tint = 0x888888;
      asteroidLayer.addChild(sprite);
      asteroidSprites.set(a.id, sprite);
    }

    sprite.visible = true;
    sprite.position.set(a.pos.x, a.pos.y);
    sprite.rotation = a.rotation;
    sprite.scale.set(a.size / Math.max(4, a.size));
    sprite.alpha = 0.8;
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

    // Create station visual
    const container = new PIXI.Container();
    container.position.set(st.pos.x, st.pos.y);

    // Station body - hexagonal shape
    const g = new PIXI.Graphics();
    g.lineStyle(2, 0x4ee2ff, 0.8);
    g.beginFill(0x1a2040, 0.6);
    const r = 22;
    g.drawRegularPolygon?.(0, 0, r, 6) ??
      (() => {
        g.moveTo(r, 0);
        for (let i = 1; i <= 6; i++) {
          const angle = (i * Math.PI * 2) / 6;
          g.lineTo(r * Math.cos(angle), r * Math.sin(angle));
        }
        g.closePath();
      })();
    g.endFill();
    container.addChild(g);

    // Station name
    const nameText = new PIXI.Text(st.name, {
      fontFamily: "Courier New",
      fontSize: 10,
      fill: "#4ee2ff",
      stroke: "#000000",
      strokeThickness: 2,
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(0, r + 4);
    container.addChild(nameText);

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

  // Clear texture cache for zone-specific textures
  // (enemies may have different colors in different zones)
}
