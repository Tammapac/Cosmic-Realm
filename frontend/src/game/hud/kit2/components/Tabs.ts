// M-01 Reiterleiste mit Edge-Glow-Wechsel.
//
// Der aktive Reiter trägt die Akzentschiene unten. Beim Wechsel laufen drei
// Leuchtebenen mit 260 / 380 / 480 ms Versatz über die Kante, während die Farbe
// in 300 ms überblendet (CLAUDE.md). Dadurch wirkt der Wechsel wie ein
// Lichtschmierer statt wie ein harter Umschalter.

import { Container, Graphics, Sprite } from "pixi.js";
import { cut } from "../core/geometry";
import { shade, rgba, mix, hex } from "../core/color";
import { radialTexture } from "../core/textures";
import { makeGlow } from "../core/shadows";
import { label as makeLabel, value as makeValue } from "../core/typography";
import { attachStates, type StateHandle } from "../core/states";
import { ACCENT, MOTION, SIZE } from "../core/tokens";

export type TabItem = {
  key: string;
  label: string;
  /** Eigene Farbe je Reiter — Skillbäume, Boards. */
  accent?: string | number;
  /** Zähler hinter dem Text. */
  count?: number;
  /** Roter Punkt für offene Vorgänge. */
  badge?: boolean;
  enabled?: boolean;
};

export type TabsOpts = {
  items: TabItem[];
  accent?: string | number;
  /** Breite je Reiter; ohne Angabe füllt die Leiste totalW. */
  tabW?: number;
  totalW?: number;
  h?: number;
  gap?: number;
  active?: string;
  fontSize?: number;
  onChange?: (key: string) => void;
};

type Cell = {
  key: string;
  node: Container;
  states: StateHandle;
  rail: Graphics;
  smear: { sp: Sprite; delay: number; t: number }[];
  accent: number;
};

export class Tabs {
  readonly root = new Container();

  private cells: Cell[] = [];
  private activeKey: string;
  private fade = 1;
  private fromColor: number;
  private toColor: number;
  private o: TabsOpts;
  private tabW: number;
  private h: number;

  constructor(o: TabsOpts) {
    this.o = o;
    this.h = o.h ?? 28;
    const gap = o.gap ?? 6;
    const n = o.items.length;
    this.tabW = o.tabW ?? ((o.totalW ?? 480) - gap * (n - 1)) / n;
    this.activeKey = o.active ?? o.items[0]?.key ?? "";
    this.fromColor = hex(o.accent ?? ACCENT.action);
    this.toColor = this.fromColor;
    this.build();
  }

  private build(): void {
    for (const c of this.cells) c.states.destroy();
    this.root.removeChildren();
    this.cells.length = 0;

    const gap = this.o.gap ?? 6;
    this.o.items.forEach((it, i) => {
      const accent = hex(it.accent ?? this.o.accent ?? ACCENT.action);
      const on = it.key === this.activeKey;
      const node = new Container();
      node.x = i * (this.tabW + gap);

      const g = new Graphics();
      cut(g, 0, 0, this.tabW, this.h, 8, on ? shade(accent, 0.4) : 0x7d7361, 1, "tl-br");
      cut(g, 1, 1, this.tabW - 2, this.h - 2, 7.5, on ? shade(accent, -0.24) : 0x3b352c, 1, "tl-br");
      cut(g, 2, 2, this.tabW - 4, this.h - 4, 7, on ? shade(accent, -0.66) : 0x141109, 1, "tl-br");
      g.rect(7, 2, this.tabW - 14, 1)
        .fill({ color: shade(accent, 0.8), alpha: on ? 0.7 : 0.22 });
      g.eventMode = "none";
      node.addChild(g);

      const wash = new Sprite(radialTexture([
        [0, rgba(accent, on ? 0.26 : 0)], [0.74, "rgba(0,0,0,0)"],
      ]));
      wash.width = this.tabW;
      wash.height = this.h;
      wash.eventMode = "none";
      node.addChild(wash);

      const rail = new Graphics();
      rail.rect(7, this.h - 2, this.tabW - 14, 2)
        .fill({ color: accent, alpha: on ? 1 : 0.25 });
      rail.eventMode = "none";
      node.addChild(rail);

      // drei Leuchtebenen für den Schmierer
      const smear = MOTION.smear.map((d) => {
        const sp = makeGlow(accent, this.tabW, 16, 0);
        sp.y = this.h - 8;
        node.addChild(sp);
        return { sp, delay: d * 1000, t: -1 };
      });

      const t = makeLabel(it.label, this.o.fontSize ?? SIZE.small,
        on ? 0xfff6e2 : shade(accent, 0.28), 1.8);
      t.anchor.set(0.5);
      t.x = this.tabW / 2;
      t.y = this.h / 2;
      node.addChild(t);

      if (it.count !== undefined) {
        const cv = makeValue(String(it.count), 7, on ? 0xfff6e2 : shade(accent, 0.24));
        cv.anchor.set(1, 0);
        cv.x = this.tabW - 6;
        cv.y = 3;
        node.addChild(cv);
      }

      if (it.badge) {
        const b = new Graphics();
        b.poly([this.tabW - 12, 6, this.tabW - 8, 10, this.tabW - 12, 14, this.tabW - 16, 10])
          .fill(ACCENT.destruction);
        node.addChild(b);
        const bg = makeGlow(ACCENT.destruction, 18, 18, 0.7);
        bg.x = this.tabW - 21;
        bg.y = 1;
        node.addChild(bg);
      }

      const states = attachStates(node, {
        accent,
        lift: 2,
        sink: 1,
        enabled: it.enabled,
        active: on,
        size: { w: this.tabW, h: this.h },
        aria: it.label,
        onClick: () => this.select(it.key),
      });

      this.root.addChild(node);
      this.cells.push({ key: it.key, node, states, rail, smear, accent });
    });
  }

  select(key: string): void {
    if (key === this.activeKey) return;
    const prev = this.cells.find((c) => c.key === this.activeKey);
    const next = this.o.items.find((i) => i.key === key);
    if (!next) return;
    this.fromColor = prev?.accent ?? this.fromColor;
    this.toColor = hex(next.accent ?? this.o.accent ?? ACCENT.action);
    this.fade = 0;
    this.activeKey = key;
    this.build();
    const cell = this.cells.find((c) => c.key === key);
    if (cell) for (const s of cell.smear) s.t = 0;
    this.o.onChange?.(key);
  }

  /** Zähler und Badges nachziehen, ohne den Reiter zu wechseln. */
  setItems(items: TabItem[]): void {
    this.o.items = items;
    this.build();
  }

  update(dt: number): void {
    // Farbüberblendung
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / MOTION.tabFade);
      const c = mix(this.fromColor, this.toColor, this.fade);
      for (const cell of this.cells) {
        if (cell.key !== this.activeKey) continue;
        cell.rail.tint = c;
        for (const s of cell.smear) s.sp.tint = c;
      }
    }
    // drei versetzte Leuchtebenen
    for (const cell of this.cells) {
      cell.states.update(dt);
      for (const s of cell.smear) {
        if (s.t < 0) continue;
        s.t += dt * 1000;
        const p = s.t / s.delay;
        if (p >= 1) { s.sp.alpha = 0; s.t = -1; continue; }
        s.sp.alpha = Math.sin(p * Math.PI) * 0.75;
        s.sp.width = this.tabW * (0.5 + p * 0.7);
        s.sp.x = (this.tabW - s.sp.width) / 2;
      }
    }
  }

  get active(): string { return this.activeKey; }
  get height(): number { return this.h; }

  destroy(): void {
    for (const c of this.cells) c.states.destroy();
    this.root.destroy({ children: true });
  }
}

export const mount = (o: TabsOpts): Tabs => new Tabs(o);
export default mount;
