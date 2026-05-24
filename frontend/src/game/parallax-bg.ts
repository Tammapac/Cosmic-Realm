// ── PARALLAX SPACE BACKGROUND ─────────────────────────────────────────────
// Folders named by map label: 1-1, 1-2 ... 4-5
// Sprites per map:
//   Layer1_<label>.png  — deep space base (tiled, slowest)
//   Layer2_<label>.png  — distant stars   (tiled, slow)
//   Layer3_<label>.png  — nebula fog      (tiled, semi-transparent)
//   Layer4_<label>.png  — planet / object (single, placed)

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

// ── Seamless tiled draw ───────────────────────────────────────────────────
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
  ctx.globalAlpha = alpha;
  for (let tx = -ox; tx < w + tw; tx += tw)
    for (let ty = -oy; ty < h + th; ty += th)
      ctx.drawImage(img, tx, ty);
  ctx.globalAlpha = 1;
}

// ── Per-label config ──────────────────────────────────────────────────────
const LABEL_CONFIG: Record<string, {
  baseFill: string;
  planetAnchor: { wx: number; wy: number };
  planetSpeed: number;
  planetSize: number;
  glowColor: string;
}> = {
  "1-1": { baseFill: "#020414", planetAnchor: { wx:  1200, wy:  -900 }, planetSpeed: 0.10, planetSize: 280, glowColor: "#3366cc" },
  "1-2": { baseFill: "#0a0220", planetAnchor: { wx: -1100, wy:  -800 }, planetSpeed: 0.10, planetSize: 260, glowColor: "#7722aa" },
  "1-3": { baseFill: "#1a0208", planetAnchor: { wx:  1000, wy:   900 }, planetSpeed: 0.10, planetSize: 240, glowColor: "#cc2233" },
  "1-4": { baseFill: "#000508", planetAnchor: { wx: -1200, wy:   700 }, planetSpeed: 0.08, planetSize: 300, glowColor: "#006655" },
  "1-5": { baseFill: "#1a0c04", planetAnchor: { wx:  1300, wy: -1100 }, planetSpeed: 0.10, planetSize: 260, glowColor: "#cc6600" },
  "2-1": { baseFill: "#1a0800", planetAnchor: { wx: -1000, wy:  -900 }, planetSpeed: 0.10, planetSize: 260, glowColor: "#cc4400" },
  "2-2": { baseFill: "#1e0804", planetAnchor: { wx:  1100, wy:  1000 }, planetSpeed: 0.10, planetSize: 240, glowColor: "#884422" },
  "2-3": { baseFill: "#220404", planetAnchor: { wx: -1300, wy: -1000 }, planetSpeed: 0.10, planetSize: 255, glowColor: "#aa0033" },
  "2-4": { baseFill: "#180006", planetAnchor: { wx:  1200, wy:   800 }, planetSpeed: 0.10, planetSize: 265, glowColor: "#660066" },
  "2-5": { baseFill: "#0e0008", planetAnchor: { wx: -1100, wy: -1200 }, planetSpeed: 0.10, planetSize: 275, glowColor: "#5500cc" },
  "3-1": { baseFill: "#0e0800", planetAnchor: { wx:  1000, wy:   900 }, planetSpeed: 0.10, planetSize: 260, glowColor: "#cc8800" },
  "3-2": { baseFill: "#160e00", planetAnchor: { wx: -1100, wy:   700 }, planetSpeed: 0.10, planetSize: 255, glowColor: "#aa6600" },
  "3-3": { baseFill: "#1a0418", planetAnchor: { wx:  1200, wy:  -900 }, planetSpeed: 0.10, planetSize: 250, glowColor: "#aa3388" },
  "3-4": { baseFill: "#0e0018", planetAnchor: { wx: -1000, wy: -1100 }, planetSpeed: 0.10, planetSize: 270, glowColor: "#7700cc" },
  "3-5": { baseFill: "#080010", planetAnchor: { wx:  1100, wy:   800 }, planetSpeed: 0.10, planetSize: 275, glowColor: "#4400aa" },
  "4-1": { baseFill: "#0a0000", planetAnchor: { wx: -1200, wy:  -800 }, planetSpeed: 0.10, planetSize: 260, glowColor: "#880000" },
  "4-2": { baseFill: "#0c0004", planetAnchor: { wx:  1000, wy:  1000 }, planetSpeed: 0.10, planetSize: 265, glowColor: "#660022" },
  "4-3": { baseFill: "#08000a", planetAnchor: { wx: -1000, wy:   900 }, planetSpeed: 0.10, planetSize: 255, glowColor: "#660066" },
  "4-4": { baseFill: "#020208", planetAnchor: { wx:  1300, wy:  -900 }, planetSpeed: 0.10, planetSize: 270, glowColor: "#222266" },
  "4-5": { baseFill: "#050002", planetAnchor: { wx: -1100, wy: -1200 }, planetSpeed: 0.10, planetSize: 280, glowColor: "#440011" },
  "DBG": { baseFill: "#0a0a0a", planetAnchor: { wx:     0, wy:     0 }, planetSpeed: 0.10, planetSize: 200, glowColor: "#224422" },
};

function _bgHex(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// ── Main render ───────────────────────────────────────────────────────────
// mapLabel: zone label string e.g. "1-1", "2-3"
export function drawParallaxBackground(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  camX: number, camY: number,
  mapLabel: string,
  t: number,
): void {
  const cfg = LABEL_CONFIG[mapLabel] ?? LABEL_CONFIG["1-1"];
  const base = `/bg/${mapLabel}`;
  const lbl  = mapLabel;

  // Preload layers — safe every frame, cached after first load
  const L1 = _bgLoad(`${base}/Layer1_${lbl}.png`);
  const L2 = _bgLoad(`${base}/Layer2_${lbl}.png`);
  const L3 = _bgLoad(`${base}/Layer3_${lbl}.png`);
  const L4 = _bgLoad(`${base}/Layer4_${lbl}.png`);

  // ── Layer 0: solid deep space fill (always drawn) ────────────────────────
  ctx.fillStyle = cfg.baseFill;
  ctx.fillRect(0, 0, w, h);

  // ── Layer 1: deep space base (slowest parallax, speed 0.02) ─────────────
  if (_bgReady(L1)) _bgTile(ctx, L1, w, h, camX, camY, 0.02);

  // ── Layer 2: distant stars (slow parallax, speed 0.05) ──────────────────
  if (_bgReady(L2)) _bgTile(ctx, L2, w, h, camX, camY, 0.05);

  // ── Layer 3: nebula fog (medium speed, 0.35 alpha — kept transparent) ───
  if (_bgReady(L3)) _bgTile(ctx, L3, w, h, camX, camY, 0.10, 0.35);

  // ── Layer 4: planet / large object (placed, not tiled) ───────────────────
  const anchor = cfg.planetAnchor;
  const px = w / 2 + (anchor.wx - camX) * cfg.planetSpeed;
  const py = h / 2 + (anchor.wy - camY) * cfg.planetSpeed;
  const ps = cfg.planetSize;
  const [gr, gg, gb] = _bgHex(cfg.glowColor);

  // soft glow halo behind the planet
  const halo = ctx.createRadialGradient(px, py, 0, px, py, ps * 1.1);
  halo.addColorStop(0,   `rgba(${gr},${gg},${gb},0.22)`);
  halo.addColorStop(0.5, `rgba(${gr},${gg},${gb},0.08)`);
  halo.addColorStop(1,   `rgba(${gr},${gg},${gb},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(px, py, ps * 1.1, 0, Math.PI * 2); ctx.fill();

  if (_bgReady(L4)) {
    ctx.globalAlpha = 0.80 + 0.06 * Math.sin(t * 0.25);
    ctx.drawImage(L4, px - ps / 2, py - ps / 2, ps, ps);
    ctx.globalAlpha = 1;
  }
}
