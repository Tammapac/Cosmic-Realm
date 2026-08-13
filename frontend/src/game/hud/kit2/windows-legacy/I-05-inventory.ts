// I-05-inventory · INVENTORY
//
// 24 Hexagon-Sockel im Raster 8 × 3, vier Kategoriereiter plus ALL, Suche,
// Raritätsfilter, Seitenblätterung. Auswahl leuchtet cyan aus der Sockelmitte;
// Celestial, Relic und Legendary bringen ihre Animation im Sockel mit. Über dem
// Raster zieht eine Scanlinie. Rechts die Akte des gewählten Stücks, unten der
// rote THROW OUT mit Bestätigungsdialog.
//
// Selbstständiges Modul: einziger Import ist pixi.js. Rahmen, Portal-Animation,
// Funken, Zustände und Daten sind eingebacken — die Datei läuft ohne Nachbarn.
//
//   import { mount } from "./I-05-inventory";
//   const win = mount({ onClosed: () => {} });
//   app.stage.addChild(win.root);
//   app.ticker.add((t) => win.update(t.deltaMS / 1000));

import * as PIXI from "pixi.js";

/* ── Rahmenbau (eingebacken, kein Import auf Nachbardateien) ──────────────── */

const hex = (s: string | number): number =>
  typeof s === "number" ? s : parseInt(String(s).replace("#", ""), 16) || 0xb866ff;

/** Aufhellen (amt > 0) oder Abdunkeln (amt < 0). */
function shade(color: number | string, amt: number): number {
  const c = hex(color);
  let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { const k = 1 + amt; r *= k; g *= k; b *= k; }
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

const rgba = (color: number | string, a: number): string => {
  const c = hex(color);
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
};

const _tex = new Map<string, PIXI.Texture>();

/** Linearer Verlauf als Textur — ersetzt linear-gradient(). */
function gradTex(stops: [number, string][], vertical = true, size = 128): PIXI.Texture {
  const key = (vertical ? "v" : "h") + size + stops.map((s) => s[0] + s[1]).join("|");
  const hit = _tex.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = vertical ? 1 : size; cv.height = vertical ? size : 1;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, vertical ? 0 : size, vertical ? size : 0);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  const t = PIXI.Texture.from(cv);
  _tex.set(key, t);
  return t;
}

/** Radialer Verlauf als Textur — Glow, Wash, Funken, weiche Schatten. */
function radTex(stops: [number, string][], size = 128): PIXI.Texture {
  const key = "r" + size + stops.map((s) => s[0] + s[1]).join("|");
  const hit = _tex.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = PIXI.Texture.from(cv);
  _tex.set(key, t);
  return t;
}

/** Weiches Leuchten in einer Akzentfarbe — ersetzt drop-shadow(0 0 N accent). */
function glow(color: number | string, w: number, h: number, alpha = 0.5): PIXI.Sprite {
  const sp = new PIXI.Sprite(radTex([
    [0, rgba(color, 0.85)], [0.45, rgba(color, 0.35)], [1, rgba(color, 0)],
  ]));
  sp.width = w; sp.height = h; sp.alpha = alpha;
  sp.blendMode = "add";
  return sp;
}

/** Welche Ecken gefast sind. Panels: TR + BL. Karten: TL + BR. */
type Cuts = "tr-bl" | "tl-br" | "all" | "none";

/** Punktliste eines gefasten Rechtecks — 1:1 die Koordinaten aus clip-path. */
function chamfer(x: number, y: number, w: number, h: number, c: number, cuts: Cuts = "tr-bl"): number[] {
  const r = x + w, b = y + h;
  if (cuts === "none" || c <= 0) return [x, y, r, y, r, b, x, b];
  if (cuts === "tl-br") return [x + c, y, r, y, r, b - c, r - c, b, x, b, x, y + c];
  if (cuts === "all") return [x + c, y, r - c, y, r, y + c, r, b - c, r - c, b, x + c, b, x, b - c, x, y + c];
  return [x, y, r - c, y, r, y + c, r, b, x + c, b, x, b - c];
}

function cut(
  g: PIXI.Graphics, x: number, y: number, w: number, h: number, c: number,
  fill: number, alpha = 1, cuts: Cuts = "tr-bl",
): PIXI.Graphics {
  g.poly(chamfer(x, y, w, h, c, cuts)).fill({ color: fill, alpha });
  return g;
}

/** 26/74-Hexagon — Sockel, Wappen, Karten. */
const hexa = (x: number, y: number, w: number, h: number): number[] =>
  [x + w * 0.5, y, x + w, y + h * 0.26, x + w, y + h * 0.74, x + w * 0.5, y + h, x, y + h * 0.74, x, y + h * 0.26];

/** Schattenstapel: harter Sitz, Kontakt, Mitte, Wurf. */
function shadows(into: PIXI.Container, w: number, h: number, c: number, cuts: Cuts, scale = 1): void {
  const steps = [
    { dy: 3 * scale, blur: 0, a: 0.95 },
    { dy: 6 * scale, blur: 7 * scale, a: 0.7 },
    { dy: 14 * scale, blur: 18 * scale, a: 0.55 },
    { dy: 26 * scale, blur: 40 * scale, a: 0.4 },
  ];
  for (const s of steps) {
    if (s.blur <= 0) {
      const g = new PIXI.Graphics();
      cut(g, 0, s.dy, w, h, c, 0x03050a, s.a, cuts);
      into.addChild(g);
    } else {
      const sp = new PIXI.Sprite(radTex([
        [0, `rgba(0,0,0,${s.a})`], [0.55, `rgba(0,0,0,${s.a * 0.5})`], [1, "rgba(0,0,0,0)"],
      ]));
      sp.width = w + s.blur * 2; sp.height = h + s.blur * 1.4;
      sp.x = -s.blur; sp.y = s.dy - s.blur * 0.5;
      into.addChild(sp);
    }
  }
}

/* Schrift */
const lbl = (t: string, size = 7, fill: number = 0x9db0c6, sp = 3.4): PIXI.Text =>
  new PIXI.Text({ text: t, style: { fontFamily: "Orbitron, sans-serif", fontSize: size, fontWeight: "700", letterSpacing: sp, fill } });

const val = (t: string, size = 11, fill: number = 0xe6f3ff): PIXI.Text =>
  new PIXI.Text({ text: t, style: { fontFamily: "JetBrains Mono, monospace", fontSize: size, fontWeight: "700", letterSpacing: 0.4, fill } });

const txt = (t: string, size = 11, fill: number = 0xcedef2, wrap?: number): PIXI.Text =>
  new PIXI.Text({ text: t, style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: size, fill, lineHeight: size * 1.5, wordWrap: !!wrap, wordWrapWidth: wrap ?? 0 } });

const num = (n: number): string => Math.round(n).toLocaleString("en-US");

/** Eine Farbe pro Bedeutung. */
const ACCENT = {
  action: 0xb866ff, system: 0x4ee2ff, currency: 0xe8b94d,
  destruction: 0xff4d5e, confirm: 0x5cff8a, relic: 0xff5cf0, steel: 0x8e9aab,
} as const;

/** Raritätsleiter. */
const RARITY: Record<string, number> = {
  common: 0x8aa0c0, uncommon: 0x5cff8a, rare: 0x4ee2ff, epic: 0xb866ff,
  legendary: 0xe8b94d, relic: 0xff5cf0, celestial: 0x9df2ff,
};

/** Hover hebt, Press sinkt, Klick blitzt — der Zustandssatz aus dem Kit. */
function states(
  node: PIXI.Container,
  o: { onClick?: () => void; onHover?: (over: boolean) => void; enabled?: boolean; lift?: number; sink?: number } = {},
): void {
  const lift = o.lift ?? 2, sink = o.sink ?? 2, y0 = node.y;
  if (o.enabled === false) {
    node.eventMode = "none"; node.cursor = "not-allowed";
    node.alpha = 0.42; node.tint = 0x8899aa;
    return;
  }
  node.eventMode = "static";
  node.cursor = "pointer";
  node.on("pointerover", () => { node.y = y0 - lift; node.tint = 0xffffff; o.onHover?.(true); });
  node.on("pointerout", () => { node.y = y0; node.tint = 0xffffff; o.onHover?.(false); });
  node.on("pointerdown", () => { node.y = y0 + sink; node.tint = 0xd8e4f4; });
  node.on("pointerupoutside", () => { node.y = y0; node.tint = 0xffffff; });
  node.on("pointerup", () => {
    node.y = y0 - lift;
    // Klickblitz: kurz aufhellen, dann zurück
    node.tint = 0xffffff;
    const flash = new PIXI.Sprite(radTex([[0, "rgba(255,255,255,.35)"], [1, "rgba(255,255,255,0)"]]));
    flash.width = node.width * 1.3; flash.height = node.height * 1.6;
    flash.x = -node.width * 0.15; flash.y = -node.height * 0.3;
    flash.blendMode = "add";
    node.addChild(flash);
    let t = 0;
    const tick = (): void => {
      t += 0.08;
      flash.alpha = Math.max(0, 1 - t);
      if (t >= 1) { flash.destroy(); PIXI.Ticker.shared.remove(tick); }
    };
    PIXI.Ticker.shared.add(tick);
    o.onClick?.();
  });
}

/* ── Print Portal: zwei Lichtstrahlen + Funken ────────────────────────────── */

type Spark = { s: PIXI.Sprite; x: number; y: number; vx: number; vy: number; r: number; k: number; g: number; t: number; l: number };

function easePortal(t: number): number {
  const bx = (u: number): number => { const v = 1 - u; return 3 * v * v * u * 0.28 + 3 * v * u * u * 0.28 + u * u * u; };
  const by = (u: number): number => { const v = 1 - u; return 3 * v * v * u * 0.62 + 3 * v * u * u + u * u * u; };
  let lo = 0, hi = 1, u = t;
  for (let i = 0; i < 10; i++) { u = (lo + hi) / 2; if (bx(u) < t) lo = u; else hi = u; }
  return by(u);
}

class PrintPortal {
  readonly root = new PIXI.Container();
  readonly reveal = new PIXI.Graphics();
  onClosed?: () => void;

  private w: number; private h: number; private accent: number; private ch: number; private dur: number;
  private topRail: PIXI.Container; private beam: PIXI.Container;
  private railOrbL: PIXI.Sprite; private railOrbR: PIXI.Sprite;
  private beamOrbL: PIXI.Sprite; private beamOrbR: PIXI.Sprite;
  private heat: PIXI.Sprite; private fx = new PIXI.Container();
  private live: Spark[] = []; private pool: PIXI.Sprite[] = [];
  private carry = { m: 0, s: 0, e: 0, f: 0 };
  private dens: number; private sparkTex: PIXI.Texture;
  private dir: 1 | -1 = 1; private t = 0; private running = false; private closedFired = false;

  constructor(o: { w: number; h: number; accent: number | string; chamfer?: number; duration?: number }) {
    this.w = o.w; this.h = o.h; this.accent = hex(o.accent);
    this.ch = o.chamfer ?? 34; this.dur = o.duration ?? 1300;
    this.dens = Math.max(0.35, Math.min(1.6, this.w / 720));
    this.sparkTex = radTex([
      [0, "rgba(255,255,255,1)"], [0.22, rgba(shade(this.accent, 0.85), 0.9)],
      [0.5, rgba(shade(this.accent, 0.2), 0.38)], [1, rgba(this.accent, 0)],
    ], 64);
    this.heat = new PIXI.Sprite(radTex([[0, rgba(shade(this.accent, 0.4), 0.45)], [0.72, "rgba(0,0,0,0)"]]));
    this.heat.width = this.w * 1.4; this.heat.height = this.h * 0.7;
    this.heat.x = -this.w * 0.2; this.heat.blendMode = "add"; this.heat.alpha = 0;
    this.root.addChild(this.heat);
    this.topRail = this.buildBeam(true); this.beam = this.buildBeam(false);
    this.railOrbL = this.orb(); this.railOrbR = this.orb();
    this.beamOrbL = this.orb(); this.beamOrbR = this.orb();
    this.root.addChild(this.topRail, this.beam, this.fx, this.railOrbL, this.railOrbR, this.beamOrbL, this.beamOrbR);
    this.frame(0, 14, 0.05, 1);
  }

  private orb(): PIXI.Sprite {
    const sp = new PIXI.Sprite(radTex([
      [0, "rgba(255,255,255,.95)"], [0.12, rgba(shade(this.accent, 0.8), 0.6)],
      [0.3, rgba(this.accent, 0.28)], [0.55, rgba(this.accent, 0.08)], [1, rgba(this.accent, 0)],
    ], 64));
    sp.width = sp.height = 30; sp.anchor.set(0.5); sp.blendMode = "add";
    return sp;
  }

  private buildBeam(up: boolean): PIXI.Container {
    const c = new PIXI.Container();
    const A = (a: number): string => rgba(this.accent, a);
    const L = (t: number, a: number): string => rgba(shade(this.accent, t), a);
    const washStops: [number, string][] = up
      ? [[0, L(0.85, 0.2)], [0.3, L(0.4, 0.06)], [0.62, A(0.015)], [1, "rgba(0,0,0,0)"]]
      : [[0, "rgba(0,0,0,0)"], [0.38, A(0.015)], [0.7, L(0.4, 0.06)], [1, L(0.85, 0.2)]];
    const wash = new PIXI.Sprite(gradTex(washStops));
    wash.width = this.w; wash.height = 84; wash.y = up ? 0 : -84; wash.blendMode = "add";
    c.addChild(wash);
    const halo = new PIXI.Sprite(gradTex([
      [0, "rgba(0,0,0,0)"], [0.1, A(0.75)], [0.5, L(0.8, 0.95)], [0.9, A(0.75)], [1, "rgba(0,0,0,0)"],
    ], false, 256));
    halo.width = this.w; halo.height = 9; halo.y = -4.5; halo.blendMode = "add";
    c.addChild(halo);
    const core = new PIXI.Sprite(gradTex([
      [0, "rgba(0,0,0,0)"], [0.06, L(0.55, 1)], [0.28, "#ffffff"], [0.72, "#ffffff"], [0.94, L(0.55, 1)], [1, "rgba(0,0,0,0)"],
    ], false, 256));
    core.width = this.w; core.height = 2; core.y = -1; core.blendMode = "add";
    c.addChild(core);
    const chroma = new PIXI.Sprite(gradTex([
      [0, "rgba(0,0,0,0)"], [0.08, "rgba(255,120,220,.5)"], [0.22, "rgba(0,0,0,0)"],
      [0.78, "rgba(0,0,0,0)"], [0.92, "rgba(120,255,220,.5)"], [1, "rgba(0,0,0,0)"],
    ], false, 256));
    chroma.width = this.w; chroma.height = 3; chroma.y = -1.5; chroma.blendMode = "add"; chroma.alpha = 0.7;
    c.addChild(chroma);
    c.pivot.x = this.w / 2; c.x = this.w / 2;
    return c;
  }

  play(): void { this.dir = 1; this.t = 0; this.running = true; this.closedFired = false; this.root.visible = true; this.clear(); }
  close(): void { if (this.dir === -1) return; this.dir = -1; this.t = 0; this.running = true; this.closedFired = false; }
  get isClosing(): boolean { return this.dir === -1; }

  update(dt: number): void {
    if (!this.running && !this.live.length) return;
    this.t += dt * 1000;
    const travel = this.dur * 0.92, openMs = Math.min(this.dur * 0.34, 460);
    const p = easePortal(Math.min(1, this.t / travel));
    const inward = this.dir > 0;
    const line = (inward ? p : 1 - p) * this.h;
    const revealH = inward ? Math.max(14, line + 4) : Math.max(0, line + 4);
    const railScale = inward ? (1 - Math.pow(1 - Math.min(1, this.t / openMs), 3)) * 0.95 + 0.05 : 1;
    this.frame(line, revealH, inward ? Math.max(0.34, p) : 1, railScale);
    if (inward) {
      const hp = Math.min(1, this.t / this.dur);
      this.heat.alpha = hp < 0.07 ? hp / 0.07 : Math.max(0, 1 - (hp - 0.07) / 0.93) * 0.9;
    } else this.heat.alpha = 0;
    if (this.t < travel && this.running) this.emit(line, dt);
    this.step(dt);
    if (!inward && this.t >= travel) {
      const s = Math.min(1, (this.t - travel) / 380);
      const k = s < 0.52 ? 1 - s / 0.52 * 0.9 : s < 0.78 ? 0.1 - (s - 0.52) / 0.26 * 0.07 : 0.03 * (1 - (s - 0.78) / 0.22);
      this.topRail.scale.x = Math.max(0, k);
      this.topRail.alpha = s > 0.78 ? 1 - (s - 0.78) / 0.22 : 1;
      const half = this.w / 2;
      this.railOrbL.x = half - half * (1 - s);
      this.railOrbR.x = half + (this.w - this.ch - half) * (1 - s);
      this.railOrbL.alpha = this.railOrbR.alpha = 1 - s;
      this.root.alpha = s > 0.7 ? 1 - (s - 0.7) / 0.3 : 1;
      if (s >= 1 && !this.closedFired) {
        this.closedFired = true; this.running = false; this.root.visible = false; this.onClosed?.();
      }
    }
    if (inward && this.t > this.dur + 400 && !this.live.length) this.running = false;
  }

  private frame(line: number, revealH: number, beamScale: number, railScale: number): void {
    this.beam.y = line; this.beam.scale.x = beamScale;
    if (this.dir > 0) { this.topRail.scale.x = railScale; this.topRail.alpha = 0.45 + railScale * 0.55; this.root.alpha = 1; }
    const railT = this.dir > 0 ? railScale : 1;
    this.railOrbL.x = this.w / 2 - (this.w / 2) * railT;
    this.railOrbR.x = this.w / 2 + (this.w / 2 - this.ch) * railT;
    this.railOrbL.y = this.railOrbR.y = 0;
    this.beamOrbL.x = this.ch * (1 - beamScale);
    this.beamOrbR.x = this.w - this.ch * (1 - beamScale);
    this.beamOrbL.y = this.beamOrbR.y = line;
    this.reveal.clear();
    this.reveal.rect(-90, -90, this.w + 180, Math.max(0, Math.min(this.h + 90, revealH)) + 90).fill(0xffffff);
  }

  private take(): PIXI.Sprite {
    const s = this.pool.pop() ?? new PIXI.Sprite(this.sparkTex);
    s.anchor.set(0.5); s.blendMode = "add"; s.visible = true;
    this.fx.addChild(s);
    return s;
  }
  private give(s: PIXI.Sprite): void { s.visible = false; this.fx.removeChild(s); if (this.pool.length < 400) this.pool.push(s); }

  private emit(line: number, dt: number): void {
    const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
    const w = this.w;
    const push = (x: number, vx: number, vy: number, r: number, k: number, g: number, l: number): void => {
      if (this.live.length >= 1100) return;
      this.live.push({ s: this.take(), x, y: line, vx, vy, r, k, g, t: 0, l });
    };
    const run = (key: "m" | "s" | "e" | "f", rate: number, make: () => void): void => {
      this.carry[key] += rate * this.dens * dt;
      while (this.carry[key] >= 1) { this.carry[key]--; make(); }
    };
    run("m", 1400, () => { const a = Math.random() * 6.2832, sp = rnd(20, 80);
      push(rnd(6, w - 6), Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.7, 1.7), 1, 0, rnd(0.26, 0.6)); });
    run("s", 380, () => push(rnd(4, w - 4), rnd(-16, 16), rnd(-95, -45), rnd(1.3, 2.6), 1.9, 30, rnd(0.5, 0.95)));
    run("e", 170, () => push(rnd(4, w - 4), rnd(-12, 12), rnd(-160, -75), rnd(1, 2), 1.7, 5, rnd(1.4, 2.2)));
    run("f", 130, () => push(rnd(4, w - 4), rnd(-12, 12), rnd(25, 75), rnd(1, 1.9), 1.5, 45, rnd(0.4, 0.8)));
  }

  private step(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const q = this.live[i];
      q.t += dt;
      if (q.t >= q.l) { this.give(q.s); this.live[i] = this.live[this.live.length - 1]; this.live.pop(); continue; }
      q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const f = q.t / q.l, sw = q.r * 4.2;
      q.s.x = q.x; q.s.y = q.y; q.s.width = sw; q.s.height = sw * q.k;
      q.s.alpha = f < 0.12 ? f / 0.12 : 1 - (f - 0.12) / 0.88;
    }
  }
  private clear(): void { for (const q of this.live) this.give(q.s); this.live.length = 0; this.carry.m = this.carry.s = this.carry.e = this.carry.f = 0; }
}

/* ── Rahmen, Kopfzeile, Bausteine ─────────────────────────────────────────── */

function panelFrame(o: { w: number; h: number; accent: number | string; chamfer?: number; cuts?: Cuts; hairlines?: boolean }): {
  root: PIXI.Container; content: PIXI.Container; inner: { w: number; h: number; chamfer: number }; amb: PIXI.Sprite;
} {
  const { w, h } = o, accent = hex(o.accent);
  const ch = o.chamfer ?? 34, cuts = o.cuts ?? "tr-bl", bands = 5, step = 2;
  const root = new PIXI.Container();
  shadows(root, w, h, ch, cuts, 1);
  const amb = glow(accent, w * 1.3, h * 1.25, 0.22);
  amb.x = -w * 0.15; amb.y = -h * 0.1;
  root.addChild(amb);
  const ladder = [0.55, -0.06, -0.42, -0.68, -0.86];
  for (let i = 0; i < bands; i++) {
    const inset = i * step, cc = ch - inset * (ch / (ch + 8));
    const g = new PIXI.Graphics();
    cut(g, inset, inset, w - inset * 2, h - inset * 2, cc, shade(accent, ladder[i]), 1, cuts);
    root.addChild(g);
    if (i < bands - 1) {
      const spec = new PIXI.Graphics();
      spec.rect(inset + cc * 0.6, inset, w - inset * 2 - cc * 1.4, 1)
        .fill({ color: shade(accent, 0.85), alpha: i === 0 ? 0.75 : 0.25 });
      root.addChild(spec);
    }
  }
  const pad = bands * step + 8, iw = w - pad * 2, ih = h - pad * 2, ic = Math.max(6, ch - pad);
  const face = new PIXI.Graphics();
  cut(face, pad, pad, iw, ih, ic, shade(accent, -0.74), 1, cuts);
  root.addChild(face);
  const grad = new PIXI.Sprite(gradTex([
    [0, rgba(shade(accent, -0.1), 0.14)], [0.42, "rgba(0,0,0,0)"], [1, "rgba(4,7,13,.85)"],
  ]));
  grad.x = pad; grad.y = pad; grad.width = iw; grad.height = ih;
  root.addChild(grad);
  const rim = new PIXI.Graphics();
  rim.rect(pad + ic * 0.5, pad, iw - ic, 1).fill({ color: 0xffffff, alpha: 0.5 });
  rim.rect(pad + ic * 0.5, pad + ih - 2, iw - ic, 2).fill({ color: accent, alpha: 0.35 });
  root.addChild(rim);
  const content = new PIXI.Container();
  content.x = pad; content.y = pad;
  const clip = new PIXI.Graphics();
  cut(clip, 0, 0, iw, ih, ic, 0xffffff, 1, cuts);
  content.addChild(clip);
  content.mask = clip;
  root.addChild(content);
  if (o.hairlines !== false) {
    const hair = new PIXI.Graphics();
    for (let x = -ih; x < iw; x += 26) hair.moveTo(x, ih).lineTo(x + ih * 0.47, 0).stroke({ width: 1, color: 0xffffff, alpha: 0.035 });
    hair.eventMode = "none";
    content.addChild(hair);
  }
  return { root, content, inner: { w: iw, h: ih, chamfer: ic }, amb };
}

const TONE: Record<string, number> = {
  action: 0xb866ff, confirm: 0x5cff8a, danger: 0xff4d5e,
  currency: 0xe8b94d, system: 0x4ee2ff, steel: 0x8e9aab,
};

function makeButton(o: {
  w: number; h: number; label: string; tone?: string; accent?: number | string;
  chamfer?: number; cuts?: Cuts; fontSize?: number; enabled?: boolean; onClick?: () => void;
}): PIXI.Container {
  const accent = hex(o.accent ?? TONE[o.tone ?? "steel"]);
  const ch = o.chamfer ?? 8, cuts = o.cuts ?? "tl-br";
  const root = new PIXI.Container(), body = new PIXI.Container();
  const sh = new PIXI.Graphics();
  cut(sh, 0, 3, o.w, o.h, ch, 0x03050a, 0.9, cuts);
  cut(sh, -1, 6, o.w + 2, o.h, ch, 0x000000, 0.45, cuts);
  body.addChild(sh);
  const rim = new PIXI.Graphics();
  cut(rim, 0, 0, o.w, o.h, ch, shade(accent, 0.5), 1, cuts);
  cut(rim, 1.5, 1.5, o.w - 3, o.h - 3, ch - 1, shade(accent, -0.34), 1, cuts);
  cut(rim, 3, 3, o.w - 6, o.h - 6, ch - 2, shade(accent, -0.72), 1, cuts);
  body.addChild(rim);
  const face = new PIXI.Sprite(gradTex([[0, rgba(shade(accent, -0.42), 1)], [1, rgba(shade(accent, -0.86), 1)]]));
  face.x = 3; face.y = 3; face.width = o.w - 6; face.height = o.h - 6;
  body.addChild(face);
  const lines = new PIXI.Graphics();
  lines.rect(6, 3, o.w - 12, 1).fill({ color: shade(accent, 0.8), alpha: 0.7 });
  lines.rect(4, o.h - 5, o.w - 8, 2).fill({ color: accent, alpha: 0.8 });
  body.addChild(lines);
  const label = lbl(o.label, o.fontSize ?? 9, shade(accent, 0.82), 2.2);
  label.anchor.set(0.5); label.x = o.w / 2; label.y = o.h / 2;
  body.addChild(label);
  root.addChild(body);
  states(body, { onClick: o.onClick, enabled: o.enabled });
  return root;
}

function makeCloseButton(size: number, onClick: () => void): PIXI.Container {
  const root = new PIXI.Container(), body = new PIXI.Container(), s = size, RED = 0xc8303f;
  const aura = glow(0xff4d5e, s * 2.2, s * 2.2, 0.28);
  aura.x = aura.y = -s * 0.6;
  body.addChild(aura);
  const g = new PIXI.Graphics();
  g.rect(0, 0, s, s).fill(shade(RED, 0.55));
  g.rect(1.5, 1.5, s - 3, s - 3).fill(shade(RED, 0.1));
  g.rect(3, 3, s - 6, s - 6).fill(shade(RED, -0.32));
  g.rect(3.5, 3, s - 7, 1).fill({ color: 0xffe4e8, alpha: 0.8 });
  body.addChild(g);
  const x = new PIXI.Text({ text: "✕", style: { fontFamily: "Orbitron, sans-serif", fontSize: Math.round(s * 0.42), fontWeight: "700", fill: 0xfff2f3 } });
  x.anchor.set(0.5); x.x = s / 2; x.y = s / 2; x.rotation = -Math.PI / 4;
  body.addChild(x);
  body.pivot.set(s / 2, s / 2); body.x = s / 2; body.y = s / 2; body.rotation = Math.PI / 4;
  root.addChild(body);
  root.eventMode = "static"; root.cursor = "pointer";
  root.on("pointerover", () => { body.scale.set(1.08); aura.alpha = 0.55; });
  root.on("pointerout", () => { body.scale.set(1); aura.alpha = 0.28; });
  root.on("pointerdown", () => { body.scale.set(0.92); aura.alpha = 0.7; });
  root.on("pointerupoutside", () => { body.scale.set(1); aura.alpha = 0.28; });
  root.on("pointerup", () => { body.scale.set(1.08); onClick(); });
  return root;
}

function makeTab(o: { w: number; h: number; label: string; accent: number | string; active: boolean; enabled?: boolean; onClick?: () => void }): PIXI.Container {
  const accent = hex(o.accent), root = new PIXI.Container();
  const g = new PIXI.Graphics();
  cut(g, 0, 0, o.w, o.h, 8, o.active ? shade(accent, 0.4) : 0x7d7361, 1, "tl-br");
  cut(g, 1, 1, o.w - 2, o.h - 2, 7.5, o.active ? shade(accent, -0.24) : 0x3b352c, 1, "tl-br");
  cut(g, 2, 2, o.w - 4, o.h - 4, 7, o.active ? shade(accent, -0.66) : 0x141109, 1, "tl-br");
  g.rect(7, 2, o.w - 14, 1).fill({ color: shade(accent, 0.8), alpha: o.active ? 0.7 : 0.22 });
  g.rect(7, o.h - 2, o.w - 14, 2).fill({ color: accent, alpha: o.active ? 1 : 0.25 });
  root.addChild(g);
  if (o.active) {
    const gl = glow(accent, o.w, 14, 0.5);
    gl.y = o.h - 10;
    root.addChild(gl);
  }
  const t = lbl(o.label, 8, o.active ? 0xfff6e2 : shade(accent, 0.3), 1.8);
  t.anchor.set(0.5); t.x = o.w / 2; t.y = o.h / 2;
  root.addChild(t);
  states(root, { onClick: o.onClick, enabled: o.enabled, lift: 2, sink: 1 });
  return root;
}

function makeBar(w: number, h: number, pct: number, accent: number | string): PIXI.Container {
  const c = hex(accent), root = new PIXI.Container();
  const track = new PIXI.Graphics();
  track.rect(0, 0, w, h).fill(0x05080f);
  track.rect(0, 0, w, 1).fill({ color: 0x000000, alpha: 0.85 });
  track.rect(0, h - 1, w, 1).fill({ color: c, alpha: 0.16 });
  root.addChild(track);
  const fw = Math.max(0, Math.min(1, pct)) * w;
  if (fw > 0) {
    const fill = new PIXI.Sprite(gradTex([[0, rgba(shade(c, 0.6), 1)], [0.48, rgba(c, 1)], [1, rgba(shade(c, -0.5), 1)]]));
    fill.width = fw; fill.height = h;
    root.addChild(fill);
    const gl = glow(c, fw + 16, h + 12, 0.45);
    gl.x = -8; gl.y = -6;
    root.addChild(gl);
    const cap = new PIXI.Graphics();
    cap.rect(Math.max(0, fw - 2), -1, 2, h + 2).fill(shade(c, 0.8));
    root.addChild(cap);
  }
  const ticks = new PIXI.Graphics();
  for (let x = 0; x < w; x += 5) ticks.rect(x, 0, 1, h).fill({ color: 0x000000, alpha: 0.4 });
  ticks.eventMode = "none";
  root.addChild(ticks);
  return root;
}

type SocketItem = { id?: string; name: string; rarity: string; icon?: string; glyph?: string; qty?: number; ilvl?: number; equipped?: boolean };
type ItemSocket = { root: PIXI.Container; tick: (t: number) => void; setSelected: (on: boolean) => void };

const _icons = new Map<string, PIXI.Texture>();
const iconTex = (u: string): PIXI.Texture => {
  let t = _icons.get(u); if (!t) { t = PIXI.Texture.from(u); _icons.set(u, t); } return t;
};

function itemSocket(size: number, item: SocketItem | null, hooks: { onClick?: () => void; onHover?: (over: boolean) => void } = {}): ItemSocket {
  const rar = item ? (RARITY[item.rarity] ?? RARITY.common) : 0x2a3444;
  const root = new PIXI.Container(), r = size * 0.0625;
  const g = new PIXI.Graphics();
  for (const [inset, tone] of [[0, 0.5], [r * 0.5, 0.12], [r, -0.24], [r * 1.5, -0.5], [r * 2, -0.68], [r * 2.5, -0.8], [r * 3, -0.88]] as [number, number][]) {
    g.poly(hexa(inset, inset, size - inset * 2, size - inset * 2)).fill(shade(rar, tone));
  }
  root.addChild(g);
  const clip = new PIXI.Graphics();
  clip.poly(hexa(r * 3, r * 3, size - r * 6, size - r * 6)).fill(0xffffff);
  const inner = new PIXI.Container();
  inner.addChild(clip); inner.mask = clip;
  root.addChild(inner);
  const wash = new PIXI.Sprite(radTex([[0, rgba(rar, item ? 0.4 : 0.1)], [0.72, "rgba(4,7,13,0)"]]));
  wash.width = wash.height = size;
  inner.addChild(wash);
  const fine = new PIXI.Graphics();
  for (let x = 0; x < size; x += 3) fine.rect(x, 0, 1, size).fill({ color: 0xaa8cdc, alpha: 0.05 });
  fine.eventMode = "none";
  inner.addChild(fine);
  const parts: { sp: PIXI.Sprite; kind: string; seed: number }[] = [];
  if (item) {
    if (item.icon) {
      const sp = new PIXI.Sprite(iconTex(item.icon));
      sp.width = sp.height = size * 0.52; sp.x = size * 0.24; sp.y = size * 0.24;
      inner.addChild(sp);
    } else if (item.glyph) {
      const t = new PIXI.Text({ text: item.glyph, style: { fontFamily: "Orbitron, sans-serif", fontSize: size * 0.36, fill: shade(rar, 0.6) } });
      t.anchor.set(0.5); t.x = size / 2; t.y = size / 2;
      inner.addChild(t);
    }
    if (item.rarity === "celestial") {
      ["rgba(157,242,255,.5)", "rgba(255,160,255,.45)", "rgba(160,255,214,.45)"].forEach((col, i) => {
        const sp = new PIXI.Sprite(radTex([[0, col], [1, "rgba(0,0,0,0)"]]));
        sp.width = sp.height = size * 1.4; sp.anchor.set(0.5); sp.x = sp.y = size / 2; sp.blendMode = "add";
        inner.addChild(sp);
        parts.push({ sp, kind: "swirl", seed: i * 2.1 });
      });
      const streak = new PIXI.Sprite(gradTex([
        [0, "rgba(0,0,0,0)"], [0.4, "rgba(240,255,255,.8)"], [0.6, "rgba(255,226,255,.55)"], [1, "rgba(0,0,0,0)"],
      ], false, 128));
      streak.width = size * 0.28; streak.height = size * 1.4; streak.y = -size * 0.2; streak.blendMode = "add";
      inner.addChild(streak);
      parts.push({ sp: streak, kind: "streak", seed: 0 });
    } else if (item.rarity === "relic" || item.rarity === "legendary") {
      const aura = new PIXI.Sprite(radTex([[0, rgba(rar, 0.55)], [1, rgba(rar, 0)]]));
      aura.width = aura.height = size * 1.15; aura.x = aura.y = -size * 0.075;
      aura.blendMode = "add"; aura.alpha = 0.45;
      root.addChildAt(aura, 0);
      parts.push({ sp: aura, kind: item.rarity === "relic" ? "spin" : "breathe", seed: 0 });
    }
    if (item.qty && item.qty > 1) {
      const q = val(num(item.qty), size * 0.17, 0xf2f7ff);
      q.anchor.set(0.5, 1); q.x = size / 2; q.y = size - r * 3.2;
      root.addChild(q);
    }
    if (item.equipped) {
      const e = lbl("E", size * 0.15, 0x5cff8a, 0);
      e.x = size * 0.14; e.y = size * 0.14;
      root.addChild(e);
    }
  }
  const sel = new PIXI.Sprite(radTex([
    [0, "rgba(78,226,255,.55)"], [0.6, "rgba(78,226,255,.14)"], [1, "rgba(78,226,255,0)"],
  ]));
  sel.width = sel.height = size * 0.9; sel.x = sel.y = size * 0.05;
  sel.blendMode = "add"; sel.visible = false;
  inner.addChild(sel);
  root.eventMode = "static"; root.cursor = "pointer";
  root.on("pointerover", () => { root.scale.set(1.04); hooks.onHover?.(true); });
  root.on("pointerout", () => { root.scale.set(1); hooks.onHover?.(false); });
  root.on("pointerdown", () => { root.scale.set(0.96); });
  root.on("pointerupoutside", () => { root.scale.set(1); });
  root.on("pointerup", () => { root.scale.set(1.04); hooks.onClick?.(); });
  return {
    root,
    tick: (t: number): void => {
      if (sel.visible) sel.alpha = 0.75 + Math.sin(t * 2.6) * 0.25;
      for (const p of parts) {
        if (p.kind === "swirl") { p.sp.rotation = t * (0.28 + p.seed * 0.06) + p.seed; p.sp.alpha = 0.4 + Math.sin(t * 1.1 + p.seed) * 0.22; }
        else if (p.kind === "streak") p.sp.x = ((t / 5) % 1) * (size + p.sp.width) - p.sp.width;
        else if (p.kind === "spin") { p.sp.rotation = t * 0.5; p.sp.alpha = 0.35 + Math.sin(t * 2.6) * 0.2; }
        else p.sp.alpha = 0.28 + Math.sin(t * 1.6) * 0.12;
      }
    },
    setSelected: (on: boolean): void => { sel.visible = on; },
  };
}

type TipRow = { k: string; v: string };

function tooltipCard(w: number, title: string, rarity: string, desc: string, rows: TipRow[]): PIXI.Container {
  const c = RARITY[rarity] ?? 0x8aa0c0, root = new PIXI.Container();
  const d = txt(desc, 11, 0xcedef2, w - 32);
  const headH = 44, h = headH + d.height + 12 + rows.length * 20 + 14;
  shadows(root, w, h, 16, "tr-bl", 0.7);
  const rim = new PIXI.Graphics();
  for (const [i, tone, ch] of [[0, 0.55, 20], [1.5, -0.1, 19], [3, -0.5, 18], [4.5, -0.68, 17], [6, -0.86, 16]] as [number, number, number][]) {
    cut(rim, i, i, w - i * 2, h - i * 2, ch, shade(c, tone), 1, "tr-bl");
  }
  root.addChild(rim);
  const face = new PIXI.Graphics();
  cut(face, 7.5, 7.5, w - 15, h - 15, 15.6, 0x0c1119, 1, "tr-bl");
  face.rect(14, 7.5, w - 28, 1).fill({ color: shade(c, 0.7), alpha: 0.5 });
  face.rect(10, h - 9.5, w - 20, 2).fill({ color: c, alpha: 0.35 });
  root.addChild(face);
  const wash = new PIXI.Sprite(radTex([[0, rgba(c, 0.16)], [0.74, "rgba(0,0,0,0)"]]));
  wash.width = w; wash.height = h * 0.7; wash.y = 4;
  root.addChild(wash);
  const t = new PIXI.Text({ text: title, style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 11.5, fontWeight: "700", fill: 0xf2f7ff } });
  t.x = 16; t.y = 13;
  root.addChild(t);
  const r = lbl(rarity.toUpperCase(), 7, c, 2.4);
  r.x = 16; r.y = 29;
  root.addChild(r);
  d.x = 16; d.y = headH + 6;
  root.addChild(d);
  let y = headH + 10 + d.height;
  for (const row of rows) {
    const g = new PIXI.Graphics();
    g.rect(14, y, w - 28, 18).fill(0x060a10);
    g.rect(14, y, w - 28, 1).fill({ color: 0x000000, alpha: 0.8 });
    g.rect(14, y + 17, w - 28, 1).fill({ color: c, alpha: 0.14 });
    g.poly([20, y + 6.5, 23.5, y + 3, 27, y + 6.5, 23.5, y + 10]).fill(c);
    root.addChild(g);
    const k = val(row.k, 9, 0xbad2ec); k.x = 34; k.y = y + 4;
    const v = val(row.v, 9.5, 0xdbe9fb); v.anchor.x = 1; v.x = w - 20; v.y = y + 4;
    root.addChild(k, v);
    y += 20;
  }
  return root;
}

function confirmDialog(o: {
  w?: number; title: string; text: string; confirmLabel: string; cancelLabel?: string;
  accent?: number | string; onConfirm: () => void; onCancel: () => void;
}): PIXI.Container {
  const w = o.w ?? 380, accent = hex(o.accent ?? ACCENT.destruction), root = new PIXI.Container();
  const veil = new PIXI.Graphics();
  veil.rect(-3000, -3000, 9000, 9000).fill({ color: 0x02040a, alpha: 0.72 });
  veil.eventMode = "static";
  root.addChild(veil);
  const body = txt(o.text, 11, 0xd8e6f6, w - 48);
  const h = 96 + body.height + 20;
  const box = new PIXI.Container();
  shadows(box, w, h, 18, "tr-bl", 1);
  const rim = new PIXI.Graphics();
  for (const [i, tone, ch] of [[0, 0.5, 22], [2, -0.08, 21], [4, -0.48, 20], [6, -0.7, 19], [8, -0.86, 18]] as [number, number, number][]) {
    cut(rim, i, i, w - i * 2, h - i * 2, ch, shade(accent, tone), 1, "tr-bl");
  }
  box.addChild(rim);
  const face = new PIXI.Graphics();
  cut(face, 10, 10, w - 20, h - 20, 17, 0x0b0f16, 1, "tr-bl");
  face.rect(18, 10, w - 36, 1).fill({ color: shade(accent, 0.75), alpha: 0.6 });
  face.rect(14, h - 12, w - 28, 2).fill({ color: accent, alpha: 0.4 });
  box.addChild(face);
  const t = lbl(o.title.toUpperCase(), 10, shade(accent, 0.72), 3);
  t.x = 24; t.y = 24;
  box.addChild(t);
  body.x = 24; body.y = 48;
  box.addChild(body);
  const bw = (w - 60) / 2;
  const cancel = makeButton({ w: bw, h: 34, label: o.cancelLabel ?? "CANCEL", tone: "steel", cuts: "tl-br", onClick: o.onCancel });
  cancel.x = 24; cancel.y = h - 52;
  const confirm = makeButton({ w: bw, h: 34, label: o.confirmLabel, accent, cuts: "tr-bl", onClick: o.onConfirm });
  confirm.x = 36 + bw; confirm.y = h - 52;
  box.addChild(cancel, confirm);
  root.addChild(box);
  return root;
}

/** Eingabefeld über ein unsichtbares DOM-Input. */
function textInput(o: { w: number; h?: number; placeholder?: string; search?: boolean; upper?: boolean; onInput?: (v: string) => void; onEnter?: (v: string) => void }): {
  root: PIXI.Container; value: () => string; setValue: (v: string) => void; tick: (t: number) => void;
} {
  const h = o.h ?? 26, root = new PIXI.Container();
  let value = "", focused = false;
  const g = new PIXI.Graphics();
  cut(g, 0, 0, o.w, h, 6, 0x05080e, 1, "tl-br");
  g.rect(1, 1, o.w - 2, 1).fill({ color: 0x000000, alpha: 0.85 });
  g.rect(1, h - 2, o.w - 2, 1).fill({ color: 0xc9a8ff, alpha: 0.16 });
  root.addChild(g);
  const padL = o.search ? 22 : 10;
  const text = val("", 10, 0xf2f7ff);
  text.x = padL; text.y = (h - 12) / 2;
  const ph = val(o.placeholder ?? "", 10, 0x6b7f96);
  ph.x = padL; ph.y = text.y;
  root.addChild(ph, text);
  if (o.search) { const m = lbl("⌕", 10, 0xc9a8ff, 0); m.x = 8; m.y = (h - 11) / 2; root.addChild(m); }
  const caret = new PIXI.Graphics();
  caret.rect(0, 0, 1, 12).fill(0xf2f7ff);
  caret.visible = false;
  root.addChild(caret);
  let el: HTMLInputElement | null = null;
  const sync = (): void => {
    text.text = value; ph.visible = !value && !focused;
    caret.x = padL + text.width + 1; caret.y = text.y;
  };
  root.eventMode = "static"; root.cursor = "text";
  root.on("pointerup", () => {
    if (el) { el.focus(); return; }
    el = document.createElement("input");
    el.type = "text";
    el.setAttribute("aria-label", o.placeholder ?? "Text");
    Object.assign(el.style, { position: "fixed", left: "-9999px", top: "0", opacity: "0", width: "1px", height: "1px" } as unknown as CSSStyleDeclaration);
    document.body.appendChild(el);
    el.addEventListener("input", () => {
      let v = el!.value;
      if (o.upper) { v = v.toUpperCase().replace(/[^A-Z0-9]/g, ""); el!.value = v; }
      value = v; sync(); o.onInput?.(value);
    });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); o.onEnter?.(value); } });
    el.addEventListener("blur", () => { focused = false; caret.visible = false; el?.remove(); el = null; sync(); });
    focused = true; el.focus(); sync();
  });
  return {
    root,
    value: (): string => value,
    setValue: (v: string): void => { value = v; if (el) el.value = v; sync(); },
    tick: (t: number): void => { caret.visible = focused && (t % 1) < 0.55; },
  };
}

/* ── Fensterhülle: Rahmen + Kopfzeile + Portal in einem ───────────────────── */

export type WindowOpts = {
  /** Öffnet sofort mit der Portal-Animation. Default true. */
  autoplay?: boolean;
  /** Wird gerufen, wenn das Fenster fertig geschlossen ist. */
  onClosed?: () => void;
};

export type WindowHandle = {
  /** In die Bühne hängen. */
  root: PIXI.Container;
  /** Pro Frame rufen, dt in Sekunden. */
  update: (dt: number) => void;
  /** Schließen mit rückwärts laufender Animation. */
  close: () => void;
  /** Außenmaße. */
  size: { w: number; h: number };
  destroy: () => void;
};

type ShellOpts = {
  w: number; h: number; accent: number | string; title: string; note?: string;
  chamfer?: number; duration?: number; onClosed?: () => void; autoplay?: boolean;
};

type Shell = {
  root: PIXI.Container;
  /** Inhaltsfläche unter der Kopfzeile. */
  body: PIXI.Container;
  bodyW: number;
  bodyH: number;
  portal: PrintPortal;
  frameAmb: PIXI.Sprite;
  close: () => void;
  update: (dt: number) => void;
};

const HEADER_H = 38;

function windowShell(o: ShellOpts): Shell {
  const accent = hex(o.accent);
  const root = new PIXI.Container();
  const frame = panelFrame({ w: o.w, h: o.h, accent, chamfer: o.chamfer ?? 34 });
  root.addChild(frame.root);

  // Kopfzeile: Diamant, Titel, Notiz, roter Schließer
  const head = new PIXI.Container();
  const hg = new PIXI.Graphics();
  hg.poly([0, 3.5, 3.5, 0, 7, 3.5, 3.5, 7]).fill(accent);
  hg.rect(0, HEADER_H - 10, frame.inner.w - 30, 1).fill({ color: 0x000000, alpha: 0.55 });
  hg.rect(0, HEADER_H - 9, frame.inner.w - 30, 1).fill({ color: accent, alpha: 0.16 });
  head.addChild(hg);
  const hGlow = glow(accent, 18, 18, 0.7);
  hGlow.x = -5.5; hGlow.y = -5.5;
  head.addChildAt(hGlow, 0);
  const title = lbl(o.title.toUpperCase(), 12, shade(accent, 0.75), 3);
  title.x = 14; title.y = -2;
  head.addChild(title);
  if (o.note) {
    const note = lbl(o.note, 8.5, 0xa8bdd6, 1.6);
    note.x = title.x + title.width + 14; note.y = 1;
    head.addChild(note);
  }
  const portal = new PrintPortal({ w: o.w, h: o.h, accent, chamfer: o.chamfer ?? 34, duration: o.duration });
  const closer = makeCloseButton(24, () => { portal.close(); });
  closer.x = frame.inner.w - 44; closer.y = -3;
  head.addChild(closer);
  head.x = 14; head.y = 12;
  frame.content.addChild(head);

  const body = new PIXI.Container();
  body.x = 14; body.y = 12 + HEADER_H;
  frame.content.addChild(body);

  root.addChild(portal.reveal);
  frame.root.mask = portal.reveal;
  root.addChild(portal.root);
  portal.onClosed = o.onClosed;
  if (o.autoplay !== false) portal.play();

  let t = 0;
  return {
    root, body,
    bodyW: frame.inner.w - 28,
    bodyH: frame.inner.h - HEADER_H - 20,
    portal,
    frameAmb: frame.amb,
    close: (): void => portal.close(),
    update: (dt: number): void => {
      t += dt;
      portal.update(dt);
      frame.amb.alpha = 0.22 + Math.sin(t * 1.3) * 0.05;
      hGlow.alpha = 0.6 + Math.sin(t * 2.2) * 0.2;
    },
  };
}


const COLS = 8, ROWS = 3, PAGE = COLS * ROWS;
const IP = "/assets/ui/items/";

/** id, name, kind, rarity, icon, qty, ilvl, equipped, slot, desc, stats */
type Entry = [string, string, string, string, string, number, number, boolean, string, string, [string, string][]];

const ITEMS: Entry[] = [
  ["i1", "Void Lance", "weapon", "celestial", "laser-t10", 1, 92, true, "WEAPON",
    "Emitter assembly wound from collapsed alloy. Draws straight from the capacitor and never asks twice.",
    [["DAMAGE", "1,840"], ["RATE", "2.4 / s"], ["HEAT", "38 %"]]],
  ["i2", "Corsair Repeater", "weapon", "legendary", "laser-t9", 1, 84, false, "WEAPON",
    "Salvaged corsair mount. Loud, fast, and it eats capacitor for breakfast.",
    [["DAMAGE", "1,412"], ["RATE", "3.1 / s"], ["HEAT", "52 %"]]],
  ["i3", "Bastion Field", "shield", "relic", "genshield-t4", 1, 88, true, "SHIELD",
    "Deflector core lifted from a derelict station. Raises the ceiling and shortens the window.",
    [["SHIELD", "12,400"], ["RECHARGE", "4.2 s"], ["DRAW", "68 /s"]]],
  ["i4", "Kestrel Drive", "engine", "epic", "genspeed-t3", 1, 76, true, "ENGINE",
    "Drive tuning block. Trades hull mass for acceleration and a shorter warp spool.",
    [["SPEED", "+18 %"], ["SPOOL", "2.8 s"], ["MASS", "-6 %"]]],
  ["i5", "Rift Coupler", "module", "celestial", "mod3-t3", 1, 90, false, "UTILITY",
    "Slots into any free bay. Bends the tail of a jump so the next one comes cheaper.",
    [["JUMP COST", "-22 %"], ["RANGE", "+4 ly"]]],
  ["i6", "Ferrite Plate", "module", "rare", "mod2-t4", 4, 54, false, "UTILITY",
    "Rolled alloy plate. Cheap, heavy, and it keeps you alive one pass longer.",
    [["HULL", "+2,200"], ["MASS", "+9 %"]]],
  ["i7", "Nova Charge", "consumable", "epic", "mod0-t3", 12, 60, false, "CONSUMABLE",
    "One-shot capacitor dump. Empties the bank into a single volley.",
    [["BURST", "×2.4"], ["COOLDOWN", "45 s"]]],
  ["i8", "Repair Cell", "consumable", "uncommon", "mod2-t3", 28, 30, false, "CONSUMABLE",
    "Field patch. Seals hull breaches mid-flight without a dock.",
    [["HULL", "+1,400"], ["CAST", "3 s"]]],
  ["i9", "Ion Scatter", "weapon", "rare", "laser-t6", 1, 58, false, "WEAPON",
    "Wide-cone emitter. Poor against armour, brutal against drone swarms.",
    [["DAMAGE", "740"], ["SPREAD", "34°"]]],
  ["i10", "Halcyon Barrier", "shield", "epic", "genshield-t2", 1, 66, false, "SHIELD",
    "Standard yard-fitted deflector. Reliable, unremarkable, always in stock.",
    [["SHIELD", "6,800"], ["RECHARGE", "5.6 s"]]],
  ["i11", "Sable Thrusters", "engine", "rare", "genspeed-t3", 1, 52, false, "ENGINE",
    "Second-hand thruster set. Runs hot but turns tighter than the spec sheet.",
    [["SPEED", "+11 %"], ["TURN", "+14 %"]]],
  ["i12", "Salvage Claw", "module", "uncommon", "mod3-t3", 2, 34, false, "UTILITY",
    "Grapple arm for wreck stripping. Slow, but it takes the whole hull.",
    [["YIELD", "+18 %"]]],
  ["i13", "Ember Rounds", "consumable", "rare", "mod0-t3", 220, 44, false, "CONSUMABLE",
    "Incendiary load. Keeps burning after the shot lands.",
    [["BURN", "180 / s"], ["DURATION", "6 s"]]],
  ["i14", "Tessera Lens", "module", "legendary", "mod2-t4", 1, 80, false, "UTILITY",
    "Targeting lens ground at the Tessera yards. Tightens every shot you take.",
    [["ACCURACY", "+16 %"], ["RANGE", "+8 %"]]],
  ["i15", "Cobalt Cutter", "weapon", "uncommon", "laser-t5", 1, 40, false, "WEAPON",
    "Mining laser pressed into service as a weapon. It works, mostly.",
    [["DAMAGE", "410"], ["MINING", "+22 %"]]],
  ["i16", "Drift Anchor", "module", "common", "mod2-t3", 6, 18, false, "UTILITY",
    "Station-keeping anchor. Holds you still while the belt drifts past.",
    [["DRIFT", "-90 %"]]],
  ["i17", "Erebus Core", "shield", "celestial", "genshield-t4", 1, 94, false, "SHIELD",
    "Pulled from the Erebus wreck. Nobody agrees on how it still works.",
    [["SHIELD", "18,600"], ["RECHARGE", "3.1 s"], ["REFLECT", "12 %"]]],
  ["i18", "Pike Booster", "engine", "common", "genspeed-t3", 3, 22, false, "ENGINE",
    "Entry-level booster. Gets a recruit out of trouble once.",
    [["SPEED", "+6 %"]]],
  ["i19", "Foundry Slag", "module", "common", "mod3-t3", 44, 12, false, "UTILITY",
    "Refinery leftovers. Worth something in bulk, worth nothing alone.",
    [["VALUE", "120 cr"]]],
  ["i20", "Nyx Sight", "module", "epic", "mod2-t4", 1, 72, false, "UTILITY",
    "Passive scanner. Paints hostiles two grids before they see you.",
    [["SCAN", "+2 grids"], ["STEALTH", "-8 %"]]],
  ["i21", "Solace Flare", "consumable", "common", "mod0-t3", 60, 10, false, "CONSUMABLE",
    "Distress flare. Someone might come. Someone might not.",
    [["RADIUS", "3 km"]]],
  ["i22", "Vandt Repeater", "weapon", "epic", "laser-t9", 1, 70, false, "WEAPON",
    "Vandt-pattern autocannon. Ugly, dependable, and it never jams.",
    [["DAMAGE", "1,060"], ["RATE", "2.8 / s"]]],
  ["i23", "Ashen Coil", "shield", "rare", "genshield-t2", 1, 56, false, "SHIELD",
    "Reconditioned coil. Recharges fast, holds little.",
    [["SHIELD", "4,200"], ["RECHARGE", "2.4 s"]]],
  ["i24", "Grist Hauler Kit", "module", "uncommon", "mod2-t3", 1, 38, false, "UTILITY",
    "Modular hold frame. Every hauler carries one and complains about it.",
    [["CARGO", "+240"]]],
  ["i25", "Relic Shard", "module", "relic", "mod3-t3", 3, 86, false, "UTILITY",
    "Fragment of something older than the charter. It hums when you jump.",
    [["ALL STATS", "+4 %"]]],
  ["i26", "Wren Scope", "module", "rare", "mod2-t4", 1, 48, false, "UTILITY",
    "Long-range optic. Reads a hull signature at the edge of the grid.",
    [["RANGE", "+12 %"]]],
  ["i27", "Kova Plating", "module", "legendary", "mod2-t4", 2, 78, false, "UTILITY",
    "Layered composite from the Kova line. Heavy, and worth every kilo.",
    [["HULL", "+5,400"], ["MASS", "+14 %"]]],
];

const CATS: [string, string][] = [
  ["all", "ALL"], ["weapon", "WEAPONS"], ["shield", "DEFENCE"],
  ["engine", "DRIVES"], ["module", "MODULES"], ["consumable", "SUPPLIES"],
];

const RAR_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "relic", "celestial"];

export type InventoryOpts = WindowOpts & {
  items?: Entry[];
  /** Startreiter. */
  category?: string;
};

export function mount(o: InventoryOpts = {}): WindowHandle {
  const rows0 = o.items ?? ITEMS;
  const W = 1020, H = 592;
  const shell = windowShell({
    w: W, h: H, accent: ACCENT.action,
    title: "Inventory", note: "24 sockets per page · rarity filter · search",
    onClosed: o.onClosed, autoplay: o.autoplay,
  });

  let cat = o.category ?? "all";
  let rarMin = 0;
  let query = "";
  let sel: string | null = rows0[0]?.[0] ?? null;
  let page = 0;
  let t = 0;

  const headL = new PIXI.Container();
  const gridL = new PIXI.Container();
  const sideL = new PIXI.Container();
  const overL = new PIXI.Container();
  gridL.y = 74;
  sideL.x = shell.bodyW - 306;
  shell.body.addChild(headL, gridL, sideL, overL);

  const socks: ItemSocket[] = [];
  let scan: PIXI.Sprite | null = null;
  let tipHost: PIXI.Container | null = null;
  let dialog: PIXI.Container | null = null;

  const search = textInput({
    w: 196, placeholder: "Search an item", search: true,
    onInput: (v) => { query = v; page = 0; build(); },
  });

  const filtered = (): Entry[] => {
    const q = query.trim().toLowerCase();
    return rows0.filter((it) =>
      (cat === "all" || it[2] === cat)
      && RAR_ORDER.indexOf(it[3]) >= rarMin
      && (!q || it[1].toLowerCase().includes(q)));
  };

  const build = (): void => {
    headL.removeChildren(); gridL.removeChildren(); sideL.removeChildren();
    socks.length = 0; scan = null; tipHost = null;

    const list = filtered();
    const gw = shell.bodyW - 318;

    /* Reiter */
    const tw = (gw - 5 * 6) / CATS.length;
    CATS.forEach(([k, label], i) => {
      const tab = makeTab({
        w: tw, h: 26, label, accent: ACCENT.action, active: cat === k,
        onClick: () => { cat = k; page = 0; build(); },
      });
      tab.x = i * (tw + 6);
      headL.addChild(tab);
    });

    /* Suche + Raritätsschwelle */
    search.root.x = 0; search.root.y = 36;
    headL.addChild(search.root);
    RAR_ORDER.forEach((r, i) => {
      const c = RARITY[r], on = rarMin <= i;
      const b = new PIXI.Container();
      const g = new PIXI.Graphics();
      g.poly(hexa(0, 0, 18, 18)).fill(shade(c, on ? 0.3 : -0.62));
      g.poly(hexa(2, 2, 14, 14)).fill(shade(c, on ? -0.2 : -0.82));
      b.addChild(g);
      if (rarMin === i) {
        const gl = glow(c, 30, 30, 0.7);
        gl.x = gl.y = -6;
        b.addChildAt(gl, 0);
      }
      b.x = 206 + i * 22; b.y = 40;
      states(b, { lift: 2, sink: 1, onClick: () => { rarMin = rarMin === i ? 0 : i; page = 0; build(); } });
      headL.addChild(b);
    });
    const count = val(list.length + " / " + rows0.length + " ITEMS", 9, 0xc9b2e8);
    count.anchor.x = 1; count.x = gw; count.y = 43;
    headL.addChild(count);

    /* Rasterwanne */
    const sz = Math.floor((gw - (COLS - 1) * 8) / COLS);
    const gh = ROWS * sz + (ROWS - 1) * 8 + 20;
    const well = new PIXI.Graphics();
    cut(well, 0, 0, gw, gh, 12, 0x080611, 1, "tr-bl");
    well.rect(10, 0, gw - 20, 1).fill({ color: 0x000000, alpha: 0.85 });
    well.rect(10, gh - 2, gw - 20, 2).fill({ color: ACCENT.action, alpha: 0.2 });
    gridL.addChild(well);

    const clip = new PIXI.Graphics();
    cut(clip, 0, 0, gw, gh, 12, 0xffffff, 1, "tr-bl");
    const inner = new PIXI.Container();
    inner.addChild(clip); inner.mask = clip;
    gridL.addChild(inner);

    // senkrechte Feinstriche + wandernde Scanlinie
    const fine = new PIXI.Graphics();
    for (let x = 0; x < gw; x += 3) fine.rect(x, 0, 1, gh).fill({ color: 0xaa8cdc, alpha: 0.04 });
    fine.eventMode = "none";
    inner.addChild(fine);
    scan = new PIXI.Sprite(gradTex([
      [0, "rgba(78,226,255,0)"], [0.44, "rgba(78,226,255,.16)"],
      [0.5, "rgba(157,242,255,.3)"], [0.56, "rgba(78,226,255,.16)"], [1, "rgba(78,226,255,0)"],
    ]));
    scan.width = gw; scan.height = 44;
    scan.blendMode = "add";
    scan.eventMode = "none";
    inner.addChild(scan);

    const start = page * PAGE;
    for (let i = 0; i < PAGE; i++) {
      const it = list[start + i];
      const cx = (i % COLS) * (sz + 8) + 0;
      const cy = Math.floor(i / COLS) * (sz + 8) + 10;
      const item: SocketItem | null = it
        ? { id: it[0], name: it[1], rarity: it[3], icon: IP + it[4] + ".png", qty: it[5], ilvl: it[6], equipped: it[7] }
        : null;
      const s = itemSocket(sz, item, {
        onClick: () => { if (it) { sel = it[0]; build(); } },
      });
      s.root.x = cx; s.root.y = cy;
      if (it && sel === it[0]) s.setSelected(true);
      inner.addChild(s.root);
      socks.push(s);
    }

    /* Blättern */
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    const navY = gh + 8;
    const prev = makeTab({ w: 30, h: 22, label: "‹", accent: ACCENT.action, active: false, enabled: page > 0, onClick: () => { page--; build(); } });
    prev.y = navY;
    const next = makeTab({ w: 30, h: 22, label: "›", accent: ACCENT.action, active: false, enabled: page < pages - 1, onClick: () => { page++; build(); } });
    next.x = 34; next.y = navY;
    gridL.addChild(prev, next);
    const pg = val("PAGE " + (page + 1) + " / " + pages, 9, 0xc9b2e8);
    pg.x = 74; pg.y = navY + 5;
    gridL.addChild(pg);

    /* Akte rechts */
    const it = rows0.find((x) => x[0] === sel) ?? null;
    const sw = 300;
    const c = it ? RARITY[it[3]] : 0x2a3444;
    const card = new PIXI.Graphics();
    cut(card, 0, 0, sw, shell.bodyH - 8, 14, shade(c, -0.8), 1, "tr-bl");
    card.rect(14, 0, sw - 28, 1).fill({ color: shade(c, 0.8), alpha: 0.35 });
    card.rect(10, shell.bodyH - 10, sw - 20, 2).fill({ color: c, alpha: 0.4 });
    sideL.addChild(card);
    const wash = new PIXI.Sprite(radTex([[0, rgba(c, 0.16)], [0.74, "rgba(0,0,0,0)"]]));
    wash.width = sw; wash.height = 180;
    sideL.addChild(wash);

    if (it) {
      const big = itemSocket(78, { name: it[1], rarity: it[3], icon: IP + it[4] + ".png" });
      big.root.x = 16; big.root.y = 16;
      sideL.addChild(big.root);
      socks.push(big);

      const nm = new PIXI.Text({
        text: it[1],
        style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, fontWeight: "700", fill: 0xf2f7ff, wordWrap: true, wordWrapWidth: sw - 116 },
      });
      nm.x = 104; nm.y = 20;
      sideL.addChild(nm);
      const rr = lbl(it[3].toUpperCase(), 7, c, 2.6);
      rr.x = 104; rr.y = 22 + nm.height;
      sideL.addChild(rr);
      const sl = val(it[8] + " · ILVL " + it[6], 9, 0xbad2ec);
      sl.x = 104; sl.y = 36 + nm.height;
      sideL.addChild(sl);
      if (it[7]) {
        const eq = lbl("EQUIPPED", 6, 0x5cff8a, 2);
        eq.x = 104; eq.y = 50 + nm.height;
        sideL.addChild(eq);
      }

      const div = new PIXI.Graphics();
      div.rect(16, 106, sw - 32, 1).fill({ color: 0x000000, alpha: 0.6 });
      div.rect(16, 107, sw - 32, 1).fill({ color: c, alpha: 0.16 });
      sideL.addChild(div);

      const d = txt(it[9], 11, 0xd8e6f6, sw - 32);
      d.x = 16; d.y = 118;
      sideL.addChild(d);

      let y = 126 + d.height;
      it[10].forEach(([k, v]) => {
        const g = new PIXI.Graphics();
        g.rect(16, y, sw - 32, 20).fill(0x060a10);
        g.rect(16, y, sw - 32, 1).fill({ color: 0x000000, alpha: 0.8 });
        g.rect(16, y + 19, sw - 32, 1).fill({ color: c, alpha: 0.14 });
        g.poly([24, y + 7.5, 27.5, y + 4, 31, y + 7.5, 27.5, y + 11]).fill(c);
        sideL.addChild(g);
        const kk = val(k, 9, 0xbad2ec); kk.x = 38; kk.y = y + 5;
        const vv = val(v, 9.5, 0xdbe9fb); vv.anchor.x = 1; vv.x = sw - 24; vv.y = y + 5;
        sideL.addChild(kk, vv);
        y += 22;
      });

      const eqBtn = makeButton({
        w: sw - 32, h: 32, label: it[7] ? "UNEQUIP" : "EQUIP",
        tone: it[7] ? "steel" : "confirm", onClick: () => { it[7] = !it[7]; build(); },
      });
      eqBtn.x = 16; eqBtn.y = shell.bodyH - 92;
      const drop = makeButton({
        w: sw - 32, h: 32, label: "THROW OUT", tone: "danger",
        onClick: () => openDialog(it),
      });
      drop.x = 16; drop.y = shell.bodyH - 54;
      sideL.addChild(eqBtn, drop);
    } else {
      const e = val("No item selected.", 10, 0x6b7f96);
      e.x = 18; e.y = 20;
      sideL.addChild(e);
    }
  };

  const openDialog = (it: Entry): void => {
    if (dialog) return;
    dialog = confirmDialog({
      title: "Throw out",
      text: `${it[1]} leaves the hold for good. Nothing comes back from the void — the slot clears the moment you confirm.`,
      confirmLabel: "THROW OUT",
      onConfirm: () => {
        const i = rows0.indexOf(it);
        if (i >= 0) rows0.splice(i, 1);
        if (sel === it[0]) sel = rows0[0]?.[0] ?? null;
        closeDialog(); build();
      },
      onCancel: closeDialog,
    });
    dialog.x = (shell.bodyW - 380) / 2;
    dialog.y = 90;
    overL.addChild(dialog);
  };
  const closeDialog = (): void => { dialog?.destroy({ children: true }); dialog = null; };

  build();

  return {
    root: shell.root,
    size: { w: W, h: H },
    close: shell.close,
    update: (dt: number): void => {
      t += dt;
      shell.update(dt);
      search.tick(t);
      for (const s of socks) s.tick(t);
      if (scan) {
        const span = scan.parent ? (scan.parent.height || 200) : 200;
        const p = (t % 5.5) / 5.5;
        scan.y = p * (span + scan.height) - scan.height;
        scan.alpha = p < 0.1 ? p / 0.1 : p > 0.9 ? (1 - p) / 0.1 : 1;
      }
    },
    destroy: (): void => { closeDialog(); shell.root.destroy({ children: true }); },
  };
}

export default mount;
