// I-14-clan-hall · CLAN HALL
//
// Drei Spalten. Links Wappen im Hexagon mit Celestial-Sheen, Clanname, Rang,
// Levelröhre, Schatzkammer, Spendenblock und Saisonbilanz. Jede Spende füllt Kasse,
// eigenen Beitrag und Clan-XP; bei 92.000 steigt der Clan ein Level und die
// Mitgliedergrenze wächst um einen Platz (10 + Level).
// 
// Mitte sechs Forschungsprojekte als Karten mit Stufen-Pips, darunter die
// Detailkarte mit NOW › NEXT TIER und dem FUND-Knopf — bei zu leerer Kasse
// ausgegraut mit Fehlsumme. Rechts das Roster, sortierbar nach Beitrag, Rang oder
// Online-Status.
//
// Selbstständiges Modul: einziger Import ist pixi.js. Rahmen, Portal-Animation,
// Funken, Zustände und Daten sind eingebacken — die Datei läuft ohne Nachbarn.
//
//   import { mount } from "./I-14-clan-hall";
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


/** Kennzahlenzeile mit Raute, wie in jedem Panel. */
function statRow(into: PIXI.Container, x: number, y: number, w: number, k: string, v: string, hx: number): void {
  const g = new PIXI.Graphics();
  g.rect(x, y, w, 22).fill(0x0a0810);
  g.rect(x, y, w, 1).fill({ color: 0x000000, alpha: 0.8 });
  g.rect(x, y + 21, w, 1).fill({ color: hx, alpha: 0.14 });
  g.poly([x + 8, y + 8.5, x + 11.5, y + 5, x + 15, y + 8.5, x + 11.5, y + 12]).fill(hx);
  into.addChild(g);
  const kk = val(k, 8.5, 0xc4daee); kk.x = x + 22; kk.y = y + 6;
  const vv = val(v, 9, 0xdbe9fb); vv.anchor.x = 1; vv.x = x + w - 8; vv.y = y + 6;
  into.addChild(kk, vv);
}

/** key, name, icon, max, base cost, unit, per tier, brief, hex */
type Project = [string, string, string, number, number, string, number, string, string];

const IP = "/assets/ui/items/";

const RESEARCH: Project[] = [
  ["hull", "Reinforced Plating", "genshield-t4", 5, 180000, "%", 2.5,
    "Rolled alloy plate shipped to every hangar under the tag. Adds hull to each member's ship the moment they undock.", "#4ee2ff"],
  ["dmg", "Focused Emitters", "laser-t9", 5, 240000, "%", 2.0,
    "Shared targeting firmware pushed to every weapon mount in the clan. Raises damage for anyone flying the banner.", "#ff4d5e"],
  ["drive", "Drive Calibration", "genspeed-t3", 5, 150000, "%", 3.0,
    "Clan-wide engine profile. Shorter warp spool and quicker acceleration on every hull in the roster.", "#5cff8a"],
  ["cargo", "Hold Expansion", "mod2-t4", 5, 120000, " units", 40,
    "Modular hold frames fitted at the clan dock. Every member hauls more ore before a run has to end.", "#e8b94d"],
  ["salv", "Salvage Rights", "mod3-t3", 5, 210000, "%", 4.0,
    "Negotiated wreck claims across the rim. Better salvage yield from anything the clan kills.", "#ff5cf0"],
  ["hon", "Banner of Honor", "mod0-t3", 5, 300000, "%", 5.0,
    "Season banner filed with the faction office. Raises the honor every member earns from contracts.", "#b866ff"],
];

/** name, role, level, contribution, online */
type Member = [string, string, number, number, boolean];

const ROSTER: Member[] = [
  ["Kestrel", "LEADER", 62, 1840000, true], ["Vega_9", "OFFICER", 58, 1210000, true],
  ["Sable", "OFFICER", 55, 986000, false], ["Ilya", "VETERAN", 51, 742000, true],
  ["Nyx_7", "VETERAN", 49, 412000, true], ["Orin", "PILOT", 44, 388000, true],
  ["Halcyon", "PILOT", 41, 301000, false], ["Bruk", "PILOT", 39, 264000, true],
  ["Mera", "PILOT", 36, 198000, false], ["Tass", "RECRUIT", 28, 96000, true],
  ["Juno", "RECRUIT", 24, 61000, false], ["Pike", "RECRUIT", 19, 24000, true],
];

const ROLE_HEX: Record<string, number> = {
  LEADER: 0xe8b94d, OFFICER: 0xb866ff, VETERAN: 0x4ee2ff, PILOT: 0x9fb6d4, RECRUIT: 0x7f8ea4,
};
const ROLE_ORDER: Record<string, number> = { LEADER: 0, OFFICER: 1, VETERAN: 2, PILOT: 3, RECRUIT: 4 };
const AMOUNTS = [5000, 25000, 100000];
const XP_PER_LEVEL = 92000;

export type ClanHallOpts = WindowOpts & {
  clanName?: string; tag?: string; level?: number; xp?: number;
  credits?: number; mcoins?: number; me?: string; tiers?: Record<string, number>;
};

export function mount(o: ClanHallOpts = {}): WindowHandle {
  const W = 1180, H = 668;
  const shell = windowShell({
    w: W, h: H, accent: ACCENT.action,
    title: "Clan Hall", note: "crest · shared research · roster",
    onClosed: o.onClosed, autoplay: o.autoplay,
  });

  const NAME = o.clanName ?? "VOID SYNDICATE";
  const TAG = o.tag ?? "VSD";
  const ME = o.me ?? "Nyx_7";
  let level = o.level ?? 14;
  let xp = o.xp ?? 68200;
  let credits = o.credits ?? 4820000;
  let mcoins = o.mcoins ?? 18400;
  let mine = 412000;
  const tiers: Record<string, number> = Object.assign(
    { hull: 3, dmg: 2, drive: 4, cargo: 1, salv: 2, hon: 0 }, o.tiers ?? {});
  let amtIdx = 1;
  let sel = "hull";
  let sort: "contrib" | "rank" | "online" = "contrib";
  let memSel: string | null = null;
  let toast: { text: string; hex: number } | null = null;
  let t = 0;

  const colA = new PIXI.Container();
  const colB = new PIXI.Container();
  const colC = new PIXI.Container();
  shell.body.addChild(colA, colB, colC);

  const glows: { sp: PIXI.Sprite; base: number }[] = [];
  let sheen: PIXI.Sprite | null = null;
  let crestW = 70;

  const addXp = (add: number): void => {
    xp += add;
    while (xp >= XP_PER_LEVEL) { xp -= XP_PER_LEVEL; level++; }
  };
  const costOf = (p: Project): number => p[4] * ((tiers[p[0]] ?? 0) + 1);
  const short = (n: number): string =>
    n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n);
  const effOf = (p: Project, tier: number): string =>
    (p[6] * tier).toFixed(p[5] === "%" ? 1 : 0).replace(/\.0$/, "") + p[5];

  const build = (): void => {
    colA.removeChildren(); colB.removeChildren(); colC.removeChildren();
    glows.length = 0; sheen = null;

    const c = ACCENT.action;
    const aw = 326, cw = 290;
    const bw = shell.bodyW - aw - cw - 24;
    colB.x = aw + 12;
    colC.x = aw + bw + 24;
    const cap = 10 + level;
    const amt = AMOUNTS[amtIdx];

    /* ════ Spalte A: Identität, Kasse, Spenden, Bilanz ════ */
    const cardA = new PIXI.Graphics();
    cut(cardA, 0, 0, aw, 168, 12, 0x140f22, 1, "tr-bl");
    cardA.rect(12, 0, aw - 24, 1).fill({ color: 0xc9a8ff, alpha: 0.3 });
    cardA.rect(8, 166, aw - 16, 2).fill({ color: c, alpha: 0.4 });
    colA.addChild(cardA);
    const washA = new PIXI.Sprite(radTex([[0, rgba(c, 0.16)], [0.74, "rgba(0,0,0,0)"]]));
    washA.width = aw; washA.height = 120;
    colA.addChild(washA);
    const fine = new PIXI.Graphics();
    for (let x = 0; x < aw; x += 3) fine.rect(x, 0, 1, 168).fill({ color: 0xaa8cdc, alpha: 0.045 });
    fine.eventMode = "none";
    colA.addChild(fine);

    const cs = 70;
    crestW = cs;
    const crest = new PIXI.Container();
    const cg = new PIXI.Graphics();
    for (const [inset, tone] of [[0, 0.5], [3, -0.2], [5.5, -0.6]] as [number, number][]) {
      cg.poly(hexa(inset, inset, cs - inset * 2, cs - inset * 2)).fill(shade(c, tone));
    }
    crest.addChild(cg);
    const cwash = new PIXI.Sprite(radTex([[0, rgba(c, 0.5)], [0.74, "rgba(7,5,13,0)"]]));
    cwash.width = cwash.height = cs - 11; cwash.x = cwash.y = 5.5;
    crest.addChild(cwash);
    const cclip = new PIXI.Graphics();
    cclip.poly(hexa(5.5, 5.5, cs - 11, cs - 11)).fill(0xffffff);
    const chost = new PIXI.Container();
    chost.addChild(cclip); chost.mask = cclip;
    sheen = new PIXI.Sprite(gradTex([
      [0, "rgba(0,0,0,0)"], [0.45, "rgba(240,228,255,.5)"], [1, "rgba(0,0,0,0)"],
    ], false, 96));
    sheen.width = cs * 0.26; sheen.height = cs * 1.4; sheen.y = -cs * 0.2;
    sheen.blendMode = "add";
    chost.addChild(sheen);
    crest.addChild(chost);
    const tgt = lbl(TAG, 15, shade(c, 0.7), 1.2);
    tgt.anchor.set(0.5); tgt.x = cs / 2; tgt.y = cs / 2;
    crest.addChild(tgt);
    const cgl = glow(c, cs * 1.8, cs * 1.8, 0.4);
    cgl.x = cgl.y = -cs * 0.4;
    crest.addChildAt(cgl, 0);
    glows.push({ sp: cgl, base: 0.34 });
    crest.x = 14; crest.y = 14;
    colA.addChild(crest);

    const nm = lbl(NAME, 13.5, 0xeddcff, 1.4);
    nm.x = 96; nm.y = 18;
    colA.addChild(nm);
    const rk = val("RANK 07 · ASCENDANT", 8.5, 0xd6c8f2);
    rk.x = 96; rk.y = 38;
    colA.addChild(rk);
    const motto = txt("Cut the rim, keep the lane, split the salvage.", 10, 0xcedef2, aw - 112);
    motto.x = 96; motto.y = 54;
    colA.addChild(motto);

    const bwid = aw - 28, bh = 13;
    const pl = lbl("CLAN LEVEL " + level, 6.5, 0xcedef6, 2.6);
    pl.x = 14; pl.y = 98;
    colA.addChild(pl);
    const pvv = val(num(xp) + " / " + num(XP_PER_LEVEL), 9, 0xeddcff);
    pvv.anchor.x = 1; pvv.x = aw - 14; pvv.y = 97;
    colA.addChild(pvv);
    const tr = new PIXI.Graphics();
    tr.rect(14, 114, bwid, bh).fill(0x080610);
    tr.rect(14, 114, bwid, 1).fill({ color: 0x000000, alpha: 0.85 });
    tr.rect(14, 114 + bh - 1, bwid, 1).fill({ color: c, alpha: 0.16 });
    colA.addChild(tr);
    const p2 = Math.max(0.02, Math.min(1, xp / XP_PER_LEVEL));
    const fl = new PIXI.Sprite(gradTex([
      [0, rgba(shade(c, 0.6), 1)], [0.46, rgba(c, 1)], [1, rgba(shade(c, -0.5), 1)],
    ]));
    fl.x = 14; fl.y = 114; fl.width = p2 * bwid; fl.height = bh;
    colA.addChild(fl);
    const fgl = glow(c, p2 * bwid + 24, bh * 3, 0.45);
    fgl.x = 2; fgl.y = 114 - bh;
    colA.addChild(fgl);
    glows.push({ sp: fgl, base: 0.42 });
    const bticks = new PIXI.Graphics();
    for (let x = 0; x < bwid; x += 5) bticks.rect(14 + x, 114, 1, bh).fill({ color: 0x000000, alpha: 0.4 });
    colA.addChild(bticks);
    const slots = val(ROSTER.length + " / " + cap + " MEMBERS  ·  +1 SLOT PER LEVEL", 8.5, 0xc9a8ff);
    slots.x = 14; slots.y = 134;
    colA.addChild(slots);

    // Kasse
    const trY = 178;
    const tcard = new PIXI.Graphics();
    cut(tcard, 0, trY, aw, 64, 12, 0x141020, 1, "tr-bl");
    tcard.rect(12, trY, aw - 24, 1).fill({ color: 0xf5dda6, alpha: 0.24 });
    tcard.rect(8, trY + 62, aw - 16, 2).fill({ color: ACCENT.currency, alpha: 0.3 });
    colA.addChild(tcard);
    const tl = lbl("CLAN TREASURY", 6.5, shade(ACCENT.currency, 0.4), 2.6);
    tl.x = 14; tl.y = trY + 10;
    colA.addChild(tl);
    ([["CREDITS", num(credits), ACCENT.currency], ["MCOINS", num(mcoins), ACCENT.system]] as [string, string, number][])
      .forEach(([k, v, hx], i) => {
        const w2 = (aw - 34) / 2, x = 14 + i * (w2 + 6);
        const g = new PIXI.Graphics();
        g.rect(x, trY + 24, w2, 32).fill(0x0b0910);
        g.rect(x, trY + 24, w2, 1).fill({ color: 0x000000, alpha: 0.8 });
        g.rect(x, trY + 55, w2, 1).fill({ color: hx, alpha: 0.18 });
        colA.addChild(g);
        const kk = lbl(k, 6, shade(hx, 0.4), 2); kk.x = x + 8; kk.y = trY + 28;
        const vv = val(v, 14, shade(hx, 0.5)); vv.x = x + 8; vv.y = trY + 38;
        colA.addChild(kk, vv);
      });

    // Spenden
    const dY = trY + 74;
    const dcard = new PIXI.Graphics();
    cut(dcard, 0, dY, aw, 116, 12, 0x141020, 1, "tr-bl");
    dcard.rect(12, dY, aw - 24, 1).fill({ color: 0xc9a8ff, alpha: 0.26 });
    dcard.rect(8, dY + 114, aw - 16, 2).fill({ color: c, alpha: 0.3 });
    colA.addChild(dcard);
    const dl = lbl("DONATION", 6.5, 0xcedef6, 2.6);
    dl.x = 14; dl.y = dY + 10;
    colA.addChild(dl);
    const yv = val("YOURS · " + short(mine), 8, 0xbed6ec);
    yv.anchor.x = 1; yv.x = aw - 14; yv.y = dY + 10;
    colA.addChild(yv);
    AMOUNTS.forEach((a, i) => {
      const on = amtIdx === i, w2 = (aw - 40) / 3;
      const b = new PIXI.Container();
      const g = new PIXI.Graphics();
      cut(g, 0, 0, w2, 22, 6, on ? shade(c, -0.2) : 0x1a1626, 1, "tl-br");
      cut(g, 1, 1, w2 - 2, 20, 5.5, on ? shade(c, -0.62) : 0x0a0812, 1, "tl-br");
      g.rect(4, 1, w2 - 8, 1).fill({ color: shade(c, 0.7), alpha: on ? 0.55 : 0.16 });
      g.rect(3, 20, w2 - 6, 2).fill({ color: c, alpha: on ? 1 : 0.22 });
      b.addChild(g);
      const l = val(short(a), 9, on ? 0xf4ecff : 0x9fb6d4);
      l.anchor.set(0.5); l.x = w2 / 2; l.y = 11;
      b.addChild(l);
      b.x = 14 + i * (w2 + 6); b.y = dY + 26;
      states(b, { lift: 2, sink: 1, onClick: () => { amtIdx = i; build(); } });
      colA.addChild(b);
    });
    const half = (aw - 34) / 2;
    const giveC = makeButton({
      w: half, h: 34, label: "✦ CREDITS", tone: "currency",
      onClick: () => {
        credits += amt; mine += amt; addXp(Math.round(amt / 100));
        toast = { text: "+" + num(amt) + " credits into the vault", hex: 0xf5dda6 };
        build();
      },
    });
    giveC.x = 14; giveC.y = dY + 54;
    const giveM = makeButton({
      w: half, h: 34, label: "◈ MCOINS", tone: "system",
      onClick: () => {
        const coins = Math.max(1, Math.round(amt / 1000));
        mcoins += coins; mine += coins * 1000; addXp(coins * 40);
        toast = { text: "+" + num(coins) + " MCoins into the vault", hex: 0xcfefff };
        build();
      },
    });
    giveM.x = 20 + half; giveM.y = dY + 54;
    colA.addChild(giveC, giveM);
    if (toast) {
      const tv = val(toast.text, 9, toast.hex);
      tv.x = 14; tv.y = dY + 94;
      colA.addChild(tv);
    }

    // Bilanz
    const sY = dY + 126;
    const scard = new PIXI.Graphics();
    cut(scard, 0, sY, aw, shell.bodyH - sY, 12, 0x141020, 1, "tr-bl");
    scard.rect(12, sY, aw - 24, 1).fill({ color: 0xc9a8ff, alpha: 0.24 });
    colA.addChild(scard);
    const sl = lbl("SEASON RECORD", 6.5, 0xcedef6, 2.6);
    sl.x = 14; sl.y = sY + 10;
    colA.addChild(sl);
    const wk = lbl("WEEK 6", 6.5, 0x5cff8a, 2);
    wk.anchor.x = 1; wk.x = aw - 14; wk.y = sY + 10;
    colA.addChild(wk);
    ([["CONTRACTS CLEARED", "1,284", 0x4ee2ff], ["SECTOR WARS WON", "7 / 9", 0xff4d5e],
      ["TREASURY INFLOW", "+842,000", 0xe8b94d], ["HONOR EARNED", "96,400", 0xff5cf0]] as [string, string, number][])
      .forEach(([k, v, hx], i) => statRow(colA, 14, sY + 26 + i * 24, aw - 28, k, v, hx));

    /* ════ Spalte B: Forschung ════ */
    const bh2 = lbl("CLAN RESEARCH", 9, 0xeddcff, 3.4);
    colB.addChild(bh2);
    const rc = val(RESEARCH.filter((r) => (tiers[r[0]] ?? 0) > 0).length + " PROJECTS ONLINE", 8.5, 0xc9a8ff);
    rc.anchor.x = 1; rc.x = bw; rc.y = 2;
    colB.addChild(rc);

    const cardW = (bw - 9) / 2;
    RESEARCH.forEach((p, i) => {
      const [key, name, icon, max, , , per] = p;
      const pc = hex(p[8]), tier = tiers[key] ?? 0;
      const on = sel === key, full = tier >= max;
      const x = (i % 2) * (cardW + 9), y = 20 + Math.floor(i / 2) * 106;
      const card = new PIXI.Container();
      const g = new PIXI.Graphics();
      cut(g, 0, 0, cardW, 98, 11, on ? shade(pc, -0.78) : 0x0f0d18, 1, "tl-br");
      g.rect(0, 0, 2, 98).fill({ color: pc, alpha: on ? 1 : 0.5 });
      g.rect(8, 1, cardW - 16, 1).fill({ color: shade(pc, 0.7), alpha: on ? 0.4 : 0.14 });
      g.rect(0, 96, cardW, 2).fill({ color: pc, alpha: tier > 0 ? (full ? 1 : 0.55) : 0.14 });
      card.addChild(g);

      const sock = new PIXI.Graphics();
      for (const [ii, tone] of [[0, 0.4], [2.5, -0.34]] as [number, number][]) {
        sock.poly(hexa(12 + ii, 12 + ii, 38 - ii * 2, 38 - ii * 2)).fill(shade(pc, tone));
      }
      card.addChild(sock);
      const ic = new PIXI.Sprite(iconTex(IP + icon + ".png"));
      ic.width = ic.height = 20; ic.x = 21; ic.y = 21;
      ic.alpha = tier > 0 ? 1 : 0.5;
      card.addChild(ic);
      if (full) {
        const fg = glow(pc, 62, 62, 0.5);
        fg.x = 0; fg.y = 0;
        card.addChildAt(fg, 0);
        glows.push({ sp: fg, base: 0.4 });
      }

      const nv = new PIXI.Text({
        text: name,
        style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 11, fontWeight: "700", fill: on ? 0xffffff : 0xe2ecfa },
      });
      nv.x = 58; nv.y = 13;
      card.addChild(nv);
      const pips = new PIXI.Graphics();
      for (let j = 0; j < max; j++) {
        const px2 = 58 + j * 10, lit = j < tier;
        pips.rect(px2, 30, 7, 7).fill(lit ? pc : 0x1b1f28);
        if (lit) pips.rect(px2, 30, 7, 1).fill({ color: 0xffffff, alpha: 0.5 });
      }
      card.addChild(pips);
      const ef = val(effOf(p, tier) + " active · " + per + p[5] + " per tier", 9, 0xbad2ec);
      ef.x = 12; ef.y = 56;
      card.addChild(ef);
      const st = lbl(full ? "MAXED" : tier > 0 ? "TIER " + tier + " ONLINE" : "NOT RESEARCHED",
        6.5, full ? 0x5cff8a : tier > 0 ? shade(pc, 0.4) : 0x6b7f96, 2);
      st.x = 12; st.y = 76;
      card.addChild(st);
      const cst = val(full ? "—" : num(costOf(p)), 9,
        full ? 0x5cff8a : credits >= costOf(p) ? 0xf5dda6 : 0xff8c9b);
      cst.anchor.x = 1; cst.x = cardW - 12; cst.y = 74;
      card.addChild(cst);

      card.x = x; card.y = y;
      states(card, { lift: 2, sink: 1, onClick: () => { sel = key; build(); } });
      colB.addChild(card);
    });

    // Detailkarte
    const p = RESEARCH.find((r) => r[0] === sel)!;
    const pc = hex(p[8]), tier = tiers[sel] ?? 0, max = p[3];
    const full = tier >= max, cost = costOf(p), afford = credits >= cost;
    const dY2 = 20 + Math.ceil(RESEARCH.length / 2) * 106 + 6;
    const dh = shell.bodyH - dY2;
    const dcard2 = new PIXI.Graphics();
    cut(dcard2, 0, dY2, bw, dh, 12, 0x141020, 1, "tr-bl");
    dcard2.rect(12, dY2, bw - 24, 1).fill({ color: shade(pc, 0.7), alpha: 0.3 });
    dcard2.rect(8, dY2 + dh - 2, bw - 16, 2).fill({ color: pc, alpha: 0.4 });
    colB.addChild(dcard2);
    const dwash = new PIXI.Sprite(radTex([[0, rgba(pc, 0.15)], [0.74, "rgba(0,0,0,0)"]]));
    dwash.width = bw; dwash.height = dh * 0.6; dwash.y = dY2;
    colB.addChild(dwash);
    const dd = new PIXI.Graphics();
    dd.poly([14, dY2 + 16, 17.5, dY2 + 12.5, 21, dY2 + 16, 17.5, dY2 + 19.5]).fill(pc);
    colB.addChild(dd);
    const dn = new PIXI.Text({
      text: p[1],
      style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 12.5, fontWeight: "700", fill: 0xf2f7ff },
    });
    dn.x = 28; dn.y = dY2 + 9;
    colB.addChild(dn);
    const dt2 = lbl("TIER " + tier + " / " + max, 7, pc, 2);
    dt2.anchor.x = 1; dt2.x = bw - 14; dt2.y = dY2 + 12;
    colB.addChild(dt2);
    const db = txt(p[7], 10.5, 0xdae8f8, bw - 28);
    db.x = 14; db.y = dY2 + 28;
    colB.addChild(db);

    const ny = dY2 + 36 + db.height;
    const nw = (bw - 50) / 2;
    ([["NOW", tier ? effOf(p, tier) : "—", 0x9fb6d4], ["NEXT TIER", full ? "MAX TIER" : effOf(p, tier + 1), pc]] as [string, string, number][])
      .forEach(([k, v, hx], i) => {
        const x = 14 + i * (nw + 22);
        const g = new PIXI.Graphics();
        g.rect(x, ny, nw, 34).fill(0x0a0810);
        g.rect(x, ny, nw, 1).fill({ color: 0x000000, alpha: 0.8 });
        g.rect(x, ny + 33, nw, 1).fill({ color: hx, alpha: 0.16 });
        colB.addChild(g);
        const kk = lbl(k, 6, shade(hx, 0.35), 2); kk.x = x + 8; kk.y = ny + 5;
        const vv = val(v, 12, i ? shade(pc, 0.5) : 0xdbe9fb); vv.x = x + 8; vv.y = ny + 15;
        colB.addChild(kk, vv);
      });
    const arw = lbl("›", 13, pc, 0);
    arw.anchor.set(0.5); arw.x = 14 + nw + 11; arw.y = ny + 17;
    colB.addChild(arw);

    const fund = makeButton({
      w: bw - 28, h: 34,
      label: full ? "RESEARCH COMPLETE" : afford ? "FUND TIER " + (tier + 1) + " · " + num(cost)
        : "TREASURY SHORT · " + num(cost),
      tone: "action", enabled: !full && afford,
      onClick: () => {
        if (full) { toast = { text: "That project is already at max tier", hex: 0x5cff8a }; build(); return; }
        if (!afford) { toast = { text: "Treasury is short " + num(cost - credits) + " credits", hex: 0xff8c9b }; build(); return; }
        tiers[sel] = tier + 1; credits -= cost;
        addXp(Math.round(cost / 40));
        toast = { text: p[1] + " advanced to tier " + (tier + 1), hex: pc };
        build();
      },
    });
    fund.x = 14; fund.y = dY2 + dh - 46;
    colB.addChild(fund);

    /* ════ Spalte C: Roster ════ */
    const rh = lbl("ROSTER", 9, 0xeddcff, 3.4);
    colC.addChild(rh);
    const free = val(Math.max(0, cap - ROSTER.length) + " SLOTS FREE", 8, 0xc9a8ff);
    free.x = 66; free.y = 2;
    colC.addChild(free);
    ([["contrib", "CONTRIB"], ["rank", "RANK"], ["online", "ONLINE"]] as const).forEach(([k, label], i) => {
      const b = makeTab({
        w: 62, h: 20, label, accent: c, active: sort === k,
        onClick: () => { sort = k; build(); },
      });
      b.x = cw - 194 + i * 66; b.y = -2;
      colC.addChild(b);
    });

    const list = [...ROSTER].sort((a, b) =>
      sort === "rank" ? ROLE_ORDER[a[1]] - ROLE_ORDER[b[1]] || b[3] - a[3]
        : sort === "online" ? (Number(b[4]) - Number(a[4])) || b[3] - a[3] : b[3] - a[3]);

    list.forEach((m, i) => {
      const [n, role, lv, contrib, online] = m;
      const mc = ROLE_HEX[role], on = memSel === n, you = n === ME;
      const y = 26 + i * 32;
      const row = new PIXI.Container();
      const g = new PIXI.Graphics();
      cut(g, 0, 0, cw, 30, 8, on ? shade(mc, -0.78) : (i % 2 ? 0x0e0b16 : 0x100d1a), 1, "tl-br");
      g.rect(0, 0, 2, 30).fill({ color: mc, alpha: on || you ? 1 : 0.55 });
      if (on || you) g.rect(0, 28, cw, 2).fill({ color: mc, alpha: 0.4 });
      row.addChild(g);
      const dot = new PIXI.Graphics();
      dot.circle(14, 15, 3).fill({ color: online ? 0x5cff8a : 0x5b6675, alpha: online ? 1 : 0.55 });
      row.addChild(dot);
      if (online) {
        const dg = glow(0x5cff8a, 16, 16, 0.6);
        dg.x = 6; dg.y = 7;
        row.addChild(dg);
      }
      const nv2 = new PIXI.Text({
        text: you ? n + " · YOU" : n,
        style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 10.5, fontWeight: "700", fill: on ? 0xffffff : you ? 0xeddcff : 0xe2ecfa },
      });
      nv2.x = 26; nv2.y = 4;
      row.addChild(nv2);
      const rl2 = lbl(role + " · LV " + lv, 6, shade(mc, 0.35), 1.6);
      rl2.x = 26; rl2.y = 19;
      row.addChild(rl2);
      const cv = val(short(you ? mine : contrib), 9, on ? 0xffffff : 0xd6e6f8);
      cv.anchor.x = 1; cv.x = cw - 10; cv.y = 9;
      row.addChild(cv);
      row.y = y;
      const x0 = row.x;
      row.eventMode = "static"; row.cursor = "pointer";
      row.on("pointerover", () => { row.x = x0 + 2; });
      row.on("pointerout", () => { row.x = x0; });
      row.on("pointerup", () => { row.x = x0 + 2; memSel = on ? null : n; build(); });
      colC.addChild(row);
    });

    const half2 = (cw - 8) / 2;
    const inv = makeButton({
      w: half2, h: 30, label: "INVITE", tone: "steel",
      onClick: () => { toast = { text: "Invite link copied to your clipboard", hex: 0xcfefff }; build(); },
    });
    inv.y = shell.bodyH - 34;
    const leave = makeButton({
      w: half2, h: 30, label: "LEAVE", tone: "danger",
      onClick: () => { toast = { text: "Leaving requires an officer's confirmation", hex: 0xff8c9b }; build(); },
    });
    leave.x = half2 + 8; leave.y = shell.bodyH - 34;
    colC.addChild(inv, leave);
  };

  build();

  return {
    root: shell.root,
    size: { w: W, h: H },
    close: shell.close,
    update: (dt: number): void => {
      t += dt;
      shell.update(dt);
      for (const g of glows) g.sp.alpha = g.base + Math.sin(t * 1.6) * 0.1;
      if (sheen) sheen.x = ((t / 6) % 1) * (crestW + sheen.width) - sheen.width;
    },
    destroy: (): void => shell.root.destroy({ children: true }),
  };
}

export default mount;
