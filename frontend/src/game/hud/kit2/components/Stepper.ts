// C-04 Stepper. Gerade Quadratknöpfe für − und +: Metallkante, Mittelband,
// versenkte Fläche mit Specular oben und Akzent-Unterlicht. Minus rot, Plus
// grün. Optional mit Schrittweitenwahl 1× / 5× / 10× wie im Pilot Dossier.

import { Container, Graphics } from "pixi.js";
import { cut } from "../core/geometry";
import { shade } from "../core/color";
import { label as makeLabel, value as makeValue, glyph as makeGlyph } from "../core/typography";
import { attachStates, type StateHandle } from "../core/states";
import { ACCENT } from "../core/tokens";

export type StepperOpts = {
  value: number;
  min?: number;
  max?: number;
  /** Verfügbare Schrittweiten; die erste ist vorgewählt. */
  steps?: number[];
  size?: number;
  /** Zusätzliche Prüfung, ob − bzw. + gehen darf. */
  canDec?: () => boolean;
  canInc?: () => boolean;
  onChange?: (value: number, delta: number) => void;
  onStepChange?: (step: number) => void;
};

/** Ein Quadratknopf mit vollem Bandaufbau. */
function squareButton(
  size: number, glyphText: string, accent: number, enabled: boolean, aria: string,
  onClick: () => void,
): { root: Container; states: StateHandle } {
  const root = new Container();
  const g = new Graphics();
  // harter Sitz
  g.rect(0, 3, size, size).fill({ color: 0x03050a, alpha: 0.9 });
  // Kante, Mittelband, Fläche
  g.rect(0, 0, size, size).fill(shade(accent, 0.45));
  g.rect(1.5, 1.5, size - 3, size - 3).fill(shade(accent, -0.36));
  g.rect(3, 3, size - 6, size - 6).fill(shade(accent, -0.74));
  // Specular oben, Unterlicht unten
  g.rect(4, 3, size - 8, 1).fill({ color: shade(accent, 0.8), alpha: 0.7 });
  g.rect(3, size - 5, size - 6, 2).fill({ color: accent, alpha: 0.75 });
  g.eventMode = "none";
  root.addChild(g);

  const t = makeGlyph(glyphText, size * 0.54, shade(accent, 0.8));
  t.anchor.set(0.5);
  t.x = size / 2;
  t.y = size / 2;
  root.addChild(t);

  const states = attachStates(root, {
    accent, enabled, size: { w: size, h: size }, aria, onClick,
  });
  return { root, states };
}

export class Stepper {
  readonly root = new Container();

  private val: number;
  private stepIdx = 0;
  private steps: number[];
  private size: number;
  private handles: StateHandle[] = [];
  private o: StepperOpts;

  constructor(o: StepperOpts) {
    this.o = o;
    this.size = o.size ?? 24;
    this.steps = o.steps ?? [1];
    this.val = o.value;
    this.build();
  }

  private build(): void {
    for (const h of this.handles) h.destroy();
    this.handles.length = 0;
    this.root.removeChildren();

    let x = 0;

    // Schrittweitenwahl
    if (this.steps.length > 1) {
      this.steps.forEach((s, i) => {
        const on = this.stepIdx === i;
        const w = 34;
        const cell = new Container();
        const g = new Graphics();
        cut(g, 0, 0, w, this.size - 2, 6,
          on ? shade(ACCENT.action, -0.2) : 0x161020, 1, "tl-br");
        cut(g, 1, 1, w - 2, this.size - 4, 5.5,
          on ? shade(ACCENT.action, -0.6) : 0x0a0812, 1, "tl-br");
        g.rect(4, 1, w - 8, 1)
          .fill({ color: shade(ACCENT.action, 0.7), alpha: on ? 0.6 : 0.18 });
        g.rect(3, this.size - 4, w - 6, 2)
          .fill({ color: ACCENT.action, alpha: on ? 1 : 0.25 });
        g.eventMode = "none";
        cell.addChild(g);
        const t = makeLabel(s + "×", 7, on ? 0xf4ecff : 0x7f8ea4, 1.2);
        t.anchor.set(0.5);
        t.x = w / 2;
        t.y = (this.size - 2) / 2;
        cell.addChild(t);
        cell.x = x;
        const st = attachStates(cell, {
          accent: ACCENT.action, lift: 2, sink: 1, active: on,
          size: { w, h: this.size - 2 }, aria: `Step ${s}`,
          onClick: () => {
            this.stepIdx = i;
            this.o.onStepChange?.(s);
            this.build();
          },
        });
        this.handles.push(st);
        this.root.addChild(cell);
        x += w + 4;
      });
      x += 6;
    }

    const step = this.steps[this.stepIdx];
    const min = this.o.min ?? 0, max = this.o.max ?? Infinity;

    const dec = squareButton(this.size, "−", ACCENT.destruction,
      this.o.canDec ? this.o.canDec() : this.val > min,
      "Decrease", () => {
        const d = -Math.min(step, this.val - min);
        if (d === 0) return;
        this.val += d;
        this.o.onChange?.(this.val, d);
        this.build();
      });
    dec.root.x = x;
    this.root.addChild(dec.root);
    this.handles.push(dec.states);
    x += this.size + 8;

    const v = makeValue(String(this.val), this.size * 0.52, 0xe6f3ff);
    v.anchor.set(0.5, 0);
    v.x = x + 20;
    v.y = this.size * 0.2;
    this.root.addChild(v);
    x += 48;

    const inc = squareButton(this.size, "+", ACCENT.confirm,
      this.o.canInc ? this.o.canInc() : this.val < max,
      "Increase", () => {
        const d = Math.min(step, max - this.val);
        if (d === 0) return;
        this.val += d;
        this.o.onChange?.(this.val, d);
        this.build();
      });
    inc.root.x = x;
    this.root.addChild(inc.root);
    this.handles.push(inc.states);
  }

  update(dt: number): void { for (const h of this.handles) h.update(dt); }

  setValue(v: number): void { this.val = v; this.build(); }
  get value(): number { return this.val; }
  get step(): number { return this.steps[this.stepIdx]; }

  destroy(): void {
    for (const h of this.handles) h.destroy();
    this.root.destroy({ children: true });
  }
}

export const mount = (o: StepperOpts): Stepper => new Stepper(o);
export default mount;
