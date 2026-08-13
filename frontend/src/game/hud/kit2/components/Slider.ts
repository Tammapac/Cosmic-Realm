// C-06 Schieber. Versenkte Röhre mit Plasmafüllung, hellem Endstrich und
// Rasterstrichen. Ziehen und Klicken setzen den Wert, der Griff hebt bei Hover,
// das Leuchten weitet sich beim Ziehen.

import { Container, Graphics, Sprite, type FederatedPointerEvent } from "pixi.js";
import { shade, rgba } from "../core/color";
import { gradientTexture } from "../core/textures";
import { makeGlow } from "../core/shadows";
import { value as makeValue } from "../core/typography";
import { ACCENT } from "../core/tokens";

export type SliderOpts = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  w?: number;
  h?: number;
  accent?: string | number;
  /** Einheit hinter der Zahl, z. B. "%" oder " FPS". */
  unit?: string;
  /** Zahl rechts anzeigen. */
  readout?: boolean;
  enabled?: boolean;
  aria?: string;
  onChange?: (value: number) => void;
};

export class Slider {
  readonly root = new Container();

  private track = new Graphics();
  private fill = new Graphics();
  private knob = new Graphics();
  private glow: Sprite;
  private readout;
  private hit = new Graphics();
  private val: number;
  private dragging = false;
  private t = 0;
  private o: SliderOpts;
  private w: number;
  private h: number;

  constructor(o: SliderOpts) {
    this.o = o;
    this.w = o.w ?? 200;
    this.h = o.h ?? 10;
    this.val = o.value;
    const c = o.accent ?? ACCENT.system;

    this.glow = makeGlow(c, this.w, this.h * 3, 0.4);
    this.glow.y = -this.h;
    this.readout = makeValue(this.text(), 10, shade(c, 0.6));
    this.readout.anchor.x = 1;
    this.readout.x = this.w + 46;
    this.readout.y = -2;

    this.root.addChild(this.glow, this.track, this.fill, this.knob);
    if (o.readout !== false) this.root.addChild(this.readout);

    this.hit.rect(-4, -8, this.w + 8, this.h + 16)
      .fill({ color: 0xffffff, alpha: 0.001 });
    this.hit.eventMode = o.enabled === false ? "none" : "static";
    this.hit.cursor = "ew-resize";
    this.root.addChild(this.hit);

    const setFrom = (e: FederatedPointerEvent): void => {
      const p = e.getLocalPosition(this.root);
      const min = this.o.min ?? 0, max = this.o.max ?? 100;
      let v = min + Math.max(0, Math.min(1, p.x / this.w)) * (max - min);
      const st = this.o.step ?? 1;
      v = Math.round(v / st) * st;
      if (v !== this.val) {
        this.val = v;
        this.paint();
        this.o.onChange?.(v);
      }
    };
    this.hit.on("pointerdown", (e: FederatedPointerEvent) => { this.dragging = true; setFrom(e); });
    this.hit.on("globalpointermove", (e: FederatedPointerEvent) => { if (this.dragging) setFrom(e); });
    this.hit.on("pointerup", () => { this.dragging = false; });
    this.hit.on("pointerupoutside", () => { this.dragging = false; });
    this.hit.on("pointerover", () => { this.glow.alpha = 0.55; });
    this.hit.on("pointerout", () => { this.glow.alpha = 0.4; });

    this.paint();
  }

  private text(): string {
    return String(Math.round(this.val)) + (this.o.unit ?? "");
  }

  private paint(): void {
    const c = this.o.accent ?? ACCENT.system;
    const min = this.o.min ?? 0, max = this.o.max ?? 100;
    const p = (this.val - min) / (max - min);

    this.track.clear();
    this.track.rect(0, 0, this.w, this.h).fill(0x05080f);
    this.track.rect(0, 0, this.w, 1).fill({ color: 0x000000, alpha: 0.85 });
    this.track.rect(0, this.h - 1, this.w, 1).fill({ color: c, alpha: 0.16 });
    for (let x = 0; x < this.w; x += 6) {
      this.track.rect(x, 0, 1, this.h).fill({ color: 0x000000, alpha: 0.4 });
    }
    this.track.eventMode = "none";

    this.fill.clear();
    const fw = p * this.w;
    if (fw > 0) {
      this.fill.rect(0, 0, fw, this.h).fill(shade(c, -0.1));
      this.fill.rect(0, 0, fw, Math.max(1, this.h * 0.3))
        .fill({ color: shade(c, 0.55), alpha: 0.85 });
      this.fill.rect(Math.max(0, fw - 2), -1, 2, this.h + 2).fill(shade(c, 0.75));
    }
    this.fill.eventMode = "none";
    this.glow.width = fw + 20;
    this.glow.x = -10;

    this.knob.clear();
    const kx = Math.max(0, Math.min(this.w - 8, fw - 4));
    this.knob.rect(kx, -3, 8, this.h + 6).fill(shade(c, 0.5));
    this.knob.rect(kx, -3, 8, 1).fill({ color: 0xffffff, alpha: 0.7 });
    this.knob.eventMode = "none";

    this.readout.text = this.text();
    void rgba;
    void gradientTexture;
  }

  update(dt: number): void {
    this.t += dt;
    this.glow.alpha = (this.dragging ? 0.62 : 0.4) + Math.sin(this.t * 2) * 0.05;
  }

  setValue(v: number): void { this.val = v; this.paint(); }
  get value(): number { return this.val; }
  setEnabled(on: boolean): void {
    this.hit.eventMode = on ? "static" : "none";
    this.root.alpha = on ? 1 : 0.42;
  }

  destroy(): void { this.root.destroy({ children: true }); }
}

export const mount = (o: SliderOpts): Slider => new Slider(o);
export default mount;
