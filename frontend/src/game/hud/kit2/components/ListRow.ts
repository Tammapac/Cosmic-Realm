// P-06 Tabellenzeile. Leaderboard, Roster, Kontaktliste, Fracht, Charters.
//
// Gefaste Fläche mit abwechselnder Helligkeit, farbige Kante links, senkrechte
// Trennstriche zwischen den Zellen, Werte rechtsbündig mit tabellarischen
// Ziffern. Auswahl tönt die Fläche und zündet die Unterkante; Hover schiebt die
// Zeile 3 px nach rechts.

import { Container, Graphics } from "pixi.js";
import { cut } from "../core/geometry";
import { shade, hex } from "../core/color";
import { label as makeLabel, value as makeValue, strong } from "../core/typography";
import { attachStates, type StateHandle } from "../core/states";
import { ACCENT } from "../core/tokens";

export type RowCell = {
  text: string;
  /** Feste Breite; ohne Angabe zusammen mit flex verteilt. */
  w?: number;
  flex?: boolean;
  align?: "left" | "center" | "right";
  color?: number;
  size?: number;
  mono?: boolean;
  bold?: boolean;
  /** Raute in dieser Farbe vor dem Text. */
  dot?: string | number;
  /** Kleines Label hinter dem Text. */
  chip?: { text: string; color: string | number };
};

export type ListRowOpts = {
  w: number;
  h?: number;
  cells: RowCell[];
  accent?: string | number;
  /** Zebra-Streifen. */
  index?: number;
  selected?: boolean;
  /** Eigene Hervorhebung — die eigene Zeile im Leaderboard. */
  own?: boolean;
  /** Trennstriche zwischen den Zellen. */
  dividers?: boolean;
  enabled?: boolean;
  aria?: string;
  onClick?: () => void;
};

export class ListRow {
  readonly root = new Container();

  private body = new Container();
  private bg = new Graphics();
  private under = new Graphics();
  private states: StateHandle;
  private selected: boolean;
  private o: ListRowOpts;
  private h: number;

  constructor(o: ListRowOpts) {
    this.o = o;
    this.h = o.h ?? 26;
    this.selected = !!o.selected;
    const c = hex(o.accent ?? ACCENT.system);

    this.body.addChild(this.bg, this.under);
    this.paint();

    // Breiten verteilen
    const fixed = o.cells.reduce((a, x) => a + (x.flex ? 0 : (x.w ?? 60)), 0);
    const flexN = o.cells.filter((x) => x.flex).length;
    const flexW = flexN ? Math.max(40, (o.w - fixed - 24) / flexN) : 0;

    let x = 12;
    o.cells.forEach((cell, ci) => {
      const cw = cell.flex ? flexW : (cell.w ?? 60);
      let tx = x;
      const t = cell.mono
        ? makeValue(cell.text, cell.size ?? 10, cell.color ?? 0xdbe9fb)
        : cell.bold
          ? strong(cell.text, cell.size ?? 11, cell.color ?? 0xe2ecfa)
          : makeValue(cell.text, cell.size ?? 10, cell.color ?? 0xbad2ec);

      if (cell.dot) {
        const d = new Graphics();
        d.poly([tx + 3, this.h / 2, tx + 6.5, this.h / 2 - 3.5,
          tx + 10, this.h / 2, tx + 6.5, this.h / 2 + 3.5]).fill(hex(cell.dot));
        d.eventMode = "none";
        this.body.addChild(d);
        tx += 18;
      }

      if (cell.align === "right") { t.anchor.x = 1; t.x = x + cw - 4; }
      else if (cell.align === "center") { t.anchor.x = 0.5; t.x = x + cw / 2; }
      else t.x = tx;
      t.y = (this.h - (cell.size ?? 10) * 1.25) / 2;
      this.body.addChild(t);

      if (cell.chip) {
        const cc = hex(cell.chip.color);
        const ch2 = makeLabel(cell.chip.text, 5.5, cc, 1.6);
        ch2.x = (cell.align === "right" ? t.x - t.width : t.x + t.width) + 8;
        ch2.y = (this.h - 7) / 2;
        this.body.addChild(ch2);
      }

      if (o.dividers !== false && ci < o.cells.length - 1) {
        const dv = new Graphics();
        dv.rect(x + cw, 3, 1, this.h - 6).fill({ color: 0x000000, alpha: 0.6 });
        dv.rect(x + cw + 1, 3, 1, this.h - 6).fill({ color: shade(c, 0.6), alpha: 0.07 });
        dv.eventMode = "none";
        this.body.addChild(dv);
      }
      x += cw;
    });

    this.root.addChild(this.body);
    this.states = attachStates(this.body, {
      accent: c,
      slide: 3,
      lift: 3,
      sink: 1,
      flash: false,
      enabled: o.enabled !== false && !!o.onClick,
      selected: this.selected,
      size: { w: o.w, h: this.h },
      aria: o.aria,
      onClick: o.onClick,
    });
  }

  private paint(): void {
    const o = this.o;
    const c = hex(o.accent ?? ACCENT.system);
    const i = o.index ?? 0;
    const base = o.own ? shade(c, -0.78)
      : this.selected ? shade(c, -0.82)
        : (i % 2 ? 0x0b1018 : 0x0d131c);
    this.bg.clear();
    this.under.clear();
    cut(this.bg, 0, 0, o.w, this.h, 8, base, 1, "tl-br");
    this.bg.rect(0, 0, 2, this.h)
      .fill({ color: c, alpha: o.own || this.selected ? 1 : 0.55 });
    if (this.selected || o.own) {
      this.bg.rect(2, 1, o.w - 4, 1).fill({ color: shade(c, 0.7), alpha: 0.35 });
      this.under.rect(0, this.h - 2, o.w, 2)
        .fill({ color: c, alpha: o.own ? 0.55 : 0.4 });
    }
    this.bg.eventMode = "none";
    this.under.eventMode = "none";
  }

  update(dt: number): void { this.states.update(dt); }

  setSelected(on: boolean): void {
    this.selected = on;
    this.states.setSelected(on);
    this.paint();
  }

  setEnabled(on: boolean): void { this.states.setEnabled(on); }
  get height(): number { return this.h; }

  destroy(): void {
    this.states.destroy();
    this.root.destroy({ children: true });
  }
}

export const mount = (o: ListRowOpts): ListRow => new ListRow(o);
export default mount;
