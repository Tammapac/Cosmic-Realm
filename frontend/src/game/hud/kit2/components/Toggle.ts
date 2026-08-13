// C-05 Umschalter. Versenkte Wanne mit Rim, gleitender Knopf, grüne Fläche und
// Unterlicht wenn an, tote Stahlfläche wenn aus. Der Knopf gleitet in 160 ms,
// die Aura folgt.

import { Container, Graphics, Sprite } from "pixi.js";
import { cut } from "../core/geometry";
import { shade } from "../core/color";
import { makeGlow } from "../core/shadows";
import { label as makeLabel } from "../core/typography";
import { attachStates, type StateHandle } from "../core/states";
import { ACCENT } from "../core/tokens";
import { approach } from "../core/easing";

export type ToggleOpts = {
  value: boolean;
  w?: number;
  h?: number;
  /** ON/OFF-Label rechts vom Schalter. */
  showLabel?: boolean;
  enabled?: boolean;
  aria?: string;
  onChange?: (value: boolean) => void;
};

export class Toggle {
  readonly root = new Container();

  private track = new Graphics();
  private knob = new Graphics();
  private aura: Sprite;
  private text;
  private states: StateHandle;
  private on: boolean;
  private pos: number;
  private t = 0;
  private w: number;
  private h: number;

  constructor(o: ToggleOpts) {
    this.w = o.w ?? 66;
    this.h = o.h ?? 22;
    this.on = o.value;
    this.pos = o.value ? 1 : 0;

    this.aura = makeGlow(ACCENT.confirm, this.w, this.h * 2.4, 0);
    this.aura.y = -this.h * 0.7;
    this.root.addChild(this.aura, this.track, this.knob);

    this.text = makeLabel(this.on ? "ON" : "OFF", 6.5,
      this.on ? ACCENT.confirm : 0x9d8489, 2.4);
    this.text.x = this.w + 10;
    this.text.y = (this.h - 7) / 2;
    if (o.showLabel !== false) this.root.addChild(this.text);

    this.paint();
    this.states = attachStates(this.root, {
      accent: ACCENT.confirm,
      lift: 0,
      sink: 1,
      flash: false,
      enabled: o.enabled,
      selected: this.on,
      size: { w: this.w, h: this.h },
      aria: o.aria ?? "Toggle",
      onClick: () => {
        this.on = !this.on;
        this.text.text = this.on ? "ON" : "OFF";
        this.states.setSelected(this.on);
        o.onChange?.(this.on);
      },
    });
  }

  private paint(): void {
    const c = this.on ? ACCENT.confirm : 0x6e5c60;
    this.track.clear();
    cut(this.track, 0, 0, this.w, this.h, 6, shade(c, this.on ? -0.4 : -0.72), 1, "tl-br");
    cut(this.track, 1.5, 1.5, this.w - 3, this.h - 3, 5, this.on ? shade(c, -0.7) : 0x0c0709, 1, "tl-br");
    this.track.rect(5, 1.5, this.w - 10, 1)
      .fill({ color: shade(c, 0.8), alpha: this.on ? 0.5 : 0.2 });
    this.track.rect(4, this.h - 3, this.w - 8, 2)
      .fill({ color: c, alpha: this.on ? 0.8 : 0.18 });
    this.track.eventMode = "none";

    this.knob.clear();
    const kx = 4 + this.pos * (this.w - 26);
    this.knob.rect(kx, 3, 18, this.h - 6).fill(shade(c, this.on ? 0.6 : -0.1));
    this.knob.rect(kx, 3, 18, 1).fill({ color: 0xffffff, alpha: 0.55 });
    this.knob.rect(kx, this.h - 4, 18, 1).fill({ color: 0x000000, alpha: 0.5 });
    this.knob.eventMode = "none";

    this.aura.tint = c;
    this.text.style.fill = this.on ? ACCENT.confirm : 0x9d8489;
  }

  update(dt: number): void {
    this.t += dt;
    this.states.update(dt);
    const target = this.on ? 1 : 0;
    if (Math.abs(this.pos - target) > 0.001) {
      this.pos = approach(this.pos, target, dt, 0.16);
      this.paint();
    }
    this.aura.alpha = this.on ? 0.28 + Math.sin(this.t * 1.8) * 0.08 : 0;
  }

  setValue(v: boolean): void {
    this.on = v;
    this.text.text = v ? "ON" : "OFF";
    this.states.setSelected(v);
    this.paint();
  }

  get value(): boolean { return this.on; }
  setEnabled(on: boolean): void { this.states.setEnabled(on); }

  destroy(): void {
    this.states.destroy();
    this.root.destroy({ children: true });
  }
}

export const mount = (o: ToggleOpts): Toggle => new Toggle(o);
export default mount;
