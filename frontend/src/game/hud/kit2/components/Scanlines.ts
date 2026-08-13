// E-03 Oberflächentexturen und wandernde Scanlinie.
//
//   hairlines   115°-Haarlinien im 26-px-Raster — Panelflächen
//   crt         waagerechte Zeilen, 1 px auf 3 px — Chat, Verlauf, Terminal
//   vertical    senkrechte Feinstriche — Karten, Sockelinnenraum
//   grid        34-px-Raster — Skillbaum, Zonenkarte
//   weave       zwei gekreuzte Streifenraster — Tooltips
//   fine        1-px-Raster auf 3 px — Vorschauflächen
//
// Dazu die Scanlinie: ein weicher Lichtbalken, der über die Fläche zieht — im
// Inventar über das Sockelraster.

import { Container, Graphics, Sprite } from "pixi.js";
import { gradientTexture } from "../core/textures";
import { rgba, shade } from "../core/color";
import { ACCENT } from "../core/tokens";

export type ScanKind = "hairlines" | "crt" | "vertical" | "grid" | "weave" | "fine";

export type ScanlinesOpts = {
  w: number;
  h: number;
  kind?: ScanKind;
  /** Deckkraft der Textur. */
  alpha?: number;
  /** Wandernde Scanlinie zusätzlich. */
  sweep?: boolean;
  accent?: string | number;
  /** Sekunden für einen Durchlauf. */
  period?: number;
  /** Höhe des Lichtbalkens. */
  sweepHeight?: number;
};

export class Scanlines {
  readonly root = new Container();

  private sweep: Sprite | null = null;
  private period: number;
  private h: number;
  private t = 0;

  constructor(o: ScanlinesOpts) {
    const kind = o.kind ?? "hairlines";
    const a = o.alpha ?? 1;
    this.h = o.h;
    this.period = o.period ?? 5.5;

    const g = new Graphics();
    switch (kind) {
      case "hairlines":
        for (let x = -o.h; x < o.w; x += 26) {
          g.moveTo(x, o.h).lineTo(x + o.h * 0.47, 0)
            .stroke({ width: 1, color: 0xffffff, alpha: 0.035 * a });
        }
        break;
      case "crt":
        for (let y = 0; y < o.h; y += 3) {
          g.rect(0, y, o.w, 1).fill({ color: 0x000000, alpha: 0.22 * a });
        }
        break;
      case "vertical":
        for (let x = 0; x < o.w; x += 3) {
          g.rect(x, 0, 1, o.h).fill({ color: 0xaa8cdc, alpha: 0.05 * a });
        }
        break;
      case "fine":
        for (let x = 0; x < o.w; x += 3) {
          g.rect(x, 0, 1, o.h).fill({ color: 0xaa8cdc, alpha: 0.045 * a });
        }
        break;
      case "grid":
        for (let x = 0; x < o.w; x += 34) {
          g.rect(x, 0, 1, o.h).fill({ color: 0x96c8eb, alpha: 0.045 * a });
        }
        for (let y = 0; y < o.h; y += 34) {
          g.rect(0, y, o.w, 1).fill({ color: 0x96c8eb, alpha: 0.045 * a });
        }
        break;
      case "weave":
        for (let x = -o.h; x < o.w + o.h; x += 23) {
          g.moveTo(x, o.h).lineTo(x + o.h * 0.25, 0)
            .stroke({ width: 1, color: 0xffffff, alpha: 0.045 * a });
        }
        for (let x = -o.h; x < o.w + o.h; x += 31) {
          g.moveTo(x, 0).lineTo(x + o.h * 0.49, o.h)
            .stroke({ width: 1, color: 0xffffff, alpha: 0.03 * a });
        }
        break;
    }
    g.eventMode = "none";
    this.root.addChild(g);

    if (o.sweep) {
      const c = o.accent ?? ACCENT.system;
      this.sweep = new Sprite(gradientTexture([
        [0, rgba(c, 0)],
        [0.42, rgba(c, 0.22)],
        [0.5, rgba(shade(c, 0.7), 0.4)],
        [0.58, rgba(c, 0.22)],
        [1, rgba(c, 0)],
      ]));
      this.sweep.width = o.w;
      this.sweep.height = o.sweepHeight ?? Math.max(46, o.h * 0.16);
      this.sweep.blendMode = "add";
      this.sweep.eventMode = "none";
      this.root.addChild(this.sweep);
    }
  }

  update(dt: number): void {
    this.t += dt;
    if (!this.sweep) return;
    const p = (this.t % this.period) / this.period;
    this.sweep.y = p * (this.h + this.sweep.height) - this.sweep.height;
    this.sweep.alpha = p < 0.1 ? p / 0.1 : p > 0.9 ? (1 - p) / 0.1 : 1;
  }

  destroy(): void { this.root.destroy({ children: true }); }
}

export const mount = (o: ScanlinesOpts): Scanlines => new Scanlines(o);
export default mount;
