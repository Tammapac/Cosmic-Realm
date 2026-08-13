// E-02 Raritätsanimation als eigenständige Ebene.
//
// Über jedes Icon, jede Karte, jeden Belohnungssockel und jeden Tooltip legbar:
//
//   celestial  Prismenwirbel, Regenbogenzyklus im Shader, Glanzstreifen, Glitzer
//   relic      kreisender Magenta-Wirbel mit umlaufendem Funken
//   legendary  ruhiges Goldatmen mit sparsamem Glitzer
//   epic       leises Violettpulsieren
//   darunter   ohne Animation
//
// Die Ebene wird auf die Trägerform beschnitten, damit nichts über das Hexagon
// oder die Fase hinausläuft.

import { Container, Graphics, Sprite } from "pixi.js";
import { hexPath, chamferPath, octPath, type Cuts } from "../core/geometry";
import { radialTexture, gradientTexture } from "../core/textures";
import { rgba } from "../core/color";
import { RARITY, RARITY_ANIMATED, type RarityKey } from "../core/tokens";
import { RainbowCycleFilter, ShineSweepFilter } from "../core/filters";
import { ParticleField } from "../core/particles";

export type RarityClip = "hex" | "card" | "oct" | "rect" | "none";

export type RarityAuraOpts = {
  rarity: RarityKey | string;
  w: number;
  h: number;
  /** Beschneidung auf die Trägerform. */
  clip?: RarityClip;
  chamfer?: number;
  cuts?: Cuts;
  /** Glitzerpartikel. */
  sparkle?: boolean;
  /** Aura außerhalb der Form — nur bei clip "none" sinnvoll. */
  halo?: boolean;
};

export class RarityAura {
  readonly root = new Container();
  readonly animated: boolean;

  private parts: { sp: Sprite; kind: string; seed: number }[] = [];
  private rainbow: RainbowCycleFilter | null = null;
  private shine: ShineSweepFilter | null = null;
  private field: ParticleField | null = null;
  private t = 0;
  private w: number;
  private h: number;
  private key: string;

  constructor(o: RarityAuraOpts) {
    this.w = o.w;
    this.h = o.h;
    this.key = o.rarity;
    const c = RARITY[o.rarity as RarityKey] ?? RARITY.common;
    this.animated = RARITY_ANIMATED[o.rarity as RarityKey] ?? false;
    this.root.eventMode = "none";

    if (!this.animated) return;

    const inner = new Container();
    if (o.clip && o.clip !== "none") {
      const m = new Graphics();
      const ch = o.chamfer ?? 10;
      if (o.clip === "card") m.poly(chamferPath(0, 0, o.w, o.h, ch, o.cuts ?? "tl-br")).fill(0xffffff);
      else if (o.clip === "oct") m.poly(octPath(0, 0, o.w, o.h)).fill(0xffffff);
      else if (o.clip === "rect") m.rect(0, 0, o.w, o.h).fill(0xffffff);
      else m.poly(hexPath(0, 0, o.w, o.h)).fill(0xffffff);
      inner.addChild(m);
      inner.mask = m;
    }
    this.root.addChild(inner);

    if (o.rarity === "celestial") {
      // drei versetzte Prismenfelder
      const cols = ["rgba(157,242,255,.55)", "rgba(255,160,255,.5)", "rgba(160,255,214,.5)"];
      cols.forEach((col, i) => {
        const sp = new Sprite(radialTexture([[0, col], [1, "rgba(0,0,0,0)"]]));
        sp.width = o.w * 1.5;
        sp.height = o.h * 1.5;
        sp.anchor.set(0.5);
        sp.x = o.w / 2;
        sp.y = o.h / 2;
        sp.blendMode = "add";
        inner.addChild(sp);
        this.parts.push({ sp, kind: "swirl", seed: i * 2.1 });
      });
      // durchlaufender Streifen
      const streak = new Sprite(gradientTexture([
        [0, "rgba(0,0,0,0)"],
        [0.38, "rgba(240,255,255,.85)"],
        [0.6, "rgba(255,226,255,.6)"],
        [1, "rgba(0,0,0,0)"],
      ], false, 128));
      streak.width = o.w * 0.28;
      streak.height = o.h * 1.4;
      streak.y = -o.h * 0.2;
      streak.blendMode = "add";
      inner.addChild(streak);
      this.parts.push({ sp: streak, kind: "streak", seed: 0 });
      // Farbzyklus und Glanz im Shader
      this.rainbow = new RainbowCycleFilter(0.22, 0.45);
      this.shine = new ShineSweepFilter(0.12, 0.24);
      inner.filters = [this.rainbow, this.shine];
    } else if (o.rarity === "relic") {
      const sp = new Sprite(radialTexture([
        [0, rgba(c, 0.6)], [0.5, rgba(c, 0.25)], [1, rgba(c, 0)],
      ]));
      sp.width = o.w * 1.35;
      sp.height = o.h * 1.35;
      sp.anchor.set(0.5);
      sp.x = o.w / 2;
      sp.y = o.h / 2;
      sp.blendMode = "add";
      inner.addChild(sp);
      this.parts.push({ sp, kind: "spin", seed: 0 });

      const orb = new Sprite(radialTexture([
        [0, "rgba(255,220,255,.9)"], [1, rgba(c, 0)],
      ]));
      orb.width = orb.height = Math.min(o.w, o.h) * 0.22;
      orb.anchor.set(0.5);
      orb.blendMode = "add";
      inner.addChild(orb);
      this.parts.push({ sp: orb, kind: "orbit", seed: 0 });
    } else {
      // legendary, epic
      const sp = new Sprite(radialTexture([[0, rgba(c, 0.5)], [1, rgba(c, 0)]]));
      sp.width = o.w * 1.2;
      sp.height = o.h * 1.2;
      sp.anchor.set(0.5);
      sp.x = o.w / 2;
      sp.y = o.h / 2;
      sp.blendMode = "add";
      inner.addChild(sp);
      this.parts.push({ sp, kind: "breathe", seed: o.rarity === "legendary" ? 0 : 1 });
    }

    if (o.halo) {
      const halo = new Sprite(radialTexture([[0, rgba(c, 0.4)], [1, rgba(c, 0)]]));
      halo.width = o.w * 1.8;
      halo.height = o.h * 1.8;
      halo.x = -o.w * 0.4;
      halo.y = -o.h * 0.4;
      halo.blendMode = "add";
      halo.alpha = 0.4;
      this.root.addChildAt(halo, 0);
      this.parts.push({ sp: halo, kind: "breathe", seed: 0 });
    }

    if (o.sparkle) {
      this.field = new ParticleField({ accent: c, max: 60, density: 0.6 });
      this.root.addChild(this.field.container);
    }
  }

  update(dt: number): void {
    if (!this.animated) return;
    this.t += dt;
    if (this.rainbow) this.rainbow.time = this.t;
    if (this.shine) this.shine.time = this.t;

    for (const p of this.parts) {
      switch (p.kind) {
        case "swirl":
          p.sp.rotation = this.t * (0.28 + p.seed * 0.06) + p.seed;
          p.sp.alpha = 0.4 + Math.sin(this.t * 1.1 + p.seed) * 0.22;
          break;
        case "streak":
          p.sp.x = ((this.t / 6.5) % 1) * (this.w + p.sp.width) - p.sp.width;
          break;
        case "spin":
          p.sp.rotation = this.t * 0.55;
          p.sp.alpha = 0.5 + Math.sin(this.t * 2.6) * 0.2;
          break;
        case "orbit": {
          const r = Math.min(this.w, this.h) * 0.3;
          p.sp.x = this.w / 2 + Math.cos(this.t * 1.5) * r;
          p.sp.y = this.h / 2 + Math.sin(this.t * 1.5) * r;
          p.sp.alpha = 0.6 + Math.sin(this.t * 3.2) * 0.3;
          break;
        }
        case "breathe":
          p.sp.alpha = (p.seed ? 0.22 : 0.3) + Math.sin(this.t * 1.55) * 0.13;
          break;
      }
    }

    if (this.field) {
      const rate = this.key === "celestial" ? 20 : this.key === "relic" ? 14 : 8;
      this.field.emit("sparkle", dt, () => [
        this.w * 0.18 + Math.random() * this.w * 0.64,
        this.h * 0.2 + Math.random() * this.h * 0.6,
      ], rate);
      this.field.update(dt);
    }
  }

  destroy(): void {
    this.field?.destroy();
    this.root.destroy({ children: true });
  }
}

export const mount = (o: RarityAuraOpts): RarityAura => new RarityAura(o);
export default mount;
