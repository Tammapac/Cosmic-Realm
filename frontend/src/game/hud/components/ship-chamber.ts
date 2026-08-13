// ship-chamber.ts — zentrale Schiffs-/Loadout-Kammer (PixiJS v8), wiederverwendbar.
//
// Massiver äußerer ArmorFrame, breite innere Schattenkante, heller Gegen-Inset-
// Bevel, dunkle Diagnosekammer, Plattformlicht + AO unter dem Schiff, technische
// Tiefenringe, rotierende Diagnosemarker, animierte Datenleitungen, gerichtetes
// Schiffslicht, dezente Hintergrundpartikel. Die eigentliche Schiffsgrafik
// (three.js im Client) scheint durch den transparenten Kammerkern; hier steckt
// ein Platzhalter-Hull, der von setShipVisible(false) ausgeblendet werden kann.
//
// tick(now) vom Host-Ticker aufrufen. build(w,h) baut/relayoutet auf Zielgröße.

import * as PIXI from "pixi.js";
import ArmorTokens from "../theme/armor-tokens";

const A = ArmorTokens;
const CY = A.color.energy.cyan, MG = A.color.faction.violet, GOLD = A.color.accent.gold;
const SHEEN = A.color.metal.sheen, GREEN = A.color.accent.green;

// gebackene Gradient-/Glow-Texturen sind pro (Größe+Farben)-Kombination IDENTISCH bei jedem
// build() (z.B. bei Equip/Sell/Filterwechsel/Resize) — gemessen: ohne Cache leckt jeder Rebuild
// eine neue GPU-Textur (Sprite.destroy() gibt die Texture standardmäßig NICHT frei). Gecacht statt
// neu gebacken — keine sichtbare Qualitätsänderung, kein Leck, kein Re-Upload.
const bakeCache = new Map<string, PIXI.Texture>();

function bakeRadial(w: number, h: number, stops: [number, string][]): PIXI.Texture {
  const key = `r:${w}x${h}:${JSON.stringify(stops)}`;
  const cached = bakeCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h);
  const x = c.getContext("2d")!; const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
  stops.forEach((s) => g.addColorStop(s[0], s[1])); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const t = PIXI.Texture.from(c); bakeCache.set(key, t); return t;
}
function bakeEllipseGlow(w: number, h: number, col: string): PIXI.Texture {
  const key = `e:${w}x${h}:${col}`;
  const cached = bakeCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h);
  const x = c.getContext("2d")!; const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, `rgba(${col},0.55)`); g.addColorStop(0.5, `rgba(${col},0.18)`); g.addColorStop(1, `rgba(${col},0)`);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const t = PIXI.Texture.from(c); bakeCache.set(key, t); return t;
}
function bakeGrad(w: number, h: number, l: string, d: string): PIXI.Texture {
  const key = `g:${w}x${h}:${l}:${d}`;
  const cached = bakeCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h);
  const x = c.getContext("2d")!; const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, l); g.addColorStop(0.55, "#161022"); g.addColorStop(1, d); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const t = PIXI.Texture.from(c); bakeCache.set(key, t); return t;
}

/** Gefaste Oktagon-Silhouette bei (x,y,w,h) mit Eckfase cut — echte parallele
 *  Insets (kein naïves Koordinaten-Shiften) → in JEDER Ecke gleich, keine Lücken. */
function octPts(x: number, y: number, w: number, h: number, cut: number): number[] {
  const c = Math.max(0, Math.min(cut, w / 2, h / 2));
  return [x + c, y, x + w - c, y, x + w, y + c, x + w, y + h - c, x + w - c, y + h, x + c, y + h, x, y + h - c, x, y + c];
}

export class ShipChamber extends PIXI.Container {
  private w = 0; private h = 0;
  private cx = 0; private cy = 0;
  private markers: { g: PIXI.Container; sp: number }[] = [];
  private dataLines = new PIXI.Graphics();
  private particles: (PIXI.Graphics & { __v?: number; __ph?: number })[] = [];
  private platform?: PIXI.Sprite;
  private shipC = new PIXI.Container();
  private innerLayer = new PIXI.Container();
  private parallax = { x: 0, y: 0 };
  private nomDot?: PIXI.Graphics;
  private t0 = performance.now();

  constructor(w = 560, h = 430) { super(); this.build(w, h); }

  setShipVisible(v: boolean): void { this.shipC.visible = v; }

  build(w: number, h: number): void {
    this.removeChildren().forEach((c) => c.destroy());
    this.markers = []; this.particles = [];
    this.w = w; this.h = h;
    const c = 34, cx = this.cx = w / 2, cy = this.cy = h / 2 - 6;
    const p = octPts(0, 0, w, h, c);

    // 1) massiver ArmorFrame: MEHRSTUFIGE Extrusion (dicker Rand) + Gradientkörper + Doppelrand
    const rim: [number, number, number][] = [[13, 0x02030a, 0.96], [9, 0x0a0716, 0.92], [5, 0x180c2c, 0.88]];
    for (const [off, col, al] of rim) this.addChild(new PIXI.Graphics().poly(p.map((n, i) => n + (i % 2 ? off : off * 0.7))).fill({ color: col, alpha: al }));
    const gm = new PIXI.Graphics().poly(p).fill(0xffffff);
    const grad = new PIXI.Sprite(bakeGrad(w, h, "#3a2560", "#040309")); grad.width = w; grad.height = h; grad.mask = gm;
    this.addChild(gm, grad);
    const frame = new PIXI.Graphics();
    frame.poly(p).stroke({ width: 2, color: MG, alpha: 0.7 });                                            // sauberer Außenrand
    // innerer Rahmen: echte parallele Oktagon-Kontur (gleichmäßige Ecken, keine Lücken)
    frame.poly(octPts(7, 7, w - 14, h - 14, c - 5)).stroke({ width: 1, color: CY, alpha: 0.4 });
    frame.poly(octPts(3, 3, w - 6, h - 6, c - 2)).stroke({ width: 1, color: A.color.metal.light, alpha: 0.18 }); // Titan-Rim
    this.addChild(frame);

    // 2) breite innere Schattenkante (tiefer)
    const shMask = new PIXI.Graphics().poly(octPts(10, 10, w - 20, h - 20, c - 7)).fill(0xffffff);
    const shadowEdge = new PIXI.Sprite(bakeRadial(w, h, [[0, "rgba(0,0,0,0)"], [0.55, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.95)"]]));
    shadowEdge.width = w; shadowEdge.height = h; shadowEdge.mask = shMask; this.addChild(shMask, shadowEdge);

    // 3) Bevel folgt der GESAMTEN gefasten Silhouette (wie ArmorWindow) — kein separater Innenrahmen, keine losen Schrägen
    const bevel = new PIXI.Graphics();
    bevel.moveTo(0, h - c).lineTo(0, c).lineTo(c, 0).lineTo(w - c, 0).stroke({ width: 2, color: SHEEN, alpha: 0.4 });   // hell oben/links
    bevel.moveTo(w, c).lineTo(w, h - c).lineTo(w - c, h).lineTo(c, h).stroke({ width: 2, color: 0x000000, alpha: 0.7 }); // dunkel unten/rechts
    this.addChild(bevel);

    // 4) dunkle Diagnosekammer (maskierter Innenraum)
    const wellPts = octPts(14, 14, w - 28, h - 28, c - 10);
    this.addChild(new PIXI.Graphics().poly(wellPts).fill({ color: 0x040308, alpha: 0.9 }));
    const wellMask = new PIXI.Graphics().poly(wellPts).fill(0xffffff);
    const inner = this.innerLayer; inner.removeChildren(); inner.mask = wellMask; this.addChild(wellMask, inner);

    // Hintergrundpartikel
    for (let i = 0; i < 26; i++) {
      const g = new PIXI.Graphics().circle(0, 0, Math.random() < 0.2 ? 1.4 : 0.8).fill({ color: 0xcfe0ff, alpha: 0.5 }) as any;
      g.position.set(Math.random() * w, Math.random() * h); g.__v = 0.06 + Math.random() * 0.12; g.__ph = Math.random() * 6;
      inner.addChild(g); this.particles.push(g);
    }
    // 5) Tiefenringe + Bodengrid
    [190, 150, 112].forEach((r, i) => { const g = new PIXI.Graphics(); g.ellipse(cx, cy + 18, r, r * 0.5).stroke({ width: 1, color: i === 0 ? MG : CY, alpha: 0.16 + i * 0.04 }); inner.addChild(g); });
    const grid = new PIXI.Graphics();
    for (let gx = -3; gx <= 3; gx++) { grid.moveTo(cx + gx * 34, cy + 6).lineTo(cx + gx * 70, cy + 70); }
    for (let gy = 0; gy < 4; gy++) grid.ellipse(cx, cy + 18 + gy * 14, 120 - gy * 8, (120 - gy * 8) * 0.5);
    grid.stroke({ width: 1, color: CY, alpha: 0.1 }); inner.addChild(grid);

    // 6) rotierende Diagnosemarker
    const mk = (r: number, n: number, col: number, al: number) => {
      const g = new PIXI.Graphics();
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.5).lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8) * 0.5); }
      g.stroke({ width: 1, color: col, alpha: al }); g.pivot.set(cx, cy); g.position.set(cx, cy); inner.addChild(g); return g;
    };
    this.markers.push({ g: mk(196, 48, CY, 0.3), sp: 0.06 }, { g: mk(150, 3, MG, 0.6), sp: -0.14 });
    const arc = new PIXI.Graphics();
    for (let k = 0; k < 3; k++) { const a0 = k * 2.1; arc.arc(0, 0, 150, a0, a0 + 0.5); }
    arc.stroke({ width: 2, color: MG, alpha: 0.5 }); arc.position.set(cx, cy); arc.scale.set(1, 0.5);
    this.markers.push({ g: arc, sp: -0.14 }); inner.addChild(arc);

    // 7) Plattformlicht
    const plat = new PIXI.Sprite(bakeEllipseGlow(300, 150, "184,102,255")); plat.anchor.set(0.5); plat.position.set(cx, cy + 70); inner.addChild(plat); this.platform = plat;
    const plat2 = new PIXI.Sprite(bakeEllipseGlow(180, 80, "78,226,255")); plat2.anchor.set(0.5); plat2.position.set(cx, cy + 74); inner.addChild(plat2);

    // 9) Datenleitungen (in tick gezeichnet)
    this.dataLines = new PIXI.Graphics(); inner.addChild(this.dataLines);
    // 8) Kontaktverschattung unter dem Schiff (tiefer + harte Kontaktlinie)
    const ao = new PIXI.Sprite(bakeRadial(180, 66, [[0, "rgba(0,0,0,0.9)"], [0.7, "rgba(0,0,0,0.35)"], [1, "rgba(0,0,0,0)"]])); ao.anchor.set(0.5); ao.position.set(cx, cy + 56); ao.width = 180; ao.height = 66; inner.addChild(ao);
    const contact = new PIXI.Graphics(); contact.ellipse(cx, cy + 44, 46, 10).fill({ color: 0x000000, alpha: 0.55 }); inner.addChild(contact);

    // 10) Platzhalter-Schiff mit STARK gerichtetem Licht (hell oben-links → dunkel unten-rechts)
    this.shipC = new PIXI.Container(); this.shipC.position.set(cx, cy);
    const hull = new PIXI.Graphics();
    hull.poly([0, -70, 52, 0, 0, 40, -52, 0]).fill({ color: 0x161d2b });                    // Grundkörper (dunkler)
    hull.poly([0, -70, -52, 0, 0, 10]).fill({ color: 0x4a5a78 });                            // helle linke Facette
    hull.poly([0, -70, 52, 0, 0, 10]).fill({ color: 0x2b3547 });                             // mittlere rechte Facette
    hull.poly([0, 10, 52, 0, 0, 40]).fill({ color: 0x0c1019 });                              // dunkle untere-rechte Facette
    hull.poly([0, 10, -52, 0, 0, 40]).fill({ color: 0x121826 });                             // untere-linke Facette
    hull.poly([0, -70, 52, 0, 0, 40, -52, 0]).stroke({ width: 1.5, color: CY, alpha: 0.5 });
    hull.moveTo(0, -70).lineTo(-52, 0).stroke({ width: 2, color: SHEEN, alpha: 0.85 });        // helle Lichtkante oben-links
    hull.moveTo(52, 0).lineTo(0, 40).stroke({ width: 1.5, color: 0x000000, alpha: 0.5 });      // Schattenkante unten-rechts
    hull.circle(0, -6, 6).fill({ color: CY, alpha: 0.95 });
    this.shipC.addChild(hull); inner.addChild(this.shipC);

    // 5b) Ausrüstungspunkte (Hardpoints)
    const hp: [number, number][] = [[-52, 0], [52, 0], [0, -70], [26, -35], [-26, -35]];
    hp.forEach(([hx, hy], i) => { const g = new PIXI.Graphics(); g.circle(0, 0, 5).stroke({ width: 1.5, color: i < 3 ? CY : MG, alpha: 0.8 }); g.circle(0, 0, 1.6).fill({ color: i < 3 ? CY : MG }); g.position.set(cx + hx, cy + hy); inner.addChild(g); });

    // 11) Labels
    const tier = new PIXI.Text({ text: "TIER 5 · SOVEREIGN", style: { fontFamily: "Orbitron, sans-serif", fontSize: 11, fontWeight: "700", letterSpacing: 3, fill: GOLD } });
    tier.position.set(20, 16); this.addChild(tier);
    const nom = new PIXI.Container();
    nom.addChild(new PIXI.Graphics().roundRect(0, 0, 150, 20, 2).fill({ color: 0x06140c, alpha: 0.8 }).stroke({ width: 1, color: GREEN, alpha: 0.4 }));
    this.nomDot = new PIXI.Graphics().circle(12, 10, 3).fill({ color: GREEN }); nom.addChild(this.nomDot);
    const nt = new PIXI.Text({ text: "SYSTEME NOMINAL", style: { fontFamily: "Chakra Petch, sans-serif", fontSize: 9, fontWeight: "700", letterSpacing: 2, fill: GREEN } }); nt.position.set(22, 5); nom.addChild(nt);
    nom.position.set(w - 170, h - 30); this.addChild(nom);
    const br = new PIXI.Graphics(), bl = 20;
    br.moveTo(0, c + bl).lineTo(0, c).lineTo(c, 0).lineTo(c + bl, 0).stroke({ width: 2, color: MG, alpha: 0.6 });
    br.moveTo(w - c - bl, h).lineTo(w - c, h).lineTo(w, h - c).lineTo(w, h - c - bl).stroke({ width: 2, color: MG, alpha: 0.6 });
    this.addChild(br);
  }

  /** geringe Parallaxe: verschiebt den Innenraum (Partikel/Ringe/Schiff) minimal, ohne die Maske zu verschieben. */
  setParallax(dx: number, dy: number): void {
    this.parallax.x = dx; this.parallax.y = dy;
  }

  tick(now = performance.now()): void {
    const el = now - this.t0, cx = this.cx, cy = this.cy;
    this.innerLayer.position.set(this.parallax.x, this.parallax.y);
    this.markers.forEach((m) => { m.g.rotation = el * 0.001 * m.sp; });
    const dl = this.dataLines; dl.clear(); const N = 10;
    for (let i = 0; i < N; i++) {
      const ang = i / N * Math.PI * 2 + el * 0.0002; const dash = (el * 0.06 + i * 30) % 40;
      for (let r = 60 + dash; r < 196; r += 40) dl.moveTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.5).lineTo(cx + Math.cos(ang) * (r + 10), cy + Math.sin(ang) * (r + 10) * 0.5);
    }
    dl.stroke({ width: 1, color: CY, alpha: 0.22 });
    this.particles.forEach((g) => { g.y -= g.__v!; if (g.y < 0) g.y = this.h; g.alpha = 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(el * 0.002 + g.__ph!)); });
    if (this.platform) this.platform.alpha = 0.75 + 0.25 * (0.5 + 0.5 * Math.sin(el * 0.0016));
    this.shipC.y = cy + Math.sin(el * 0.0012) * 4;
    if (this.nomDot) this.nomDot.alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(el * 0.003));
  }
}

export function createShipChamber(w?: number, h?: number): ShipChamber { return new ShipChamber(w, h); }
