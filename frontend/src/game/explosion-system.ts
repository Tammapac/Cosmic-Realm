/**
 * ExplosionSystem — layered, pooled explosion VFX for Cosmic Realm.
 *
 * Replaces the previous per-event AnimatedSprite explosions (unpooled,
 * ticker-coupled) and the Starblast GPU point-mesh at explosion call
 * sites. One explosion is a composition of nine independent layers, each
 * with its own texture, blend mode, timing curve and world-layer slot:
 *
 *   effectsBehindLayer   ambient light flash, smoke, embers
 *   effectsLayer         flipbook fireball, ring, debris
 *   effectsFrontLayer    core flash, shockwave, sparks
 *
 * All three containers are children of worldLayer, so world coordinates
 * and the camera transform (pivot/zoom on worldLayer) apply automatically,
 * and everything draws above ships/projectiles but under floaters/UI.
 *
 * Pooling: every layer role has a fixed-size pool of PIXI.Sprites that
 * are created once, permanently parented to their container, and toggled
 * via `visible`. Spawning after warm-up allocates nothing; expired
 * particles return to the free list automatically in update(). Boss
 * multi-bursts are scheduled through a reused pending queue — no
 * setTimeout, no closures, no leaks.
 *
 * The flipbook reuses the two existing explosion sheets
 * (/explosion-spritesheet.png, /explosion-spritesheet-2.png) with the
 * exact slicing and frame order of the previous implementation
 * (8 cols x 6 rows of 256px, row-major). Frames are advanced manually
 * from update(dt), so playback is framerate-independent and the sprite
 * itself pools like any other.
 */
import * as PIXI from "pixi.js";
import { state } from "./store";

// ── Quality: decided once at module init. Mobile GPUs choke on many
// overlapping additive quads long before they run out of sprite count,
// so particle counts and the pool cap both scale down.
const QUALITY: number = (() => {
  const cores = navigator.hardwareConcurrency ?? 8;
  const touch = (navigator.maxTouchPoints ?? 0) > 0;
  if (cores <= 4 || (touch && cores <= 6)) return 0.55;
  return 1;
})();

// ══════════════════════════════════════════════════════════════════════════
// SHARED FLIPBOOK FRAMES (module singleton — loaded once, shared by the
// world instance and the debug instance)
// ══════════════════════════════════════════════════════════════════════════

const flipbookSets: PIXI.Texture[][] = [];
let flipbookLoadStarted = false;

function ensureFlipbookLoaded(): void {
  if (flipbookLoadStarted) return;
  flipbookLoadStarted = true;
  // Same sheets, same 8x6 @256px row-major slicing as the previous
  // implementation — frame order deliberately unchanged.
  const sheets = ["/explosion-spritesheet.png", "/explosion-spritesheet-2.png"];
  for (const src of sheets) {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const baseTex = PIXI.Texture.from(img);
      const cols = 8, rows = 6, fw = 256, fh = 256;
      const frames: PIXI.Texture[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          frames.push(new PIXI.Texture({ source: baseTex.source, frame: new PIXI.Rectangle(c * fw, r * fh, fw, fh) }));
        }
      }
      flipbookSets.push(frames);
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PROCEDURAL TEXTURES (canvas-drawn once, cached at module level)
// ══════════════════════════════════════════════════════════════════════════

const texCache = new Map<string, PIXI.Texture>();

function cachedTex(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): PIXI.Texture {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  t = PIXI.Texture.from(c);
  (t.source as PIXI.TextureSource).scaleMode = "linear";
  texCache.set(key, t);
  return t;
}

/** Soft radial glow — core flash and ambient light. White so tint works. */
function glowTex(): PIXI.Texture {
  return cachedTex("exp-glow", 128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/**
 * Organic soft ring. Not a stroked circle: the ring path is built from 64
 * points whose radius is modulated by three random-phase sine harmonics,
 * and the band itself is a soft radial gradient, so the edge wobbles and
 * feathers like a combustion front instead of reading as a CSS border.
 * A handful of variants are cached so consecutive explosions differ.
 */
function ringTex(variant: number): PIXI.Texture {
  return cachedTex(`exp-ring-${variant}`, 256, (ctx, s) => {
    const cx = s / 2, cy = s / 2;
    const p1 = Math.random() * Math.PI * 2;
    const p2 = Math.random() * Math.PI * 2;
    const p3 = Math.random() * Math.PI * 2;
    // Soft band gradient: transparent -> peak at 72% radius -> transparent.
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s / 2);
    g.addColorStop(0.45, "rgba(255,255,255,0)");
    g.addColorStop(0.66, "rgba(255,255,255,0.75)");
    g.addColorStop(0.74, "rgba(255,255,255,1)");
    g.addColorStop(0.84, "rgba(255,255,255,0.4)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    // Clip the gradient through a wobbled annulus so the band's silhouette
    // is irregular (±7% radius noise, 3 harmonics).
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const wob = 1 + 0.05 * Math.sin(3 * a + p1) + 0.035 * Math.sin(5 * a + p2) + 0.02 * Math.sin(8 * a + p3);
      const r = (s / 2) * wob * 0.96;
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.clip();
    ctx.fillRect(0, 0, s, s);
  });
}

/** Very wide, very soft band — the transparent shockwave. Tinted cold. */
function shockTex(): PIXI.Texture {
  return cachedTex("exp-shock", 256, (ctx, s) => {
    const cx = s / 2, cy = s / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s / 2);
    g.addColorStop(0.3, "rgba(255,255,255,0)");
    g.addColorStop(0.62, "rgba(255,255,255,0.35)");
    g.addColorStop(0.78, "rgba(255,255,255,0.55)");
    g.addColorStop(0.95, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Elongated streak for sparks — rotated to the particle's velocity. */
function sparkTex(): PIXI.Texture {
  return cachedTex("exp-spark", 64, (ctx, s) => {
    const g = ctx.createLinearGradient(0, s / 2, s, s / 2);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.25, "rgba(255,255,255,0.9)");
    g.addColorStop(0.6, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, s / 2 - 2.5, s, 5);
  });
}

/** Irregular dark polygon silhouette — hull debris. Several variants. */
function debrisTex(variant: number): PIXI.Texture {
  return cachedTex(`exp-debris-${variant}`, 32, (ctx, s) => {
    const cx = s / 2, cy = s / 2;
    const verts = 4 + Math.floor(Math.random() * 3);
    ctx.fillStyle = "#ffffff"; // white; tinted dark at spawn time
    ctx.beginPath();
    for (let i = 0; i < verts; i++) {
      const a = (i / verts) * Math.PI * 2 + Math.random() * 0.6;
      const r = (s / 2 - 2) * (0.5 + Math.random() * 0.5);
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
}

/** Soft blotchy puff for smoke — three offset gradients, not one circle. */
function smokeTex(variant: number): PIXI.Texture {
  return cachedTex(`exp-smoke-${variant}`, 128, (ctx, s) => {
    for (let i = 0; i < 3; i++) {
      const ox = s / 2 + (Math.random() - 0.5) * s * 0.3;
      const oy = s / 2 + (Math.random() - 0.5) * s * 0.3;
      const r = s * (0.25 + Math.random() * 0.18);
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
      g.addColorStop(0, "rgba(255,255,255,0.5)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// PARTICLE + PRESETS
// ══════════════════════════════════════════════════════════════════════════

/** Layer roles — also the unit of isolation for the debug view. */
export const EXPLOSION_LAYERS = [
  "coreFlash",   // 1 very short white-yellow pop            (front, ADD)
  "flipbook",    // 2 main animated explosion                (mid,   ADD)
  "ring",        // 3 expanding combustion ring              (mid,   ADD)
  "shockwave",   // 4 transparent cold pressure wave         (front, NORMAL)
  "sparks",      // 5 radial streaks                         (front, ADD)
  "fireTrails",  // 6 flying embers that leave a fire trail  (front, ADD)
  "debris",      // 7 dark rotating fragments                (mid,   NORMAL)
  "embers",      // 8 slow-fading glow motes                 (behind, ADD)
  "smoke",       // 9 growing grey puffs                     (behind, NORMAL)
  "light",       // 0 brief ambient illumination             (behind, ADD)
] as const;
export type ExplosionLayer = (typeof EXPLOSION_LAYERS)[number];

// "fireTrail" heads stamp short-lived "trailPuff" glows along their path.
type Behavior = ExplosionLayer | "fireTrail" | "trailPuff";

interface ExpParticle {
  active: boolean;
  sprite: PIXI.Sprite;
  behavior: Behavior;
  life: number;
  maxLife: number;
  x: number; y: number;
  vx: number; vy: number;
  drag: number;
  baseScale: number;      // sprite scale at t=0 (sign-less)
  endScale: number;       // sprite scale at t=maxLife
  flipX: number; flipY: number; // ±1 random mirroring
  spin: number;           // rad/s
  startAlpha: number;
  frames: PIXI.Texture[] | null; // flipbook only
  trailTimer: number;     // fireTrail heads: countdown to next puff stamp
}

export type ExplosionPreset = "smallHit" | "enemyExplosion" | "bossExplosion";

interface PresetCfg {
  radius: number;        // world-unit visual radius of the fireball
  flashLife: number;
  flipbooks: number;     // overlapping flipbook instances (volume)
  animLife: number;
  ringLife: number;
  shockLife: number;
  sparks: number; sparkLife: number;
  fireTrails: number;    // ember heads that leave a fire trail behind
  debris: number; debrisLife: number;
  embers: number; smoke: number; smokeLife: number;
  lightScale: number; lightAlpha: number; lightLife: number;
  shake: number;         // written to state.cameraShake (0 = none)
  subBursts: number;     // boss: staggered secondary explosions
}

const PRESETS: Record<ExplosionPreset, PresetCfg> = {
  smallHit: {
    radius: 34,
    flashLife: 0.1, flipbooks: 1, animLife: 0.62, ringLife: 0.4, shockLife: 0.45,
    sparks: 9, sparkLife: 0.6,
    fireTrails: 2,
    debris: 4, debrisLife: 1.2,
    embers: 4, smoke: 2, smokeLife: 1.2,
    lightScale: 2.0, lightAlpha: 0.2, lightLife: 0.2,
    shake: 0, subBursts: 0,
  },
  enemyExplosion: {
    radius: 95,
    flashLife: 0.14, flipbooks: 2, animLife: 0.95, ringLife: 0.65, shockLife: 0.75,
    sparks: 24, sparkLife: 1.1,
    fireTrails: 5,
    debris: 12, debrisLife: 2.2,
    embers: 10, smoke: 8, smokeLife: 2.4,
    lightScale: 2.8, lightAlpha: 0.34, lightLife: 0.3,
    shake: 0.35, subBursts: 0,
  },
  bossExplosion: {
    radius: 200,
    flashLife: 0.18, flipbooks: 3, animLife: 1.15, ringLife: 0.85, shockLife: 1.0,
    sparks: 36, sparkLife: 1.4,
    fireTrails: 9,
    debris: 20, debrisLife: 3.0,
    embers: 14, smoke: 14, smokeLife: 3.2,
    lightScale: 3.2, lightAlpha: 0.45, lightLife: 0.4,
    shake: 1, subBursts: 6,
  },
};

// Two-temperature palette: warm fire family, one cold layer.
const COLOR_FLASH_CORE = 0xffffff;
const COLOR_FLASH_HALO = 0xffe9a8;
const COLOR_RING = 0xffd9a0;
const COLOR_SHOCK = 0x9fc2ff;   // the cold signature layer
const COLOR_SPARKS = [0xffe9a8, 0xffb347, 0xff9040];
const COLOR_EMBERS = [0xffb347, 0xff7a2f, 0xff9955];
const COLOR_DEBRIS = [0x39404e, 0x2e3440, 0x4a5162];
const COLOR_SMOKE = 0x98a1b3;
const COLOR_LIGHT = 0xffc98a;

interface PendingBurst {
  active: boolean;
  delay: number;
  preset: ExplosionPreset;
  x: number; y: number;
  sizeScale: number;
}

// ══════════════════════════════════════════════════════════════════════════
// SYSTEM
// ══════════════════════════════════════════════════════════════════════════

export class ExplosionSystem {
  private behind: PIXI.Container;
  private mid: PIXI.Container;
  private front: PIXI.Container;

  // One pool per target container so each sprite can stay permanently
  // parented (re-parenting per spawn would defeat the pool).
  private pools: Record<"behind" | "mid" | "front", ExpParticle[]> = {
    behind: [], mid: [], front: [],
  };
  private activeCount = 0;
  private readonly maxActive = Math.round(950 * QUALITY);

  // Reused scheduler slots for boss sub-bursts (no setTimeout).
  private pending: PendingBurst[] = Array.from({ length: 16 }, () => ({
    active: false, delay: 0, preset: "enemyExplosion" as ExplosionPreset, x: 0, y: 0, sizeScale: 1,
  }));

  /** When false (debug isolation), spawn() never writes camera shake. */
  allowShake = true;

  constructor(behind: PIXI.Container, mid: PIXI.Container, front: PIXI.Container) {
    this.behind = behind;
    this.mid = mid;
    this.front = front;
    ensureFlipbookLoaded();
    // Pre-build texture variants so nothing is canvas-rendered mid-combat.
    glowTex(); shockTex(); sparkTex();
    for (let i = 0; i < 4; i++) { ringTex(i); debrisTex(i); smokeTex(i); }
  }

  // ── pooling ─────────────────────────────────────────────────────────────

  private acquire(slot: "behind" | "mid" | "front"): ExpParticle | null {
    if (this.activeCount >= this.maxActive) return null;
    const pool = this.pools[slot];
    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].active) {
        pool[i].active = true;
        pool[i].sprite.visible = true;
        this.activeCount++;
        return pool[i];
      }
    }
    const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    sprite.anchor.set(0.5);
    sprite.visible = true;
    (slot === "behind" ? this.behind : slot === "mid" ? this.mid : this.front).addChild(sprite);
    const p: ExpParticle = {
      active: true, sprite, behavior: "sparks", life: 0, maxLife: 1,
      x: 0, y: 0, vx: 0, vy: 0, drag: 0,
      baseScale: 1, endScale: 1, flipX: 1, flipY: 1, spin: 0,
      startAlpha: 1, frames: null, trailTimer: 0,
    };
    pool.push(p);
    this.activeCount++;
    return p;
  }

  private release(p: ExpParticle): void {
    p.active = false;
    p.frames = null;
    p.sprite.visible = false;
    this.activeCount--;
  }

  // ── public API ──────────────────────────────────────────────────────────

  /**
   * Spawn a full layered explosion. `sizeScale` scales the preset's radius
   * (e.g. enemy size / 18); shake can be suppressed per call.
   */
  spawn(preset: ExplosionPreset, x: number, y: number, opts?: { sizeScale?: number; shake?: boolean }): void {
    const cfg = PRESETS[preset];
    const s = opts?.sizeScale ?? 1;
    this.burst(cfg, x, y, s, opts?.shake !== false);
    // Boss: staggered secondary bursts ripple outward over ~0.7s so scale
    // is communicated through rhythm, not just size.
    for (let i = 0; i < cfg.subBursts; i++) {
      const slot = this.pending.find((b) => !b.active);
      if (!slot) break;
      slot.active = true;
      slot.delay = 0.09 + i * 0.15 + Math.random() * 0.08;
      slot.preset = "enemyExplosion";
      const a = Math.random() * Math.PI * 2;
      const d = cfg.radius * s * (0.3 + Math.random() * 0.45);
      slot.x = x + Math.cos(a) * d;
      slot.y = y + Math.sin(a) * d;
      slot.sizeScale = s * (0.35 + Math.random() * 0.2) * (cfg.radius / PRESETS.enemyExplosion.radius);
    }
  }

  /** Debug helper: spawn only one layer of a preset, at full strength. */
  spawnLayerOnly(layer: ExplosionLayer, preset: ExplosionPreset, x: number, y: number): void {
    const cfg = PRESETS[preset];
    this.burst(cfg, x, y, 1, false, layer);
  }

  /**
   * Directional ship-hit impact — a shot striking a hull, NOT a small
   * explosion. `shotAngle` is the projectile's travel direction (radians).
   * Two spark families sell the impact:
   *   - ricochet: most sparks bounce BACK off the hull in a wide cone
   *     around the reversed shot direction (as if deflected by armor)
   *   - punch-through spread: a few faster, dimmer sparks continue in a
   *     narrow cone along the original shot direction
   * plus a tiny impact flash and a couple of drifting ember motes.
   * No ring, shockwave, flipbook, smoke, debris or shake.
   */
  spawnShipHit(x: number, y: number, shotAngle: number, sizeScale = 1): void {
    const R = 20 * sizeScale;
    const q = QUALITY;

    // Impact flash — small and fast, just marks the contact point.
    const flash = this.acquire("front");
    if (flash) {
      this.initP(flash, "coreFlash", x, y, 0.07);
      flash.sprite.texture = glowTex();
      flash.sprite.tint = COLOR_FLASH_HALO;
      flash.sprite.blendMode = "add";
      flash.baseScale = (R * 1.2) / 128;
      flash.endScale = (R * 2.0) / 128;
      flash.startAlpha = 0.9;
      this.prime(flash);
    }

    // Ricochet sparks — deflected off the hull, wide cone (~±70°) around
    // the reversed shot direction.
    const ricochets = Math.max(4, Math.round(7 * q));
    for (let i = 0; i < ricochets; i++) {
      const p = this.acquire("front");
      if (!p) break;
      const a = shotAngle + Math.PI + (Math.random() - 0.5) * 2.4;
      const speed = 90 + Math.random() * 150;
      this.initP(p, "sparks", x, y, 0.35 + Math.random() * 0.35);
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.drag = 2.4;
      p.sprite.texture = sparkTex();
      p.sprite.tint = i < 2 ? 0xffffff : COLOR_SPARKS[Math.floor(Math.random() * COLOR_SPARKS.length)];
      p.sprite.blendMode = "add";
      p.sprite.rotation = a;
      p.baseScale = (R * (0.5 + Math.random() * 0.4)) / 64;
      p.endScale = p.baseScale * 0.3;
      p.startAlpha = 1;
      this.prime(p);
    }

    // Punch-through spread — a few faster, dimmer sparks carry on in a
    // narrow cone (~±14°) along the shot direction itself.
    const through = Math.max(2, Math.round(4 * q));
    for (let i = 0; i < through; i++) {
      const p = this.acquire("front");
      if (!p) break;
      const a = shotAngle + (Math.random() - 0.5) * 0.5;
      const speed = 140 + Math.random() * 180;
      this.initP(p, "sparks", x, y, 0.25 + Math.random() * 0.25);
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.drag = 2.0;
      p.sprite.texture = sparkTex();
      p.sprite.tint = COLOR_SPARKS[Math.floor(Math.random() * COLOR_SPARKS.length)];
      p.sprite.blendMode = "add";
      p.sprite.rotation = a;
      p.baseScale = (R * (0.35 + Math.random() * 0.25)) / 64;
      p.endScale = p.baseScale * 0.25;
      p.startAlpha = 0.7;
      this.prime(p);
    }

    // Two ember motes drifting slowly off the impact point.
    for (let i = 0; i < 2; i++) {
      const p = this.acquire("behind");
      if (!p) break;
      const a = shotAngle + Math.PI + (Math.random() - 0.5) * 1.6;
      this.initP(p, "embers", x, y, 0.5 + Math.random() * 0.4);
      p.vx = Math.cos(a) * (20 + Math.random() * 30);
      p.vy = Math.sin(a) * (20 + Math.random() * 30);
      p.drag = 1.2;
      p.sprite.texture = glowTex();
      p.sprite.tint = COLOR_EMBERS[Math.floor(Math.random() * COLOR_EMBERS.length)];
      p.sprite.blendMode = "add";
      p.baseScale = (R * 0.18) / 128;
      p.endScale = p.baseScale * 0.3;
      p.startAlpha = 0.7;
      this.prime(p);
    }
  }

  // ── the composition ─────────────────────────────────────────────────────

  private burst(cfg: PresetCfg, x: number, y: number, sizeScale: number, shake: boolean, only?: ExplosionLayer): void {
    const R = cfg.radius * sizeScale;
    const q = QUALITY;

    // 9) ambient light — big soft warm glow behind everything, very short.
    if (!only || only === "light") {
      const p = this.acquire("behind");
      if (p) {
        this.initP(p, "light", x, y, cfg.lightLife);
        p.sprite.texture = glowTex();
        p.sprite.tint = COLOR_LIGHT;
        p.sprite.blendMode = "add";
        p.baseScale = (R * cfg.lightScale * 2) / 128;
        p.endScale = p.baseScale * 1.15;
        p.startAlpha = cfg.lightAlpha;
        this.prime(p);
      }
    }

    // 1) core flash — white pop with a warm halo, fastest layer.
    if (!only || only === "coreFlash") {
      const core = this.acquire("front");
      if (core) {
        this.initP(core, "coreFlash", x, y, cfg.flashLife);
        core.sprite.texture = glowTex();
        core.sprite.tint = COLOR_FLASH_CORE;
        core.sprite.blendMode = "add";
        core.baseScale = (R * 0.9) / 128;
        core.endScale = (R * 2.3) / 128;
        core.startAlpha = 1;
        this.prime(core);
      }
      const halo = this.acquire("front");
      if (halo) {
        this.initP(halo, "coreFlash", x, y, cfg.flashLife * 1.6);
        halo.sprite.texture = glowTex();
        halo.sprite.tint = COLOR_FLASH_HALO;
        halo.sprite.blendMode = "add";
        halo.baseScale = (R * 1.5) / 128;
        halo.endScale = (R * 2.9) / 128;
        halo.startAlpha = 0.65;
        this.prime(halo);
      }
    }

    // 2) main flipbook — existing sheets, frame order untouched, manual
    // tick. Bigger presets overlay several offset instances so the
    // fireball reads as a volume, not a single flat card.
    if ((!only || only === "flipbook") && flipbookSets.length > 0) {
      for (let i = 0; i < cfg.flipbooks; i++) {
        const p = this.acquire("mid");
        if (!p) break;
        const frames = flipbookSets[Math.floor(Math.random() * flipbookSets.length)];
        const secondary = i > 0;
        const oa = Math.random() * Math.PI * 2;
        const od = secondary ? R * (0.25 + Math.random() * 0.3) : 0;
        this.initP(
          p, "flipbook",
          x + Math.cos(oa) * od, y + Math.sin(oa) * od,
          cfg.animLife * (secondary ? 0.75 + Math.random() * 0.3 : 0.95 + Math.random() * 0.25)
        );
        p.frames = frames;
        p.sprite.texture = frames[0];
        p.sprite.tint = 0xffffff;
        p.sprite.blendMode = "add";
        p.sprite.rotation = Math.random() * Math.PI * 2;
        p.flipX = Math.random() < 0.5 ? -1 : 1;
        p.flipY = Math.random() < 0.5 ? -1 : 1;
        p.baseScale = (R * 2.4) / 256 * (0.85 + Math.random() * 0.3) * (secondary ? 0.55 : 1);
        p.endScale = p.baseScale * 1.25;
        p.startAlpha = secondary ? 0.8 : 0.95;
        this.prime(p);
      }
    }

    // 3) ring — organic wobbled band, additive warm.
    if (!only || only === "ring") {
      const p = this.acquire("mid");
      if (p) {
        this.initP(p, "ring", x, y, cfg.ringLife);
        p.sprite.texture = ringTex(Math.floor(Math.random() * 4));
        p.sprite.tint = COLOR_RING;
        p.sprite.blendMode = "add";
        p.sprite.rotation = Math.random() * Math.PI * 2;
        p.baseScale = (R * 0.5) / 256;
        p.endScale = (R * 2.4) / 256;
        p.startAlpha = 0.85;
        this.prime(p);
      }
    }

    // 4) shockwave — cold, transparent, faster and wider than the ring.
    if (!only || only === "shockwave") {
      const p = this.acquire("front");
      if (p) {
        this.initP(p, "shockwave", x, y, cfg.shockLife);
        p.sprite.texture = shockTex();
        p.sprite.tint = COLOR_SHOCK;
        p.sprite.blendMode = "normal";
        p.baseScale = (R * 0.6) / 256;
        p.endScale = (R * 3.4) / 256;
        p.startAlpha = 0.22;
        this.prime(p);
      }
    }

    // 5) sparks — radial streaks aligned to velocity.
    if (!only || only === "sparks") {
      const n = Math.max(3, Math.round(cfg.sparks * q));
      for (let i = 0; i < n; i++) {
        const p = this.acquire("front");
        if (!p) break;
        const a = Math.random() * Math.PI * 2;
        const speed = R * (2.4 + Math.random() * 3.8);
        this.initP(p, "sparks", x + (Math.random() - 0.5) * R * 0.2, y + (Math.random() - 0.5) * R * 0.2, cfg.sparkLife * (0.6 + Math.random() * 0.7));
        p.vx = Math.cos(a) * speed;
        p.vy = Math.sin(a) * speed;
        p.drag = 2.1; // low drag: sparks travel visibly far from the blast
        p.sprite.texture = sparkTex();
        p.sprite.tint = COLOR_SPARKS[Math.floor(Math.random() * COLOR_SPARKS.length)];
        p.sprite.blendMode = "add";
        p.sprite.rotation = a;
        p.baseScale = (R * (0.35 + Math.random() * 0.3)) / 64;
        p.endScale = p.baseScale * 0.35;
        p.startAlpha = 1;
        this.prime(p);
      }
    }

    // 5b) fire trails — glowing ember heads thrown out of the blast that
    // stamp a fading fire trail behind them as they fly (see update()).
    if (!only || only === "fireTrails") {
      const n = Math.max(1, Math.round(cfg.fireTrails * q));
      for (let i = 0; i < n; i++) {
        const p = this.acquire("front");
        if (!p) break;
        const a = Math.random() * Math.PI * 2;
        const speed = R * (1.7 + Math.random() * 1.8);
        this.initP(p, "fireTrail", x, y, cfg.sparkLife * (0.9 + Math.random() * 0.6));
        p.vx = Math.cos(a) * speed;
        p.vy = Math.sin(a) * speed;
        p.drag = 1.3; // keeps momentum: trails arc well clear of the fireball
        p.trailTimer = 0.02 * Math.random(); // desync stamp cadence
        p.sprite.texture = glowTex();
        p.sprite.tint = COLOR_EMBERS[Math.floor(Math.random() * COLOR_EMBERS.length)];
        p.sprite.blendMode = "add";
        p.baseScale = (R * (0.14 + Math.random() * 0.08)) / 128;
        p.endScale = p.baseScale * 0.35;
        p.startAlpha = 0.95;
        this.prime(p);
      }
    }

    // 6) debris — dark rotating silhouettes, the one non-glowing solid.
    if (!only || only === "debris") {
      const n = Math.max(1, Math.round(cfg.debris * q));
      for (let i = 0; i < n; i++) {
        const p = this.acquire("mid");
        if (!p) break;
        const a = Math.random() * Math.PI * 2;
        const speed = R * (0.8 + Math.random() * 1.4);
        this.initP(p, "debris", x, y, cfg.debrisLife * (0.7 + Math.random() * 0.6));
        p.vx = Math.cos(a) * speed;
        p.vy = Math.sin(a) * speed;
        p.drag = 1.1;
        p.spin = (Math.random() - 0.5) * 12;
        p.sprite.texture = debrisTex(Math.floor(Math.random() * 4));
        p.sprite.tint = COLOR_DEBRIS[Math.floor(Math.random() * COLOR_DEBRIS.length)];
        p.sprite.blendMode = "normal";
        p.sprite.rotation = Math.random() * Math.PI * 2;
        p.baseScale = (R * (0.1 + Math.random() * 0.12)) / 32;
        p.endScale = p.baseScale * 0.8;
        p.startAlpha = 1;
        this.prime(p);
      }
    }

    // 7) embers — slow additive glow motes drifting out.
    if (!only || only === "embers") {
      const n = Math.max(1, Math.round(cfg.embers * q));
      for (let i = 0; i < n; i++) {
        const p = this.acquire("behind");
        if (!p) break;
        const a = Math.random() * Math.PI * 2;
        const speed = R * (0.4 + Math.random() * 0.9);
        this.initP(p, "embers", x, y, cfg.smokeLife * (0.5 + Math.random() * 0.5));
        p.vx = Math.cos(a) * speed;
        p.vy = Math.sin(a) * speed;
        p.drag = 1.6;
        p.sprite.texture = glowTex();
        p.sprite.tint = COLOR_EMBERS[Math.floor(Math.random() * COLOR_EMBERS.length)];
        p.sprite.blendMode = "add";
        p.baseScale = (R * (0.12 + Math.random() * 0.1)) / 128;
        p.endScale = p.baseScale * 0.3;
        p.startAlpha = 0.8;
        this.prime(p);
      }
    }

    // 7b/8) smoke — cool grey puffs, normal blend, grow while fading.
    if (!only || only === "smoke") {
      const n = Math.round(cfg.smoke * q);
      for (let i = 0; i < n; i++) {
        const p = this.acquire("behind");
        if (!p) break;
        const a = Math.random() * Math.PI * 2;
        const d = R * Math.random() * 0.5;
        this.initP(p, "smoke", x + Math.cos(a) * d, y + Math.sin(a) * d, cfg.smokeLife * (0.7 + Math.random() * 0.6));
        p.vx = Math.cos(a) * R * 0.25;
        p.vy = Math.sin(a) * R * 0.25;
        p.drag = 0.8;
        p.spin = (Math.random() - 0.5) * 0.8;
        p.sprite.texture = smokeTex(Math.floor(Math.random() * 4));
        p.sprite.tint = COLOR_SMOKE;
        p.sprite.blendMode = "normal";
        p.sprite.rotation = Math.random() * Math.PI * 2;
        p.baseScale = (R * (0.5 + Math.random() * 0.4)) / 128;
        p.endScale = p.baseScale * 1.9;
        p.startAlpha = 0.32;
        this.prime(p);
      }
    }

    // 8) camera shake — optional, reuses the game's existing normalized
    // 0..1 shake channel (decayed and applied by the renderer/loop).
    if (shake && this.allowShake && cfg.shake > 0 && !only) {
      state.cameraShake = Math.max(state.cameraShake, cfg.shake * Math.min(1.5, sizeScale));
    }
  }

  private initP(p: ExpParticle, behavior: Behavior, x: number, y: number, life: number): void {
    p.behavior = behavior;
    p.x = x; p.y = y;
    p.vx = 0; p.vy = 0;
    p.drag = 0; p.spin = 0;
    p.life = life; p.maxLife = life;
    p.flipX = 1; p.flipY = 1;
    p.frames = null;
    p.trailTimer = 0;
    p.sprite.rotation = 0;
    p.sprite.position.set(x, y);
    // Hide until prime() applies the configured t=0 alpha/scale — a pooled
    // sprite still carries its previous life's visuals, and spawns that
    // happen after this frame's update() (e.g. projectile deaths, which
    // sync later in the frame) would otherwise show them for one frame.
    p.sprite.alpha = 0;
  }

  /** Apply the configured t=0 visuals immediately at spawn time. */
  private prime(p: ExpParticle): void {
    p.sprite.alpha = p.behavior === "smoke" ? 0 : p.startAlpha;
    p.sprite.scale.set(p.baseScale * p.flipX, p.baseScale * p.flipY);
  }

  // ── per-frame update (dt in seconds) ────────────────────────────────────

  update(dt: number): void {
    // Boss sub-burst scheduler.
    for (const b of this.pending) {
      if (!b.active) continue;
      b.delay -= dt;
      if (b.delay <= 0) {
        b.active = false;
        this.burst(PRESETS[b.preset], b.x, b.y, b.sizeScale, false);
      }
    }

    for (const slot of ["behind", "mid", "front"] as const) {
      const pool = this.pools[slot];
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) { this.release(p); continue; }

        const t = 1 - p.life / p.maxLife; // 0 → 1 over lifetime
        const sp = p.sprite;

        // Motion (sparks/debris/embers/smoke drift; drag decays velocity).
        if (p.vx !== 0 || p.vy !== 0) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.drag > 0) {
            const k = Math.max(0, 1 - p.drag * dt);
            p.vx *= k; p.vy *= k;
          }
          sp.position.set(p.x, p.y);
        }
        if (p.spin !== 0) sp.rotation += p.spin * dt;

        // Per-behavior curves.
        let scale = p.baseScale + (p.endScale - p.baseScale) * t;
        let alpha = p.startAlpha;
        switch (p.behavior) {
          case "coreFlash":
          case "light": {
            const e = 1 - (1 - t) * (1 - t); // ease-out
            scale = p.baseScale + (p.endScale - p.baseScale) * e;
            alpha = p.startAlpha * (1 - t) * (1 - t);
            break;
          }
          case "flipbook": {
            if (p.frames) {
              const idx = Math.min(p.frames.length - 1, Math.floor(t * p.frames.length));
              if (sp.texture !== p.frames[idx]) sp.texture = p.frames[idx];
            }
            alpha = p.startAlpha * (t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25);
            break;
          }
          case "ring":
          case "shockwave": {
            const e = 1 - Math.pow(1 - t, 2.2); // fast start, soft end
            scale = p.baseScale + (p.endScale - p.baseScale) * e;
            alpha = p.startAlpha * (1 - t);
            break;
          }
          case "sparks":
            alpha = p.startAlpha * (1 - t * t);
            break;
          case "fireTrail": {
            alpha = p.startAlpha * (1 - t * t);
            // Stamp a short-lived fire puff along the flight path. Puffs
            // are plain pooled particles ("trailPuff": no motion, no
            // stamping of their own — no cascade), so the trail fades
            // tail-first behind the head.
            p.trailTimer -= dt;
            if (p.trailTimer <= 0) {
              p.trailTimer = 0.045;
              const puff = this.acquire(slot);
              if (puff) {
                this.initP(puff, "trailPuff", p.x, p.y, 0.28 + Math.random() * 0.2);
                puff.sprite.texture = glowTex();
                puff.sprite.tint = p.sprite.tint;
                puff.sprite.blendMode = "add";
                puff.baseScale = p.baseScale * (0.7 + Math.random() * 0.3);
                puff.endScale = puff.baseScale * 0.2;
                puff.startAlpha = 0.5;
                this.prime(puff);
              }
            }
            break;
          }
          case "trailPuff":
            alpha = p.startAlpha * (1 - t);
            break;
          case "debris":
            // Solid until the last third, then fade.
            alpha = t < 0.66 ? 1 : 1 - (t - 0.66) / 0.34;
            break;
          case "embers":
            alpha = p.startAlpha * (1 - t) * (0.85 + 0.15 * Math.sin(t * 26)); // subtle flicker
            break;
          case "smoke":
            alpha = p.startAlpha * (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8);
            break;
        }
        sp.alpha = alpha;
        sp.scale.set(scale * p.flipX, scale * p.flipY);
      }
    }
  }

  /** Active particle count (debug overlay display). */
  get active(): number {
    return this.activeCount;
  }

  destroy(): void {
    for (const slot of ["behind", "mid", "front"] as const) {
      for (const p of this.pools[slot]) p.sprite.destroy();
      this.pools[slot] = [];
    }
    this.activeCount = 0;
    for (const b of this.pending) b.active = false;
  }
}
