// C-07 Chip. Filter, Statusmarke, Rekrutierungs-Tag, Raritätsschwelle.
//
// Gefaste Fläche, farbige Kante links, Akzenttönung wenn aktiv. Als readonly
// dient er als reine Anzeige (Statusmarke), sonst schaltet er.

import { Container, Graphics } from "pixi.js";
import { cut } from "../core/geometry";
import { shade, hex } from "../core/color";
import { label as makeLabel } from "../core/typography";
import { attachStates, type StateHandle } from "../core/states";
import { ACCENT } from "../core/tokens";

export type ChipOpts = {
  label: string;
  accent?: string | number;
  active?: boolean;
  w?: number;
  h?: number;
  /** Raute vor dem Text. */
  dot?: boolean;
  /** Reine Anzeige ohne Klick. */
  readonly?: boolean;
  enabled?: boolean;
  aria?: string;
  onClick?: (active: boolean) => void;
};

export class Chip {
  readonly root = new Container();
  readonly width: number;

  private body = new Container();
  private g = new Graphics();
  private text;
  private states: StateHandle | null = null;
  private on: boolean;
  private c: number;
  private h: number;

  constructor(o: ChipOpts) {
    this.c = hex(o.accent ?? ACCENT.system);
    this.h = o.h ?? 20;
    this.on = !!o.active;

    this.text = makeLabel(o.label, 6, this.on ? 0xf4f9ff : shade(this.c, 0.28), 1.8);
    this.width = o.w ?? Math.max(46, this.text.width + (o.dot ? 26 : 18));

    this.body.addChild(this.g);
    if (o.dot) {
      const d = new Graphics();
      d.poly([12, this.h / 2 - 3.5, 15.5, this.h / 2, 12, this.h / 2 + 3.5, 8.5, this.h / 2])
        .fill(this.c);
      d.eventMode = "none";
      this.body.addChild(d);
    }
    this.text.x = o.dot ? 22 : 9;
    this.text.y = (this.h - this.text.height) / 2 + 0.5;
    this.body.addChild(this.text);
    this.paint();
    this.root.addChild(this.body);

    if (!o.readonly) {
      this.states = attachStates(this.body, {
        accent: this.c, lift: 2, sink: 1,
        enabled: o.enabled, selected: this.on,
        size: { w: this.width, h: this.h },
        aria: o.aria ?? o.label,
        onClick: () => {
          this.on = !this.on;
          this.paint();
          this.states?.setSelected(this.on);
          o.onClick?.(this.on);
        },
      });
    }
  }

  private paint(): void {
    this.g.clear();
    cut(this.g, 0, 0, this.width, this.h, 5,
      this.on ? shade(this.c, -0.2) : shade(this.c, -0.7), 1, "tl-br");
    cut(this.g, 1, 1, this.width - 2, this.h - 2, 4.5,
      this.on ? shade(this.c, -0.55) : 0x0a0d14, 1, "tl-br");
    this.g.rect(0, 0, 2, this.h).fill({ color: this.c, alpha: this.on ? 1 : 0.4 });
    this.g.rect(4, 1, this.width - 8, 1)
      .fill({ color: shade(this.c, 0.8), alpha: this.on ? 0.45 : 0.14 });
    this.g.eventMode = "none";
    this.text.style.fill = this.on ? 0xf4f9ff : shade(this.c, 0.28);
  }

  update(dt: number): void { this.states?.update(dt); }
  setActive(on: boolean): void { this.on = on; this.paint(); this.states?.setSelected(on); }
  get active(): boolean { return this.on; }
  destroy(): void { this.states?.destroy(); this.root.destroy({ children: true }); }
}

export const mount = (o: ChipOpts): Chip => new Chip(o);
export default mount;
