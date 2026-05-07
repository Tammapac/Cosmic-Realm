// ── PARALLAX SPACE BACKGROUND ─────────────────────────────────────────────
// All 10 zones use Pixellab-generated pixel art layers.
// 5 layers per zone: solid base, stars, nebula, planet, foreground dust.

// ── Image loader/cache ────────────────────────────────────────────────────
const _bgCache = new Map<string, HTMLImageElement | null>();
function _bgLoad(src: string): HTMLImageElement | null {
  if (_bgCache.has(src)) return _bgCache.get(src)!;
  const img = new Image();
  img.onload  = () => _bgCache.set(src, img);
  img.onerror = () => _bgCache.set(src, null);
  img.src = src;
  _bgCache.set(src, img);
  return null;
}
function _bgReady(img: HTMLImageElement | null): img is HTMLImageElement {
  return img !== null && img.complete && img.naturalWidth > 0;
}

// ── Seamless tile draw ────────────────────────────────────────────────────
function _bgTile(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number, h: number,
  camX: number, camY: number,
  speed: number,
  alpha = 1,
): void {
  const tw = img.naturalWidth, th = img.naturalHeight;
  if (!tw || !th) return;
  const ox = ((camX * speed % tw) + tw) % tw;
  const oy = ((camY * speed % th) + th) % th;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  for (let tx = -ox; tx < w; tx += tw)
    for (let ty = -oy; ty < h; ty += th)
      ctx.drawImage(img, tx, ty);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

// ── Per-zone config ───────────────────────────────────────────────────────
// baseFill: solid colour drawn before any layers (shows through transparent tiles)
// planet anchor: world-space position the planet orbits relative to
const ZONE_CONFIG: Record<string, {
  baseFill: string;
  planetAnchor: { wx: number; wy: number };
  planetSpeed: number;
  planetSize: number;
  glowColor: string;
}> = {
  alpha:     { baseFill: "#02061a", planetAnchor: { wx: 1200, wy: -900  }, planetSpeed: 0.22, planetSize: 220, glowColor: "#3366cc" },
  nebula:    { baseFill: "#08021a", planetAnchor: { wx:-1100, wy: -800  }, planetSpeed: 0.20, planetSize: 230, glowColor: "#7722aa" },
  crimson:   { baseFill: "#120208", planetAnchor: { wx: 1000, wy: 900   }, planetSpeed: 0.22, planetSize: 210, glowColor: "#cc2233" },
  void:      { baseFill: "#000508", planetAnchor: { wx:-1200, wy: 700   }, planetSpeed: 0.18, planetSize: 240, glowColor: "#006655" },
  forge:     { baseFill: "#0a0502", planetAnchor: { wx: 1300, wy:-1100  }, planetSpeed: 0.22, planetSize: 220, glowColor: "#cc6600" },
  corona:    { baseFill: "#100400", planetAnchor: { wx:-1000, wy: -900  }, planetSpeed: 0.22, planetSize: 220, glowColor: "#cc4400" },
  fracture:  { baseFill: "#120500", planetAnchor: { wx: 1100, wy: 1000  }, planetSpeed: 0.20, planetSize: 200, glowColor: "#884422" },
  abyss:     { baseFill: "#0e0206", planetAnchor: { wx:-1300, wy:-1000  }, planetSpeed: 0.22, planetSize: 215, glowColor: "#aa0033" },
  marsdepth: { baseFill: "#0c000e", planetAnchor: { wx: 1200, wy: 800   }, planetSpeed: 0.20, planetSize: 225, glowColor: "#660066" },
  maelstrom: { baseFill: "#04000c", planetAnchor: { wx:-1100, wy:-1200  }, planetSpeed: 0.22, planetSize: 235, glowColor: "#5500cc" },
};

function _bgHex(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// ── Main render ───────────────────────────────────────────────────────────
export function drawParallaxBackground(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  camX: number, camY: number,
  zone: string,
  t: number,
): void {
  const cfg = ZONE_CONFIG[zone] ?? ZONE_CONFIG.alpha;
  const base = `/bg/${zone}`;

  // Preload all layers (lazy — safe to call every frame, cached after first)
  const L2 = _bgLoad(`${base}/layer_02_stars.png`);
  const L3 = _bgLoad(`${base}/layer_03_nebula.png`);
  const L4 = _bgLoad(`${base}/layer_04_planet.png`);
  const L5 = _bgLoad(`${base}/layer_05_dust.png`);

  // ── Layer 1: solid deep space fill ──────────────────────────────────────
  ctx.fillStyle = cfg.baseFill;
  ctx.fillRect(0, 0, w, h);

  // ── Layer 2: distant stars (slowest parallax) ────────────────────────────
  if (_bgReady(L2)) _bgTile(ctx, L2, w, h, camX, camY, 0.05);

  // ── Layer 3: nebula fog (slow, semi-transparent) ─────────────────────────
  if (_bgReady(L3)) _bgTile(ctx, L3, w, h, camX, camY, 0.12, 0.75);

  // ── Layer 4: planet (single placed object with glow halo) ────────────────
  const anchor = cfg.planetAnchor;
  const px = w / 2 + (anchor.wx - camX) * cfg.planetSpeed;
  const py = h / 2 + (anchor.wy - camY) * cfg.planetSpeed;
  const ps = cfg.planetSize;
  const [gr, gg, gb] = _bgHex(cfg.glowColor);
  // glow halo
  const halo = ctx.createRadialGradient(px, py, 0, px, py, ps * 0.9);
  halo.addColorStop(0,   `rgba(${gr},${gg},${gb},0.18)`);
  halo.addColorStop(0.5, `rgba(${gr},${gg},${gb},0.07)`);
  halo.addColorStop(1,   `rgba(${gr},${gg},${gb},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(px, py, ps * 0.9, 0, Math.PI * 2); ctx.fill();
  // planet sprite
  if (_bgReady(L4)) {
    ctx.globalAlpha = 0.72 + 0.06 * Math.sin(t * 0.3);
    ctx.drawImage(L4, px - ps / 2, py - ps / 2, ps, ps);
    ctx.globalAlpha = 1;
  }

  // ── Layer 5: foreground dust / bright stars (fastest, twinkle) ───────────
  if (_bgReady(L5)) {
    const tw = 0.78 + 0.22 * Math.sin(t * 0.85 + 1.2);
    _bgTile(ctx, L5, w, h, camX, camY, 0.35, tw);
  }
}
