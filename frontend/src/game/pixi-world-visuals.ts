/**
 * Enhanced World Visuals for Cosmic Realm
 * Provides rich PixiJS-native drawing for portals, stations, and asteroids
 */
import * as PIXI from "pixi.js";

// ══════════════════════════════════════════════════════════════════════════
// PORTAL / GATE VISUALS
// ══════════════════════════════════════════════════════════════════════════

export function createPortalVisual(toZoneName: string, toZoneColor?: string): PIXI.Container {
  const container = new PIXI.Container();
  const color = toZoneColor ? PIXI.utils.string2hex(toZoneColor) : 0x4ee2ff;

  // Outer gate frame: 8-segment ring with struts
  const frame = new PIXI.Graphics();
  frame.name = "frame";
  const gateR = 24;
  const strutLen = 8;

  // Support struts (8 spokes)
  frame.lineStyle(2, color, 0.5);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x1 = Math.cos(a) * (gateR - 2);
    const y1 = Math.sin(a) * (gateR - 2);
    const x2 = Math.cos(a) * (gateR + strutLen);
    const y2 = Math.sin(a) * (gateR + strutLen);
    frame.moveTo(x1, y1);
    frame.lineTo(x2, y2);
  }

  // Outer segmented ring
  frame.lineStyle(2.5, color, 0.7);
  for (let i = 0; i < 8; i++) {
    const a1 = (i / 8) * Math.PI * 2 + 0.08;
    const a2 = ((i + 1) / 8) * Math.PI * 2 - 0.08;
    frame.arc(0, 0, gateR + strutLen, a1, a2);
    frame.moveTo(0, 0);
  }

  // Inner structural ring
  frame.lineStyle(1.5, color, 0.4);
  frame.drawCircle(0, 0, gateR);

  container.addChild(frame);

  // Light nodes at strut endpoints
  const nodes = new PIXI.Graphics();
  nodes.name = "nodes";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const nx = Math.cos(a) * (gateR + strutLen);
    const ny = Math.sin(a) * (gateR + strutLen);
    nodes.beginFill(0xffffff, 0.9);
    nodes.drawCircle(nx, ny, 2);
    nodes.endFill();
    nodes.beginFill(color, 0.4);
    nodes.drawCircle(nx, ny, 4);
    nodes.endFill();
  }
  container.addChild(nodes);

  // Inner energy field (animated separately)
  const energy = new PIXI.Graphics();
  energy.name = "energy";
  energy.beginFill(color, 0.08);
  energy.drawCircle(0, 0, gateR - 2);
  energy.endFill();
  container.addChild(energy);

  // Energy swirl rings (inner animated elements)
  const swirl = new PIXI.Graphics();
  swirl.name = "swirl";
  container.addChild(swirl);

  // Core glow
  const core = new PIXI.Graphics();
  core.name = "core";
  core.beginFill(0xffffff, 0.12);
  core.drawCircle(0, 0, 8);
  core.endFill();
  core.beginFill(color, 0.06);
  core.drawCircle(0, 0, 14);
  core.endFill();
  container.addChild(core);

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
  label.position.set(0, gateR + strutLen + 8);
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
  gateLabel.position.set(0, -(gateR + strutLen + 6));
  container.addChild(gateLabel);

  return container;
}

export function updatePortalAnimation(container: PIXI.Container, tick: number): void {
  const color = 0x4ee2ff;

  // Animate swirl
  const swirl = container.getChildByName("swirl") as PIXI.Graphics;
  if (swirl) {
    swirl.clear();
    // Rotating inner arcs
    for (let i = 0; i < 3; i++) {
      const a = tick * 1.5 + (i / 3) * Math.PI * 2;
      const pulse = 0.3 + 0.3 * Math.sin(tick * 4 + i * 2);
      swirl.lineStyle(1.5, color, pulse);
      swirl.arc(0, 0, 12 + i * 4, a, a + 1.2);
    }
    // Counter-rotating arcs
    for (let i = 0; i < 2; i++) {
      const a = -tick * 2 + (i / 2) * Math.PI * 2;
      const pulse = 0.2 + 0.2 * Math.sin(tick * 3 + i);
      swirl.lineStyle(1, color, pulse);
      swirl.arc(0, 0, 8 + i * 6, a, a + 0.8);
    }
  }

  // Animate energy field
  const energy = container.getChildByName("energy") as PIXI.Graphics;
  if (energy) {
    energy.alpha = 0.6 + 0.3 * Math.sin(tick * 2);
  }

  // Animate core
  const core = container.getChildByName("core") as PIXI.Graphics;
  if (core) {
    const pulse = 0.8 + 0.2 * Math.sin(tick * 5);
    core.scale.set(pulse);
    core.alpha = 0.7 + 0.3 * Math.sin(tick * 3);
  }

  // Animate nodes (blinking)
  const nodes = container.getChildByName("nodes") as PIXI.Graphics;
  if (nodes) {
    nodes.alpha = 0.6 + 0.4 * Math.sin(tick * 4);
  }
}

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

export function createStationVisual(
  stationName: string,
  stationKind: string,
  glyphChar: string,
): PIXI.Container {
  const container = new PIXI.Container();
  const accent = STATION_ACCENT[stationKind] || 0x4ee2ff;

  // Native PixiJS station body
  const body = new PIXI.Graphics();
  body.name = "stBody";

  // Outer hull plates (octagonal)
  const hullR = 34;
  body.lineStyle(2, accent, 0.5);
  body.beginFill(0x141828, 0.95);
  body.moveTo(hullR, 0);
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    body.lineTo(Math.cos(a) * hullR, Math.sin(a) * hullR);
  }
  body.closePath();
  body.endFill();

  // Inner hull panel (rotated hex)
  const innerR = 24;
  body.lineStyle(1, accent, 0.3);
  body.beginFill(0x1e2240, 0.85);
  const hexOff = Math.PI / 6;
  body.moveTo(Math.cos(hexOff) * innerR, Math.sin(hexOff) * innerR);
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2 + hexOff;
    body.lineTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
  }
  body.closePath();
  body.endFill();

  // Structural cross-beams
  body.lineStyle(1.5, accent, 0.2);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    body.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
    body.lineTo(Math.cos(a + Math.PI) * innerR, Math.sin(a + Math.PI) * innerR);
  }

  // Center core
  body.lineStyle(1, accent, 0.4);
  body.beginFill(accent, 0.12);
  body.drawCircle(0, 0, 10);
  body.endFill();
  body.beginFill(0xffffff, 0.15);
  body.drawCircle(0, 0, 4);
  body.endFill();

  // Corner brackets on outer hull
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const bx = Math.cos(a) * (hullR + 4);
    const by = Math.sin(a) * (hullR + 4);
    body.lineStyle(2, accent, 0.6);
    body.moveTo(bx - 3, by - 3);
    body.lineTo(bx, by);
    body.lineTo(bx + 3, by - 3);
  }

  // Docking bay indicators (small rectangles at cardinal points)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const dx = Math.cos(a) * (hullR - 2);
    const dy = Math.sin(a) * (hullR - 2);
    body.lineStyle(0);
    body.beginFill(accent, 0.3);
    body.drawRect(dx - 3, dy - 1.5, 6, 3);
    body.endFill();
  }

  container.addChild(body);

  // Ambient glow ring
  const glow = new PIXI.Graphics();
  glow.name = "stGlow";
  glow.lineStyle(1, accent, 0.15);
  glow.drawCircle(0, 0, 55);
  glow.lineStyle(0.5, accent, 0.08);
  glow.drawCircle(0, 0, 70);
  container.addChild(glow);

  // Docking range indicator
  const dockRing = new PIXI.Graphics();
  dockRing.name = "dockRing";
  dockRing.lineStyle(1, accent, 0.12);
  for (let i = 0; i < 12; i++) {
    const a1 = (i / 12) * Math.PI * 2 + 0.05;
    const a2 = ((i + 1) / 12) * Math.PI * 2 - 0.05;
    dockRing.arc(0, 0, 48, a1, a2);
    dockRing.moveTo(0, 0);
  }
  container.addChild(dockRing);

  // Blinking lights (4 positioned around station)
  const lights = new PIXI.Graphics();
  lights.name = "stLights";
  container.addChild(lights);

  // Energy strips (accent lines)
  const strips = new PIXI.Graphics();
  strips.name = "stStrips";
  strips.lineStyle(1, accent, 0.3);
  strips.moveTo(-30, -35);
  strips.lineTo(-30, -20);
  strips.moveTo(30, -35);
  strips.lineTo(30, -20);
  strips.moveTo(-30, 20);
  strips.lineTo(-30, 35);
  strips.moveTo(30, 20);
  strips.lineTo(30, 35);
  container.addChild(strips);

  // Station name
  const accentStr = "#" + accent.toString(16).padStart(6, "0");
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
  nameText.position.set(0, -72);
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
  kindLabel.position.set(0, -54);
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
  dockLabel.position.set(0, 72);
  container.addChild(dockLabel);

  return container;
}

export function updateStationAnimation(container: PIXI.Container, tick: number): void {
  const lights = container.getChildByName("stLights") as PIXI.Graphics;
  if (lights) {
    lights.clear();
    const positions = [
      { x: -22, y: -22 },
      { x: 22, y: -22 },
      { x: -22, y: 22 },
      { x: 22, y: 22 },
    ];
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const blink = Math.sin(tick * 3 + i * 1.5) > 0.3 ? 0.8 : 0.15;
      lights.beginFill(0xffffff, blink);
      lights.drawCircle(p.x, p.y, 1.5);
      lights.endFill();
    }
  }

  const dockRing = container.getChildByName("dockRing") as PIXI.Graphics;
  if (dockRing) {
    dockRing.rotation = tick * 0.2;
  }

  const glow = container.getChildByName("stGlow") as PIXI.Graphics;
  if (glow) {
    glow.alpha = 0.6 + 0.2 * Math.sin(tick * 1.5);
  }
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
