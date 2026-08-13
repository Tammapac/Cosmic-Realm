// I-13-leaderboard · LEADERBOARD
//
// Vier Boards — Level, Honor, Kills, Credits — und zwei Zeiträume: MONTHLY wird pro
// Zyklus geleert und zahlt MCoins, ALL-TIME läuft weiter und zahlt permanente
// Boosts; die ersten drei halten Premium, solange sie den Platz halten.
// 
// Podium: Gold, Silber und Bronze als eigene Rahmenfarbe, Platz 1 breiter und mit
// laufendem Sheen. Die Rangziffer sitzt als angeschrägtes Eck oben links, Fraktion
// links vom Namen, Clan-Tag rechts. Die Tabelle läuft bis Platz 100 in Seiten von
// neun; die eigene Zeile bleibt unten angeheftet, auch wenn sie aus der Hundert
// fällt. Rechts die Belohnungsleiter des gewählten Zeitraums.
//
// Selbstständiges Modul: einziger Import ist pixi.js. Rahmen, Portal-Animation,
// Funken, Zustände und Daten sind eingebacken — die Datei läuft ohne Nachbarn.
//
//   import { mount } from "./I-13-leaderboard";
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


const MEDAL = [0xffdf8a, 0xdfe8f2, 0xe09a5a];
const PER_PAGE = 9;

const FAC_COLOR: Record<string, string> = { EIC: "#4ee2ff", MMO: "#ff8c4d", VRU: "#5cff8a" };

/** name, faction, tag, level, honor, kills, credits */
export type Standing = [string, string, string, number, number, number, number];

const TOP: Standing[] = [
  ["Kestrel", "EIC", "VSD", 62, 1840000, 9840, 182400000],
  ["Ashmark", "MMO", "NVP", 61, 1712000, 11204, 164900000],
  ["Sable", "EIC", "VSD", 60, 1655000, 8620, 158200000],
  ["Corvus_X", "VRU", "IRC", 59, 1498000, 10412, 149600000],
  ["Vega_9", "EIC", "VSD", 58, 1402000, 7318, 141800000],
  ["Rell", "MMO", "EMW", 58, 1366000, 9106, 138400000],
  ["Ilya", "EIC", "VSD", 57, 1284000, 6842, 132900000],
  ["Nakamura", "VRU", "HLV", 56, 1198000, 8004, 127300000],
  ["Sorrow", "MMO", "ASH", 56, 1142000, 7690, 121600000],
  ["Bruk", "EIC", "VSD", 55, 1088000, 6218, 118200000],
  ["Wren", "VRU", "SLM", 54, 1024000, 5904, 114700000],
  ["Kova", "MMO", "EMW", 53, 968000, 6440, 109300000],
  ["Halcyon", "EIC", "VSD", 52, 912000, 5312, 104800000],
  ["Vasquez", "VRU", "IRC", 51, 864000, 5788, 101200000],
  ["Orin", "EIC", "VSD", 50, 806000, 4920, 96400000],
  ["Nyx_7", "EIC", "VSD", 49, 96400, 4182, 46200000],
];

const NAMES = ["Torvald", "Ash_Vela", "Quill", "Renn", "Marrow", "Six_Cade", "Ollo", "Prae", "Suri_K", "Vandt",
  "Ketch", "Nova_Lin", "Brim", "Ozar", "Talia", "Grist", "Ephra", "Sundo", "Ryke", "Calla",
  "Merrow", "Dax_9", "Fenn", "Ivor", "Solace", "Yorne", "Pell", "Anka", "Drift_V", "Bram",
  "Sable_II", "Krieg", "Nim", "Osric", "Vex", "Lark", "Thann", "Ivy_R", "Corda", "Bex",
  "Mirek", "Sova", "Halt", "Ren_K", "Ulric", "Vail", "Wick", "Xan", "Yuri", "Zeb",
  "Adair", "Brann", "Cass", "Dovan", "Elin", "Foss", "Garr", "Hux", "Ilm", "Jory",
  "Kell", "Lyss", "Mott", "Nash", "Oren", "Pyre", "Quen", "Rask_II", "Syl", "Tarn",
  "Umbo", "Vane", "Wren_II", "Xero", "Yael", "Zane", "Alto", "Bode", "Cyra", "Doro",
  "Esk", "Faye", "Gunn", "Hale", "Iris", "Joss"];
const TAGS = ["IRC", "EMW", "SLM", "NVP", "DFC", "HLV", "SCU", "ASH", "VSD", "—"];
const FACS = ["EIC", "MMO", "VRU"];

const FILL: Standing[] = NAMES.map((n, i) => {
  const k = i + 1, wob = ((i * 37) % 11) / 10;
  return [n, FACS[(i * 7) % 3], TAGS[(i * 3) % 10],
    Math.max(12, 54 - Math.round(k * 0.42 + wob)),
    Math.round(1024000 / (1 + k * 0.09) - wob * 9000),
    Math.round(5904 / (1 + k * 0.05) - wob * 60),
    Math.round(92000000 / (1 + k * 0.1) - wob * 400000)] as Standing;
});

const ALL: Standing[] = TOP.concat(FILL);

/** key, label, hex, Spaltenindex, Einheit */
const BOARDS: [string, string, string, number, string][] = [
  ["level", "LEVEL", "#4ee2ff", 3, "LEVEL"],
  ["honor", "HONOR", "#ff5cf0", 4, "HONOR"],
  ["kills", "KILLS", "#ff4d5e", 5, "KILLS"],
  ["credits", "CREDITS", "#e8b94d", 6, "CREDITS"],
];

type RewardTier = [string, string, string[], boolean];

const REWARDS: Record<string, { title: string; hex: string; brief: string; tiers: RewardTier[] }> = {
  monthly: {
    title: "MONTHLY REWARDS", hex: "#e8b94d",
    brief: "The monthly board wipes at the start of every cycle. Placement pays MCoins the moment the season closes, plus the cosmetics filed for that cycle.",
    tiers: [
      ["RANK 1", "1st", ["25,000 MCOINS", "SEASON CREST", "TITLE: ASCENDANT"], true],
      ["RANK 2", "2nd", ["15,000 MCOINS", "SEASON CREST"], true],
      ["RANK 3", "3rd", ["10,000 MCOINS", "SEASON CREST"], true],
      ["RANK 4 – 10", "4-10", ["4,000 MCOINS"], false],
      ["RANK 11 – 50", "11+", ["1,500 MCOINS"], false],
      ["RANK 51 – 100", "51+", ["500 MCOINS"], false],
    ],
  },
  alltime: {
    title: "ALL-TIME REWARDS", hex: "#b866ff",
    brief: "The all-time board never resets. Standing pays a permanent boost that applies while you hold the seat — lose the rank and the boost goes with it.",
    tiers: [
      ["RANK 1", "1st", ["+15% EXPERIENCE", "+15% CREDITS", "PREMIUM WHILE HELD"], true],
      ["RANK 2", "2nd", ["+12% EXPERIENCE", "+12% CREDITS", "PREMIUM WHILE HELD"], true],
      ["RANK 3", "3rd", ["+10% EXPERIENCE", "+10% CREDITS", "PREMIUM WHILE HELD"], true],
      ["RANK 4 – 10", "4-10", ["+6% EXPERIENCE", "+6% CREDITS"], false],
      ["RANK 11 – 50", "11+", ["+3% EXPERIENCE", "+3% CREDITS"], false],
      ["RANK 51 – 100", "51+", ["+1% EXPERIENCE"], false],
    ],
  },
};

export type LeaderboardOpts = WindowOpts & {
  /** Eigene Rangliste einspeisen; ohne Angabe die Vorgabe aus dem Kit. */
  standings?: Standing[];
  /** Wessen Zeile unten angeheftet wird. */
  me?: string;
  /** Startboard. */
  board?: string;
  /** Startzeitraum. */
  season?: "monthly" | "alltime";
  /** Restlaufzeit im Kopf. */
  cycleEnds?: string;
};

export function mount(o: LeaderboardOpts = {}): WindowHandle {
  const rows0 = o.standings ?? ALL;
  const ME = o.me ?? "Nyx_7";
  const W = 1060, H = 640;

  const shell = windowShell({
    w: W, h: H, accent: ACCENT.currency,
    title: "Leaderboard", note: "four boards · podium for the top three",
    onClosed: o.onClosed, autoplay: o.autoplay,
  });

  let board = o.board ?? "honor";
  let season: "monthly" | "alltime" = o.season ?? "monthly";
  let page = 0;
  let sel: string | null = null;
  let t = 0;

  const headL = new PIXI.Container();
  const bodyL = new PIXI.Container();
  const sideL = new PIXI.Container();
  bodyL.y = 76;
  sideL.x = shell.bodyW - 300;
  shell.body.addChild(headL, bodyL, sideL);

  const glows: { sp: PIXI.Sprite; base: number }[] = [];
  let sheen: PIXI.Sprite | null = null;
  let sheenHost: PIXI.Container | null = null;

  const colOf = (): number => (BOARDS.find((b) => b[0] === board)?.[3] as number) ?? 4;

  const fmt = (p: Standing): string => {
    const v = p[colOf()] as number;
    if (board === "credits") return v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : num(v);
    if (board === "level") return String(v);
    return num(v);
  };

  const ranked = (): Standing[] => {
    const c = colOf();
    return [...rows0].sort((a, b) => (b[c] as number) - (a[c] as number) || b[4] - a[4]);
  };

  const build = (): void => {
    headL.removeChildren(); bodyL.removeChildren(); sideL.removeChildren();
    glows.length = 0; sheen = null; sheenHost = null;

    const rows = ranked();
    const lw = shell.bodyW - 312;
    const B = BOARDS.find((b) => b[0] === board)!;
    const unit = B[4];

    /* Zeitraum + Restlaufzeit */
    ([["monthly", "MONTHLY"], ["alltime", "ALL-TIME"]] as const).forEach(([k, label], i) => {
      const tab = makeTab({
        w: 104, h: 24, label, accent: ACCENT.currency, active: season === k,
        onClick: () => { season = k; build(); },
      });
      tab.x = i * 110;
      headL.addChild(tab);
    });
    const reset = val(season === "monthly" ? (o.cycleEnds ?? "CYCLE ENDS IN 11 D 04 H") : "NEVER RESETS · SINCE LAUNCH", 8.5, 0xe6d4b2);
    reset.anchor.x = 1; reset.x = shell.bodyW; reset.y = 8;
    headL.addChild(reset);

    /* Boards mit vollem Rahmen */
    BOARDS.forEach((b, i) => {
      const [key, name, hx] = b;
      const c = hex(hx), on = board === key;
      const bw = (lw - 18) / 4, x = i * (bw + 6), y = 34;
      const btn = new PIXI.Container();
      const g = new PIXI.Graphics();
      cut(g, 0, 0, bw, 30, 9, on ? shade(c, 0.5) : 0x7d7361, 1, "tl-br");
      cut(g, 1, 1, bw - 2, 28, 8.5, on ? shade(c, -0.2) : 0x3b352c, 1, "tl-br");
      cut(g, 2, 2, bw - 4, 26, 8, on ? shade(c, -0.62) : 0x161209, 1, "tl-br");
      g.rect(7, 2, bw - 14, 1).fill({ color: on ? shade(c, 0.7) : 0xf5ebd7, alpha: on ? 0.75 : 0.3 });
      g.rect(7, 27, bw - 14, 2).fill({ color: c, alpha: on ? 1 : 0.25 });
      btn.addChild(g);
      const dot = new PIXI.Graphics();
      dot.poly([16, 11, 20, 15, 16, 19, 12, 15]).fill({ color: c, alpha: on ? 1 : 0.45 });
      btn.addChild(dot);
      const label = lbl(name, 7.5, on ? 0xfff6e2 : shade(c, 0.3), 2.2);
      label.x = 30; label.y = 11;
      btn.addChild(label);
      if (on) {
        const gl = glow(c, bw, 18, 0.5);
        gl.y = 22;
        btn.addChildAt(gl, 0);
        glows.push({ sp: gl, base: 0.42 });
      }
      btn.x = x; btn.y = y;
      states(btn, { lift: 2, sink: 1, onClick: () => { board = key; page = 0; build(); } });
      headL.addChild(btn);
    });

    /* Podium — Silber, Gold, Bronze; Platz 1 in der Mitte und breiter */
    const podium = rows.slice(0, 3);
    [1, 0, 2].forEach((slot, pos) => {
      const p = podium[slot];
      if (!p) return;
      const first = slot === 0, c = MEDAL[slot];
      const pw = pos === 1 ? (lw - 16) * 0.38 : (lw - 16) * 0.31;
      const x = pos === 0 ? 0 : pos === 1 ? (lw - 16) * 0.31 + 8 : (lw - 16) * 0.69 + 16;
      const ph = first ? 92 : 84, y = first ? 0 : 8;

      const card = new PIXI.Container();
      const g = new PIXI.Graphics();
      cut(g, 0, 0, pw, ph, 14, shade(c, 0.5), 1, "tl-br");
      cut(g, 1.5, 1.5, pw - 3, ph - 3, 13, shade(c, -0.16), 1, "tl-br");
      cut(g, 3, 3, pw - 6, ph - 6, 12, shade(c, -0.55), 1, "tl-br");
      cut(g, 5, 5, pw - 10, ph - 10, 11, 0x120d06, 1, "tl-br");
      g.rect(14, 5, pw - 28, 1).fill({ color: shade(c, 0.7), alpha: 0.7 });
      g.rect(10, ph - 7, pw - 20, 2).fill({ color: c, alpha: first ? 0.6 : 0.4 });
      card.addChild(g);
      const wash = new PIXI.Sprite(radTex([[0, rgba(c, first ? 0.24 : 0.14)], [0.74, "rgba(0,0,0,0)"]]));
      wash.width = pw; wash.height = ph * 0.7; wash.y = 5;
      card.addChild(wash);

      // Rangziffer als angeschrägtes Eck
      const bs = first ? 34 : 29;
      const badge = new PIXI.Graphics();
      badge.poly([5, 5, 5 + bs, 5, 5, 5 + bs]).fill(shade(c, 0.2));
      card.addChild(badge);
      const rk = lbl(String(slot + 1), first ? 11 : 9.5, shade(c, -0.82), 0.6);
      rk.x = 11; rk.y = 9;
      card.addChild(rk);

      // Wappen
      const cs = first ? 42 : 34;
      const sock = new PIXI.Graphics();
      for (const [i, tone] of [[0, 0.4], [2.5, -0.3]] as [number, number][]) {
        sock.poly(hexa(bs + 8 + i, ph / 2 - cs / 2 + i, cs - i * 2, cs - i * 2)).fill(shade(c, tone));
      }
      card.addChild(sock);
      const dia = new PIXI.Text({ text: "◆", style: { fontFamily: "Orbitron, sans-serif", fontSize: first ? 17 : 14, fill: shade(c, 0.5) } });
      dia.anchor.set(0.5); dia.x = bs + 8 + cs / 2; dia.y = ph / 2;
      card.addChild(dia);

      // Fraktion | Name | Tag in einer Zeile
      const tx = bs + 8 + cs + 11;
      const fc = hex(FAC_COLOR[p[1]] ?? "#8aa0c0");
      const fac = lbl(p[1], 6, fc, 2);
      fac.x = tx; fac.y = ph / 2 - 20;
      card.addChild(fac);
      const nm = lbl(p[0], first ? 12.5 : 10.5, 0xfff6e2, 1);
      nm.x = tx + fac.width + 8; nm.y = ph / 2 - 22;
      card.addChild(nm);
      const tg = val("[" + p[2] + "]", 8.5, 0xe6d4b2);
      tg.x = nm.x + nm.width + 8; tg.y = ph / 2 - 21;
      card.addChild(tg);

      const v = val(fmt(p), first ? 19 : 15, c);
      v.x = tx; v.y = ph / 2 - 2;
      card.addChild(v);
      const un = lbl(unit, 6, 0xe6d4b2, 2);
      un.x = tx + v.width + 8; un.y = ph / 2 + (first ? 8 : 5);
      card.addChild(un);

      const prize = season === "monthly"
        ? ["25,000 MC", "15,000 MC", "10,000 MC"][slot]
        : ["+15% & PREMIUM", "+12% & PREMIUM", "+10% & PREMIUM"][slot];
      const pz = lbl(prize, 6, c, 2);
      pz.anchor.x = 1; pz.x = pw - 14; pz.y = ph - 20;
      card.addChild(pz);

      const gl = glow(c, pw * 1.1, ph * 1.2, first ? 0.5 : 0.32);
      gl.x = -pw * 0.05; gl.y = -ph * 0.1;
      card.addChildAt(gl, 0);
      glows.push({ sp: gl, base: first ? 0.42 : 0.28 });

      if (first) {
        const clip = new PIXI.Graphics();
        cut(clip, 5, 5, pw - 10, ph - 10, 11, 0xffffff, 1, "tl-br");
        const host = new PIXI.Container();
        host.addChild(clip); host.mask = clip;
        sheen = new PIXI.Sprite(gradTex([
          [0, "rgba(0,0,0,0)"], [0.45, rgba(shade(c, 0.6), 0.45)], [1, "rgba(0,0,0,0)"],
        ], false, 128));
        sheen.width = pw * 0.22; sheen.height = ph;
        sheen.blendMode = "add";
        host.addChild(sheen);
        card.addChild(host);
        sheenHost = card;
      }

      card.x = x; card.y = y;
      states(card, { lift: 3, sink: 1, onClick: () => { sel = p[0]; build(); } });
      bodyL.addChild(card);
    });

    /* Tabellenkopf */
    const tY = 110;
    ([["RANK", 12, false], ["PILOT", 68, false], ["CLAN", lw - 190, false], [unit, lw - 12, true]] as [string, number, boolean][])
      .forEach(([label, cx, right]) => {
        const l = lbl(label, 6, 0xe6d4b2, 2.6);
        if (right) l.anchor.x = 1;
        l.x = cx; l.y = tY;
        bodyL.addChild(l);
      });

    /* Zeilen ab Platz 4, geblättert bis 100 */
    const start = 3 + page * PER_PAGE;
    rows.slice(start, Math.min(100, start + PER_PAGE)).forEach((p, i) => {
      const rank = start + i + 1;
      const me = p[0] === ME, on = sel === p[0];
      const fc = hex(FAC_COLOR[p[1]] ?? "#8aa0c0");
      const y = tY + 18 + i * 28;
      const row = new PIXI.Container();
      const g = new PIXI.Graphics();
      cut(g, 0, 0, lw, 26, 8, me ? 0x181207 : on ? 0x14100a : (i % 2 ? 0x100d07 : 0x131009), 1, "tl-br");
      g.rect(0, 0, 2, 26).fill({ color: me ? 0xe8b94d : fc, alpha: me ? 1 : 0.7 });
      if (me || on) g.rect(0, 24, lw, 2).fill({ color: me ? 0xe8b94d : fc, alpha: 0.45 });
      row.addChild(g);
      const rk = val(String(rank).padStart(2, "0"), 11.5, rank <= 10 ? 0xffeec2 : 0xe6d4b2);
      rk.x = 16; rk.y = 6;
      row.addChild(rk);
      const dot = new PIXI.Graphics();
      dot.poly([56, 10, 60, 14, 56, 18, 52, 14]).fill(fc);
      row.addChild(dot);
      const nm = new PIXI.Text({
        text: p[0],
        style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 11, fontWeight: "700", fill: on || me ? 0xfff6e2 : 0xeee4d0 },
      });
      nm.x = 68; nm.y = 6;
      row.addChild(nm);
      const fac = lbl(p[1], 6, fc, 2);
      fac.x = 68 + nm.width + 8; fac.y = 9;
      row.addChild(fac);
      if (me) {
        const you = lbl("YOU", 6, 0xffeec2, 2);
        you.x = fac.x + fac.width + 10; you.y = 9;
        row.addChild(you);
      }
      const tg = val("[" + p[2] + "]", 9, 0xe6d4b2);
      tg.x = lw - 190; tg.y = 7;
      row.addChild(tg);
      const v = val(fmt(p), 11, on ? 0xffeec2 : 0xf0e6d4);
      v.anchor.x = 1; v.x = lw - 12; v.y = 6;
      row.addChild(v);
      // Trennstriche zwischen den Zellen
      const dv = new PIXI.Graphics();
      for (const x of [52, lw - 200, lw - 116]) {
        dv.rect(x, 3, 1, 20).fill({ color: 0x000000, alpha: 0.55 });
        dv.rect(x + 1, 3, 1, 20).fill({ color: 0xf5dda6, alpha: 0.06 });
      }
      row.addChild(dv);
      row.y = y;
      const x0 = row.x;
      row.eventMode = "static"; row.cursor = "pointer";
      row.on("pointerover", () => { row.x = x0 + 3; });
      row.on("pointerout", () => { row.x = x0; });
      row.on("pointerup", () => { row.x = x0 + 3; sel = on ? null : p[0]; build(); });
      bodyL.addChild(row);
    });

    /* Blättern */
    const pages = Math.ceil(97 / PER_PAGE);
    const navY = tY + 18 + PER_PAGE * 28 + 4;
    const prev = makeTab({ w: 30, h: 22, label: "‹", accent: ACCENT.currency, active: false, enabled: page > 0, onClick: () => { page--; build(); } });
    prev.y = navY;
    const next = makeTab({ w: 30, h: 22, label: "›", accent: ACCENT.currency, active: false, enabled: page < pages - 1, onClick: () => { page++; build(); } });
    next.x = 34; next.y = navY;
    bodyL.addChild(prev, next);
    const pg = val(`RANKS ${start + 1}–${Math.min(100, start + PER_PAGE)} OF 100`, 9, 0xc8b898);
    pg.x = 74; pg.y = navY + 5;
    bodyL.addChild(pg);

    /* Eigene Zeile angeheftet */
    const meIdx = rows.findIndex((p) => p[0] === ME);
    const meRank = meIdx + 1;
    const sy = navY + 30;
    const sg = new PIXI.Graphics();
    cut(sg, 0, sy, lw, 30, 10, 0x171208, 1, "tl-br");
    sg.rect(0, sy, 2, 30).fill(0xe8b94d);
    sg.rect(0, sy + 28, lw, 2).fill({ color: 0xe8b94d, alpha: 0.4 });
    bodyL.addChild(sg);
    const sgGlow = glow(0xe8b94d, lw, 40, 0.16);
    sgGlow.y = sy - 5;
    bodyL.addChild(sgGlow);
    glows.push({ sp: sgGlow, base: 0.14 });
    const sl = lbl("YOUR STANDING", 6.5, 0xf5dda6, 2.4);
    sl.x = 14; sl.y = sy + 11;
    bodyL.addChild(sl);
    const sr = val("#" + meRank, 14, 0xffeec2);
    sr.x = 120; sr.y = sy + 8;
    bodyL.addChild(sr);
    const sn = val(meRank <= 100
      ? `inside the hundred · ${season === "monthly" ? "paying 1,500 MCoins" : "paying +3% boosts"}`
      : "outside the hundred · no reward tier", 9, 0xe6d4b2);
    sn.x = 176; sn.y = sy + 11;
    bodyL.addChild(sn);
    if (meIdx >= 0) {
      const sv = val(fmt(rows[meIdx]), 10, 0xffeec2);
      sv.anchor.x = 1; sv.x = lw - 12; sv.y = sy + 9;
      bodyL.addChild(sv);
    }

    /* Belohnungsleiter */
    const REW = REWARDS[season];
    const c = hex(REW.hex), w = 300;
    const card = new PIXI.Graphics();
    cut(card, 0, 0, w, shell.bodyH - 8, 14, 0x171208, 1, "tr-bl");
    card.rect(14, 0, w - 28, 1).fill({ color: shade(c, 0.8), alpha: 0.3 });
    card.rect(10, shell.bodyH - 10, w - 20, 2).fill({ color: c, alpha: 0.4 });
    sideL.addChild(card);
    const rt = lbl(REW.title, 9, 0xffeec2, 3.4);
    rt.x = 14; rt.y = 12;
    sideL.addChild(rt);
    const rb = txt(REW.brief, 10.5, 0xeee0c8, w - 32);
    rb.x = 16; rb.y = 32;
    sideL.addChild(rb);

    let y = 40 + rb.height + 8;
    REW.tiers.forEach((tier, i) => {
      const [k, badge, items, prem] = tier;
      const tc = i < 3 ? MEDAL[i] : c;
      const th = 26 + items.length * 16;
      const g = new PIXI.Graphics();
      cut(g, 12, y, w - 24, th, 9, i < 3 ? 0x15110a : 0x100d07, 1, "tl-br");
      g.rect(12, y + th - 2, w - 24, 2).fill({ color: tc, alpha: i < 3 ? 1 : 0.35 });
      sideL.addChild(g);
      const sock = new PIXI.Graphics();
      for (const [ii, tone] of [[0, 0.35], [2, -0.42]] as [number, number][]) {
        sock.poly(hexa(20 + ii, y + 6 + ii, 22 - ii * 2, 22 - ii * 2)).fill(shade(tc, tone));
      }
      sideL.addChild(sock);
      const bg = lbl(badge, 7, shade(tc, 0.6), 0.4);
      bg.anchor.set(0.5); bg.x = 31; bg.y = y + 17;
      sideL.addChild(bg);
      const kk = lbl(k, 7.5, i < 3 ? 0xfff6e2 : 0xeee4d0, 2.2);
      kk.x = 50; kk.y = y + 9;
      sideL.addChild(kk);
      if (prem && season === "alltime") {
        const pm = lbl("+ PREMIUM", 5.5, 0xffeec2, 1.6);
        pm.anchor.x = 1; pm.x = w - 20; pm.y = y + 10;
        sideL.addChild(pm);
      }
      items.forEach((it, j) => {
        const iv = val(it, 8.5, i < 3 ? 0xfff2d8 : 0xeee4d0);
        iv.x = 50; iv.y = y + 24 + j * 15;
        sideL.addChild(iv);
      });
      y += th + 6;
    });
  };

  build();

  return {
    root: shell.root,
    size: { w: W, h: H },
    close: shell.close,
    update: (dt: number): void => {
      t += dt;
      shell.update(dt);
      for (const g of glows) g.sp.alpha = g.base + Math.sin(t * 1.6) * 0.14;
      if (sheen && sheenHost) {
        const span = sheenHost.width + sheen.width;
        sheen.x = ((t / 5.5) % 1) * span - sheen.width;
      }
    },
    destroy: (): void => shell.root.destroy({ children: true }),
  };
}

export default mount;
