/**
 * PixiJS Effect Manager — Centralized VFX with Object Pooling
 *
 * Handles: thrusters, explosions, hit effects, muzzle flashes,
 * rocket launches, projectile trails, sparks, smoke, debris, embers
 */
import * as PIXI from "pixi.js";

// ══════════════════════════════════════════════════════════════════════════
// VFX TUNING CONSTANTS
// ══════════════════════════════════════════════════════════════════════════

export const VFX = {
  THRUSTER_PARTICLE_RATE: 30,
  THRUSTER_PARTICLE_LIFETIME: 0.45,
  AFTERBURN_PARTICLE_MULTIPLIER: 2.5,

  LASER_TRAIL_LIFETIME: 0.22,
  PLASMA_TRAIL_LIFETIME: 0.32,
  ROCKET_TRAIL_LIFETIME: 0.75,

  HIT_SPARK_COUNT: 12,
  HEAVY_HIT_SPARK_COUNT: 22,

  SMALL_EXPLOSION_FIRE_COUNT: 30,
  MEDIUM_EXPLOSION_FIRE_COUNT: 30,
  LARGE_EXPLOSION_FIRE_COUNT: 25,

  SMALL_EXPLOSION_DEBRIS_COUNT: 14,
  MEDIUM_EXPLOSION_DEBRIS_COUNT: 15,
  LARGE_EXPLOSION_DEBRIS_COUNT: 25,

  SMOKE_LIFETIME: 1.6,
  DEBRIS_LIFETIME: 3.8,
  EMBER_LIFETIME: 1.5,

  MAX_ACTIVE_PARTICLES: 2500,
  MAX_ACTIVE_SMOKE: 400,
  MAX_ACTIVE_DEBRIS: 350,
  MAX_ACTIVE_SPARKS: 500,
  MAX_ACTIVE_FLASHES: 80,
};

// ══════════════════════════════════════════════════════════════════════════
// POOLED PARTICLE
// ══════════════════════════════════════════════════════════════════════════

interface PooledParticle {
  active: boolean;
  sprite: PIXI.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  alpha: number;
  startAlpha: number;
  scaleStart: number;
  scaleEnd: number;
  rotation: number;
  angularVel: number;
  tint: number;
  kind: string;
  blendAdd: boolean;
  trailTimer: number;
}

// ══════════════════════════════════════════════════════════════════════════
// TEXTURE GENERATORS
// ══════════════════════════════════════════════════════════════════════════

const fxTexCache = new Map<string, PIXI.Texture>();

function makeTex(key: string, size: number, drawFn: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void): PIXI.Texture {
  let tex = fxTexCache.get(key);
  if (tex) return tex;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  drawFn(ctx, size / 2, size / 2, size / 2 - 2);
  tex = PIXI.Texture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR });
  fxTexCache.set(key, tex);
  return tex;
}

function getSoftGlowTex(r: number): PIXI.Texture {
  const rr = Math.max(4, Math.ceil(r));
  return makeTex(`softglow-${rr}`, rr * 2 + 4, (ctx, cx, cy, rad) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.3, "rgba(255,255,255,0.7)");
    g.addColorStop(0.6, "rgba(255,255,255,0.2)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  });
}

function getFireballTex(r: number): PIXI.Texture {
  const rr = Math.max(6, Math.ceil(r));
  return makeTex(`fireball-${rr}`, rr * 2 + 4, (ctx, cx, cy, rad) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.12, "#ffffa0");
    g.addColorStop(0.35, "#ff8800");
    g.addColorStop(0.6, "#cc3300");
    g.addColorStop(0.85, "#330000");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  });
}

function getSmokeTex(r: number): PIXI.Texture {
  const rr = Math.max(6, Math.ceil(r));
  return makeTex(`smoke-${rr}`, rr * 2 + 4, (ctx, cx, cy, rad) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, "rgba(200,190,175,0.7)");
    g.addColorStop(0.35, "rgba(160,150,140,0.45)");
    g.addColorStop(0.7, "rgba(120,110,100,0.2)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  });
}

function getEmberTex(r: number): PIXI.Texture {
  const rr = Math.max(3, Math.ceil(r));
  return makeTex(`ember-${rr}`, rr * 2 + 6, (ctx, cx, cy, rad) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.3, "#ffcc44");
    g.addColorStop(0.7, "#ff6600");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  });
}

function getSparkTex(): PIXI.Texture {
  return makeTex("spark-4", 10, (ctx, cx, cy) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - 1, cy - 3, 2, 6);
    ctx.fillStyle = "#ffffffaa";
    ctx.fillRect(cx - 3, cy - 1, 6, 2);
  });
}

function getDebrisTex(variant: number): PIXI.Texture {
  return makeTex(`debris-burn-${variant}`, 16, (ctx, cx, cy) => {
    ctx.shadowColor = "#ff5500";
    ctx.shadowBlur = 4;
    ctx.fillStyle = variant === 0 ? "#8a7060" : variant === 1 ? "#7a6655" : "#887060";
    ctx.beginPath();
    if (variant === 0) {
      ctx.moveTo(cx - 4, cy - 2);
      ctx.lineTo(cx - 1, cy - 5);
      ctx.lineTo(cx + 4, cy - 3);
      ctx.lineTo(cx + 5, cy + 1);
      ctx.lineTo(cx + 2, cy + 4);
      ctx.lineTo(cx - 3, cy + 3);
    } else if (variant === 1) {
      ctx.moveTo(cx - 3, cy - 4);
      ctx.lineTo(cx + 2, cy - 5);
      ctx.lineTo(cx + 5, cy - 1);
      ctx.lineTo(cx + 3, cy + 4);
      ctx.lineTo(cx - 2, cy + 3);
      ctx.lineTo(cx - 5, cy);
    } else {
      ctx.moveTo(cx, cy - 5);
      ctx.lineTo(cx + 4, cy - 2);
      ctx.lineTo(cx + 3, cy + 3);
      ctx.lineTo(cx - 1, cy + 5);
      ctx.lineTo(cx - 4, cy + 1);
      ctx.lineTo(cx - 3, cy - 3);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#cc6622";
    ctx.fillRect(cx - 1, cy - 1, 3, 2);
  });
}

function getHullFragTex(variant: number): PIXI.Texture {
  return makeTex(`hullfrag-burn-${variant}`, 28, (ctx, cx, cy) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(variant * 0.7);
    // Outer burning glow
    ctx.shadowColor = "#ff6600";
    ctx.shadowBlur = 3;
    if (variant === 0) {
      ctx.fillStyle = "#8a7055";
      ctx.fillRect(-8, -3, 16, 6);
      ctx.fillStyle = "#cc6622";
      ctx.fillRect(-8, -3, 3, 6);
      ctx.fillRect(5, -3, 3, 6);
      ctx.fillStyle = "#aaa090";
      ctx.fillRect(-4, -1, 5, 2);
    } else if (variant === 1) {
      ctx.fillStyle = "#8a7766";
      ctx.beginPath();
      ctx.moveTo(-6, -5);
      ctx.lineTo(7, -3);
      ctx.lineTo(5, 5);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#dd6622";
      ctx.fillRect(-6, -5, 3, 3);
      ctx.fillRect(3, 2, 3, 3);
    } else {
      ctx.fillStyle = "#887766";
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, -2);
      ctx.lineTo(4, 5);
      ctx.lineTo(-5, 6);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#dd7733";
      ctx.fillRect(-7, -2, 3, 4);
      ctx.fillRect(2, 3, 3, 3);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

function getRingTex(r: number): PIXI.Texture {
  const rr = Math.max(8, Math.ceil(r));
  return makeTex(`ring-${rr}`, rr * 2 + 4, (ctx, cx, cy, rad) => {
    ctx.strokeStyle = "rgba(255,200,100,0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,140,40,0.4)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.75, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function getShieldHitTex(): PIXI.Texture {
  return makeTex("shield-hit-32", 64, (ctx, cx, cy) => {
    ctx.strokeStyle = "rgba(78,226,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, -0.6, 0.6);
    ctx.stroke();
    ctx.strokeStyle = "rgba(78,226,255,0.4)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, -0.4, 0.4);
    ctx.stroke();
  });
}

// ══════════════════════════════════════════════════════════════════════════
// EFFECT MANAGER CLASS
// ══════════════════════════════════════════════════════════════════════════

export class EffectManager {
  private behindLayer: PIXI.Container;
  private frontLayer: PIXI.Container;
  private pools: Map<string, PooledParticle[]> = new Map();
  private activeCount = 0;
  private processedEvents = new Set<string>();
  private eventCleanTimer = 0;

  // Debug counters
  debugActiveSparks = 0;
  debugActiveSmoke = 0;
  debugActiveDebris = 0;
  debugActiveFlashes = 0;
  debugActiveTrails = 0;
  debugActiveTotal = 0;


  // Explosion animated sprites (multiple spritesheets for variety)
  private explosionSets: PIXI.Texture[][] = [];
  private activeExplosionAnims: {
    sprite: PIXI.AnimatedSprite;
    life: number;
    maxLife: number;
  }[] = [];
  private explosionSheetsLoaded = 0;

  constructor(behindLayer: PIXI.Container, frontLayer: PIXI.Container) {
    this.behindLayer = behindLayer;
    this.frontLayer = frontLayer;
    this.loadExplosionSheet();
  }

  private loadExplosionSheet(): void {
    const sheets = ["/explosion-spritesheet.png", "/explosion-spritesheet-2.png"];
    for (const src of sheets) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        const baseTex = PIXI.BaseTexture.from(img);
        const cols = 8, rows = 6, fw = 256, fh = 256;
        const textures: PIXI.Texture[] = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            textures.push(
              new PIXI.Texture(baseTex, new PIXI.Rectangle(c * fw, r * fh, fw, fh))
            );
          }
        }
        this.explosionSets.push(textures);
        this.explosionSheetsLoaded++;
      };
    }
  }

  private getPool(kind: string): PooledParticle[] {
    let pool = this.pools.get(kind);
    if (!pool) {
      pool = [];
      this.pools.set(kind, pool);
    }
    return pool;
  }

  private acquire(kind: string, layer: PIXI.Container, tex: PIXI.Texture, blendAdd: boolean): PooledParticle | null {
    if (this.activeCount >= VFX.MAX_ACTIVE_PARTICLES) return null;

    const pool = this.getPool(kind);
    for (const p of pool) {
      if (!p.active) {
        p.active = true;
        p.sprite.visible = true;
        p.sprite.texture = tex;
        p.sprite.blendMode = blendAdd ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL;
        p.kind = kind;
        p.blendAdd = blendAdd;
        this.activeCount++;
        return p;
      }
    }
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.blendMode = blendAdd ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL;
    layer.addChild(sprite);
    const p: PooledParticle = {
      active: true, sprite, x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 1, alpha: 1, startAlpha: 1,
      scaleStart: 1, scaleEnd: 0, rotation: 0, angularVel: 0,
      tint: 0xffffff, kind, blendAdd, trailTimer: 0,
    };
    pool.push(p);
    this.activeCount++;
    return p;
  }

  private release(p: PooledParticle): void {
    p.active = false;
    p.sprite.visible = false;
    this.activeCount--;
  }

  hasProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  markProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
  }

  // ── UPDATE ──────────────────────────────────────────────────────────
  update(dt: number): void {
    let sparks = 0, smoke = 0, debris = 0, flashes = 0, trails = 0;

    for (const [, pool] of this.pools) {
      for (const p of pool) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          this.release(p);
          continue;
        }
        const t = 1 - p.life / p.maxLife;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.angularVel * dt;
        const drag = p.kind === "debris" ? 0.993 : 0.98;
        p.vx *= drag;
        p.vy *= drag;

        const scale = p.scaleStart + (p.scaleEnd - p.scaleStart) * t;
        const alpha = p.startAlpha * (1 - t);

        p.sprite.position.set(p.x, p.y);
        p.sprite.scale.set(Math.max(0.01, scale));
        p.sprite.alpha = Math.max(0, alpha);
        p.sprite.rotation = p.rotation;
        p.sprite.tint = p.tint;

        // Burning debris fire trails
        if (p.kind === "debris" && t < 0.85) {
          p.trailTimer = (p.trailTimer || 0) + dt;
          const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (p.trailTimer > 0.07 && spd > 6) {
            p.trailTimer = 0;
            const trail = this.acquire("spark", this.frontLayer, getEmberTex(6 + Math.random() * 5), true);
            if (trail) {
              trail.x = p.x - p.vx * dt * 2;
              trail.y = p.y - p.vy * dt * 2;
              trail.vx = p.vx * 0.03 + (Math.random() - 0.5) * 3;
              trail.vy = p.vy * 0.03 + (Math.random() - 0.5) * 3;
              trail.life = 0.75 + Math.random() * 0.6;
              trail.maxLife = trail.life;
              trail.startAlpha = 1.0 * (1 - t * 0.4);
              trail.scaleStart = 0.5 + Math.random() * 0.35;
              trail.scaleEnd = 0.03;
              trail.tint = Math.random() > 0.4 ? 0xffaa22 : Math.random() > 0.5 ? 0xff6600 : 0xffcc44;
              trail.rotation = Math.random() * Math.PI * 2;
              trail.angularVel = (Math.random() - 0.5) * 3;
              trail.trailTimer = 0;
            }
            // Occasional second trail spark
            if (Math.random() < 0.4) {
              const t2 = this.acquire("spark", this.frontLayer, getEmberTex(3 + Math.random() * 3), true);
              if (t2) {
                t2.x = p.x - p.vx * dt * 3;
                t2.y = p.y - p.vy * dt * 3;
                t2.vx = p.vx * 0.02 + (Math.random() - 0.5) * 3;
                t2.vy = p.vy * 0.02 + (Math.random() - 0.5) * 3;
                t2.life = 0.5 + Math.random() * 0.4;
                t2.maxLife = t2.life;
                t2.startAlpha = 0.8 * (1 - t * 0.4);
                t2.scaleStart = 0.3 + Math.random() * 0.2;
                t2.scaleEnd = 0.02;
                t2.tint = Math.random() > 0.5 ? 0xffcc44 : 0xff8822;
                t2.rotation = Math.random() * Math.PI * 2;
                t2.angularVel = (Math.random() - 0.5) * 3;
                t2.trailTimer = 0;
              }
            }
          }
        }

        if (p.kind === "spark") sparks++;
        else if (p.kind === "smoke") smoke++;
        else if (p.kind === "debris") debris++;
        else if (p.kind === "flash" || p.kind === "muzzle") flashes++;
        else if (p.kind === "trail") trails++;
      }
    }

    this.debugActiveSparks = sparks;
    this.debugActiveSmoke = smoke;
    this.debugActiveDebris = debris;
    this.debugActiveFlashes = flashes;
    this.debugActiveTrails = trails;
    // Update explosion animated sprites
    for (let i = this.activeExplosionAnims.length - 1; i >= 0; i--) {
      const ea = this.activeExplosionAnims[i];
      ea.life -= dt;
      // Fade out in last 30% of life
      const lifePct = ea.life / ea.maxLife;
      if (lifePct < 0.3) {
        ea.sprite.alpha = lifePct / 0.3 * 0.8;
      }
      if (ea.life <= 0 || !ea.sprite.visible) {
        this.frontLayer.removeChild(ea.sprite);
        ea.sprite.destroy();
        this.activeExplosionAnims.splice(i, 1);
      }
    }

    this.debugActiveTotal = this.activeCount;

    this.eventCleanTimer += dt;
    if (this.eventCleanTimer > 2) {
      this.eventCleanTimer = 0;
      if (this.processedEvents.size > 500) this.processedEvents.clear();
    }
  }

  // ── THRUSTER TRAIL ──────────────────────────────────────────────────
  spawnThrusterTrail(x: number, y: number, angle: number, speed: number, color: number, alphaMultiplier: number = 1, sizeMultiplier: number = 1): void {
    const intensity = Math.min(1, speed / 4);
    if (intensity < 0.05) return;

    const count = intensity > 0.4 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const texR = Math.max(4, Math.round(6 * sizeMultiplier));
      const p = this.acquire("trail", this.behindLayer, getSoftGlowTex(texR), true);
      if (!p) return;
      const back = angle + Math.PI;
      const spread = (Math.random() - 0.5) * 0.4;
      const offset = (2 + Math.random() * 1) * sizeMultiplier;
      p.x = x + Math.cos(back + spread) * offset;
      p.y = y + Math.sin(back + spread) * offset;
      p.vx = Math.cos(back) * (25 + Math.random() * 20) * intensity;
      p.vy = Math.sin(back) * (25 + Math.random() * 20) * intensity;
      p.life = VFX.THRUSTER_PARTICLE_LIFETIME * (0.7 + Math.random() * 0.6) * sizeMultiplier;
      p.maxLife = p.life;
      p.startAlpha = 0.7 * intensity * alphaMultiplier;
      p.scaleStart = (0.18 + intensity * 0.35) * (0.8 + Math.random() * 0.4) * sizeMultiplier;
      p.scaleEnd = 0;
      p.tint = color;
      p.rotation = 0;
      p.angularVel = 0;
    }
  }


  spawnEngineGlow(x: number, y: number, intensity: number, color: number, inFront: boolean = false): void {
    const layer = inFront ? this.frontLayer : this.behindLayer;
    const p = this.acquire(inFront ? "muzzle" : "trail", layer, getSoftGlowTex(12), true);
    if (!p) return;
    const jitter = (Math.random() - 0.5) * 2;
    p.x = x + jitter;
    p.y = y + jitter;
    p.vx = (Math.random() - 0.5) * 4;
    p.vy = (Math.random() - 0.5) * 4;
    p.life = 0.05 + Math.random() * 0.03;
    p.maxLife = p.life;
    p.startAlpha = intensity * (0.45 + Math.random() * 0.25);
    p.scaleStart = 0.5 + intensity * 0.35 + Math.random() * 0.15;
    p.scaleEnd = p.scaleStart * 0.7;
    p.tint = color;
    p.rotation = Math.random() * Math.PI * 2;
    p.angularVel = (Math.random() - 0.5) * 3;
  }


  spawnPlasmaWake(x: number, y: number, angle: number, speed: number, shipWidth: number, color: number): void {
    const intensity = Math.min(1, speed / 4);
    if (intensity < 0.05) return;
    const back = angle + Math.PI;
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);
    const count = 3 + Math.floor(intensity * 2);
    for (let i = 0; i < count; i++) {
      const p = this.acquire("trail", this.behindLayer, getSoftGlowTex(6), true);
      if (!p) return;
      const lateralSpread = (Math.random() - 0.5) * shipWidth * 0.45;
      const backOffset = (3 + Math.random() * 5);
      p.x = x + Math.cos(back) * backOffset + perpX * lateralSpread;
      p.y = y + Math.sin(back) * backOffset + perpY * lateralSpread;
      p.vx = Math.cos(back) * (30 + Math.random() * 20) * intensity + (Math.random() - 0.5) * 6;
      p.vy = Math.sin(back) * (30 + Math.random() * 20) * intensity + (Math.random() - 0.5) * 6;
      p.life = 0.7 * (0.7 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.startAlpha = (0.3 + Math.random() * 0.15) * intensity;
      p.scaleStart = (0.3 + Math.random() * 0.2) * (shipWidth / 50);
      p.scaleEnd = p.scaleStart * 0.2;
      p.tint = color;
      p.rotation = Math.random() * Math.PI * 2;
      p.angularVel = (Math.random() - 0.5) * 2;
    }
  }

  // ── MUZZLE FLASH ────────────────────────────────────────────────────
  spawnMuzzleFlash(x: number, y: number, angle: number, weaponType: string, color: number): void {
    const isRocket = weaponType === "rocket";
    const size = isRocket ? 8 : 7;

    // Core flash
    const f = this.acquire("muzzle", this.frontLayer, getSoftGlowTex(size), true);
    if (!f) return;
    f.x = x + Math.cos(angle) * 6;
    f.y = y + Math.sin(angle) * 6;
    f.vx = Math.cos(angle) * 20;
    f.vy = Math.sin(angle) * 20;
    f.life = isRocket ? 0.12 : 0.06;
    f.maxLife = f.life;
    f.startAlpha = 1;
    f.scaleStart = 1;
    f.scaleEnd = 1.8;
    f.tint = 0xffffff;
    f.rotation = 0;
    f.angularVel = 0;

    // Color burst
    const b = this.acquire("muzzle", this.frontLayer, getSoftGlowTex(size * 1.5), true);
    if (!b) return;
    b.x = f.x;
    b.y = f.y;
    b.vx = f.vx * 0.5;
    b.vy = f.vy * 0.5;
    b.life = isRocket ? 0.16 : 0.08;
    b.maxLife = b.life;
    b.startAlpha = 0.8;
    b.scaleStart = isRocket ? 0.5 : 0.8;
    b.scaleEnd = isRocket ? 1.2 : 2;
    b.tint = color;
    b.rotation = 0;
    b.angularVel = 0;

    if (isRocket) {
      // Small sparks only
      this.spawnSparkBurst(x, y, angle + Math.PI, 3, color);
    }
  }

  // ── ROCKET LAUNCH ───────────────────────────────────────────────────
  spawnRocketLaunch(x: number, y: number, angle: number): void {
    this.spawnMuzzleFlash(x, y, angle, "rocket", 0xff6633);
    // Fire ignition ring (large, bright, visible)
    const r = this.acquire("flash", this.frontLayer, getRingTex(24), true);
    if (r) {
      r.x = x;
      r.y = y;
      r.vx = 0;
      r.vy = 0;
      r.life = 0.3;
      r.maxLife = 0.3;
      r.startAlpha = 1;
      r.scaleStart = 0.2;
      r.scaleEnd = 1.5;
      r.tint = 0xffaa33;
      r.rotation = Math.random() * Math.PI;
      r.angularVel = 3;
    }
    // Secondary fire glow ring
    const r2 = this.acquire("flash", this.frontLayer, getSoftGlowTex(16), true);
    if (r2) {
      r2.x = x;
      r2.y = y;
      r2.vx = 0;
      r2.vy = 0;
      r2.life = 0.2;
      r2.maxLife = 0.2;
      r2.startAlpha = 0.9;
      r2.scaleStart = 0.15;
      r2.scaleEnd = 1.0;
      r2.tint = 0xff8833;
      r2.rotation = 0;
      r2.angularVel = 0;
    }
    // Fire embers from ignition
    for (let i = 0; i < 8; i++) {
      const e = this.acquire("spark", this.frontLayer, getEmberTex(3), true);
      if (!e) break;
      const a = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 40;
      e.x = x; e.y = y;
      e.vx = Math.cos(a) * spd; e.vy = Math.sin(a) * spd;
      e.life = 0.12 + Math.random() * 0.1; e.maxLife = e.life;
      e.startAlpha = 0.9; e.scaleStart = 0.3; e.scaleEnd = 0;
      e.tint = Math.random() > 0.5 ? 0xff6633 : 0xff8844;
      e.rotation = 0; e.angularVel = 0;
    }
  }

  // ── PROJECTILE TRAIL ────────────────────────────────────────────────
  spawnProjectileTrail(x: number, y: number, color: number, weaponType: string): void {
    const isRocket = weaponType === "rocket";

    if (isRocket) {
      // Light smoke wisp (smaller, less prominent)
      if (Math.random() < 0.4) {
        const smoke = this.acquire("trail", this.behindLayer, getSmokeTex(5), false);
        if (smoke) {
          smoke.x = x + (Math.random() - 0.5) * 3;
          smoke.y = y + (Math.random() - 0.5) * 3;
          smoke.vx = (Math.random() - 0.5) * 8;
          smoke.vy = (Math.random() - 0.5) * 8;
          smoke.life = VFX.ROCKET_TRAIL_LIFETIME * 0.5;
          smoke.maxLife = smoke.life;
          smoke.startAlpha = 0.4;
          smoke.scaleStart = 0.25;
          smoke.scaleEnd = 0.8;
          smoke.tint = 0xbbaa99;
          smoke.rotation = Math.random() * Math.PI * 2;
          smoke.angularVel = (Math.random() - 0.5) * 1;
        }
      }
      // Primary fire trail (always spawns, more yellow)
      const fire = this.acquire("trail", this.behindLayer, getEmberTex(5), true);
      if (fire) {
        fire.x = x + (Math.random() - 0.5) * 3;
        fire.y = y + (Math.random() - 0.5) * 3;
        fire.vx = (Math.random() - 0.5) * 15;
        fire.vy = (Math.random() - 0.5) * 15;
        fire.life = 0.25 + Math.random() * 0.2;
        fire.maxLife = fire.life;
        fire.startAlpha = 1;
        fire.scaleStart = 0.35 + Math.random() * 0.25;
        fire.scaleEnd = 0.05;
        fire.tint = Math.random() > 0.3 ? 0xffcc33 : Math.random() > 0.5 ? 0xffaa22 : 0xff8833;
        fire.rotation = 0;
        fire.angularVel = 0;
      }
      // Extra fire spark (yellow)
      if (Math.random() < 0.5) {
        const spark = this.acquire("trail", this.behindLayer, getEmberTex(3), true);
        if (spark) {
          spark.x = x + (Math.random() - 0.5) * 4;
          spark.y = y + (Math.random() - 0.5) * 4;
          spark.vx = (Math.random() - 0.5) * 25;
          spark.vy = (Math.random() - 0.5) * 25;
          spark.life = 0.12 + Math.random() * 0.15;
          spark.maxLife = spark.life;
          spark.startAlpha = 0.9;
          spark.scaleStart = 0.2 + Math.random() * 0.15;
          spark.scaleEnd = 0;
          spark.tint = 0xffdd55;
          spark.rotation = 0;
          spark.angularVel = 0;
        }
      }
    } else {
      // Laser glow trail
      const p = this.acquire("trail", this.behindLayer, getSoftGlowTex(4), true);
      if (!p) return;
      p.x = x + (Math.random() - 0.5) * 2;
      p.y = y + (Math.random() - 0.5) * 2;
      p.vx = (Math.random() - 0.5) * 10;
      p.vy = (Math.random() - 0.5) * 10;
      p.life = VFX.LASER_TRAIL_LIFETIME;
      p.maxLife = p.life;
      p.startAlpha = 0.7;
      p.scaleStart = 0.3;
      p.scaleEnd = 0;
      p.tint = color;
      p.rotation = 0;
      p.angularVel = 0;
    }
  }

  // ── HIT EFFECT ──────────────────────────────────────────────────────
  spawnHitEffect(x: number, y: number, angle: number, weaponType: string, color: number, isShieldHit: boolean): void {
    const isRocket = weaponType === "rocket";
    const sparkCount = isRocket ? VFX.HEAVY_HIT_SPARK_COUNT : VFX.HIT_SPARK_COUNT;

    // Impact flash
    const f = this.acquire("flash", this.frontLayer, getSoftGlowTex(isRocket ? 18 : 10), true);
    if (f) {
      f.x = x;
      f.y = y;
      f.vx = 0;
      f.vy = 0;
      f.life = isRocket ? 0.12 : 0.08;
      f.maxLife = f.life;
      f.startAlpha = 1;
      f.scaleStart = 0.6;
      f.scaleEnd = isRocket ? 3.5 : 2;
      f.tint = 0xffffff;
      f.rotation = 0;
      f.angularVel = 0;
    }

    // Directional sparks (more spread)
    this.spawnSparkBurst(x, y, angle + Math.PI, sparkCount, color);

    // Fire debris flying away from ALL hits (yellow-orange)
    const fireDebrisCount = isRocket ? 8 : 5;
    for (let i = 0; i < fireDebrisCount; i++) {
      const fb = this.acquire("spark", this.frontLayer, getEmberTex(3), true);
      if (!fb) break;
      const a = (angle + Math.PI) + (Math.random() - 0.5) * 2.5;
      const spd = 50 + Math.random() * 80;
      fb.x = x; fb.y = y;
      fb.vx = Math.cos(a) * spd; fb.vy = Math.sin(a) * spd;
      fb.life = 0.15 + Math.random() * 0.2; fb.maxLife = fb.life;
      fb.startAlpha = 1; fb.scaleStart = 0.25 + Math.random() * 0.2; fb.scaleEnd = 0;
      fb.tint = Math.random() > 0.3 ? 0xffcc33 : Math.random() > 0.5 ? 0xffaa22 : 0xff8833;
      fb.rotation = a; fb.angularVel = 0;
    }

    // Light smoke wisp (minimal)
    if (isRocket) {
      this.spawnSmokePuff(x, y, 5);
    }

    // Expanding impact ring
    const ring = this.acquire("flash", this.frontLayer, getSoftGlowTex(14), true);
    if (ring) {
      ring.x = x;
      ring.y = y;
      ring.vx = 0;
      ring.vy = 0;
      ring.life = 0.18;
      ring.maxLife = 0.18;
      ring.startAlpha = 0.5;
      ring.scaleStart = 0.2;
      ring.scaleEnd = isRocket ? 3 : 1.8;
      ring.tint = color;
      ring.rotation = 0;
      ring.angularVel = 0;
    }

    // Shield hit arc
    if (isShieldHit) {
      const s = this.acquire("flash", this.frontLayer, getShieldHitTex(), true);
      if (s) {
        s.x = x;
        s.y = y;
        s.vx = 0;
        s.vy = 0;
        s.life = 0.25;
        s.maxLife = 0.25;
        s.startAlpha = 0.9;
        s.scaleStart = 0.6;
        s.scaleEnd = 1.4;
        s.tint = 0x4ee2ff;
        s.rotation = angle;
        s.angularVel = 0;
      }
    }

    // Glow pulse at impact
    const g = this.acquire("flash", this.frontLayer, getSoftGlowTex(14), true);
    if (g) {
      g.x = x;
      g.y = y;
      g.vx = 0;
      g.vy = 0;
      g.life = 0.15;
      g.maxLife = 0.15;
      g.startAlpha = 0.7;
      g.scaleStart = 0.4;
      g.scaleEnd = 2.5;
      g.tint = color;
      g.rotation = 0;
      g.angularVel = 0;
    }
  }

  // ── EXPLOSION ───────────────────────────────────────────────────────
  spawnExplosion(x: number, y: number, size: number, type: "small" | "medium" | "large"): void {
    this.spawnExplosionAnim(x, y, size, type);

    const fireCount = type === "large" ? VFX.LARGE_EXPLOSION_FIRE_COUNT
      : type === "medium" ? VFX.MEDIUM_EXPLOSION_FIRE_COUNT
      : VFX.SMALL_EXPLOSION_FIRE_COUNT;
    const emberCount = Math.ceil(fireCount * 0.7);
    const hullFragCount = type === "large" ? 10 : type === "medium" ? 6 : 3;
    const sizeScale = size / 15;

    // STAGE 1: Initial white-hot flash
    const flash = this.acquire("flash", this.frontLayer, getSoftGlowTex(14), true);
    if (flash) {
      flash.x = x; flash.y = y; flash.vx = 0; flash.vy = 0;
      flash.life = 0.18; flash.maxLife = 0.18;
      flash.startAlpha = 1;
      flash.scaleStart = sizeScale * 0.3;
      flash.scaleEnd = sizeScale * 3;
      flash.tint = 0xffffff;
      flash.rotation = 0; flash.angularVel = 0;
    }

    // STAGE 2: FIREBALL BUILDUP - swarm of small fire particles building up
    const burstCount = type === "large" ? 14 : type === "medium" ? 9 : 5;
    for (let i = 0; i < burstCount; i++) {
      const useGlow = Math.random() > 0.4;
      const texSz = useGlow ? Math.max(4, Math.round(4 + Math.random() * 5)) : (3 + Math.random() * 4);
      const fb = this.acquire("fire", this.frontLayer, useGlow ? getSoftGlowTex(texSz) : getEmberTex(texSz), true);
      if (!fb) break;
      const a = Math.random() * Math.PI * 2;
      const dist = Math.random() * size * 0.3;
      const spd = 8 + Math.random() * 25;
      fb.x = x + Math.cos(a) * dist * 0.3;
      fb.y = y + Math.sin(a) * dist * 0.3;
      fb.vx = Math.cos(a) * spd + (Math.random() - 0.5) * 10;
      fb.vy = Math.sin(a) * spd + (Math.random() - 0.5) * 10;
      fb.life = 0.5 + Math.random() * 0.7;
      fb.maxLife = fb.life;
      fb.startAlpha = 0.95;
      fb.scaleStart = sizeScale * (0.25 + Math.random() * 0.35);
      fb.scaleEnd = sizeScale * (0.6 + Math.random() * 0.5);
      fb.tint = Math.random() > 0.4 ? 0xffdd55 : Math.random() > 0.5 ? 0xffaa33 : 0xff7722;
      fb.rotation = Math.random() * Math.PI * 2;
      fb.angularVel = (Math.random() - 0.5) * 5;
    }

    // STAGE 3: Bright warm smoke that builds up and spreads outward
    const brightSmokeCount = type === "large" ? 8 : type === "medium" ? 5 : 3;
    for (let i = 0; i < brightSmokeCount; i++) {
      const s = this.acquire("smoke", this.frontLayer, getSmokeTex(10 + Math.random() * 8), false);
      if (!s) break;
      const a = Math.random() * Math.PI * 2;
      const spd = 15 + Math.random() * 40 * sizeScale;
      s.x = x + (Math.random() - 0.5) * size * 0.15;
      s.y = y + (Math.random() - 0.5) * size * 0.15;
      s.vx = Math.cos(a) * spd;
      s.vy = Math.sin(a) * spd;
      s.life = 1.2 + Math.random() * 0.8;
      s.maxLife = s.life;
      s.startAlpha = 0.7;
      s.scaleStart = sizeScale * (0.3 + Math.random() * 0.2);
      s.scaleEnd = sizeScale * (1.5 + Math.random() * 1.0);
      s.tint = Math.random() > 0.5 ? 0xeedd99 : Math.random() > 0.5 ? 0xddcc88 : 0xffeeaa;
      s.rotation = Math.random() * Math.PI * 2;
      s.angularVel = (Math.random() - 0.5) * 1.5;
    }

    // STAGE 4: Fire chunks thrown outward (varied speeds, some fast some slow)
    for (let i = 0; i < fireCount; i++) {
      const isFast = Math.random() > 0.4;
      const texSize = isFast ? (6 + Math.random() * 6) : (12 + Math.random() * 12);
      const p = this.acquire("fire", this.frontLayer, getFireballTex(texSize), true);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const spd = isFast ? (70 + Math.random() * 140 * sizeScale) : (15 + Math.random() * 45 * sizeScale);
      p.x = x + (Math.random() - 0.5) * size * 0.15;
      p.y = y + (Math.random() - 0.5) * size * 0.15;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = isFast ? (0.4 + Math.random() * 0.5) : (0.7 + Math.random() * 0.9);
      p.maxLife = p.life;
      p.startAlpha = 0.95;
      p.scaleStart = sizeScale * (isFast ? (0.25 + Math.random() * 0.25) : (0.4 + Math.random() * 0.4));
      p.scaleEnd = sizeScale * 0.03;
      p.tint = Math.random() > 0.3 ? 0xffcc33 : Math.random() > 0.5 ? 0xffaa00 : 0xff6600;
      p.rotation = Math.random() * Math.PI * 2;
      p.angularVel = (Math.random() - 0.5) * 6;
    }

    // STAGE 5: BIG burning debris chunks with fire trails (like the small ones but bigger)
    const bigDebrisCount = type === "large" ? 6 : type === "medium" ? 4 : 2;
    for (let i = 0; i < bigDebrisCount; i++) {
      const p = this.acquire("debris", this.frontLayer, getFireballTex(8 + Math.random() * 6), false);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const spd = 50 + Math.random() * 130 * sizeScale;
      p.x = x + (Math.random() - 0.5) * size * 0.15;
      p.y = y + (Math.random() - 0.5) * size * 0.15;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = VFX.DEBRIS_LIFETIME * (1.0 + Math.random() * 0.6);
      p.maxLife = p.life;
      p.startAlpha = 1;
      p.scaleStart = sizeScale * (0.5 + Math.random() * 0.5);
      p.scaleEnd = sizeScale * 0.1;
      p.tint = Math.random() > 0.3 ? 0xffaa33 : Math.random() > 0.5 ? 0xff7711 : 0xffcc44;
      p.rotation = Math.random() * Math.PI * 2;
      p.angularVel = (Math.random() - 0.5) * 8;
      p.trailTimer = 0;
    }

    // STAGE 6: Hull fragments flying away (glowy, closer range)
    for (let i = 0; i < hullFragCount; i++) {
      const p = this.acquire("debris", this.frontLayer, getHullFragTex(i % 3), false);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * 90 * sizeScale;
      p.x = x + (Math.random() - 0.5) * size * 0.15;
      p.y = y + (Math.random() - 0.5) * size * 0.15;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = VFX.DEBRIS_LIFETIME * (0.7 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.startAlpha = 1;
      p.scaleStart = sizeScale * (0.7 + Math.random() * 0.6);
      p.scaleEnd = sizeScale * 0.15;
      p.tint = Math.random() > 0.4 ? 0xddaa77 : 0xcc9966;
      p.rotation = Math.random() * Math.PI * 2;
      p.angularVel = (Math.random() - 0.5) * 8;
      p.trailTimer = 0;
    }

    // STAGE 7: Big burning embers thrown outward (the fire chunks the client sees)
    const burnCount = Math.ceil(emberCount * 0.7);
    for (let i = 0; i < burnCount; i++) {
      const isBig = Math.random() > 0.35;
      const texSz = isBig ? (6 + Math.random() * 5) : (3 + Math.random() * 3);
      const p = this.acquire("spark", this.frontLayer, getEmberTex(texSz), true);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const spd = 35 + Math.random() * 150 * sizeScale;
      p.x = x + (Math.random() - 0.5) * size * 0.2;
      p.y = y + (Math.random() - 0.5) * size * 0.2;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = VFX.EMBER_LIFETIME * (0.8 + Math.random() * 1.0);
      p.maxLife = p.life;
      p.startAlpha = 1;
      p.scaleStart = sizeScale * (isBig ? (0.4 + Math.random() * 0.5) : (0.2 + Math.random() * 0.25));
      p.scaleEnd = 0;
      p.tint = Math.random() > 0.3 ? 0xffcc33 : Math.random() > 0.4 ? 0xff8800 : 0xff5500;
      p.rotation = Math.random() * Math.PI * 2;
      p.angularVel = (Math.random() - 0.5) * 4;
    }

    // STAGE 8: Expanding fire rings
    const ringCount = type === "large" ? 3 : type === "medium" ? 2 : 1;
    for (let r = 0; r < ringCount; r++) {
      const ring = this.acquire("flash", this.frontLayer, getRingTex(10 + r * 3), true);
      if (!ring) break;
      ring.x = x; ring.y = y; ring.vx = 0; ring.vy = 0;
      ring.life = 0.6 + r * 0.15;
      ring.maxLife = ring.life;
      ring.startAlpha = 0.5 - r * 0.1;
      ring.scaleStart = sizeScale * (0.15 + r * 0.1);
      ring.scaleEnd = sizeScale * (1.2 + r * 0.5);
      ring.tint = r === 0 ? 0xffcc66 : 0xff8833;
      ring.rotation = Math.random() * Math.PI * 2;
      ring.angularVel = (Math.random() - 0.5) * 1;
    }

    // Outer shockwave
    const shockwave = this.acquire("flash", this.frontLayer, getSoftGlowTex(16), true);
    if (shockwave) {
      shockwave.x = x; shockwave.y = y; shockwave.vx = 0; shockwave.vy = 0;
      shockwave.life = 0.8; shockwave.maxLife = 0.8;
      shockwave.startAlpha = 0.35;
      shockwave.scaleStart = sizeScale * 0.2;
      shockwave.scaleEnd = sizeScale * 2.5;
      shockwave.tint = 0xffcc66;
      shockwave.rotation = 0; shockwave.angularVel = 0;
    }

    // STAGE 9: CENTER FIREBALL - dense cluster of small fire particles on top
    const centerParticleCount = type === "large" ? 18 : type === "medium" ? 12 : 6;
    for (let i = 0; i < centerParticleCount; i++) {
      const useGlow = Math.random() > 0.35;
      const texSz = useGlow ? Math.max(4, Math.round(3 + Math.random() * 6)) : (3 + Math.random() * 5);
      const fb = this.acquire("fire", this.frontLayer, useGlow ? getSoftGlowTex(texSz) : getEmberTex(texSz), true);
      if (!fb) break;
      const a = Math.random() * Math.PI * 2;
      const dist = Math.random() * size * 0.2;
      const spd = 5 + Math.random() * 18;
      fb.x = x + Math.cos(a) * dist * 0.2;
      fb.y = y + Math.sin(a) * dist * 0.2;
      fb.vx = Math.cos(a) * spd + (Math.random() - 0.5) * 8;
      fb.vy = Math.sin(a) * spd + (Math.random() - 0.5) * 8;
      fb.life = 0.8 + Math.random() * 0.8 + (i * 0.02);
      fb.maxLife = fb.life;
      fb.startAlpha = 0.9;
      fb.scaleStart = sizeScale * (0.2 + Math.random() * 0.4);
      fb.scaleEnd = sizeScale * (0.5 + Math.random() * 0.4);
      fb.tint = Math.random() > 0.35 ? 0xffdd55 : Math.random() > 0.5 ? 0xffbb33 : 0xff8822;
      fb.rotation = Math.random() * Math.PI * 2;
      fb.angularVel = (Math.random() - 0.5) * 6;
    }

    // Bright smoke layer on top that builds and fades
    const centerSmokeCount = type === "large" ? 5 : type === "medium" ? 3 : 2;
    for (let i = 0; i < centerSmokeCount; i++) {
      const sm = this.acquire("smoke", this.frontLayer, getSmokeTex(14 + Math.random() * 10), false);
      if (!sm) break;
      const drift = (Math.random() - 0.5) * 10;
      sm.x = x + (Math.random() - 0.5) * size * 0.08;
      sm.y = y + (Math.random() - 0.5) * size * 0.08;
      sm.vx = drift;
      sm.vy = drift * 0.5;
      sm.life = 1.2 + i * 0.12 + Math.random() * 0.6;
      sm.maxLife = sm.life;
      sm.startAlpha = 0.75;
      sm.scaleStart = sizeScale * (0.3 + i * 0.1);
      sm.scaleEnd = sizeScale * (1.6 + Math.random() * 0.8);
      sm.tint = Math.random() > 0.3 ? 0xfff0bb : Math.random() > 0.5 ? 0xffeecc : 0xeeddaa;
      sm.rotation = Math.random() * Math.PI * 2;
      sm.angularVel = (Math.random() - 0.5) * 1;
    }

    // Hot core glow that lingers
    const coreGlow = this.acquire("flash", this.frontLayer, getSoftGlowTex(18), true);
    if (coreGlow) {
      coreGlow.x = x; coreGlow.y = y; coreGlow.vx = 0; coreGlow.vy = 0;
      coreGlow.life = 1.2 + Math.random() * 0.4;
      coreGlow.maxLife = coreGlow.life;
      coreGlow.startAlpha = 0.5;
      coreGlow.scaleStart = sizeScale * 0.3;
      coreGlow.scaleEnd = sizeScale * 1.2;
      coreGlow.tint = 0xffdd88;
      coreGlow.rotation = 0; coreGlow.angularVel = 0;
    }
  }

    // ── SPARK BURST ─────────────────────────────────────────────────────
  spawnSparkBurst(x: number, y: number, angle: number, count: number, color: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquire("spark", this.frontLayer, getSparkTex(), true);
      if (!p) break;
      const spread = (Math.random() - 0.5) * 1.5;
      const spd = 60 + Math.random() * 120;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle + spread) * spd;
      p.vy = Math.sin(angle + spread) * spd;
      p.life = 0.1 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.startAlpha = 1;
      p.scaleStart = 0.6 + Math.random() * 0.4;
      p.scaleEnd = 0;
      p.tint = color;
      p.rotation = angle + spread;
      p.angularVel = 0;
    }
  }

  // ── DEBRIS BURST ────────────────────────────────────────────────────
  spawnDebrisBurst(x: number, y: number, count: number, palette: number[]): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquire("debris", this.frontLayer, getDebrisTex(i % 3), false);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 70;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = VFX.DEBRIS_LIFETIME * (0.4 + Math.random() * 0.6);
      p.maxLife = p.life;
      p.startAlpha = 1;
      p.scaleStart = 0.5 + Math.random() * 0.5;
      p.scaleEnd = 0.1;
      p.tint = palette[i % palette.length];
      p.rotation = Math.random() * Math.PI * 2;
      p.angularVel = (Math.random() - 0.5) * 10;
    }
  }

  // ── SMOKE PUFF ──────────────────────────────────────────────────────
  spawnSmokePuff(x: number, y: number, size: number): void {
    const count = Math.ceil(size / 2.5);
    for (let i = 0; i < count; i++) {
      const p = this.acquire("smoke", this.frontLayer, getSmokeTex(8 + Math.random() * 8), false);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const spd = 8 + Math.random() * 20;
      p.x = x + (Math.random() - 0.5) * size;
      p.y = y + (Math.random() - 0.5) * size;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd - 5;
      p.life = 0.5 + Math.random() * 0.5;
      p.maxLife = p.life;
      p.startAlpha = 0.9;
      p.scaleStart = 0.5;
      p.scaleEnd = 1.8;
      p.tint = Math.random() > 0.5 ? 0xffeedd : 0xeeddcc;
      p.rotation = Math.random() * Math.PI * 2;
      p.angularVel = (Math.random() - 0.5) * 1.5;
    }
  }

  // ── MINI EXPLOSION (rocket impact) ──────────────────────────────────
  spawnMiniExplosion(x: number, y: number): void {
    // Bright flash
    const f = this.acquire("flash", this.frontLayer, getSoftGlowTex(16), true);
    if (f) {
      f.x = x; f.y = y; f.vx = 0; f.vy = 0;
      f.life = 0.1; f.maxLife = 0.1;
      f.startAlpha = 1; f.scaleStart = 0.3; f.scaleEnd = 1.8;
      f.tint = 0xffffff; f.rotation = 0; f.angularVel = 0;
    }
    // Fire ring expanding
    const ring = this.acquire("flash", this.frontLayer, getRingTex(10), true);
    if (ring) {
      ring.x = x; ring.y = y; ring.vx = 0; ring.vy = 0;
      ring.life = 0.2; ring.maxLife = 0.2;
      ring.startAlpha = 0.7; ring.scaleStart = 0.2; ring.scaleEnd = 1.5;
      ring.tint = 0xff6622; ring.rotation = Math.random() * Math.PI; ring.angularVel = 1;
    }
    // Fire spreading outward (more fireballs, faster)
    for (let i = 0; i < 8; i++) {
      const p = this.acquire("fire", this.frontLayer, getFireballTex(3 + Math.random() * 4), true);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 70;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * spd; p.vy = Math.sin(a) * spd;
      p.life = 0.15 + Math.random() * 0.2; p.maxLife = p.life;
      p.startAlpha = 0.9; p.scaleStart = 0.2 + Math.random() * 0.15; p.scaleEnd = 0.03;
      p.tint = Math.random() > 0.3 ? 0xffcc33 : Math.random() > 0.5 ? 0xffaa00 : 0xff7700;
      p.rotation = Math.random() * Math.PI * 2; p.angularVel = (Math.random() - 0.5) * 5;
    }
    // Fire embers flying out
    for (let i = 0; i < 6; i++) {
      const e = this.acquire("spark", this.frontLayer, getEmberTex(2 + Math.random() * 2), true);
      if (!e) break;
      const a = Math.random() * Math.PI * 2;
      const spd = 50 + Math.random() * 80;
      e.x = x; e.y = y;
      e.vx = Math.cos(a) * spd; e.vy = Math.sin(a) * spd;
      e.life = 0.15 + Math.random() * 0.18; e.maxLife = e.life;
      e.startAlpha = 0.9; e.scaleStart = 0.2 + Math.random() * 0.15; e.scaleEnd = 0;
      e.tint = Math.random() > 0.4 ? 0xffcc33 : 0xffaa22;
      e.rotation = 0; e.angularVel = 0;
    }
    // Small debris burst
    this.spawnDebrisBurst(x, y, 3, [0x556677, 0x778899, 0x667788]);
    // Light smoke
    this.spawnSmokePuff(x, y, 5);
  }

  // ── CINEMATIC LASER HIT (on enemies) ──────────────────────────────
  spawnCinematicLaserHit(x: number, y: number, angle: number, color: number, enemySize: number = 0): void {
    // Position already at hit point (edge of enemy, calculated by caller)
    // Bright directional flash
    const f = this.acquire("flash", this.frontLayer, getSoftGlowTex(8), true);
    if (f) {
      f.x = x; f.y = y; f.vx = 0; f.vy = 0;
      f.life = 0.07; f.maxLife = 0.07;
      f.startAlpha = 1; f.scaleStart = 0.3; f.scaleEnd = 1.5;
      f.tint = 0xffffff; f.rotation = 0; f.angularVel = 0;
    }
    // Color glow pulse (small)
    const g = this.acquire("flash", this.frontLayer, getSoftGlowTex(10), true);
    if (g) {
      g.x = x; g.y = y; g.vx = 0; g.vy = 0;
      g.life = 0.1; g.maxLife = 0.1;
      g.startAlpha = 0.6; g.scaleStart = 0.2; g.scaleEnd = 1.2;
      g.tint = color; g.rotation = 0; g.angularVel = 0;
    }
    // Fire debris flying away from hit (yellow-orange tones)
    const backAngle = angle + Math.PI;
    for (let i = 0; i < 8; i++) {
      const p = this.acquire("spark", this.frontLayer, getEmberTex(3), true);
      if (!p) break;
      const spread = (Math.random() - 0.5) * 2.2;
      const spd = 60 + Math.random() * 120;
      p.x = x; p.y = y;
      p.vx = Math.cos(backAngle + spread) * spd;
      p.vy = Math.sin(backAngle + spread) * spd;
      p.life = 0.15 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.startAlpha = 1; p.scaleStart = 0.3 + Math.random() * 0.3; p.scaleEnd = 0;
      p.tint = Math.random() > 0.3 ? 0xffcc33 : Math.random() > 0.5 ? 0xff8833 : 0xffaa44;
      p.rotation = backAngle + spread; p.angularVel = 0;
    }
    // Directional sparks (yellow-white)
    for (let i = 0; i < 6; i++) {
      const p = this.acquire("spark", this.frontLayer, getSparkTex(), true);
      if (!p) break;
      const spread = (Math.random() - 0.5) * 1.6;
      const spd = 80 + Math.random() * 130;
      p.x = x; p.y = y;
      p.vx = Math.cos(backAngle + spread) * spd;
      p.vy = Math.sin(backAngle + spread) * spd;
      p.life = 0.1 + Math.random() * 0.15;
      p.maxLife = p.life;
      p.startAlpha = 1; p.scaleStart = 0.5 + Math.random() * 0.4; p.scaleEnd = 0;
      p.tint = Math.random() > 0.4 ? 0xffffaa : 0xffffff;
      p.rotation = backAngle + spread; p.angularVel = 0;
    }
  }

  // ── SHIELD BREAK ────────────────────────────────────────────────────
  spawnShieldBreak(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      const p = this.acquire("spark", this.frontLayer, getSoftGlowTex(6), true);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 80;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = 0.2 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.startAlpha = 0.9;
      p.scaleStart = 0.4;
      p.scaleEnd = 0;
      p.tint = 0x4ee2ff;
      p.rotation = 0;
      p.angularVel = 0;
    }
    // Ring
    const r = this.acquire("flash", this.frontLayer, getSoftGlowTex(20), true);
    if (r) {
      r.x = x;
      r.y = y;
      r.vx = 0;
      r.vy = 0;
      r.life = 0.25;
      r.maxLife = 0.25;
      r.startAlpha = 0.8;
      r.scaleStart = 0.5;
      r.scaleEnd = 3;
      r.tint = 0x4ee2ff;
      r.rotation = 0;
      r.angularVel = 0;
    }
  }

  // ── CLEANUP ─────────────────────────────────────────────────────────
  spawnExplosionAnim(x: number, y: number, size: number, type: "small" | "medium" | "large"): void {
    if (this.explosionSheetsLoaded === 0 || this.explosionSets.length === 0) return;

    const setIndex = Math.floor(Math.random() * this.explosionSets.length);
    const anim = new PIXI.AnimatedSprite(this.explosionSets[setIndex]);
    anim.anchor.set(0.5);
    anim.position.set(x, y);

    // Randomize scale based on enemy size + random variation
    const baseScale = type === "large" ? 0.9 : type === "medium" ? 0.6 : 0.35;
    const scaleVar = 0.7 + Math.random() * 0.6;
    anim.scale.set(baseScale * scaleVar * Math.min(size / 15, 2.5));

    // Randomize rotation + angular velocity
    anim.rotation = Math.random() * Math.PI * 2;

    // Randomize color tint
    const tints = [0xffffff, 0xffddaa, 0xffcc88, 0xffaa66, 0xff8844, 0xaaccff, 0xccddff, 0xffffcc];
    anim.tint = tints[Math.floor(Math.random() * tints.length)];

    // Randomize animation speed
    const speedVar = 0.25 + Math.random() * 0.2;
    anim.animationSpeed = speedVar;

    // Randomize alpha
    anim.alpha = 0.7 + Math.random() * 0.3;

    // Additive blending for fire look
    anim.blendMode = PIXI.BLEND_MODES.ADD;

    // Random flip
    if (Math.random() > 0.5) anim.scale.x *= -1;
    if (Math.random() > 0.5) anim.scale.y *= -1;

    anim.loop = false;
    anim.gotoAndPlay(0);

    const maxLife = this.explosionSets[setIndex].length / (anim.animationSpeed * 60) + 0.1;
    this.activeExplosionAnims.push({ sprite: anim, life: maxLife, maxLife });
    this.frontLayer.addChild(anim);

    anim.onComplete = () => {
      anim.visible = false;
    };
  }

  destroy(): void {
    for (const [, pool] of this.pools) {
      for (const p of pool) {
        p.sprite.destroy();
      }
    }
    for (const ea of this.activeExplosionAnims) {
      this.frontLayer.removeChild(ea.sprite);
      ea.sprite.destroy();
    }
    this.activeExplosionAnims = [];
    this.pools.clear();
    this.activeCount = 0;
    fxTexCache.clear();
  }
}
