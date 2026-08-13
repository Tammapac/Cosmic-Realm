// P-04 Tooltip-Karte im Rahmenbau von F-01, nur kleiner.
//
// Fünf Bänder, versenkte Fläche, Kopfzeile mit Icon und Raritätslabel,
// Beschreibungstext, Werteliste mit Rautenpunkten. Rahmen- und Fill-in-Farbe
// folgen der Raritätsstufe; Celestial und Relic bringen ihre Animation mit.
// Auffahren in 180 ms von 0,96 aus.

import { Container, Graphics, Sprite } from "pixi.js";
import { cut, type Cuts } from "../core/geometry";
import { shade, rgba } from "../core/color";
import { radialTexture, gradientTexture } from "../core/textures";
import { addShadowStack, makeGlow } from "../core/shadows";
import { label as makeLabel, value as makeValue, body as makeBody, strong } from "../core/typography";
import { itemTexture } from "../core/assets";
import { RARITY, SIZE, MOTION, type RarityKey } from "../core/tokens";
import { easeOutCubic } from "../core/easing";
import { RainbowCycleFilter } from "../core/filters";

export type TooltipRow = { k: string; v: string; hex?: string | number };

export type TooltipOpts = {
  w: number;
  title: string;
  rarity?: RarityKey | string;
  /** Überschreibt die Raritätsfarbe. */
  accent?: string | number;
  desc?: string;
  rows?: TooltipRow[];
  /** Icon-Kürzel aus assets/ui/items. */
  icon?: string;
  /** Kleines Label unter dem Titel; ohne Angabe die Rarität. */
  subtitle?: string;
  /** Fußzeile, z. B. Bindung oder Quelle. */
  footer?: string;
  cuts?: Cuts;
};

export class Tooltip {
  readonly root = new Container();
  readonly height: number;

  private rainbow: RainbowCycleFilter | null = null;
  private anim: { sp: Sprite; kind: string }[] = [];
  private t = 0;
  private appear = 0;
  private h: number;

  constructor(o: TooltipOpts) {
    const c = o.accent ?? RARITY[(o.rarity ?? "common") as RarityKey] ?? 0x8aa0c0;
    const w = o.w;
    const rows = o.rows ?? [];
    const cuts = o.cuts ?? "tr-bl";

    const desc = o.desc ? makeBody(o.desc, SIZE.body, 0xcedef2, w - 32) : null;
    const headH = 44;
    const footH = o.footer ? 18 : 0;
    const h = headH + (desc ? desc.height + 12 : 6) + rows.length * 20 + 14 + footH;
    this.h = h;
    this.height = h;

    addShadowStack(this.root, w, h, 16, cuts, 0.7);

    // fünf Bänder in der Raritätsfarbe
    const rim = new Graphics();
    const ladder: [number, number, number][] = [
      [0, 0.55, 20], [1.5, -0.1, 19], [3, -0.5, 18], [4.5, -0.68, 17], [6, -0.86, 16],
    ];
    for (const [i, tone, ch] of ladder) {
      cut(rim, i, i, w - i * 2, h - i * 2, ch, shade(c, tone), 1, cuts);
    }
    rim.eventMode = "none";
    this.root.addChild(rim);

    const face = new Graphics();
    cut(face, 7.5, 7.5, w - 15, h - 15, 15.6, 0x0c1119, 1, cuts);
    face.rect(14, 7.5, w - 28, 1).fill({ color: shade(c, 0.7), alpha: 0.5 });
    face.rect(10, h - 9.5, w - 20, 2).fill({ color: c, alpha: 0.35 });
    face.eventMode = "none";
    this.root.addChild(face);

    const wash = new Sprite(radialTexture([[0, rgba(c, 0.16)], [0.74, "rgba(0,0,0,0)"]]));
    wash.width = w; wash.height = h * 0.7; wash.y = 4;
    wash.eventMode = "none";
    this.root.addChild(wash);

    // gekreuzte Feinlinien
    const weave = new Graphics();
    for (let x = -h; x < w + h; x += 23) {
      weave.moveTo(x, h).lineTo(x + h * 0.25, 0)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.045 });
    }
    for (let x = -h; x < w + h; x += 31) {
      weave.moveTo(x, 0).lineTo(x + h * 0.49, h)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.03 });
    }
    weave.eventMode = "none";
    this.root.addChild(weave);

    // Raritätsanimation, auf die Karte beschnitten
    if (o.rarity === "celestial" || o.rarity === "relic") {
      const clip = new Graphics();
      cut(clip, 7.5, 7.5, w - 15, h - 15, 15.6, 0xffffff, 1, cuts);
      const fx = new Container();
      fx.addChild(clip);
      fx.mask = clip;
      fx.eventMode = "none";
      if (o.rarity === "celestial") {
        const streak = new Sprite(gradientTexture([
          [0, "rgba(0,0,0,0)"], [0.42, "rgba(236,255,255,.5)"],
          [0.6, "rgba(255,222,255,.34)"], [1, "rgba(0,0,0,0)"],
        ], false, 128));
        streak.width = w * 0.22;
        streak.height = h;
        streak.blendMode = "add";
        fx.addChild(streak);
        this.anim.push({ sp: streak, kind: "streak" });
        this.rainbow = new RainbowCycleFilter(0.18, 0.3);
        fx.filters = [this.rainbow];
      } else {
        const sw = new Sprite(radialTexture([[0, rgba(c, 0.4)], [1, rgba(c, 0)]]));
        sw.width = w * 1.1; sw.height = h * 1.1;
        sw.anchor.set(0.5);
        sw.x = w / 2; sw.y = h / 2;
        sw.blendMode = "add";
        fx.addChild(sw);
        this.anim.push({ sp: sw, kind: "spin" });
      }
      this.root.addChild(fx);
    }

    // Kopfzeile
    let tx = 16;
    if (o.icon) {
      const sp = new Sprite(itemTexture(o.icon));
      sp.width = 26; sp.height = 23;
      sp.x = 16; sp.y = 12;
      this.root.addChild(sp);
      const ig = makeGlow(c, 42, 40, 0.5);
      ig.x = 8; ig.y = 4;
      this.root.addChildAt(ig, 3);
      tx = 50;
    }

    const title = strong(o.title, 11.5, 0xf2f7ff, w - tx - 16);
    title.x = tx; title.y = 13;
    this.root.addChild(title);

    const sub = makeLabel((o.subtitle ?? o.rarity ?? "").toString().toUpperCase(), 7, c, 2.4);
    sub.x = tx; sub.y = 29;
    this.root.addChild(sub);

    const div = new Graphics();
    div.rect(14, headH - 6, w - 28, 1).fill({ color: 0x000000, alpha: 0.55 });
    div.rect(14, headH - 5, w - 28, 1).fill({ color: c, alpha: 0.14 });
    div.eventMode = "none";
    this.root.addChild(div);

    let y = headH + 6;
    if (desc) {
      desc.x = 16; desc.y = y;
      this.root.addChild(desc);
      y += desc.height + 8;
    }

    for (const row of rows) {
      const rc = row.hex ?? c;
      const g = new Graphics();
      g.rect(14, y, w - 28, 18).fill(0x060a10);
      g.rect(14, y, w - 28, 1).fill({ color: 0x000000, alpha: 0.8 });
      g.rect(14, y + 17, w - 28, 1).fill({ color: rc, alpha: 0.14 });
      g.poly([20, y + 6.5, 23.5, y + 3, 27, y + 6.5, 23.5, y + 10]).fill(rc);
      g.eventMode = "none";
      this.root.addChild(g);
      const k = makeValue(row.k, 9, 0xbad2ec);
      k.x = 34; k.y = y + 4;
      const v = makeValue(row.v, 9.5, 0xdbe9fb);
      v.anchor.x = 1; v.x = w - 20; v.y = y + 4;
      this.root.addChild(k, v);
      y += 20;
    }

    if (o.footer) {
      const f = makeLabel(o.footer.toUpperCase(), 6, shade(c, 0.3), 2);
      f.x = 16; f.y = h - 22;
      this.root.addChild(f);
    }

    // Auffahren
    this.root.pivot.set(w / 2, 0);
    this.root.x = w / 2;
    this.root.alpha = 0;
    this.root.scale.set(0.96);
  }

  update(dt: number): void {
    this.t += dt;
    if (this.appear < 1) {
      this.appear = Math.min(1, this.appear + dt / MOTION.tooltip);
      const e = easeOutCubic(this.appear);
      this.root.alpha = e;
      this.root.scale.set(0.96 + e * 0.04);
    }
    if (this.rainbow) this.rainbow.time = this.t;
    for (const a of this.anim) {
      if (a.kind === "streak") {
        const span = a.sp.parent ? this.root.width + a.sp.width : 300;
        a.sp.x = ((this.t / 6.5) % 1) * span - a.sp.width;
      } else {
        a.sp.rotation = this.t * 0.5;
        a.sp.alpha = 0.45 + Math.sin(this.t * 2.4) * 0.18;
      }
    }
  }

  destroy(): void { this.root.destroy({ children: true }); }
}

export const mount = (o: TooltipOpts): Tooltip => new Tooltip(o);
export default mount;
