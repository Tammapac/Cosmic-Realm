// ArmorPanel — the reusable titanium plate that every native window/HUD region
// is built on. Layered to read as physical hardware, not a flat card:
//
//   1. drop shadow (depth off the world)
//   2. outer titanium bezel (bright-top → deep-base steel ramp)
//   3. recessed navy glass body (inset from the bezel)
//   4. cyan energy conduit tracing the inner edge
//   5. corner brackets + a few structural rivets (the "connectors")
//
// The silhouette is the HUD's 8-point chamfer (theme.GEO.windowCut). All draw
// values are design-space px; the caller scales the container.
import * as PIXI from "pixi.js";
import { UiComponent } from "./UiComponent";
import { COLOR, GEO, mixColor } from "../theme";
import { PanelMaterialFilter } from "../filters/PanelMaterialFilter";

export interface ArmorPanelOpts {
  w: number;
  h: number;
  /** cut size override (windows use GEO.windowCut, small plates less). */
  cut?: number;
  /** accent colour for the conduit + brackets (cyan default, gold for elite). */
  accent?: number;
  /** secondary edge-marker colour (magenta by default) — the reference uses a
   *  cyan/magenta pair on the rim, not a single hue. */
  accent2?: number;
  /** draw the corner rivets (bigger panels yes, tiny chips no). */
  rivets?: boolean;
  /** conduit brightness 0..1 (dim ambient panels vs lit active windows). */
  conduit?: number;
}

export class ArmorPanel extends UiComponent {
  private shadow = new PIXI.Graphics();
  private bezel = new PIXI.Graphics();
  private body = new PIXI.Graphics();
  private conduit = new PIXI.Graphics();
  private connectors = new PIXI.Graphics();
  private material: PanelMaterialFilter;
  private opts: Required<ArmorPanelOpts>;

  constructor(opts: ArmorPanelOpts) {
    super("armor-panel");
    this.opts = {
      cut: GEO.windowCut,
      accent: COLOR.cyan,
      accent2: 0xff5cf0,   // magenta rim marker
      rivets: true,
      conduit: 1,
      ...opts,
    };
    // Sci-fi metal fill on the body only, masked by its own chamfer alpha.
    // Brighter navy for the reference's higher-contrast look.
    this.material = new PanelMaterialFilter(0x24374f);
    this.body.filters = [this.material];
    this.container.addChild(this.shadow, this.bezel, this.body, this.conduit, this.connectors);
    this.redraw();
  }

  resize(w: number, h: number): void {
    this.opts.w = w;
    this.opts.h = h;
    this.redraw();
  }

  /** The 8-point chamfered outline at a given inset. */
  private silhouette(inset: number): number[] {
    const { w, h, cut } = this.opts;
    const c = cut;
    const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
    return [
      x0 + c, y0, x1 - c, y0, x1, y0 + c, x1, y1 - c,
      x1 - c, y1, x0 + c, y1, x0, y1 - c, x0, y0 + c,
    ];
  }

  protected tick(dt: number): void {
    this.material.advance(dt);
  }

  protected redraw(): void {
    const { w, h, accent, conduit } = this.opts;
    const lit = conduit * (0.7 + 0.3 * this.anim);
    const warn = this.getState() === "warning";
    const accentCol = warn ? COLOR.amber : accent;

    // Frame construction (design px): ONE solid frame with an inner bevel, per
    // the reference — not two rings with a gap.
    //   FRAME  = the metal rim's total thickness
    //   BEVEL  = the dark chamfer that turns from rim down into the recess
    const FRAME = 8;
    const BEVEL = 3;
    const bodyInset = FRAME;

    // 1. drop shadow
    this.shadow.clear();
    this.shadow.beginFill(0x000000, 0.6);
    this.shadow.drawPolygon(this.offsetPoly(this.silhouette(0), 0, 8));
    this.shadow.endFill();

    // 2. bezel — a single milled frame, top-lit, with an inner bevel
    this.bezel.clear();
    // (a) the frame body: one ring of steel from edge to (FRAME - BEVEL)
    // beginHole/endHole don't exist in v8's Graphics — the replacement is
    // draw-outer, fill(), draw-inner, cut() (cut() subtracts the last-drawn
    // path from the previously filled shape). Everything else in this file
    // stays on the legacy beginFill/drawPolygon/endFill API, which v8's
    // Graphics class still supports directly.
    this.bezel.poly(this.silhouette(0)).fill({ color: mixColor(COLOR.steel2, COLOR.steel1, 0.35), alpha: 1 });
    this.bezel.poly(this.silhouette(FRAME - BEVEL)).cut();
    // (b) bright top-lit highlight along the OUTER edge (a milled catch-light)
    this.bezel.poly(this.silhouette(0)).fill({ color: mixColor(COLOR.steel1, COLOR.steel0, 0.45 + 0.25 * this.anim), alpha: 1 });
    this.bezel.poly(this.silhouette(1.5)).cut();
    // (c) the inner BEVEL: a dark chamfer dropping from the frame into the
    //     recess — this is the single depth cue, replacing the two-ring gap
    this.bezel.poly(this.silhouette(FRAME - BEVEL)).fill({ color: COLOR.navyDeep, alpha: 0.95 });
    this.bezel.poly(this.silhouette(FRAME)).cut();
    // (d) structural notches along the frame's top & bottom faces
    this.drawEdgeSegments(FRAME - BEVEL);

    // 3. recessed body — the material filter textures this
    this.body.clear();
    this.body.beginFill(COLOR.navyHi, 0.9);
    this.body.drawPolygon(this.silhouette(bodyInset));
    this.body.endFill();

    // 4. accent: a deep inner vignette ring + short edge energy segments +
    //    the corner cut details. This is where the "not flat" read comes from.
    this.conduit.clear();
    // inner vignette: dark gradient hugging the body edge (depth into the panel)
    for (let k = 0; k < 5; k++) {
      this.conduit.lineStyle(2, 0x000000, 0.16 * (1 - k / 5) );
      this.conduit.drawPolygon(this.silhouette(bodyInset + 1 + k * 2));
    }
    // hairline accent just inside the inner frame (the lit edge)
    this.conduit.lineStyle(1, accentCol, 0.55 * lit );
    this.conduit.drawPolygon(this.silhouette(bodyInset));

    // 5. connectors: corner cut details + edge energy markers + rivets
    this.connectors.clear();
    this.drawCornerCuts(accentCol, lit, FRAME);
    this.drawEdgeAccents(accentCol, lit);
    if (this.opts.rivets) this.drawRivets(FRAME);
  }

  /** Recessed notches on the outer frame's top & bottom faces. */
  private drawEdgeSegments(outer: number): void {
    const { w, h, cut } = this.opts;
    const g = this.bezel;
    const seg = 12, gap = 9, startX = cut + 12, endX = w - cut - 12;
    g.lineStyle(0);
    for (let x = startX; x + seg < endX; x += seg + gap) {
      g.beginFill(COLOR.navyDeep, 0.6); g.drawRect(x, 1, seg, outer - 2); g.endFill();
      g.beginFill(COLOR.navyDeep, 0.5); g.drawRect(x, h - outer + 1, seg, outer - 2); g.endFill();
    }
  }

  /** Diagonal accent lines cutting across each corner (the reference's
   *  corner detailing) — bright accent over the milled steel. */
  private drawCornerCuts(col: number, lit: number, outer: number): void {
    const { w, h, cut } = this.opts;
    const g = this.connectors;
    const a = 0.85 * lit;
    g.lineStyle(2, col, a );
    const d = cut - 2, o = outer + 2;
    // each corner: a short line parallel to the chamfer + a stub
    g.moveTo(o, o + d); g.lineTo(o + d, o);                       // TL chamfer accent
    g.moveTo(w - o - d, o); g.lineTo(w - o, o + d);               // TR
    g.moveTo(o, h - o - d); g.lineTo(o + d, h - o);               // BL
    g.moveTo(w - o - d, h - o); g.lineTo(w - o, h - o - d);       // BR
  }

  /** Short energy segments on each edge — a cyan/magenta marker PAIR like the
   *  reference, not a single hue or a full outline. */
  private drawEdgeAccents(col: number, lit: number): void {
    const { w, h } = this.opts;
    const col2 = this.opts.accent2;
    const g = this.connectors;
    const len = Math.min(70, w * 0.2);

    // top centre — primary accent (cyan), 3-segment tick
    this.tickRow(g, w / 2, 2.5, len, col, lit);
    // bottom centre — secondary accent (magenta)
    this.tickRow(g, w / 2, h - 2.5, len, col2, lit);
    // left + right mid — short primary stubs
    g.lineStyle(2, col, 0.75 * lit );
    g.moveTo(2.5, h / 2 - 10); g.lineTo(2.5, h / 2 + 10);
    g.moveTo(w - 2.5, h / 2 - 10); g.lineTo(w - 2.5, h / 2 + 10);
  }

  /** A 3-segment energy tick centred at (cx,y): long-middle + two short flanks
   *  with a hot core dot. */
  private tickRow(g: PIXI.Graphics, cx: number, y: number, len: number, col: number, lit: number): void {
    const mid = len * 0.5, flank = len * 0.2, gap = 5;
    g.lineStyle(2.5, col, 0.95 * lit );
    g.moveTo(cx - mid / 2, y); g.lineTo(cx + mid / 2, y);
    g.lineStyle(2, col, 0.6 * lit );
    g.moveTo(cx - mid / 2 - gap - flank, y); g.lineTo(cx - mid / 2 - gap, y);
    g.moveTo(cx + mid / 2 + gap, y); g.lineTo(cx + mid / 2 + gap + flank, y);
    g.lineStyle(0);
    g.beginFill(mixColor(col, 0xffffff, 0.6), 0.95 * lit);
    g.drawCircle(cx, y, 2);
    g.endFill();
  }

  private drawRivets(inset: number): void {
    const { w, h } = this.opts;
    const g = this.connectors;
    const r = 1.8;
    const spots = [
      [inset + 5, inset + 5], [w - inset - 5, inset + 5],
      [inset + 5, h - inset - 5], [w - inset - 5, h - inset - 5],
    ];
    for (const [x, y] of spots) {
      g.beginFill(COLOR.navyDeep, 1); g.drawCircle(x, y, r + 1); g.endFill();
      g.beginFill(COLOR.steel3, 1); g.drawCircle(x, y, r); g.endFill();
      g.beginFill(COLOR.steel0, 0.9); g.drawCircle(x - 0.5, y - 0.5, r * 0.5); g.endFill();
    }
  }

  /** translate a polygon point list by (dx,dy). */
  private offsetPoly(poly: number[], dx: number, dy: number): number[] {
    const out = poly.slice();
    for (let i = 0; i < out.length; i += 2) { out[i] += dx; out[i + 1] += dy; }
    return out;
  }
}
