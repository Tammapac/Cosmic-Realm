// C-02 Schließer. Überall derselbe rote Knopf: ein um 45° gedrehtes Quadrat
// mit drei Bändern, Specular-Linie und aufrecht stehendem Kreuz.
//
// Hover skaliert 1,08 und weitet die Aura, Press sinkt auf 0,92 und verkürzt
// den Schatten. Der Klick löst zusätzlich einen kurzen Funkenstoß aus.

import { Container, Graphics, Sprite } from "pixi.js";
import { shade } from "../core/color";
import { makeGlow } from "../core/shadows";
import { glyph as makeGlyph } from "../core/typography";
import { attachStates, type StateHandle } from "../core/states";
import { ACCENT } from "../core/tokens";
import { ParticleField } from "../core/particles";

export type CloseButtonOpts = {
  /** Kantenlänge des ungedrehten Quadrats. */
  size?: number;
  /** Funkenstoß beim Klick. */
  sparks?: boolean;
  aria?: string;
  onClick?: () => void;
};

export class CloseButton {
  readonly root = new Container();
  private body = new Container();
  private aura: Sprite;
  private states: StateHandle;
  private field: ParticleField | null = null;
  private t = 0;

  constructor(o: CloseButtonOpts = {}) {
    const s = o.size ?? 24;
    const RED = ACCENT.destruction;

    this.aura = makeGlow(RED, s * 2.4, s * 2.4, 0.28);
    this.aura.x = this.aura.y = -s * 0.7;
    this.body.addChild(this.aura);

    const g = new Graphics();
    // harter Sitz
    g.rect(0, 3, s, s).fill({ color: 0x1a0307, alpha: 0.9 });
    // drei Bänder
    g.rect(0, 0, s, s).fill(shade(RED, 0.55));
    g.rect(1.5, 1.5, s - 3, s - 3).fill(shade(RED, 0.1));
    g.rect(3, 3, s - 6, s - 6).fill(shade(RED, -0.32));
    // Specular oben, Schattenkante unten
    g.rect(3.5, 3, s - 7, 1).fill({ color: 0xffe4e8, alpha: 0.8 });
    g.rect(3, s - 4, s - 6, 1).fill({ color: 0x000000, alpha: 0.6 });
    g.eventMode = "none";
    this.body.addChild(g);

    const x = makeGlyph("✕", Math.round(s * 0.42), 0xfff2f3);
    x.anchor.set(0.5);
    x.x = s / 2; x.y = s / 2;
    x.rotation = -Math.PI / 4;
    x.eventMode = "none";
    this.body.addChild(x);

    this.body.pivot.set(s / 2, s / 2);
    this.body.x = s / 2;
    this.body.y = s / 2;
    this.body.rotation = Math.PI / 4;
    this.root.addChild(this.body);

    if (o.sparks !== false) {
      this.field = new ParticleField({ accent: RED, max: 60, density: 1 });
      this.root.addChild(this.field.container);
    }

    this.states = attachStates(this.body, {
      accent: RED,
      aura: this.aura,
      auraBase: 0.28,
      scaleHover: 1.08,
      scalePress: 0.92,
      lift: 0,
      sink: 0,
      flash: false,
      size: { w: s, h: s },
      aria: o.aria ?? "Close",
      onClick: () => {
        this.field?.burst(s / 2, s / 2, 14);
        o.onClick?.();
      },
    });
  }

  update(dt: number): void {
    this.t += dt;
    this.states.update(dt);
    this.field?.update(dt);
  }

  destroy(): void {
    this.states.destroy();
    this.field?.destroy();
    this.root.destroy({ children: true });
  }
}

export const mount = (o: CloseButtonOpts = {}): CloseButton => new CloseButton(o);
export default mount;
