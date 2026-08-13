// armor-lighting.ts — wiederverwendbares Licht-/Schattensystem für PixiJS v8.
//
// Hauptlicht IMMER oben links. Alle weichen Effekte (Cast Shadow, Glow,
// Specular, Gradient, AO) werden über Canvas-2D in Texturen gebacken —
// KEINE Abhängigkeit von BlurFilter. Harte Effekte (Kontaktschatten, Bevel)
// sind Graphics. Jede Funktion liefert ein fertiges DisplayObject, das man
// unter/über ein Element legt. Ändert keine bestehende UI.
//
// PixiJS 7.4.3 (v8-kompatibel geschrieben).

import * as PIXI from "pixi.js";

/** Hauptlichtrichtung (normalisiert): oben links → unten rechts. */
export const LIGHT_DIR = { x: -0.707, y: -0.707 } as const;

const isBrowser = typeof document !== "undefined";

/** Backt eine Canvas-2D-Zeichnung in eine Pixi-Textur (Blur ohne Filter). */
function bake(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): PIXI.Texture {
  if (!isBrowser) return PIXI.Texture.WHITE;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext("2d")!;
  draw(ctx);
  return PIXI.Texture.from(c);
}

// ── 1. Gerichteter Grundverlauf (Hauptlicht oben links) ──────────────────────
export function createDirectionalGradient(
  w: number, h: number,
  opts: { light?: string; dark?: string } = {},
): PIXI.Sprite {
  const light = opts.light ?? "#3d4658";
  const dark = opts.dark ?? "#171c26";
  const tex = bake(w, h, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, w, h); // TL → BR
    g.addColorStop(0, light);
    g.addColorStop(0.55, "#232a37");
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const s = new PIXI.Sprite(tex);
  s.width = w; s.height = h;
  return s;
}

// ── 2. Weicher Cast Shadow (nach unten rechts, vom Licht weg) ────────────────
export function createCastShadow(
  w: number, h: number,
  opts: { blur?: number; alpha?: number; offset?: number; radius?: number } = {},
): PIXI.Sprite {
  const blur = opts.blur ?? 18;
  const alpha = opts.alpha ?? 0.45;
  const off = opts.offset ?? 10;
  const radius = opts.radius ?? 6;
  const pad = blur + off + 4;
  const tex = bake(w + pad * 2, h + pad * 2, (ctx) => {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${alpha})`;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = off;   // Licht oben links → Schatten unten rechts
    ctx.shadowOffsetY = off;
    ctx.fillStyle = "#000";
    roundRect(ctx, pad, pad, w, h, radius);
    ctx.fill();
    ctx.restore();
  });
  const s = new PIXI.Sprite(tex);
  s.anchor.set(0);
  s.position.set(-pad, -pad);
  return s;
}

// ── 3. Harter Kontaktschatten (schmal, direkt unter dem Element) ─────────────
export function createContactShadow(
  w: number,
  opts: { height?: number; alpha?: number } = {},
): PIXI.Graphics {
  const ch = opts.height ?? 5;
  const alpha = opts.alpha ?? 0.6;
  const g = new PIXI.Graphics();
  // dünnes, dunkles Band knapp unter der Grundlinie (harte Kante)
  g.rect(w * 0.06, 0, w * 0.88, ch).fill({ color: 0x000000, alpha });
  return g;
}

// ── 4. Ambient-Occlusion-Eindruck (inneres Vignette-Dunkel an den Kanten) ────
export function createAmbientOcclusion(
  w: number, h: number,
  opts: { alpha?: number; spread?: number } = {},
): PIXI.Sprite {
  const alpha = opts.alpha ?? 0.5;
  const spread = opts.spread ?? 0.22;
  const tex = bake(w, h, (ctx) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * (0.5 - spread), w / 2, h / 2, Math.max(w, h) * 0.62);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const s = new PIXI.Sprite(tex);
  s.width = w; s.height = h;
  return s;
}

// ── 5. Äußerer Bevel (erhaben: hell oben/links, dunkel unten/rechts) ─────────
export function createOuterBevel(
  w: number, h: number,
  opts: { width?: number; light?: number; dark?: number; radius?: number } = {},
): PIXI.Graphics {
  const bw = opts.width ?? 3;
  const light = opts.light ?? 0xbcd6ff;
  const dark = opts.dark ?? 0x05070d;
  const g = new PIXI.Graphics();
  // helle Lichtkante oben + links
  g.moveTo(0, h).lineTo(0, 0).lineTo(w, 0).stroke({ width: bw, color: light, alpha: 0.7 });
  // dunkle Schattenkante unten + rechts
  g.moveTo(w, 0).lineTo(w, h).lineTo(0, h).stroke({ width: bw, color: dark, alpha: 0.85 });
  return g;
}

// ── 6. Innerer Bevel (vertieft: dunkel oben/links, hell unten/rechts) ────────
export function createInnerBevel(
  w: number, h: number,
  opts: { width?: number; light?: number; dark?: number; inset?: number } = {},
): PIXI.Graphics {
  const bw = opts.width ?? 2;
  const light = opts.light ?? 0x9fb8d6;
  const dark = opts.dark ?? 0x05070d;
  const i = opts.inset ?? 3;
  const g = new PIXI.Graphics();
  // Recess: Schatten fällt oben/links INS Element (Licht kommt oben links)
  g.moveTo(i, h - i).lineTo(i, i).lineTo(w - i, i).stroke({ width: bw, color: dark, alpha: 0.8 });
  // schwaches Rücklicht unten/rechts
  g.moveTo(w - i, i).lineTo(w - i, h - i).lineTo(i, h - i).stroke({ width: bw, color: light, alpha: 0.35 });
  return g;
}

// ── 7. Lokales Specular Highlight (Glanzfleck oben links) ────────────────────
export function createSpecularHighlight(
  w: number, h: number,
  opts: { x?: number; y?: number; radius?: number; alpha?: number } = {},
): PIXI.Sprite {
  const cx = opts.x ?? w * 0.28;      // vom Hauptlicht oben links
  const cy = opts.y ?? h * 0.24;
  const r = opts.radius ?? Math.min(w, h) * 0.5;
  const alpha = opts.alpha ?? 0.5;
  const tex = bake(w, h, (ctx) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.4, `rgba(220,235,255,${alpha * 0.4})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const s = new PIXI.Sprite(tex);
  s.width = w; s.height = h;
  s.blendMode = "screen"; // additiver Glanz (v8-Blendmode-String)
  return s;
}

// ── 8. Energie-Glow (Cyan / Violett), Canvas-gebacken (kein BlurFilter) ──────
export function createEnergyGlow(
  w: number, h: number,
  opts: { color?: "cyan" | "violet" | number; alpha?: number; spread?: number; radius?: number } = {},
): PIXI.Sprite {
  const alpha = opts.alpha ?? 0.55;
  const spread = opts.spread ?? 20;
  const col = opts.color === "violet" ? "184,102,255"
    : opts.color === "cyan" || opts.color === undefined ? "78,226,255"
    : `${(opts.color >> 16) & 255},${(opts.color >> 8) & 255},${opts.color & 255}`;
  const pad = spread + 4;
  const tex = bake(w + pad * 2, h + pad * 2, (ctx) => {
    ctx.save();
    ctx.shadowColor = `rgba(${col},${alpha})`;
    ctx.shadowBlur = spread;
    ctx.strokeStyle = `rgba(${col},${Math.min(1, alpha + 0.2)})`;
    ctx.lineWidth = 2;
    roundRect(ctx, pad, pad, w, h, opts.radius ?? 4);
    ctx.stroke();
    ctx.stroke(); // zweiter Pass = kräftigerer Glow
    ctx.restore();
  });
  const s = new PIXI.Sprite(tex);
  s.position.set(-pad, -pad);
  s.blendMode = "add";
  return s;
}

// ── Composite-Helfer: fertige Metallplatte mit Tiefe (nur für Demos) ─────────
export interface PlateOptions {
  width: number; height: number;
  depth?: number;              // Extrusionstiefe → Schattenlänge/Bevelbreite
  radius?: number;
  glow?: "cyan" | "violet" | null;
  recessed?: boolean;          // innen statt außen bevelt
}

/**
 * Baut einen Container mit korrekt gestapelten Licht-/Schattenschichten:
 *   Cast Shadow → Kontaktschatten → Grundverlauf → AO → Bevel → Specular → Glow
 * Der Container-Ursprung (0,0) ist die Plattenecke.
 */
export function createArmorPlate(o: PlateOptions): PIXI.Container {
  const { width: w, height: h } = o;
  const depth = o.depth ?? 6;
  const radius = o.radius ?? 6;
  const c = new PIXI.Container();

  // Schatten (unter der Platte)
  c.addChild(createCastShadow(w, h, { blur: depth * 2.2, offset: depth, radius }));
  const contact = createContactShadow(w, { height: Math.max(3, depth * 0.5), alpha: 0.55 });
  contact.position.set(0, h - 1);
  c.addChild(contact);

  // Plattenkörper
  const body = createDirectionalGradient(w, h);
  const mask = new PIXI.Graphics().roundRect(0, 0, w, h, radius).fill(0xffffff);
  body.mask = mask;
  c.addChild(body, mask);

  // AO + Bevel + Specular
  const ao = createAmbientOcclusion(w, h, { alpha: 0.45 }); ao.mask = mask; c.addChild(ao);
  c.addChild(o.recessed
    ? createInnerBevel(w, h, { width: Math.max(2, depth * 0.4) })
    : createOuterBevel(w, h, { width: Math.max(2, depth * 0.4), radius }));
  const spec = createSpecularHighlight(w, h, { alpha: 0.4 }); spec.mask = mask; c.addChild(spec);

  // optionaler Energie-Glow
  if (o.glow) c.addChildAt(createEnergyGlow(w, h, { color: o.glow, radius }), 0);

  return c;
}

// ── util ─────────────────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
