// F-01 Panelrahmen. Grundlage jedes Fensters.
//
// Aufbau von außen nach innen (CLAUDE.md):
//   1  Schattenstapel — harter Sitz, Kontakt, Mitte, Wurf
//   2  Akzent-Aura
//   3  fünf Metallbänder, je 2 px enger gefast, Helligkeit fällt
//   4  versenkte Fläche mit Innenschatten, Bounce-Linie, Akzent-Unterlicht
//   5  115°-Haarlinien im 26-px-Raster
//   6  geclippte Inhaltsebene
//
// Panels schneiden oben rechts und unten links. Nie border mit clip-path.

import { Container, Graphics, Sprite } from "pixi.js";
import { cut, type Cuts } from "../core/geometry";
import { shade, rgba } from "../core/color";
import { gradientTexture } from "../core/textures";
import { addShadowStack, makeGlow, makeWash } from "../core/shadows";
import { BAND, CHAMFER } from "../core/tokens";
import { pulse } from "../core/easing";

export type PanelFrameOpts = {
  w: number;
  h: number;
  accent: string | number;
  /** Außenfase. Große Panels 34, HUD-Rahmen 22. */
  chamfer?: number;
  cuts?: Cuts;
  /** Anzahl Bänder inkl. Rim. Standard 5. */
  bands?: number;
  /** Abstand je Band. Standard 2. */
  bandStep?: number;
  /** Deckkraft der Akzent-Aura. 0 schaltet sie ab. */
  ambient?: number;
  /** Schattenstapel skalieren. 0 schaltet ihn ab. */
  shadow?: number;
  /** Haarlinien über der Fläche. */
  hairlines?: boolean;
  /** Zusätzliche Innenpolsterung der Inhaltsebene. */
  pad?: number;
};

export class PanelFrame {
  readonly root = new Container();
  /** Inhaltsebene — bereits auf die Innenkante versetzt und dort geclippt. */
  readonly content = new Container();
  /** Maße der Innenfläche. */
  readonly inner: { x: number; y: number; w: number; h: number; chamfer: number };

  private aura: Sprite;
  private ambientBase: number;
  private t = 0;

  constructor(o: PanelFrameOpts) {
    const { w, h } = o;
    const accent = o.accent;
    const ch = o.chamfer ?? CHAMFER.panel;
    const cuts = o.cuts ?? "tr-bl";
    const bands = o.bands ?? BAND.count;
    const step = o.bandStep ?? BAND.step;
    this.ambientBase = o.ambient ?? 0.22;

    if ((o.shadow ?? 1) > 0) addShadowStack(this.root, w, h, ch, cuts, o.shadow ?? 1);

    this.aura = makeGlow(accent, w * 1.3, h * 1.25, this.ambientBase);
    this.aura.x = -w * 0.15;
    this.aura.y = -h * 0.1;
    this.root.addChild(this.aura);

    // Bänder: Helligkeitsleiter, jedes 2 px enger gefast
    for (let i = 0; i < bands; i++) {
      const inset = i * step;
      const cc = ch - inset * (ch / (ch + 8));
      const g = new Graphics();
      cut(g, inset, inset, w - inset * 2, h - inset * 2, cc,
        shade(accent, BAND.ladder[Math.min(i, BAND.ladder.length - 1)]), 1, cuts);
      g.eventMode = "none";
      this.root.addChild(g);
      if (i < bands - 1) {
        const spec = new Graphics();
        spec.rect(inset + cc * 0.6, inset, w - inset * 2 - cc * 1.4, 1)
          .fill({ color: shade(accent, 0.85), alpha: i === 0 ? 0.75 : 0.25 });
        spec.eventMode = "none";
        this.root.addChild(spec);
      }
    }

    // Versenkte Fläche
    const pad = bands * step + 8 + (o.pad ?? 0);
    const iw = w - pad * 2, ih = h - pad * 2;
    const ic = Math.max(6, ch - pad);

    const face = new Graphics();
    cut(face, pad, pad, iw, ih, ic, shade(accent, -0.74), 1, cuts);
    face.eventMode = "none";
    this.root.addChild(face);

    const grad = new Sprite(gradientTexture([
      [0, rgba(shade(accent, -0.1), 0.14)],
      [0.42, "rgba(0,0,0,0)"],
      [1, "rgba(4,7,13,.85)"],
    ]));
    grad.x = pad; grad.y = pad; grad.width = iw; grad.height = ih;
    grad.eventMode = "none";
    this.root.addChild(grad);

    const rim = new Graphics();
    rim.rect(pad + ic * 0.5, pad, iw - ic, 1).fill({ color: 0xffffff, alpha: 0.5 });
    rim.rect(pad + ic * 0.5, pad + ih - 2, iw - ic, 2).fill({ color: accent, alpha: 0.35 });
    rim.eventMode = "none";
    this.root.addChild(rim);

    this.content.x = pad;
    this.content.y = pad;
    const clip = new Graphics();
    cut(clip, 0, 0, iw, ih, ic, 0xffffff, 1, cuts);
    this.content.addChild(clip);
    this.content.mask = clip;
    this.root.addChild(this.content);

    if (o.hairlines !== false) {
      const hair = new Graphics();
      for (let x = -ih; x < iw; x += 26) {
        hair.moveTo(x, ih).lineTo(x + ih * 0.47, 0)
          .stroke({ width: 1, color: 0xffffff, alpha: 0.035 });
      }
      hair.eventMode = "none";
      this.content.addChild(hair);
    }

    this.inner = { x: pad, y: pad, w: iw, h: ih, chamfer: ic };
  }

  /** Radialer Lichtwurf oben in die Fläche — für Kopfzeilen. */
  addWash(color: string | number, h: number, alpha = 0.16): Sprite {
    const sp = makeWash(color, this.inner.w, h, alpha);
    this.content.addChildAt(sp, 1);
    return sp;
  }

  update(dt: number): void {
    this.t += dt;
    this.aura.alpha = this.ambientBase + (pulse(this.t, 0.21) - 0.5) * 0.1;
  }

  destroy(): void { this.root.destroy({ children: true }); }
}

export const mount = (o: PanelFrameOpts): PanelFrame => new PanelFrame(o);
export default mount;
