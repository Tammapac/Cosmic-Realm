// HealthShieldBar — the combat resource cluster: a hull bar, a shield bar with
// the moving interference field, and a primary-fire cooldown ring. Native Pixi
// Graphics + one shader on the shield. Values are pushed in via set(); the
// component owns only drawing + animation.
//
// Bars use the segmented, straight silhouette agreed for the CSS HUD (a small
// corner shear, not a bent ramp) so the two systems read alike.
import * as PIXI from "pixi.js";
import { UiComponent } from "./UiComponent";
import { COLOR } from "../theme";
import { ShieldInterferenceFilter } from "../filters/ShieldInterferenceFilter";

export interface BarValues {
  hull: number; hullMax: number;
  shield: number; shieldMax: number;
  /** primary-fire cooldown 0..1 (1 = ready). */
  fireReady: number;
}

const W = 240;       // bar width (design px)
const BAR_H = 20;    // taller — the old 14 read as a thin blade
const GAP = 10;
const RING_R = 26;

export class HealthShieldBar extends UiComponent {
  private hullG = new PIXI.Graphics();
  private shieldFillG = new PIXI.Graphics();
  private shieldFrameG = new PIXI.Graphics();
  private ringG = new PIXI.Graphics();
  private labels: PIXI.Text[] = [];
  private shieldFilter: ShieldInterferenceFilter;
  private v: BarValues = { hull: 100, hullMax: 100, shield: 50, shieldMax: 50, fireReady: 1 };

  constructor() {
    super("health-shield-bar");
    this.shieldFilter = new ShieldInterferenceFilter(0x6ac0ff, 0.6);
    this.shieldFillG.filters = [this.shieldFilter];

    this.container.addChild(this.hullG, this.shieldFrameG, this.shieldFillG, this.ringG);

    const mk = (t: string) => {
      const txt = new PIXI.Text(t, {
        fontFamily: "monospace", fontSize: 9, fill: COLOR.textDim, letterSpacing: 1.5,
      });
      this.container.addChild(txt);
      this.labels.push(txt);
      return txt;
    };
    mk("HULL"); mk("SHIELD");
    this.redraw();
  }

  set(v: BarValues): void {
    this.v = v;
    // hull warns red below 30%, shield-interference dims when depleted
    this.setState(v.hull / Math.max(1, v.hullMax) < 0.3 ? "warning" : "idle");
  }

  protected tick(dt: number): void {
    this.shieldFilter.advance(dt);
    const sPct = this.v.shield / Math.max(1, this.v.shieldMax);
    this.shieldFilter.intensity = 0.25 + 0.6 * sPct;
  }

  private barPoly(x: number, y: number, w: number, h: number): number[] {
    const c = 4;
    return [x, y + c, x + c, y, x + w, y, x + w, y + h - c, x + w - c, y + h, x, y + h];
  }

  /** A filled bar with vertical depth: dark base → bright core → hot top edge,
   *  drawn as three stacked bands, plus a segment hatch and an inner highlight. */
  private drawDepthBar(
    g: PIXI.Graphics, x: number, y: number, w: number, h: number,
    base: number, mid: number, hot: number,
  ): void {
    if (w <= 0) return;
    const poly = this.barPoly(x, y, w, h);
    // base (deep tone)
    g.beginFill(base, 1); g.drawPolygon(poly); g.endFill();
    // dominant bright core — most of the bar height, so colour reads BOLD
    g.beginFill(mid, 1); g.drawRect(x, y + h * 0.12, w, h * 0.7); g.endFill();
    // hot top highlight (bright specular edge)
    g.beginFill(hot, 1); g.drawRect(x, y + 1, w, 3); g.endFill();
    // dark bottom shade for roundness
    g.beginFill(0x000000, 0.4); g.drawRect(x, y + h - 4, w, 4); g.endFill();
    // segment hatch — subtler so it doesn't wash the colour
    g.beginFill(0x000000, 0.2);
    for (let sx = x + 8; sx < x + w - 2; sx += 12) g.drawRect(sx, y, 2, h);
    g.endFill();
  }

  protected redraw(): void {
    const hullPct = Math.max(0, Math.min(1, this.v.hull / Math.max(1, this.v.hullMax)));
    const shPct = Math.max(0, Math.min(1, this.v.shield / Math.max(1, this.v.shieldMax)));

    // ── hull bar (GREEN) ──
    const hy = 14;
    this.hullG.clear();
    this.hullG.beginFill(0x04140a, 0.95); this.hullG.drawPolygon(this.barPoly(0, hy, W, BAR_H)); this.hullG.endFill();
    // green, warning to amber/red only when very low
    const green = hullPct > 0.3
      ? { base: 0x0f7a3a, mid: 0x2fe06a, hot: 0xbfffd6 }
      : { base: 0x7a2a0f, mid: 0xff6a3c, hot: 0xffd6bf };
    this.drawDepthBar(this.hullG, 0, hy, W * hullPct, BAR_H, green.base, green.mid, green.hot);
    // frame
    this.hullG.lineStyle(1.5, 0x2fe06a, 0.55 );
    this.hullG.drawPolygon(this.barPoly(0, hy, W, BAR_H));
    // outer glow line
    this.hullG.lineStyle(1, 0x2fe06a, 0.25 );
    this.hullG.drawPolygon(this.barPoly(-1.5, hy - 1.5, W + 3, BAR_H + 3));

    // ── shield bar (BLUE) — frame here, filtered fill separately ──
    const sy = hy + BAR_H + GAP;
    this.shieldFrameG.clear();
    this.shieldFrameG.beginFill(0x04101c, 0.95); this.shieldFrameG.drawPolygon(this.barPoly(0, sy, W, BAR_H)); this.shieldFrameG.endFill();
    this.shieldFrameG.lineStyle(1.5, 0x3aa0ff, 0.6 );
    this.shieldFrameG.drawPolygon(this.barPoly(0, sy, W, BAR_H));
    this.shieldFrameG.lineStyle(1, 0x3aa0ff, 0.28 );
    this.shieldFrameG.drawPolygon(this.barPoly(-1.5, sy - 1.5, W + 3, BAR_H + 3));

    this.shieldFillG.clear();
    this.drawDepthBar(this.shieldFillG, 0, sy, W * shPct, BAR_H, 0x0a3a7a, 0x2f8fff, 0xbfe0ff);

    // ── fire-cooldown ring, to the right ──
    const cx = W + 20 + RING_R, cy = sy - GAP;
    this.ringG.clear();
    this.ringG.lineStyle(5, 0x0a1420, 0.9 );
    this.ringG.drawCircle(cx, cy, RING_R);
    const ready = this.v.fireReady;
    this.ringG.lineStyle(4, ready >= 1 ? COLOR.cyan : COLOR.steel2, 0.95 );
    this.ringG.arc(cx, cy, RING_R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ready);
    if (ready >= 1) {
      this.ringG.lineStyle(0);
      this.ringG.beginFill(COLOR.cyan, 0.15); this.ringG.drawCircle(cx, cy, RING_R - 6); this.ringG.endFill();
    }

    // labels
    if (this.labels[0]) this.labels[0].position.set(0, hy - 11);
    if (this.labels[1]) this.labels[1].position.set(0, sy - 11);
  }
}
