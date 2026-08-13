// P-03 Energieröhre. Hull, Shield, Erfahrung, Füllstand, Fortschritt.
//
// Aufbau: versenkte Wanne mit Innenschatten oben und Akzentlinie unten,
// Füllung als weicher Plasmaverlauf statt harter Strich, heller Endstrich,
// Rasterstriche darüber, weiches Leuchten außen. Optional Filamente, die im
// Inneren mit versetztem Takt driften — nichts läuft synchron (CLAUDE.md).

import { Container, Graphics, Sprite } from "pixi.js";
import { shade, rgba } from "../core/color";
import { gradientTexture } from "../core/textures";
import { makeGlow } from "../core/shadows";
import { approach } from "../core/easing";
import { MOTION } from "../core/tokens";
import { EnergyDistortFilter } from "../core/filters";

export type EnergyBarOpts = {
  w: number;
  h: number;
  /** 0 … 1 */
  pct: number;
  accent: string | number;
  /** Driftende Lichtfäden im Inneren. */
  filaments?: number;
  /** Rasterstriche über der Röhre. */
  ticks?: boolean;
  /** Sekunden für die Nachlaufbewegung. */
  ease?: number;
  /** Warnfarbe ab diesem Füllstand (Fracht) oder darunter (Hülle). */
  warnAbove?: number;
  warnBelow?: number;
  warnColor?: string | number;
  /** Wellenbewegung im Plasma. */
  distort?: boolean;
  /** Taktversatz, damit zwei Röhren nicht synchron laufen. */
  phase?: number;
};

export class EnergyBar {
  readonly root = new Container();

  private fill: Sprite;
  private cap: Graphics;
  private glow: Sprite;
  private flash: Sprite;
  private fils: { sp: Sprite; speed: number; phase: number }[] = [];
  private distort: EnergyDistortFilter | null = null;
  private target: number;
  private shown: number;
  private flashT = 0;
  private t: number;
  private o: EnergyBarOpts;

  constructor(o: EnergyBarOpts) {
    this.o = o;
    this.target = Math.max(0, Math.min(1, o.pct));
    this.shown = this.target;
    this.t = o.phase ?? 0;

    const c = this.colorFor(this.target);

    const track = new Graphics();
    track.rect(0, 0, o.w, o.h).fill(0x05080f);
    track.rect(0, 0, o.w, 1).fill({ color: 0x000000, alpha: 0.85 });
    track.rect(0, o.h - 1, o.w, 1).fill({ color: c, alpha: 0.16 });
    track.eventMode = "none";

    this.glow = makeGlow(c, o.w, o.h * 3.2, 0.45);
    this.glow.y = -o.h;
    this.root.addChild(this.glow, track);

    const clip = new Graphics();
    clip.rect(0, 0, o.w, o.h).fill(0xffffff);
    const tube = new Container();
    tube.addChild(clip);
    tube.mask = clip;
    tube.eventMode = "none";
    this.root.addChild(tube);

    this.fill = new Sprite(gradientTexture([
      [0, rgba(shade(c, 0.65), 1)],
      [0.28, rgba(shade(c, 0.15), 1)],
      [0.6, rgba(c, 1)],
      [1, rgba(shade(c, -0.55), 1)],
    ]));
    this.fill.height = o.h;
    tube.addChild(this.fill);
    if (o.distort) {
      this.distort = new EnergyDistortFilter(0.02, 30, 1.8);
      this.fill.filters = [this.distort];
    }

    const n = o.filaments ?? 0;
    for (let i = 0; i < n; i++) {
      const sp = new Sprite(gradientTexture([
        [0, "rgba(0,0,0,0)"],
        [0.5, rgba(shade(c, 0.9), 0.5)],
        [1, "rgba(0,0,0,0)"],
      ], false, 64));
      sp.width = o.w * 0.17;
      sp.height = o.h * 0.44;
      sp.y = o.h * (0.14 + i * (0.72 / Math.max(1, n)));
      sp.blendMode = "add";
      tube.addChild(sp);
      // versetzte Geschwindigkeit und Phase — nichts synchron
      this.fils.push({ sp, speed: 0.11 + i * 0.043, phase: i * 0.31 + (o.phase ?? 0) });
    }

    this.cap = new Graphics();
    this.cap.rect(0, -1, 2, o.h + 2).fill(shade(c, 0.85));
    tube.addChild(this.cap);

    this.flash = new Sprite(gradientTexture([
      [0, "rgba(255,120,140,0)"],
      [0.5, "rgba(255,120,140,.7)"],
      [1, "rgba(255,120,140,0)"],
    ]));
    this.flash.width = o.w;
    this.flash.height = o.h;
    this.flash.blendMode = "add";
    this.flash.alpha = 0;
    tube.addChild(this.flash);

    if (o.ticks !== false) {
      const tk = new Graphics();
      for (let x = 0; x < o.w; x += 5) {
        tk.rect(x, 0, 1, o.h).fill({ color: 0x000000, alpha: 0.4 });
      }
      tk.eventMode = "none";
      this.root.addChild(tk);
    }

    this.paint();
  }

  private colorFor(pct: number): string | number {
    const o = this.o;
    if (o.warnAbove !== undefined && pct >= o.warnAbove) return o.warnColor ?? 0xff4d5e;
    if (o.warnBelow !== undefined && pct <= o.warnBelow) return o.warnColor ?? 0xff4d5e;
    return o.accent;
  }

  private paint(): void {
    const w = this.shown * this.o.w;
    this.fill.width = Math.max(0, w);
    this.cap.x = Math.max(0, w - 2);
    this.cap.visible = w > 2;
    this.glow.width = w + 24;
    this.glow.x = -12;
  }

  update(dt: number): void {
    this.t += dt;
    if (Math.abs(this.shown - this.target) > 0.0005) {
      this.shown = approach(this.shown, this.target, dt, this.o.ease ?? MOTION.barEase);
      this.paint();
    }
    this.glow.alpha = 0.4 + Math.sin(this.t * 1.6 + (this.o.phase ?? 0) * 6) * 0.08;
    if (this.distort) this.distort.time = this.t;

    const w = this.shown * this.o.w;
    for (const f of this.fils) {
      if (w <= 4) { f.sp.alpha = 0; continue; }
      f.sp.x = (((this.t * f.speed + f.phase) % 1) * (w + f.sp.width)) - f.sp.width;
      f.sp.alpha = 0.42 + Math.sin(this.t * 2.3 + f.phase * 7) * 0.3;
    }

    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt / 0.32);
      this.flash.alpha = this.flashT;
    }
  }

  setPct(p: number): void { this.target = Math.max(0, Math.min(1, p)); }
  /** Trefferblitz. */
  hit(): void { this.flashT = 1; }
  get pct(): number { return this.shown; }

  destroy(): void { this.root.destroy({ children: true }); }
}

export const mount = (o: EnergyBarOpts): EnergyBar => new EnergyBar(o);
export default mount;
