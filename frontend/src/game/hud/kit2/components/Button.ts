// C-01 Aktionsknopf. Alle sieben Zustände, gebauter Rahmen, Sheen-Sweep.
//
// Aufbau:
//   Schattenstapel · Metallkante · zwei Mittelbänder · versenkte Fläche
//   Specular-Linie oben · Akzent-Unterlicht unten · Aura · Label
//
// Hover hebt 2 px und hellt auf, Press sinkt 2 px, Klick blitzt, gesperrt
// entsättigt. Der Glanzstreifen läuft im Shader, nicht als Sprite.

import { Container, Graphics, Sprite } from "pixi.js";
import { cut, type Cuts } from "../core/geometry";
import { shade, rgba } from "../core/color";
import { gradientTexture } from "../core/textures";
import { makeGlow } from "../core/shadows";
import { label as makeLabel } from "../core/typography";
import { attachStates, type StateHandle, type VisualState } from "../core/states";
import { ACCENT, CHAMFER, SIZE, type AccentKey } from "../core/tokens";
import { ShineSweepFilter } from "../core/filters";

export type ButtonOpts = {
  w: number;
  h: number;
  label: string;
  /** Bedeutung bestimmt die Farbe. */
  tone?: AccentKey;
  /** Überschreibt die Tonfarbe. */
  accent?: string | number;
  chamfer?: number;
  /** Knöpfe schneiden TL + BR, Dialogknöpfe zeigen nach außen. */
  cuts?: Cuts;
  fontSize?: number;
  /** Wandernder Glanzstreifen — für den Hauptknopf eines Panels. */
  sweep?: boolean;
  /** Glyphe vor dem Text. */
  glyph?: string;
  enabled?: boolean;
  selected?: boolean;
  /** Vorlesetext; ohne Angabe wird das Label benutzt. */
  aria?: string;
  onClick?: () => void;
  onStateChange?: (s: VisualState) => void;
};

export class Button {
  readonly root = new Container();
  private body = new Container();
  private labelText;
  private states: StateHandle;
  private shine: ShineSweepFilter | null = null;
  private aura: Sprite;
  private t = 0;
  private accent: number;
  private o: ButtonOpts;

  constructor(o: ButtonOpts) {
    this.o = o;
    this.accent = typeof (o.accent ?? ACCENT[o.tone ?? "steel"]) === "number"
      ? (o.accent ?? ACCENT[o.tone ?? "steel"]) as number
      : ACCENT.steel;
    const accent = this.accent;
    const ch = o.chamfer ?? CHAMFER.button;
    const cuts = o.cuts ?? "tl-br";

    // Schattenstapel: harter Sitz + Kontakt
    const sh = new Graphics();
    cut(sh, 0, 3, o.w, o.h, ch, 0x03050a, 0.9, cuts);
    cut(sh, -1, 6, o.w + 2, o.h, ch, 0x000000, 0.45, cuts);
    sh.eventMode = "none";
    this.body.addChild(sh);

    // Kante + zwei Mittelbänder
    const rim = new Graphics();
    cut(rim, 0, 0, o.w, o.h, ch, shade(accent, 0.5), 1, cuts);
    cut(rim, 1.5, 1.5, o.w - 3, o.h - 3, ch - 1, shade(accent, -0.34), 1, cuts);
    cut(rim, 3, 3, o.w - 6, o.h - 6, ch - 2, shade(accent, -0.72), 1, cuts);
    rim.eventMode = "none";
    this.body.addChild(rim);

    // Versenkte Fläche
    const face = new Sprite(gradientTexture([
      [0, rgba(shade(accent, -0.42), 1)],
      [1, rgba(shade(accent, -0.86), 1)],
    ]));
    face.x = 3; face.y = 3;
    face.width = o.w - 6; face.height = o.h - 6;
    face.eventMode = "none";
    this.body.addChild(face);

    // Specular oben, Akzent-Unterlicht unten
    const lines = new Graphics();
    lines.rect(6, 3, o.w - 12, 1).fill({ color: shade(accent, 0.8), alpha: 0.7 });
    lines.rect(4, o.h - 5, o.w - 8, 2).fill({ color: accent, alpha: 0.8 });
    lines.eventMode = "none";
    this.body.addChild(lines);

    if (o.sweep) {
      this.shine = new ShineSweepFilter(0.14, 0.3, [1, 0.95, 1]);
      face.filters = [this.shine];
    }

    // Label mit optionaler Glyphe
    this.labelText = makeLabel(o.label, o.fontSize ?? SIZE.label, shade(accent, 0.82), 2.2);
    this.labelText.anchor.set(0.5);
    this.labelText.x = o.w / 2;
    this.labelText.y = o.h / 2;
    this.body.addChild(this.labelText);
    if (o.glyph) {
      const g = makeLabel(o.glyph, (o.fontSize ?? SIZE.label) + 2, shade(accent, 0.85), 0);
      g.anchor.set(1, 0.5);
      g.x = o.w / 2 - this.labelText.width / 2 - 7;
      g.y = o.h / 2;
      this.body.addChild(g);
    }

    this.aura = makeGlow(accent, o.w * 1.24, o.h * 1.8, 0.22);
    this.aura.x = -o.w * 0.12;
    this.aura.y = -o.h * 0.4;
    this.body.addChildAt(this.aura, 0);

    this.root.addChild(this.body);
    this.states = attachStates(this.body, {
      accent,
      aura: this.aura,
      auraBase: 0.2,
      enabled: o.enabled,
      selected: o.selected,
      size: { w: o.w, h: o.h },
      focusRing: true,
      aria: o.aria ?? o.label,
      onClick: o.onClick,
      onStateChange: o.onStateChange,
    });
  }

  update(dt: number): void {
    this.t += dt;
    this.states.update(dt);
    if (this.shine) this.shine.time = this.t;
  }

  setLabel(text: string): void { this.labelText.text = text; }
  setEnabled(on: boolean): void {
    this.states.setEnabled(on);
    if (this.shine) this.shine.enabled = on;
  }
  setSelected(on: boolean): void { this.states.setSelected(on); }
  get state(): VisualState { return this.states.state; }
  get width(): number { return this.o.w; }
  get height(): number { return this.o.h; }

  destroy(): void {
    this.states.destroy();
    this.root.destroy({ children: true });
  }
}

export const mount = (o: ButtonOpts): Button => new Button(o);
export default mount;
