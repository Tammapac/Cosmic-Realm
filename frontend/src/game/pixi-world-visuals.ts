/**
 * Enhanced World Visuals for Cosmic Realm
 * Provides rich PixiJS-native drawing for portals, stations, and asteroids
 */
import * as PIXI from "pixi.js";

// ══════════════════════════════════════════════════════════════════════════
// PORTAL / GATE VISUALS
// ══════════════════════════════════════════════════════════════════════════

// ── Portal spritesheet atlas (loaded once, reused for all portals) ────────
let _portalSheet: PIXI.Spritesheet | null = null;
let _portalSheetLoading = false;

function _loadPortalSheet(): void {
  if (_portalSheet || _portalSheetLoading) return;
  _portalSheetLoading = true;
  (PIXI.Assets as any).load("/sprites/portal_spritesheet.json")
    .then((sheet: PIXI.Spritesheet) => {
      _portalSheet = sheet;
      _portalSheetLoading = false;
    })
    .catch((e: any) => {
      console.warn("[portal] Failed to load spritesheet:", e);
      _portalSheetLoading = false;
    });
}

// Pre-warm the load as soon as this module is imported
_loadPortalSheet();

export function createPortalVisual(toZoneName: string, toZoneColor?: string): PIXI.Container {
  const container = new PIXI.Container();
  const PORTAL_SIZE = 512;

  if (_portalSheet) {
    // ── Animated sprite portal ──────────────────────────────────────────
    const frames = _portalSheet.animations["portal"];
    const anim = new PIXI.AnimatedSprite(frames);
    anim.name = "anim";
    anim.anchor.set(0.5);
    // Scale to PORTAL_SIZE, mirror horizontally to face right
    anim.scale.set(PORTAL_SIZE / 512, PORTAL_SIZE / 512);
    anim.animationSpeed = 0.15;
    anim.loop = true;
    anim.play();
    container.addChild(anim);
  } else {
    // ── Fallback: simple placeholder circle while sheet loads ───────────
    const ph = new PIXI.Graphics();
    ph.name = "placeholder";
    ph.lineStyle(2, 0x4ee2ff, 0.8);
    ph.drawCircle(0, 0, PORTAL_SIZE / 2);
    container.addChild(ph);
    // Retry next frame until sheet is ready
    const retry = setInterval(() => {
      if (!_portalSheet) return;
      clearInterval(retry);
      const old = container.getChildByName("placeholder");
      if (old) { container.removeChild(old); old.destroy(); }
      const frames = _portalSheet.animations["portal"];
      const anim = new PIXI.AnimatedSprite(frames);
      anim.name = "anim";
      anim.anchor.set(0.5);
      anim.scale.set(PORTAL_SIZE / 512, PORTAL_SIZE / 512);
      anim.animationSpeed = 0.15;
      anim.loop = true;
      anim.play();
      container.addChildAt(anim, 0);
    }, 200);
  }

  // Destination label
  const label = new PIXI.Text(toZoneName, {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 11,
    fill: "#4ee2ff",
    fontWeight: "bold",
    stroke: "#000000",
    strokeThickness: 1,
  });
  label.resolution = 2;
  label.anchor.set(0.5, 0);
  label.position.set(0, PORTAL_SIZE / 2 + 6);
  container.addChild(label);

  // "GATE" sub-label
  const gateLabel = new PIXI.Text("GATE", {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 9,
    fill: "#4ee2ff",
    letterSpacing: 2,
    stroke: "#000000",
    strokeThickness: 1,
  });
  gateLabel.resolution = 2;
  gateLabel.anchor.set(0.5, 1);
  gateLabel.position.set(0, -(PORTAL_SIZE / 2 + 6));
  container.addChild(gateLabel);

  return container;
}

// AnimatedSprite drives its own ping-pong via onComplete — no per-tick update needed.
export function updatePortalAnimation(_container: PIXI.Container, _tick: number): void {}

// ══════════════════════════════════════════════════════════════════════════
// STATION VISUALS
// ══════════════════════════════════════════════════════════════════════════

const STATION_ACCENT: Record<string, number> = {
  trade: 0xffd24a,
  repair: 0x44ff66,
  hub: 0x4ee2ff,
  faction: 0xff6b6b,
  industrial: 0xff8844,
  military: 0xff3b4d,
};

const STATION_FRAMES = 256;
// Display size in world units (~200px wide on screen)
const STATION_DISPLAY_PX = 1843;

const _stationTextures: PIXI.Texture[] = [];

function _ensureStationTextures(): void {
  if (_stationTextures.length > 0) return;
  for (let i = 1; i <= STATION_FRAMES; i++) {
    const path = `/sprites/station/station_${String(i).padStart(3, "0")}.png`;
    _stationTextures.push(PIXI.Texture.from(path));
  }
}

export function createStationVisual(
  stationName: string,
  stationKind: string,
  glyphChar: string,
): PIXI.Container {
  _ensureStationTextures();

  const container = new PIXI.Container();
  const accent = STATION_ACCENT[stationKind] || 0x4ee2ff;
  const accentStr = "#" + accent.toString(16).padStart(6, "0");

  // Single sprite — 256 frames gives 1.4° per frame, smooth enough without crossfade
  const scale = STATION_DISPLAY_PX / 512;

  const body = new PIXI.Sprite(_stationTextures[0] ?? PIXI.Texture.WHITE);
  body.name = "stBody";
  body.anchor.set(0.5);
  body.scale.set(scale);
  container.addChild(body);

  // Docking range indicator ring
  const dockRing = new PIXI.Graphics();
  dockRing.name = "dockRing";
  dockRing.lineStyle(1, accent, 0.12);
  for (let i = 0; i < 12; i++) {
    const a1 = (i / 12) * Math.PI * 2 + 0.05;
    const a2 = ((i + 1) / 12) * Math.PI * 2 - 0.05;
    dockRing.arc(0, 0, 110, a1, a2);
    dockRing.moveTo(0, 0);
  }
  container.addChild(dockRing);

  // Station name
  const nameText = new PIXI.Text(stationName, {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    fill: "#ffffff",
    fontWeight: "bold",
    letterSpacing: 1,
    stroke: "#000000",
    strokeThickness: 1.5,
  });
  nameText.resolution = 2;
  nameText.anchor.set(0.5, 1);
  nameText.position.set(0, -115);
  container.addChild(nameText);

  // Kind label
  const kindLabel = new PIXI.Text(`${glyphChar} ${stationKind.toUpperCase()}`, {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 11,
    fill: accentStr,
    fontWeight: "bold",
    letterSpacing: 1,
    stroke: "#000000",
    strokeThickness: 1,
  });
  kindLabel.resolution = 2;
  kindLabel.anchor.set(0.5, 1);
  kindLabel.position.set(0, -98);
  container.addChild(kindLabel);

  // Dock label
  const dockLabel = new PIXI.Text("[ DOCK ]", {
    fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 11,
    fill: accentStr,
    fontWeight: "bold",
    letterSpacing: 1,
    stroke: "#000000",
    strokeThickness: 1,
  });
  dockLabel.resolution = 2;
  dockLabel.anchor.set(0.5, 0);
  dockLabel.position.set(0, 115);
  container.addChild(dockLabel);

  return container;
}

export function updateStationAnimation(container: PIXI.Container, tick: number): void {
  if (_stationTextures.length === 0) return;

  // 60 seconds per full rotation — one frame every ~14 ticks, very slow and steady
  const TICKS_PER_ROTATION = 3600;
  const t = (tick % TICKS_PER_ROTATION) / TICKS_PER_ROTATION;
  const frame = Math.floor(t * STATION_FRAMES) % STATION_FRAMES;

  const body = container.getChildByName("stBody") as PIXI.Sprite;
  if (body) {
    const tex = _stationTextures[frame];
    if (tex && body.texture !== tex) body.texture = tex;
    body.rotation = 0;
  }

  const dockRing = container.getChildByName("dockRing") as PIXI.Graphics;
  if (dockRing) dockRing.rotation = tick * 0.005;
}

// ══════════════════════════════════════════════════════════════════════════
// ASTEROID VISUALS — Rich procedural rocky shapes
// ══════════════════════════════════════════════════════════════════════════

const RESOURCE_COLORS: Record<string, { vein: string; glow: string }> = {
  // mineable ores (zone asteroid drops)
  iron:            { vein: "#c69060", glow: "#d8a878" },
  copper:          { vein: "#e8a050", glow: "#ffc080" },
  cobalt:          { vein: "#4466cc", glow: "#6688ee" },
  lumenite:        { vein: "#7ad8ff", glow: "#a0e8ff" },
  "crystal-shard": { vein: "#cc88ff", glow: "#ddaaff" },
  palladium:       { vein: "#d4e4f0", glow: "#e8f0ff" },
  "helium-3":      { vein: "#88ddaa", glow: "#aaeecc" },
  iridium:         { vein: "#f0e068", glow: "#fff088" },
  sulfur:          { vein: "#cccc44", glow: "#eedd66" },
  obsidian:        { vein: "#6644aa", glow: "#8866cc" },
  // salvage / drop resources
  scrap:           { vein: "#aaaaaa", glow: "#cccccc" },
  plasma:          { vein: "#ff8866", glow: "#ffaa88" },
  warp:            { vein: "#aa44ff", glow: "#cc66ff" },
  void:            { vein: "#44ffe2", glow: "#66fff0" },
  dread:           { vein: "#ffaa22", glow: "#ffcc44" },
  // additional materials
  titanium:        { vein: "#c0c8d8", glow: "#d0d8e8" },
  quantum:         { vein: "#ff5cf0", glow: "#ff88f4" },
  "refined-alloy": { vein: "#dd8844", glow: "#eea866" },
  "crystal-matrix":{ vein: "#dd88ff", glow: "#eeaaff" },
  "fusion-core":   { vein: "#88ffaa", glow: "#aaffcc" },
  "void-steel":    { vein: "#8866cc", glow: "#aa88ee" },
  "nano-compound": { vein: "#66ddcc", glow: "#88eeee" },
  "plasma-cell":   { vein: "#ff8866", glow: "#ffaa88" },
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

function shadeColor(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

export function createAsteroidTexture(
  size: number,
  yields: string,
  idSeed: number
): PIXI.Texture {
  const margin = 10;
  const canvasSz = Math.ceil(size * 3) + margin * 2;
  const c = document.createElement("canvas");
  c.width = canvasSz;
  c.height = canvasSz;
  const ctx = c.getContext("2d")!;
  const cx = canvasSz / 2;
  const cy = canvasSz / 2;

  const rng = seedRng(idSeed);

  // Resource color for body tinting
  const res = RESOURCE_COLORS[yields];
  const baseHex = res ? res.vein : "#8a7a60";
  const darkBase = shadeColor(baseHex, 0.3);
  const midBase = shadeColor(baseHex, 0.45);
  const lightBase = shadeColor(baseHex, 0.6);
  const edgeColor = shadeColor(baseHex, 0.2);

  // Generate irregular rocky polygon
  const points = 10 + Math.floor(rng() * 6);
  const verts: { x: number; y: number }[] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const r = size * (0.6 + rng() * 0.4);
    verts.push({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
    });
  }

  // Dark rocky base (tinted with resource color)
  ctx.fillStyle = darkBase;
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) {
    ctx.lineTo(verts[i].x, verts[i].y);
  }
  ctx.closePath();
  ctx.fill();

  // Light face shading (top-left light source)
  ctx.fillStyle = midBase;
  ctx.beginPath();
  const mid = Math.floor(verts.length / 2);
  ctx.moveTo(cx, cy);
  for (let i = 0; i <= mid; i++) {
    ctx.lineTo(verts[i].x, verts[i].y);
  }
  ctx.closePath();
  ctx.fill();

  // Highlight face
  ctx.fillStyle = lightBase;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  for (let i = 0; i <= Math.floor(points / 3); i++) {
    ctx.lineTo(verts[i].x, verts[i].y);
  }
  ctx.closePath();
  ctx.fill();

  // Cracks
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 1;
  for (let i = 0; i < 2 + Math.floor(rng() * 3); i++) {
    const startVert = Math.floor(rng() * verts.length);
    ctx.beginPath();
    ctx.moveTo(verts[startVert].x, verts[startVert].y);
    const crackLen = 2 + Math.floor(rng() * 3);
    let px = verts[startVert].x;
    let py = verts[startVert].y;
    for (let j = 0; j < crackLen; j++) {
      px += (cx - px) * 0.3 + (rng() - 0.5) * size * 0.3;
      py += (cy - py) * 0.3 + (rng() - 0.5) * size * 0.3;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Resource veins (brighter accent lines)
  if (res) {
    ctx.strokeStyle = res.vein;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
      const sv = Math.floor(rng() * verts.length);
      ctx.beginPath();
      let px = verts[sv].x * 0.7 + cx * 0.3;
      let py = verts[sv].y * 0.7 + cy * 0.3;
      ctx.moveTo(px, py);
      for (let j = 0; j < 3; j++) {
        px += (rng() - 0.5) * size * 0.4;
        py += (rng() - 0.5) * size * 0.4;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Mineral node glow spots
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 1 + Math.floor(rng() * 2); i++) {
      const gx = cx + (rng() - 0.5) * size * 0.8;
      const gy = cy + (rng() - 0.5) * size * 0.8;
      const gr = 2 + rng() * 3;
      const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * 2);
      grd.addColorStop(0, res.glow);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(gx, gy, gr * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(gx, gy, gr * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4;
    }
    ctx.globalAlpha = 1;
  }

  // Subtle rocky edge outline
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) {
    ctx.lineTo(verts[i].x, verts[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  // Top-left highlight edge
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i <= Math.floor(points / 3); i++) {
    ctx.lineTo(verts[i].x, verts[i].y);
  }
  ctx.stroke();

  return PIXI.Texture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR });
}

function seedRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s >>> 16) / 32768;
  };
}

// ══════════════════════════════════════════════════════════════════════════
// ENHANCED BACKGROUND ELEMENTS
// ══════════════════════════════════════════════════════════════════════════

export const ENHANCED_STAR_LAYERS = [
  { count: 350, speed: 0.04, minSize: 0.5, maxSize: 1, colors: ["#141e3d", "#1a2950", "#1e2848"] },
  { count: 250, speed: 0.1, minSize: 0.5, maxSize: 1.5, colors: ["#2a3960", "#3a4980", "#334070"] },
  { count: 160, speed: 0.25, minSize: 1, maxSize: 2, colors: ["#6070b0", "#7a8ad8", "#5a6ab0"] },
  { count: 80, speed: 0.5, minSize: 1.5, maxSize: 2.5, colors: ["#c0d0ff", "#e8f0ff", "#d8e4ff"] },
  { count: 20, speed: 0.65, minSize: 2, maxSize: 3, colors: ["#ffffff", "#ffe8d0", "#d8e4ff"] },
];

export interface EnhancedStar {
  x: number;
  y: number;
  size: number;
  color: number;
  speed: number;
  twinklePhase: number;
  twinkleSpeed: number;
}

export function generateEnhancedStars(w: number, h: number): EnhancedStar[][] {
  const layers: EnhancedStar[][] = [];
  for (const layer of ENHANCED_STAR_LAYERS) {
    const arr: EnhancedStar[] = [];
    for (let i = 0; i < layer.count; i++) {
      const colorStr = layer.colors[Math.floor(Math.random() * layer.colors.length)];
      arr.push({
        x: Math.random() * w * 2,
        y: Math.random() * h * 2,
        size: layer.minSize + Math.random() * (layer.maxSize - layer.minSize),
        color: PIXI.utils.string2hex(colorStr),
        speed: layer.speed,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.5 + Math.random() * 2,
      });
    }
    layers.push(arr);
  }
  return layers;
}

export function renderEnhancedStars(
  g: PIXI.Graphics,
  layers: EnhancedStar[][],
  cam: { x: number; y: number },
  w: number, h: number,
  tick: number
): void {
  g.clear();
  for (const layer of layers) {
    for (const s of layer) {
      const sx = ((s.x - cam.x * s.speed) % w + w * 1.5) % w;
      const sy = ((s.y - cam.y * s.speed) % h + h * 1.5) % h;
      const twinkle = s.size > 1.5
        ? 0.6 + 0.4 * Math.sin(tick * s.twinkleSpeed + s.twinklePhase)
        : 1;
      g.beginFill(s.color, twinkle);
      if (s.size <= 1) {
        g.drawRect(sx, sy, s.size, s.size);
      } else {
        g.drawCircle(sx, sy, s.size * 0.5);
      }
      g.endFill();
    }
  }
}
