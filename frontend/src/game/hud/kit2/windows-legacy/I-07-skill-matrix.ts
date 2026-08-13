// I-07-skill-matrix · SKILL MATRIX
//
// Drei Bäume — Offensive, Defence, Utility — jeder mit eigenem Layout, von oben
// nach unten wachsend. Normale Knoten sind Hexagone, Elite-Knoten gedrehte
// Quadrate, Kapstein-Knoten Achtecke. Lichtstrahlen verbinden Eltern und Kind:
// freigeschaltet leuchten sie in Baumfarbe, gesperrt bleiben sie dunkel.
// 
// Geskillte Stufen lesen sich als kleine gelbe Quadrate unter dem Knoten. Ein voll
// ausgebauter Knoten pulsiert. Ziehen verschiebt die Ansicht, Rad zoomt. Klick
// öffnet die Akte rechts. INVEST braucht außerhalb der Station Premium, RESPEC
// kostet MCoins.
//
// Selbstständiges Modul: einziger Import ist pixi.js. Rahmen, Portal-Animation,
// Funken, Zustände und Daten sind eingebacken — die Datei läuft ohne Nachbarn.
//
//   import { mount } from "./I-07-skill-matrix";
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


/** id, name, tier, x, y, max, kind, parent, brief, effect per rank */
type Node = [string, string, number, number, number, number, "normal" | "elite" | "capstone", string | null, string, string];

const TREES: Record<string, { label: string; hex: string; nodes: Node[] }> = {
  off: {
    label: "OFFENSIVE", hex: "#ff4d5e",
    nodes: [
      ["o1", "Focused Barrel", 1, 0, 0, 5, "normal", null, "Tighter bore, straighter shot. The first thing any gunner pays for.", "+3% weapon damage"],
      ["o2", "Heat Sink", 1, -150, 96, 5, "normal", "o1", "Vented sink bolted to the mount. Lets you hold the trigger longer.", "-4% heat build-up"],
      ["o3", "Rapid Cycle", 1, 150, 96, 5, "normal", "o1", "Reworked feed mechanism. More shots in the same window.", "+2.5% fire rate"],
      ["o4", "Piercing Core", 2, -230, 196, 4, "normal", "o2", "Hardened penetrator. Goes through plate that used to stop you.", "+4% armour penetration"],
      ["o5", "Overcharge", 2, -76, 196, 4, "elite", "o2", "Dumps the capacitor into the first shot of every burst.", "+9% opening burst"],
      ["o6", "Splinter Rounds", 2, 76, 196, 4, "elite", "o3", "Rounds break on impact and spray the hull behind.", "+7% splash damage"],
      ["o7", "Hair Trigger", 2, 230, 196, 4, "normal", "o3", "Shorter travel on the trigger. Milliseconds add up.", "+3% fire rate"],
      ["o8", "Executioner", 3, -150, 302, 3, "elite", "o5", "Targets under a third health take noticeably more.", "+12% damage below 33% hull"],
      ["o9", "Chain Fire", 3, 150, 302, 3, "elite", "o6", "Every kill shortens the next reload.", "-14% reload after a kill"],
      ["o10", "Annihilation Field", 4, 0, 412, 1, "capstone", "o8", "Your kills detonate. Anything close to the wreck takes it too.", "Kills deal 40% splash in 900 m"],
    ],
  },
  def: {
    label: "DEFENCE", hex: "#4ee2ff",
    nodes: [
      ["d1", "Hull Weave", 1, 0, 0, 5, "normal", null, "Cross-woven plate. Cheap tonnage that keeps you flying.", "+2.5% hull"],
      ["d2", "Shield Cell", 1, -190, 92, 5, "normal", "d1", "Extra cell in the deflector bank. More ceiling, same draw.", "+3% shield capacity"],
      ["d3", "Reactive Plating", 1, 0, 92, 5, "normal", "d1", "Plate that stiffens on impact. Blunts repeat hits.", "-2% damage taken"],
      ["d4", "Coolant Loop", 1, 190, 92, 5, "normal", "d1", "Closed loop that keeps the deflector from browning out.", "-4% shield recharge delay"],
      ["d5", "Bulwark", 2, -120, 200, 4, "elite", "d2", "Locks the deflector open while the bank drains.", "+11% shield under fire"],
      ["d6", "Ablative Skin", 2, 120, 200, 4, "elite", "d3", "Outer layer burns off instead of the hull.", "-8% first hit damage"],
      ["d7", "Fast Cycle", 2, 0, 296, 4, "normal", "d4", "Shortens the gap before the deflector comes back.", "-5% recharge time"],
      ["d8", "Last Stand", 3, -170, 388, 3, "elite", "d5", "Under a quarter hull, everything toughens.", "-18% damage below 25% hull"],
      ["d9", "Mirror Field", 3, 170, 388, 3, "elite", "d6", "A share of what hits the deflector goes back out.", "Reflect 6% of shield damage"],
      ["d10", "Aegis Protocol", 4, 0, 492, 1, "capstone", "d8", "One full stop. Everything bounces for three seconds.", "3 s immunity, 180 s cooldown"],
    ],
  },
  uti: {
    label: "UTILITY", hex: "#5cff8a",
    nodes: [
      ["u1", "Drive Trim", 1, 0, 0, 5, "normal", null, "Trimmed thruster profile. Free speed for a weekend's work.", "+2% top speed"],
      ["u2", "Cargo Frames", 1, -210, 104, 5, "normal", "u1", "Modular frames in the hold. More ore per run.", "+40 cargo units"],
      ["u3", "Scanner Gain", 1, -70, 104, 5, "normal", "u1", "Stronger return on the passive array.", "+8% scan range"],
      ["u4", "Salvage Arms", 1, 70, 104, 5, "normal", "u1", "Better grip on wrecks. Less left behind.", "+3% salvage yield"],
      ["u5", "Warp Tuning", 1, 210, 104, 5, "normal", "u1", "Shorter spool, smoother exit.", "-5% warp spool"],
      ["u6", "Prospector", 2, -140, 212, 4, "elite", "u2", "Reads ore density before you commit to a rock.", "+9% mining yield"],
      ["u7", "Ghost Signature", 2, 0, 212, 4, "elite", "u3", "Damps your return. Hostiles notice you later.", "-11% detection range"],
      ["u8", "Wreck Rights", 2, 140, 212, 4, "normal", "u4", "Negotiated claims. Better rolls on salvage.", "+5% rare salvage chance"],
      ["u9", "Slipstream", 3, -110, 320, 3, "elite", "u6", "Drafts the wake of your own jump.", "+14% speed after warp"],
      ["u10", "Deep Survey", 3, 110, 320, 3, "elite", "u8", "Finds the seams nobody else bothered to map.", "Reveals hidden belt nodes"],
      ["u11", "Quantum Anchor", 4, 0, 424, 1, "capstone", "u9", "Drops a return point. One jump back, any time.", "Recall to anchor, 300 s cooldown"],
    ],
  },
};

const RANKS: Record<string, number> = {
  o1: 5, o2: 3, o3: 4, o4: 2, o5: 1, o6: 0, o7: 2, o8: 0, o9: 0, o10: 0,
  d1: 4, d2: 5, d3: 2, d4: 1, d5: 2, d6: 0, d7: 0, d8: 0, d9: 0, d10: 0,
  u1: 3, u2: 5, u3: 2, u4: 1, u5: 0, u6: 1, u7: 0, u8: 0, u9: 0, u10: 0, u11: 0,
};

export type SkillOpts = WindowOpts & {
  ranks?: Record<string, number>;
  points?: number;
  mcoins?: number;
  premium?: boolean;
  docked?: boolean;
  tree?: string;
};

export function mount(o: SkillOpts = {}): WindowHandle {
  const W = 1080, H = 660;
  const shell = windowShell({
    w: W, h: H, accent: ACCENT.action,
    title: "Skill Matrix", note: "three trees · drag to pan · wheel to zoom",
    onClosed: o.onClosed, autoplay: o.autoplay,
  });

  const ranks: Record<string, number> = Object.assign({}, RANKS, o.ranks ?? {});
  let points = o.points ?? 14;
  const mcoins = o.mcoins ?? 18400;
  const premium = !!o.premium;
  const docked = o.docked !== false;
  let tree = o.tree ?? "off";
  let sel: string | null = null;
  let zoom = 1;
  const pan = { x: 0, y: 0 };
  let t = 0;

  const headL = new PIXI.Container();
  const viewL = new PIXI.Container();
  const worldL = new PIXI.Container();
  const sideL = new PIXI.Container();
  const overL = new PIXI.Container();
  viewL.y = 36;
  sideL.x = shell.bodyW - 292;
  shell.body.addChild(headL, viewL, sideL, overL);

  const pulses: { node: PIXI.Container; hex: number }[] = [];
  const beams: { g: PIXI.Graphics; lit: boolean; hex: number }[] = [];
  let dialog: PIXI.Container | null = null;
  let dragging = false;
  const last = { x: 0, y: 0 };

  const unlocked = (n: Node): boolean => !n[7] || (ranks[n[7]] ?? 0) > 0;

  const build = (): void => {
    headL.removeChildren(); viewL.removeChildren(); sideL.removeChildren();
    worldL.removeChildren();
    pulses.length = 0; beams.length = 0;

    const T = TREES[tree], c = hex(T.hex);
    const vw = shell.bodyW - 304, vh = shell.bodyH - 44;

    /* Reiter + Punktestand */
    Object.entries(TREES).forEach(([k, v], i) => {
      const tab = makeTab({
        w: 130, h: 26, label: v.label, accent: hex(v.hex), active: tree === k,
        onClick: () => { tree = k; sel = null; pan.x = 0; pan.y = 0; build(); },
      });
      tab.x = i * 136;
      headL.addChild(tab);
    });
    const pts = val(points + " POINTS", 11, shade(ACCENT.currency, 0.5));
    pts.anchor.x = 1; pts.x = shell.bodyW; pts.y = 6;
    headL.addChild(pts);

    /* Ansichtsfenster */
    const well = new PIXI.Graphics();
    cut(well, 0, 0, vw, vh, 12, 0x070510, 1, "tr-bl");
    well.rect(10, 0, vw - 20, 1).fill({ color: 0x000000, alpha: 0.85 });
    well.rect(10, vh - 2, vw - 20, 2).fill({ color: c, alpha: 0.2 });
    viewL.addChild(well);

    const clip = new PIXI.Graphics();
    cut(clip, 0, 0, vw, vh, 12, 0xffffff, 1, "tr-bl");
    const inner = new PIXI.Container();
    inner.addChild(clip); inner.mask = clip;
    viewL.addChild(inner);

    // 34-px-Raster
    const grid = new PIXI.Graphics();
    for (let x = 0; x < vw; x += 34) grid.rect(x, 0, 1, vh).fill({ color: 0x96c8eb, alpha: 0.04 });
    for (let y = 0; y < vh; y += 34) grid.rect(0, y, vw, 1).fill({ color: 0x96c8eb, alpha: 0.04 });
    grid.eventMode = "none";
    inner.addChild(grid);
    inner.addChild(worldL);

    /* Verbindungsstrahlen */
    const byId: Record<string, Node> = {};
    for (const n of T.nodes) byId[n[0]] = n;
    for (const n of T.nodes) {
      if (!n[7]) continue;
      const p = byId[n[7]];
      const lit = (ranks[p[0]] ?? 0) > 0;
      const g = new PIXI.Graphics();
      const x1 = p[3], y1 = p[4] + 30, x2 = n[3], y2 = n[4] - 30;
      const my = (y1 + y2) / 2;
      g.moveTo(x1, y1).bezierCurveTo(x1, my, x2, my, x2, y2)
        .stroke({ width: lit ? 2.4 : 1.4, color: lit ? c : 0x2a3040, alpha: lit ? 0.85 : 0.5 });
      worldL.addChild(g);
      beams.push({ g, lit, hex: c });
      if (lit) {
        const g2 = new PIXI.Graphics();
        g2.moveTo(x1, y1).bezierCurveTo(x1, my, x2, my, x2, y2)
          .stroke({ width: 7, color: c, alpha: 0.16 });
        g2.blendMode = "add";
        worldL.addChildAt(g2, 0);
      }
    }

    /* Knoten */
    for (const n of T.nodes) {
      const [id, name, , nx, ny, max, kind] = n;
      const rank = ranks[id] ?? 0;
      const open = unlocked(n);
      const full = rank >= max;
      const on = sel === id;
      const size = kind === "capstone" ? 74 : kind === "elite" ? 62 : 54;
      const node = new PIXI.Container();
      node.x = nx; node.y = ny;

      const g = new PIXI.Graphics();
      const shape = (inset: number): number[] => {
        const s = size - inset * 2, x = inset - size / 2, y = inset - size / 2;
        if (kind === "elite") return [x + s / 2, y, x + s, y + s / 2, x + s / 2, y + s, x, y + s / 2];
        if (kind === "capstone") {
          const q = s * 0.29;
          return [x + q, y, x + s - q, y, x + s, y + q, x + s, y + s - q,
            x + s - q, y + s, x + q, y + s, x, y + s - q, x, y + q];
        }
        return hexa(x, y, s, s);
      };
      const base = open ? c : 0x2a3040;
      for (const [inset, tone] of [[0, 0.45], [2.5, -0.1], [5, -0.5], [7.5, -0.76]] as [number, number][]) {
        g.poly(shape(inset)).fill(shade(base, open ? tone : tone - 0.2));
      }
      node.addChild(g);

      const wash = new PIXI.Sprite(radTex([
        [0, rgba(base, open ? (rank > 0 ? 0.45 : 0.2) : 0.08)], [0.74, "rgba(0,0,0,0)"],
      ]));
      wash.width = wash.height = size * 0.8;
      wash.anchor.set(0.5);
      node.addChild(wash);

      const glyph = new PIXI.Text({
        text: kind === "capstone" ? "✦" : kind === "elite" ? "◆" : "▲",
        style: { fontFamily: "Orbitron, sans-serif", fontSize: size * 0.26, fill: open ? shade(base, 0.55) : 0x4a5364 },
      });
      glyph.anchor.set(0.5);
      node.addChild(glyph);

      // Stufen als kleine gelbe Quadrate unter dem Knoten
      const pipW = 6, pipGap = 3;
      const totalW = max * pipW + (max - 1) * pipGap;
      const pips = new PIXI.Graphics();
      for (let i = 0; i < max; i++) {
        const px = -totalW / 2 + i * (pipW + pipGap);
        const lit = i < rank;
        pips.rect(px, size / 2 + 5, pipW, pipW).fill(lit ? ACCENT.currency : 0x1b1f28);
        if (lit) pips.rect(px, size / 2 + 5, pipW, 1).fill({ color: 0xfff4d6, alpha: 0.7 });
      }
      node.addChild(pips);

      if (full) {
        const gl = glow(base, size * 1.9, size * 1.9, 0.4);
        gl.anchor?.set?.(0.5);
        gl.x = -size * 0.95; gl.y = -size * 0.95;
        node.addChildAt(gl, 0);
        pulses.push({ node: gl as unknown as PIXI.Container, hex: base });
      }
      if (on) {
        const ring = new PIXI.Graphics();
        ring.poly(shape(-4)).stroke({ width: 1.5, color: 0x4ee2ff, alpha: 0.8 });
        node.addChild(ring);
      }

      const nm = lbl(name.toUpperCase(), 6, open ? shade(base, 0.4) : 0x5b6675, 1.4);
      nm.anchor.set(0.5, 0);
      nm.y = size / 2 + 16;
      node.addChild(nm);

      node.eventMode = "static";
      node.cursor = "pointer";
      node.on("pointerover", () => { node.scale.set(1.06); });
      node.on("pointerout", () => { node.scale.set(1); });
      node.on("pointerup", () => { node.scale.set(1.06); sel = id; build(); });
      worldL.addChild(node);
    }

    // Baum mittig einpassen
    const xs = T.nodes.map((n) => n[3]);
    const ys = T.nodes.map((n) => n[4]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const spanY = Math.max(...ys) - Math.min(...ys) + 160;
    const fit = Math.min(1, (vh - 40) / spanY);
    worldL.scale.set(zoom * fit);
    worldL.x = vw / 2 - cx * zoom * fit + pan.x;
    worldL.y = 60 * zoom * fit + pan.y;

    // Ziehen und Zoomen
    inner.eventMode = "static";
    inner.cursor = "grab";
    inner.on("pointerdown", (e: PIXI.FederatedPointerEvent) => {
      dragging = true; last.x = e.global.x; last.y = e.global.y; inner.cursor = "grabbing";
    });
    inner.on("globalpointermove", (e: PIXI.FederatedPointerEvent) => {
      if (!dragging) return;
      pan.x += e.global.x - last.x; pan.y += e.global.y - last.y;
      last.x = e.global.x; last.y = e.global.y;
      worldL.x = vw / 2 - cx * zoom * fit + pan.x;
      worldL.y = 60 * zoom * fit + pan.y;
    });
    inner.on("pointerup", () => { dragging = false; inner.cursor = "grab"; });
    inner.on("pointerupoutside", () => { dragging = false; inner.cursor = "grab"; });
    inner.on("wheel", (e: PIXI.FederatedWheelEvent) => {
      zoom = Math.max(0.55, Math.min(1.7, zoom - e.deltaY * 0.0012));
      build();
    });

    /* Akte rechts */
    const sw = 286;
    const n = T.nodes.find((x) => x[0] === sel) ?? null;
    const card = new PIXI.Graphics();
    cut(card, 0, 0, sw, shell.bodyH - 4, 14, shade(c, -0.82), 1, "tr-bl");
    card.rect(14, 0, sw - 28, 1).fill({ color: shade(c, 0.8), alpha: 0.32 });
    card.rect(10, shell.bodyH - 6, sw - 20, 2).fill({ color: c, alpha: 0.4 });
    sideL.addChild(card);
    const wash2 = new PIXI.Sprite(radTex([[0, rgba(c, 0.16)], [0.74, "rgba(0,0,0,0)"]]));
    wash2.width = sw; wash2.height = 150;
    sideL.addChild(wash2);

    if (n) {
      const rank = ranks[n[0]] ?? 0, max = n[5];
      const open = unlocked(n), full = rank >= max;
      const nm = new PIXI.Text({
        text: n[1],
        style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, fontWeight: "700", fill: 0xf2f7ff, wordWrap: true, wordWrapWidth: sw - 32 },
      });
      nm.x = 16; nm.y = 16;
      sideL.addChild(nm);
      const kindL = lbl(n[6].toUpperCase() + " · TIER " + n[2], 6.5, c, 2.4);
      kindL.x = 16; kindL.y = 18 + nm.height;
      sideL.addChild(kindL);
      const rk = val("RANK " + rank + " / " + max, 10, full ? 0x5cff8a : 0xdbe9fb);
      rk.x = 16; rk.y = 32 + nm.height;
      sideL.addChild(rk);

      const d = txt(n[8], 11, 0xd8e6f6, sw - 32);
      d.x = 16; d.y = 56 + nm.height;
      sideL.addChild(d);

      let y = 64 + nm.height + d.height;
      ([["PER RANK", n[9]], ["NOW", rank ? n[9].replace(/[\d.]+/, (m) => String((parseFloat(m) * rank).toFixed(1)).replace(/\.0$/, "")) : "—"],
        ["REQUIRES", n[7] ? (TREES[tree].nodes.find((x) => x[0] === n[7])?.[1] ?? "—") : "NOTHING"]] as [string, string][])
        .forEach(([k, v]) => {
          const g = new PIXI.Graphics();
          g.rect(16, y, sw - 32, 20).fill(0x060a10);
          g.rect(16, y, sw - 32, 1).fill({ color: 0x000000, alpha: 0.8 });
          g.rect(16, y + 19, sw - 32, 1).fill({ color: c, alpha: 0.14 });
          g.poly([24, y + 7.5, 27.5, y + 4, 31, y + 7.5, 27.5, y + 11]).fill(c);
          sideL.addChild(g);
          const kk = val(k, 8.5, 0xbad2ec); kk.x = 38; kk.y = y + 5;
          const vv = val(v, 9, 0xdbe9fb); vv.anchor.x = 1; vv.x = sw - 24; vv.y = y + 5;
          sideL.addChild(kk, vv);
          y += 22;
        });

      const canInvest = open && !full && points > 0 && (docked || premium);
      const invest = makeButton({
        w: sw - 32, h: 34,
        label: full ? "MAXED" : !open ? "LOCKED" : points <= 0 ? "NO POINTS"
          : (!docked && !premium) ? "INVEST · PREMIUM" : "INVEST 1 POINT",
        tone: "confirm", enabled: canInvest,
        onClick: () => {
          if (!docked && !premium) {
            gate("Skilling outside a station needs premium. Dock at any station to spend points for free.");
            return;
          }
          if (!canInvest) return;
          ranks[n[0]] = rank + 1; points--;
          build();
        },
      });
      invest.x = 16; invest.y = shell.bodyH - 96;
      sideL.addChild(invest);

      const spent = Object.values(ranks).reduce((a, b) => a + b, 0);
      const cost = Math.max(2000, spent * 1400);
      const respec = makeButton({
        w: sw - 32, h: 32,
        label: "RESPEC · " + num(cost) + " MC", tone: "currency",
        enabled: mcoins >= cost && spent > 0,
        onClick: () => {
          if (mcoins < cost) { gate("Respec costs " + num(cost) + " MCoins. You are short " + num(cost - mcoins) + "."); return; }
          for (const k of Object.keys(ranks)) { points += ranks[k]; ranks[k] = 0; }
          sel = null; build();
        },
      });
      respec.x = 16; respec.y = shell.bodyH - 56;
      sideL.addChild(respec);
    } else {
      const e = txt("Pick a node to read what it does and what it costs.", 10.5, 0x6b7f96, sw - 32);
      e.x = 16; e.y = 18;
      sideL.addChild(e);
    }
  };

  const gate = (text: string): void => {
    if (dialog) return;
    dialog = confirmDialog({
      title: "Premium required", text,
      confirmLabel: "GET PREMIUM", cancelLabel: "NOT NOW",
      accent: ACCENT.currency,
      onConfirm: closeDialog, onCancel: closeDialog,
    });
    dialog.x = (shell.bodyW - 380) / 2;
    dialog.y = 110;
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
      for (const p of pulses) p.node.alpha = 0.32 + Math.sin(t * 1.9) * 0.16;
      for (const b of beams) if (b.lit) b.g.alpha = 0.7 + Math.sin(t * 2.1) * 0.18;
    },
    destroy: (): void => { closeDialog(); shell.root.destroy({ children: true }); },
  };
}

export default mount;
