import * as PIXI from "pixi.js";
import { ShipClassId, SHIP_SIZE_SCALE } from "./types";

const ROTATION_FRAME_SHIPS: Set<string> = new Set(["skimmer"]);
import { getShipVisualConfig, getQuality, ShipVisualConfig, EnginePort } from "./ship-visual-config";
import { ShipLightingSystem, ShipLightingFilter } from "./ship-lighting-filter";

// ── Cached textures ────────────────────────────────────────────────────
const texCache = new Map<string, PIXI.Texture>();

function getSoftGlow(radius: number, color = "#ffffff"): PIXI.Texture {
  const key = `sg-${radius}-${color}`;
  let t = texCache.get(key);
  if (t) return t;
  const sz = (radius + 4) * 2;
  const c = document.createElement("canvas");
  c.width = sz; c.height = sz;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, radius + 4);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color + "aa");
  grad.addColorStop(0.7, color + "33");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, sz, sz);
  t = PIXI.Texture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR });
  texCache.set(key, t);
  return t;
}

function getFlameGlow(w: number, h: number): PIXI.Texture {
  const key = `flame-${w}-${h}`;
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = w * 2; c.height = h * 2;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(w, h * 0.4, 0, w, h, h);
  grad.addColorStop(0, "#ffffffee");
  grad.addColorStop(0.2, "#88ccffcc");
  grad.addColorStop(0.5, "#4488ff66");
  grad.addColorStop(0.8, "#2244aa22");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(w, h, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  t = PIXI.Texture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR });
  texCache.set(key, t);
  return t;
}

let shieldTexCache: PIXI.Texture | null = null;
function getShieldTex(radius: number): PIXI.Texture {
  if (shieldTexCache) return shieldTexCache;
  const sz = (radius + 10) * 2;
  const c = document.createElement("canvas");
  c.width = sz; c.height = sz;
  const ctx = c.getContext("2d")!;
  const cx = sz / 2, cy = sz / 2;
  ctx.strokeStyle = "#4ee2ff";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
  ctx.stroke();
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius + 2);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(0.8, "rgba(78,226,255,0.04)");
  grad.addColorStop(1, "rgba(78,226,255,0.08)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, sz, sz);
  shieldTexCache = PIXI.Texture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR });
  return shieldTexCache;
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }

// ── Ship visual state ───────────────────────────────────────────────────
export interface ShipVisualState {
  container: PIXI.Container;
  shadow: PIXI.Sprite;
  rimLight: PIXI.Sprite;
  baseSprite: PIXI.Sprite;
  lightingFilter: ShipLightingFilter | null;
  cockpitGlow: PIXI.Sprite;
  engineContainer: PIXI.Container;
  engineGlows: PIXI.Sprite[];
  engineFlames: PIXI.Sprite[];
  weaponGlows: PIXI.Sprite[];
  shieldSprite: PIXI.Sprite | null;
  damageFlash: PIXI.Sprite;
  config: ShipVisualConfig;
  shipClass: ShipClassId;
  currentSkewX: number;
  currentRotOffset: number;
  currentScaleY: number;
  hoverSeed: number;
  lastHitTime: number;
  lastHitType: "shield" | "hull";
  shieldHitAlpha: number;
}

// Fixed world-space light direction (top-left of screen)
const LIGHT_ANGLE = -Math.PI * 0.75;

export function createShipVisual(
  baseTex: PIXI.Texture,
  shipClass: ShipClassId,
): ShipVisualState {
  const config = getShipVisualConfig(shipClass);
  const sizeScale = SHIP_SIZE_SCALE[shipClass] ?? 1;
  const quality = getQuality();
  const container = new PIXI.Container();

  // 1. Shadow
  const shadow = new PIXI.Sprite(baseTex);
  shadow.anchor.set(0.5);
  shadow.tint = 0x000008;
  shadow.alpha = config.shadow.alpha * 0.5;
  shadow.scale.set(config.shadow.scaleX, config.shadow.scaleY);
  container.addChild(shadow);

  // 2. Engine glow container (behind ship)
  const engineContainer = new PIXI.Container();
  engineContainer.name = "engineLayer";
  const engineGlows: PIXI.Sprite[] = [];
  const engineFlames: PIXI.Sprite[] = [];
  for (const port of config.engines) {
    const glowSize = Math.ceil(6 * port.size * sizeScale);
    const glow = new PIXI.Sprite(getSoftGlow(glowSize));
    glow.anchor.set(0.5);
    glow.blendMode = PIXI.BLEND_MODES.ADD;
    glow.position.set(port.x * sizeScale, port.y * sizeScale);
    glow.alpha = 0;
    engineContainer.addChild(glow);
    engineGlows.push(glow);

    const flameW = Math.ceil(3 * port.size * sizeScale);
    const flameH = Math.ceil(8 * port.size * sizeScale);
    const flame = new PIXI.Sprite(getFlameGlow(flameW, flameH));
    flame.anchor.set(0.5, 0.2);
    flame.blendMode = PIXI.BLEND_MODES.ADD;
    flame.position.set(port.x * sizeScale, port.y * sizeScale);
    flame.alpha = 0;
    engineContainer.addChild(flame);
    engineFlames.push(flame);
  }
  container.addChild(engineContainer);

  // 3. Base ship sprite
  const baseSprite = new PIXI.Sprite(baseTex);
  baseSprite.anchor.set(0.5);

  // Try WebGL shader filter — if it fails, ship still renders fine without it
  let lightingFilter: ShipLightingFilter | null = null;
  try {
    const f = new ShipLightingFilter(quality);
    const rimCfg = config.rimLight;
    f.configure({
      rimColor: [
        ((rimCfg.color >> 16) & 0xff) / 255,
        ((rimCfg.color >> 8) & 0xff) / 255,
        (rimCfg.color & 0xff) / 255,
      ],
      rimIntensity: rimCfg.alpha * 3,
    });
    baseSprite.filters = [f];
    lightingFilter = f;
  } catch (err) {
    console.error("[ShipLighting] Filter failed:", err);
  }
  container.addChild(baseSprite);

  // 3b. Rim light ON TOP — subtle light reflection, not an outline
  const rimLight = new PIXI.Sprite(baseTex);
  rimLight.anchor.set(0.5);
  rimLight.tint = config.rimLight.color;
  rimLight.alpha = 0;
  rimLight.scale.set(1.0 + (config.rimLight.scale - 1.0) * 0.3);
  rimLight.blendMode = PIXI.BLEND_MODES.ADD;
  container.addChild(rimLight);

  // 4. Cockpit glow
  const cpSize = Math.ceil(5 * config.cockpit.size * sizeScale);
  const cockpitGlow = new PIXI.Sprite(getSoftGlow(cpSize));
  cockpitGlow.anchor.set(0.5);
  cockpitGlow.blendMode = PIXI.BLEND_MODES.ADD;
  cockpitGlow.tint = config.cockpit.color;
  cockpitGlow.alpha = quality === "LOW" ? 0 : 0.25;
  cockpitGlow.position.set(config.cockpit.x * sizeScale, config.cockpit.y * sizeScale);
  container.addChild(cockpitGlow);

  // 5. Weapon glow points
  const weaponGlows: PIXI.Sprite[] = [];
  if (quality !== "LOW") {
    for (const wp of config.weaponPoints) {
      const wg = new PIXI.Sprite(getSoftGlow(Math.ceil(3 * sizeScale)));
      wg.anchor.set(0.5);
      wg.blendMode = PIXI.BLEND_MODES.ADD;
      wg.tint = 0x4ee2ff;
      wg.alpha = 0.08;
      wg.position.set(wp.x * sizeScale, wp.y * sizeScale);
      container.addChild(wg);
      weaponGlows.push(wg);
    }
  }

  // 6. Damage flash
  const damageFlash = new PIXI.Sprite(baseTex);
  damageFlash.anchor.set(0.5);
  damageFlash.blendMode = PIXI.BLEND_MODES.ADD;
  damageFlash.alpha = 0;
  damageFlash.tint = 0xffffff;
  container.addChild(damageFlash);

  // 7. Shield overlay
  let shieldSprite: PIXI.Sprite | null = null;
  if (quality !== "LOW") {
    const shieldR = Math.ceil(20 * sizeScale);
    shieldSprite = new PIXI.Sprite(getShieldTex(shieldR));
    shieldSprite.anchor.set(0.5);
    shieldSprite.blendMode = PIXI.BLEND_MODES.ADD;
    shieldSprite.alpha = 0;
    container.addChild(shieldSprite);
  }

  return {
    container, shadow, rimLight, baseSprite, lightingFilter,
    cockpitGlow,
    engineContainer, engineGlows, engineFlames, weaponGlows,
    shieldSprite, damageFlash,
    config, shipClass,
    currentSkewX: 0, currentRotOffset: 0, currentScaleY: 1,
    hoverSeed: Math.random() * Math.PI * 2,
    lastHitTime: 0, lastHitType: "hull", shieldHitAlpha: 0,
  };
}

export function updateShipVisual(
  vs: ShipVisualState,
  baseTex: PIXI.Texture,
  rotation: number,
  velX: number, velY: number, speed: number,
  tick: number, dt: number,
  shield: number, shieldMax: number,
): void {
  const cfg = vs.config;
  const sizeScale = SHIP_SIZE_SCALE[vs.shipClass] ?? 1;
  const quality = getQuality();

  if (vs.baseSprite.texture !== baseTex) {
    vs.baseSprite.texture = baseTex;
    vs.shadow.texture = baseTex;
    vs.rimLight.texture = baseTex;
    vs.damageFlash.texture = baseTex;
  }

  // ── Rotation ─────────────────────────────────────────────────────
  vs.baseSprite.rotation = rotation;
  vs.shadow.rotation = rotation;
  vs.rimLight.rotation = rotation;
  vs.damageFlash.rotation = rotation;

  // ── Update shader lighting if active ──
  if (vs.lightingFilter) {
    const damage = vs.damageFlash.alpha > 0 ? vs.damageFlash.alpha : 0;
    vs.lightingFilter.update(rotation, tick, speed, damage);
  }

  // ── Shadow drops away from world light ────────────────────────────
  const shadowDist = 4 * sizeScale;
  vs.shadow.position.set(
    Math.cos(LIGHT_ANGLE + Math.PI) * shadowDist,
    Math.sin(LIGHT_ANGLE + Math.PI) * shadowDist,
  );

  // ── Movement tilt — asymmetric ────────────────────────────────────
  if (quality !== "LOW" && !ROTATION_FRAME_SHIPS.has(vs.shipClass)) {
    const targetSkewX = clamp(velX * cfg.tilt.skewFactor * 1.5, -0.12, 0.12);
    const targetRotOff = clamp(velX * cfg.tilt.rotFactor * 1.5, -0.04, 0.04);
    const targetScaleY = 1 - clamp(Math.abs(velY) * cfg.tilt.scaleFactor * 1.5, 0, 0.06);
    const engaging = Math.abs(targetSkewX) > Math.abs(vs.currentSkewX) + 0.001;
    const tiltLerp = Math.min(1, dt * (engaging ? 5 : 1.2));
    vs.currentSkewX = lerp(vs.currentSkewX, targetSkewX, tiltLerp);
    vs.currentRotOffset = lerp(vs.currentRotOffset, targetRotOff, tiltLerp);
    vs.currentScaleY = lerp(vs.currentScaleY, targetScaleY, tiltLerp);
    vs.baseSprite.skew.x = vs.currentSkewX;
    vs.baseSprite.scale.y = vs.currentScaleY;
    vs.rimLight.skew.x = vs.currentSkewX * 0.8;
    vs.shadow.skew.x = vs.currentSkewX * 1.2;
  }

  // ── Idle hover ────────────────────────────────────────────────────
  const hoverY = quality !== "LOW" ? Math.sin(tick * cfg.hover.speed + vs.hoverSeed) * cfg.hover.amplitude : 0;
  const hoverRot = quality !== "LOW" ? Math.sin(tick * 1.3 + vs.hoverSeed) * 0.008 : 0;
  if (quality !== "LOW" && !ROTATION_FRAME_SHIPS.has(vs.shipClass)) {
    vs.baseSprite.position.set(0, hoverY);
    vs.rimLight.position.set(0, hoverY);
    vs.damageFlash.position.set(0, hoverY);

    vs.baseSprite.rotation = rotation + hoverRot + vs.currentRotOffset;
    vs.rimLight.rotation = rotation + hoverRot + vs.currentRotOffset * 0.8;
    vs.shadow.rotation = rotation + hoverRot + vs.currentRotOffset * 1.2;
  } else if (ROTATION_FRAME_SHIPS.has(vs.shipClass)) {
    vs.baseSprite.rotation = rotation;
    vs.shadow.rotation = rotation;
    vs.rimLight.rotation = rotation;
  }

  // ── Parallax ──────────────────────────────────────────────────────
  if (quality === "HIGH") {
    const px = velX * 0.015 * cfg.parallax;
    const py = velY * 0.015 * cfg.parallax;
    const sd = 4 * sizeScale;
    vs.shadow.position.set(
      Math.cos(LIGHT_ANGLE + Math.PI) * sd + px * 2,
      Math.sin(LIGHT_ANGLE + Math.PI) * sd + py * 2,
    );
    vs.cockpitGlow.position.set(
      cfg.cockpit.x * sizeScale - px * 0.5,
      cfg.cockpit.y * sizeScale - py * 0.5 + hoverY,
    );
  }

  // ── Engine glow ───────────────────────────────────────────────────
  const thrustIntensity = clamp(speed / 150, 0, 1);
  const flicker = 0.75 + 0.25 * Math.sin(tick * 22 + vs.hoverSeed);
  for (let i = 0; i < vs.engineGlows.length; i++) {
    const eg = vs.engineGlows[i];
    const ef = vs.engineFlames[i];
    if (thrustIntensity > 0.02) {
      eg.alpha = thrustIntensity * flicker * 0.4;
      eg.scale.set(0.8 + thrustIntensity * 0.4);
      eg.tint = 0x4488ff;
      ef.alpha = thrustIntensity * 0.5 * flicker;
      ef.scale.set(0.5 + thrustIntensity * 0.4, 0.7 + thrustIntensity * 0.6 + Math.sin(tick * 30 + i) * 0.12);
    } else {
      eg.alpha = 0.03;
      eg.scale.set(0.4);
      eg.tint = 0x224488;
      ef.alpha = 0;
    }
    eg.rotation = rotation;
    ef.rotation = rotation;
  }
  vs.engineContainer.rotation = 0;

  // ── Cockpit glow pulse ────────────────────────────────────────────
  if (quality !== "LOW") {
    vs.cockpitGlow.alpha = 0.20 + 0.08 * Math.sin(tick * 2.5 + vs.hoverSeed);
    vs.cockpitGlow.rotation = rotation;
  }

  // ── Weapon glow pulse ─────────────────────────────────────────────
  for (let i = 0; i < vs.weaponGlows.length; i++) {
    vs.weaponGlows[i].alpha = 0.06 + 0.04 * Math.sin(tick * 3 + i * 1.5);
    vs.weaponGlows[i].rotation = rotation;
  }

  // ── Rim light pulse ───────────────────────────────────────────────
  vs.rimLight.alpha = 0;

  // ── Shield ────────────────────────────────────────────────────────
  if (vs.shieldSprite) {
    if (shield > 0) {
      const baseAlpha = 0.08 + 0.05 * (shield / Math.max(1, shieldMax));
      vs.shieldSprite.alpha = Math.max(0, baseAlpha + 0.03 * Math.sin(tick * 3) + vs.shieldHitAlpha);
      vs.shieldSprite.rotation = tick * 0.3;
      vs.shieldSprite.visible = true;
    } else {
      vs.shieldSprite.visible = false;
    }
    if (vs.shieldHitAlpha > 0) vs.shieldHitAlpha = Math.max(0, vs.shieldHitAlpha - dt * 6);
  }

  // ── Damage flash decay ────────────────────────────────────────────
  if (vs.damageFlash.alpha > 0) {
    vs.damageFlash.alpha = Math.max(0, vs.damageFlash.alpha - dt * 12);
  }
}

export function triggerDamageFlash(vs: ShipVisualState, isShield: boolean): void {
  vs.damageFlash.tint = isShield ? 0x4ee2ff : 0xff8844;
  vs.damageFlash.alpha = isShield ? 0.5 : 0.65;
  vs.lastHitTime = performance.now();
  vs.lastHitType = isShield ? "shield" : "hull";
  if (vs.shieldSprite && isShield) {
    vs.shieldHitAlpha = 0.5;
    vs.shieldSprite.scale.set(1.08);
  }
}

export function triggerMuzzleFlash(vs: ShipVisualState): void {
  for (const wg of vs.weaponGlows) {
    wg.alpha = 0.6;
    wg.scale.set(2.0);
  }
}

export function updateMuzzleDecay(vs: ShipVisualState, dt: number): void {
  for (const wg of vs.weaponGlows) {
    if (wg.alpha > 0.1) {
      wg.alpha = Math.max(0.06, wg.alpha - dt * 8);
      wg.scale.x = Math.max(1, wg.scale.x - dt * 12);
      wg.scale.y = wg.scale.x;
    }
  }
}

export function updateShipTexture(vs: ShipVisualState, newTex: PIXI.Texture): void {
  vs.baseSprite.texture = newTex;
  vs.shadow.texture = newTex;
  vs.rimLight.texture = newTex;
  vs.damageFlash.texture = newTex;
}
