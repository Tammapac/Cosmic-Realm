/**
 * LaserSystem — layered laser projectile visuals for Cosmic Realm.
 *
 * Pure presentation on top of the EXISTING game systems: projectiles keep
 * living in state.projectiles (world coordinates, game logic untouched),
 * the camera transform stays worldLayer's pivot/scale, and everything
 * renders through the one existing PIXI Application. This module only
 * owns how a laser LOOKS:
 *
 *   core   bright near-white elongated bolt, NORMAL blend — sharp,
 *          readable silhouette that additive glow can never wash out
 *   glow   soft colored halo, ADD blend, preset-colored
 *   trail  short stamps at the projectile's REAL previous positions
 *          (distance-based, interpolated — no lag, no side offset),
 *          fading and narrowing to the rear, in effectsBehindLayer
 *   tip    small pulsing energy point at the bolt's head
 *   muzzle 60-90ms directional flash at the spawn point
 *   hit    white impact flash + clean energy ring + a few embers
 *          (directional ricochet sparks come from the ship-hit system,
 *          which the renderer calls alongside)
 *
 * Core+glow+tip live in a per-laser container that hops between
 * projectileLayer / projectileBehindLayer with flight direction, matching
 * how ship-vs-projectile depth already works. All sizes are world units —
 * worldLayer.scale applies the camera zoom to them correctly for free.
 *
 * Pooling: laser visuals, trail stamps and hit/muzzle transients are all
 * fixed pools; sprites stay permanently parented and toggle `visible`.
 * Nothing is allocated per frame after warm-up, everything auto-returns
 * on expiry — no leaks, no per-frame garbage.
 */
import * as PIXI from "pixi.js";
import { state } from "./store";

const QUALITY: number = (() => {
  const cores = navigator.hardwareConcurrency ?? 8;
  const touch = (navigator.maxTouchPoints ?? 0) > 0;
  if (cores <= 4 || (touch && cores <= 6)) return 0.55;
  return 1;
})();

// ══════════════════════════════════════════════════════════════════════════
// TEXTURES — generated once with canvas, LINEAR-filtered, cached forever
// ══════════════════════════════════════════════════════════════════════════

const texCache = new Map<string, PIXI.Texture>();
function cached(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): PIXI.Texture {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!, w, h);
  t = PIXI.Texture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR });
  texCache.set(key, t);
  return t;
}

/** Elongated bolt core: rounded nose, tapered tail — a directed shape with
 *  a crisp silhouette, deliberately NOT a round dot. White; tinted at use. */
function coreTex(): PIXI.Texture {
  return cached("lz-core", 96, 24, (ctx, w, h) => {
    const cy = h / 2, noseR = h * 0.34;
    ctx.beginPath();
    ctx.moveTo(2, cy); // tail point
    ctx.quadraticCurveTo(w * 0.55, cy - noseR, w - noseR - 2, cy - noseR);
    ctx.arc(w - noseR - 2, cy, noseR, -Math.PI / 2, Math.PI / 2);
    ctx.quadraticCurveTo(w * 0.55, cy + noseR, 2, cy);
    ctx.closePath();
    // hot white center with a hint of edge falloff for anti-aliased crispness
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(0.35, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = g;
    ctx.fill();
  });
}

/** Soft radial glow. */
function glowTex(): PIXI.Texture {
  return cached("lz-glow", 128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.4, "rgba(255,255,255,0.38)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

/** Trail stamp: soft short streak, brighter toward its front. */
function trailTex(): PIXI.Texture {
  return cached("lz-trail", 64, 20, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.55, "rgba(255,255,255,0.55)");
    g.addColorStop(0.9, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    const cy = h / 2;
    ctx.beginPath();
    ctx.ellipse(w / 2, cy, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Round soft puff (plasma trail). */
function puffTex(): PIXI.Texture {
  return cached("lz-puff", 48, 48, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,0.8)");
    g.addColorStop(0.5, "rgba(255,255,255,0.3)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

/** Sharp small tip point. */
function tipTex(): PIXI.Texture {
  return cached("lz-tip", 32, 32, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

/** Clean thin energy ring (hit effect) — tech look, no wobble. */
function ringTex(): PIXI.Texture {
  return cached("lz-ring", 128, 128, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0.62, "rgba(255,255,255,0)");
    g.addColorStop(0.74, "rgba(255,255,255,0.9)");
    g.addColorStop(0.8, "rgba(255,255,255,1)");
    g.addColorStop(0.88, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Muzzle flash: horizontal energy burst + short perpendicular cross. */
function muzzleTex(): PIXI.Texture {
  return cached("lz-muzzle", 96, 48, (ctx, w, h) => {
    const cx = w * 0.35, cy = h / 2;
    const main = ctx.createLinearGradient(0, cy, w, cy);
    main.addColorStop(0, "rgba(255,255,255,0)");
    main.addColorStop(0.3, "rgba(255,255,255,0.9)");
    main.addColorStop(0.5, "rgba(255,255,255,1)");
    main.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, cy, w * 0.5 - 1, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    const cross = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.5);
    cross.addColorStop(0, "rgba(255,255,255,0.95)");
    cross.addColorStop(0.5, "rgba(255,255,255,0.35)");
    cross.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = cross;
    ctx.beginPath();
    ctx.ellipse(cx, cy, h * 0.28, h * 0.5 - 1, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ══════════════════════════════════════════════════════════════════════════
// PRESETS
// ══════════════════════════════════════════════════════════════════════════

export type LaserPreset = "lightLaser" | "heavyLaser" | "plasmaBolt" | "enemyLaser";

interface LaserCfg {
  coreLen: number; coreW: number;   // world units
  coreTint: number;                 // near-white, slightly toward the family color
  glowR: number; glowColor: number; glowAlpha: number;
  tipR: number;
  pulseHull: boolean;               // plasma: whole glow pulses
  trailKind: "streak" | "puff";
  trailColor: number; trailW: number; trailLife: number; trailSpacing: number;
  muzzleColor: number; muzzleSize: number;
  hitFlashR: number; hitRingR: number; hitRingAlpha: number; hitEmbers: number;
  hitColor: number; hitShake: number;
}

const PRESETS: Record<LaserPreset, LaserCfg> = {
  lightLaser: {
    coreLen: 26, coreW: 4.5, coreTint: 0xeffbff,
    glowR: 15, glowColor: 0x3fc8ff, glowAlpha: 0.75,
    tipR: 5.5, pulseHull: false,
    trailKind: "streak", trailColor: 0x2fa8ff, trailW: 6.5, trailLife: 0.2, trailSpacing: 10,
    muzzleColor: 0x9fe8ff, muzzleSize: 26,
    hitFlashR: 14, hitRingR: 0, hitRingAlpha: 0, hitEmbers: 2,
    hitColor: 0x6fd8ff, hitShake: 0,
  },
  heavyLaser: {
    coreLen: 36, coreW: 8.5, coreTint: 0xf2f2ff,
    glowR: 26, glowColor: 0x6f8bff, glowAlpha: 0.85,
    tipR: 8, pulseHull: false,
    trailKind: "streak", trailColor: 0x5577ff, trailW: 11, trailLife: 0.28, trailSpacing: 11,
    muzzleColor: 0xb8c6ff, muzzleSize: 40,
    hitFlashR: 22, hitRingR: 34, hitRingAlpha: 0.8, hitEmbers: 4,
    hitColor: 0x8fa4ff, hitShake: 0.12,
  },
  plasmaBolt: {
    coreLen: 19, coreW: 9, coreTint: 0xf0fff5,
    glowR: 22, glowColor: 0x52ffa8, glowAlpha: 0.8,
    tipR: 7, pulseHull: true,
    trailKind: "puff", trailColor: 0x3fe08a, trailW: 9, trailLife: 0.26, trailSpacing: 12,
    muzzleColor: 0x9dffc8, muzzleSize: 30,
    hitFlashR: 26, hitRingR: 20, hitRingAlpha: 0.5, hitEmbers: 3,
    hitColor: 0x6dffb2, hitShake: 0,
  },
  enemyLaser: {
    coreLen: 25, coreW: 5.5, coreTint: 0xfff1ec,
    glowR: 17, glowColor: 0xff4a38, glowAlpha: 0.8,
    tipR: 6, pulseHull: false,
    trailKind: "streak", trailColor: 0xff7a52, trailW: 7.5, trailLife: 0.2, trailSpacing: 10,
    muzzleColor: 0xffb3a0, muzzleSize: 26,
    hitFlashR: 15, hitRingR: 0, hitRingAlpha: 0, hitEmbers: 2,
    hitColor: 0xff8a66, hitShake: 0,
  },
};

/** Small per-shot tint variation: lerp a color a touch toward white. */
function jitterColor(c: number, k: number): number {
  const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
  const lerp = (v: number) => Math.min(255, Math.round(v + (255 - v) * k));
  return (lerp(r) << 16) | (lerp(g) << 8) | lerp(b);
}

// ══════════════════════════════════════════════════════════════════════════
// POOLED STRUCTURES
// ══════════════════════════════════════════════════════════════════════════

interface LaserVisual {
  active: boolean;
  id: string;
  preset: LaserPreset;
  cont: PIXI.Container;   // glow + core + tip, moved between proj layers
  glow: PIXI.Sprite;
  core: PIXI.Sprite;
  tip: PIXI.Sprite;
  prevX: number; prevY: number;
  trailAcc: number;       // distance since last trail stamp
  sizeMul: number;        // ±10% per shot
  brightMul: number;      // ±8% per shot
  trailMul: number;       // ±12% per shot
  phase: number;          // tip/hull pulse phase
  trailTint: number;      // resolved trail color (ammo color when given)
}

interface Transient {
  active: boolean;
  spr: PIXI.Sprite;
  life: number; maxLife: number;
  kind: "trail" | "flash" | "ring" | "ember" | "muzzle";
  vx: number; vy: number;
  scale0: number; scale1: number;
  alpha0: number;
  sx: number; sy: number; // scale aspect (trail streaks are non-uniform)
}

export interface LaserDebugMask { core: boolean; glow: boolean; trail: boolean; tip: boolean }

// ══════════════════════════════════════════════════════════════════════════
// SYSTEM
// ══════════════════════════════════════════════════════════════════════════

export class LaserSystem {
  private projFront: PIXI.Container;
  private projBehind: PIXI.Container;
  private trailLayer: PIXI.Container;  // effectsBehindLayer — weak trails
  private fxLayer: PIXI.Container;     // effectsLayer/effectsFrontLayer — hit + muzzle

  private visuals = new Map<string, LaserVisual>();
  private visualPool: LaserVisual[] = [];
  private transients: Transient[] = [];
  private readonly maxTransients = Math.round(360 * QUALITY);
  private transientCount = 0;

  /** Debug isolation: when set, only the flagged parts render. */
  debugMask: LaserDebugMask | null = null;
  /** Debug: suppress camera shake inside the isolated test scene. */
  allowShake = true;

  constructor(projFront: PIXI.Container, projBehind: PIXI.Container, trailLayer: PIXI.Container, fxLayer: PIXI.Container) {
    this.projFront = projFront;
    this.projBehind = projBehind;
    this.trailLayer = trailLayer;
    this.fxLayer = fxLayer;
    coreTex(); glowTex(); trailTex(); puffTex(); tipTex(); ringTex(); muzzleTex();
  }

  // ── laser lifecycle ─────────────────────────────────────────────────────

  /**
   * Attach visuals for a projectile id (no-op if already attached).
   * Returns true when this call created the visual (fresh shot).
   *
   * `color` is the projectile's own synced color — for player lasers the
   * ACTIVE AMMO TYPE's color (X1 cyan, X2 green, ...), for remote players
   * resolved from their synced ammoType, for enemies the server color.
   * When given it drives glow/tip/trail (and the core picks up a subtle
   * hue hint while staying near-white); the preset keeps supplying
   * geometry, trail kind, hit ring and shake. Omitted -> preset palette.
   */
  ensure(id: string, preset: LaserPreset, x: number, y: number, angle: number, sizeScale = 1, color?: number): boolean {
    if (this.visuals.has(id)) return false;
    const cfg = PRESETS[preset];
    let v = this.visualPool.find((p) => !p.active);
    if (!v) {
      const cont = new PIXI.Container();
      const glow = new PIXI.Sprite(glowTex());
      glow.anchor.set(0.5);
      glow.blendMode = PIXI.BLEND_MODES.ADD;
      const core = new PIXI.Sprite(coreTex());
      core.anchor.set(0.5);
      core.blendMode = PIXI.BLEND_MODES.NORMAL; // stays readable over the glow
      const tip = new PIXI.Sprite(tipTex());
      tip.anchor.set(0.5);
      tip.blendMode = PIXI.BLEND_MODES.ADD;
      cont.addChild(glow, core, tip);
      this.projFront.addChild(cont);
      v = {
        active: false, id: "", preset, cont, glow, core, tip,
        prevX: 0, prevY: 0, trailAcc: 0, sizeMul: 1, brightMul: 1, trailMul: 1, phase: 0,
        trailTint: 0xffffff,
      };
      this.visualPool.push(v);
    }
    // Per-shot randomization: size ±10%, brightness ±8%, trail length ±12%,
    // slight color variation. Never position/trajectory (flight stays exact).
    v.active = true;
    v.id = id;
    v.preset = preset;
    v.sizeMul = (0.9 + Math.random() * 0.2) * sizeScale;
    v.brightMul = 0.92 + Math.random() * 0.16;
    v.trailMul = 0.88 + Math.random() * 0.24;
    v.phase = Math.random() * Math.PI * 2;
    v.prevX = x; v.prevY = y;
    v.trailAcc = 0;
    // Color readability: the glow carries the ammo color PURE (only a tiny
    // ±8% per-shot variation), the core is white-hot but clearly hued, the
    // tip sits between — blue ammo reads blue, red ammo reads red at a
    // glance instead of washing out toward white.
    const tintK = Math.random() * 0.08;
    const family = color ?? cfg.glowColor;
    v.trailTint = color ?? cfg.trailColor;
    v.core.tint = color != null ? jitterColor(family, 0.45) : cfg.coreTint;
    v.core.width = cfg.coreLen * v.sizeMul;
    v.core.height = cfg.coreW * v.sizeMul;
    v.glow.tint = jitterColor(family, tintK);
    v.glow.width = v.glow.height = cfg.glowR * 2 * v.sizeMul;
    v.glow.alpha = Math.min(1, cfg.glowAlpha * 1.15) * v.brightMul;
    v.tip.tint = jitterColor(family, 0.3);
    v.tip.width = v.tip.height = cfg.tipR * 2 * v.sizeMul;
    v.cont.visible = true;
    v.cont.position.set(x, y);
    v.cont.rotation = angle;
    this.applyMask(v);
    this.visuals.set(id, v);
    return true;
  }

  /** Per-frame position/rotation update + trail stamping from the REAL
   *  previous position (interpolated along the actual flight segment). */
  move(id: string, x: number, y: number, vx: number, vy: number): void {
    const v = this.visuals.get(id);
    if (!v) return;
    const cfg = PRESETS[v.preset];
    v.cont.visible = true;
    v.cont.position.set(x, y);
    const angle = Math.atan2(vy, vx);
    v.cont.rotation = angle;
    // depth: southbound shots pass behind the ship, like existing sprites
    const target = vy < 0 ? this.projFront : this.projBehind;
    if (v.cont.parent !== target) {
      v.cont.parent?.removeChild(v.cont);
      target.addChild(v.cont);
    }
    // tip: pulsing point at the bolt's head (local +x = flight direction)
    const t = state.tick;
    const pulse = 1 + 0.18 * Math.sin(t * 30 + v.phase);
    v.tip.x = (cfg.coreLen * v.sizeMul) / 2;
    v.tip.scale.set(((cfg.tipR * 2 * v.sizeMul) / 32) * pulse);
    if (cfg.pulseHull) {
      const hull = 1 + 0.14 * Math.sin(t * 22 + v.phase);
      v.glow.width = v.glow.height = cfg.glowR * 2 * v.sizeMul * hull;
    }
    // trail: stamp along the segment prev->current every trailSpacing world
    // units — gapless for fast shots, and always exactly ON the flight path
    if (!this.debugMask || this.debugMask.trail) {
      const dx = x - v.prevX, dy = y - v.prevY;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.001) {
        const spacing = cfg.trailSpacing;
        v.trailAcc += dist;
        let stamps = 0;
        while (v.trailAcc >= spacing && stamps < 6) {
          v.trailAcc -= spacing;
          const f = 1 - v.trailAcc / dist; // position along the segment
          this.stampTrail(v, cfg, v.prevX + dx * f, v.prevY + dy * f, angle);
          stamps++;
        }
      }
    }
    v.prevX = x; v.prevY = y;
  }

  /** Hide (off-screen cull) without releasing. */
  hide(id: string): void {
    const v = this.visuals.get(id);
    if (v) v.cont.visible = false;
  }

  /** Release the visual (projectile gone). No hit visuals. */
  kill(id: string): void {
    const v = this.visuals.get(id);
    if (!v) return;
    v.active = false;
    v.cont.visible = false;
    this.visuals.delete(id);
  }

  has(id: string): boolean {
    return this.visuals.has(id);
  }

  // ── one-shot effects ────────────────────────────────────────────────────

  /** Muzzle flash at the weapon point, aligned to the shot direction.
   *  `color` (ammo/projectile color) overrides the preset palette. */
  muzzle(x: number, y: number, angle: number, preset: LaserPreset, color?: number): void {
    const cfg = PRESETS[preset];
    const size = cfg.muzzleSize * (0.85 + Math.random() * 0.3);
    const m = this.acquireTransient("muzzle", this.fxLayer, muzzleTex());
    if (!m) return;
    m.life = m.maxLife = 0.05 + Math.random() * 0.05; // 50-100ms
    m.spr.tint = jitterColor(color != null ? jitterColor(color, 0.15) : cfg.muzzleColor, Math.random() * 0.08);
    m.spr.rotation = angle;
    m.spr.position.set(x, y);
    m.scale0 = size / 96;
    m.scale1 = (size / 96) * 1.25;
    m.alpha0 = 0.95;
    m.sx = 1; m.sy = 0.9;
    m.spr.alpha = m.alpha0;
    m.spr.scale.set(m.scale0 * m.sx, m.scale0 * m.sy);
  }

  /** Impact at the exact hit point: white flash, clean energy ring
   *  (preset-dependent), a few embers, optional light camera shake.
   *  Directional ricochet sparks are the ship-hit system's job — the
   *  renderer calls both so hull hits keep their bounce-off look. */
  hitAt(x: number, y: number, angle: number, preset: LaserPreset, color?: number): void {
    const cfg = PRESETS[preset];
    const hitColor = color != null ? jitterColor(color, 0.1) : cfg.hitColor;
    // white flash
    const f = this.acquireTransient("flash", this.fxLayer, glowTex());
    if (f) {
      f.life = f.maxLife = 0.09;
      f.spr.tint = 0xffffff;
      f.spr.position.set(x, y);
      f.spr.rotation = 0;
      f.scale0 = (cfg.hitFlashR * 2) / 128;
      f.scale1 = f.scale0 * 1.9;
      f.alpha0 = 1;
      f.sx = f.sy = 1;
      f.spr.alpha = 1;
      f.spr.scale.set(f.scale0);
    }
    // energy ring
    if (cfg.hitRingR > 0) {
      const r = this.acquireTransient("ring", this.fxLayer, ringTex());
      if (r) {
        r.life = r.maxLife = 0.22;
        r.spr.tint = hitColor;
        r.spr.position.set(x, y);
        r.spr.rotation = 0;
        r.scale0 = (cfg.hitRingR * 0.5) / 128;
        r.scale1 = (cfg.hitRingR * 2) / 128;
        r.alpha0 = cfg.hitRingAlpha;
        r.sx = r.sy = 1;
        r.spr.alpha = r.alpha0;
        r.spr.scale.set(r.scale0);
      }
    }
    // embers, biased back along the shot direction
    const embers = Math.max(1, Math.round(cfg.hitEmbers * QUALITY * (0.75 + Math.random() * 0.5)));
    for (let i = 0; i < embers; i++) {
      const e = this.acquireTransient("ember", this.trailLayer, puffTex());
      if (!e) break;
      const a = angle + Math.PI + (Math.random() - 0.5) * 1.8;
      const sp = 25 + Math.random() * 45;
      e.life = e.maxLife = 0.35 + Math.random() * 0.3;
      e.vx = Math.cos(a) * sp;
      e.vy = Math.sin(a) * sp;
      e.spr.tint = hitColor;
      e.spr.position.set(x, y);
      e.spr.rotation = 0;
      e.scale0 = (5 + Math.random() * 3) / 48;
      e.scale1 = e.scale0 * 0.3;
      e.alpha0 = 0.75;
      e.sx = e.sy = 1;
      e.spr.alpha = e.alpha0;
      e.spr.scale.set(e.scale0);
    }
    if (cfg.hitShake > 0 && this.allowShake) {
      state.cameraShake = Math.max(state.cameraShake, cfg.hitShake);
    }
  }

  // ── internals ───────────────────────────────────────────────────────────

  private applyMask(v: LaserVisual): void {
    const m = this.debugMask;
    v.core.visible = !m || m.core;
    v.glow.visible = !m || m.glow;
    v.tip.visible = !m || m.tip;
  }

  /** Debug: re-apply the current mask to all live visuals. */
  refreshMask(): void {
    for (const v of this.visuals.values()) this.applyMask(v);
  }

  private stampTrail(v: LaserVisual, cfg: LaserCfg, x: number, y: number, angle: number): void {
    const tp = this.acquireTransient("trail", this.trailLayer, cfg.trailKind === "puff" ? puffTex() : trailTex());
    if (!tp) return;
    tp.life = tp.maxLife = cfg.trailLife * v.trailMul;
    tp.spr.tint = v.trailTint;
    tp.spr.position.set(x, y);
    tp.spr.rotation = angle;
    if (cfg.trailKind === "puff") {
      tp.scale0 = (cfg.trailW * 2 * v.sizeMul) / 48;
      tp.scale1 = tp.scale0 * 0.25;
      tp.sx = tp.sy = 1;
    } else {
      // streak: long along flight, thin across — narrows to the rear as it dies
      tp.scale0 = 1;
      tp.scale1 = 0.3;
      tp.sx = (cfg.trailSpacing * 1.5 * v.sizeMul) / 64;
      tp.sy = (cfg.trailW * v.sizeMul) / 20;
    }
    tp.alpha0 = 0.7 * v.brightMul;
    tp.vx = 0; tp.vy = 0;
    tp.spr.alpha = tp.alpha0;
    tp.spr.scale.set(tp.scale0 * tp.sx, tp.scale0 * tp.sy);
  }

  private acquireTransient(kind: Transient["kind"], layer: PIXI.Container, tex: PIXI.Texture): Transient | null {
    if (this.transientCount >= this.maxTransients) return null;
    let t = this.transients.find((p) => !p.active && p.spr.parent === layer);
    if (!t) {
      const spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5);
      spr.blendMode = PIXI.BLEND_MODES.ADD;
      layer.addChild(spr);
      t = {
        active: false, spr, life: 0, maxLife: 1, kind,
        vx: 0, vy: 0, scale0: 1, scale1: 1, alpha0: 1, sx: 1, sy: 1,
      };
      this.transients.push(t);
    }
    t.active = true;
    t.kind = kind;
    t.spr.texture = tex;
    t.spr.visible = true;
    t.vx = 0; t.vy = 0;
    this.transientCount++;
    return t;
  }

  /** Per-frame decay of trail stamps, muzzle flashes, hit transients. */
  update(dt: number): void {
    for (let i = 0; i < this.transients.length; i++) {
      const t = this.transients[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        t.spr.visible = false;
        this.transientCount--;
        continue;
      }
      const p = 1 - t.life / t.maxLife; // 0 -> 1
      if (t.vx !== 0 || t.vy !== 0) {
        t.spr.x += t.vx * dt;
        t.spr.y += t.vy * dt;
      }
      const s = t.scale0 + (t.scale1 - t.scale0) * (t.kind === "ring" ? 1 - (1 - p) * (1 - p) : p);
      t.spr.scale.set(s * t.sx, s * t.sy);
      t.spr.alpha = t.alpha0 * (t.kind === "flash" || t.kind === "muzzle" ? (1 - p) * (1 - p) : 1 - p);
    }
  }

  /** Release every laser visual (zone change / renderer teardown). */
  releaseAll(): void {
    for (const v of this.visuals.values()) {
      v.active = false;
      v.cont.visible = false;
    }
    this.visuals.clear();
  }

  destroy(): void {
    this.releaseAll();
    for (const v of this.visualPool) v.cont.destroy({ children: true });
    this.visualPool = [];
    for (const t of this.transients) t.spr.destroy();
    this.transients = [];
    this.transientCount = 0;
  }
}

/** Maps a live projectile to a laser preset. Enemy laser-family shots are
 *  always the distinct enemy palette; player shots split by weapon kind
 *  and weight. Deterministic — no per-frame branching randomness. */
export function laserPresetFor(fromPlayer: boolean, weaponKind: string | undefined, size: number, damage: number): LaserPreset {
  if (!fromPlayer) return "enemyLaser";
  if (weaponKind === "plasma" || weaponKind === "energy") return "plasmaBolt";
  return size >= 6 || damage >= 30 ? "heavyLaser" : "lightLaser";
}
