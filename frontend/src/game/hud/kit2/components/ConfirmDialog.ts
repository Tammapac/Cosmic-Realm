// P-05 Bestätigungsdialog.
//
// Abdunkelnder Vorhang, darüber die Karte im Rahmenbau: fünf Bänder in der
// Warnfarbe, versenkte Fläche, Titel, Text und zwei Knöpfe. Der linke Knopf ist
// unten links gefast, der rechte unten rechts — die Fasen zeigen nach außen wie
// die Ecken des Panelrahmens. Auffahren in 180 ms von 0,96 aus.

import { Container, Graphics, Sprite } from "pixi.js";
import { cut } from "../core/geometry";
import { shade, rgba } from "../core/color";
import { radialTexture } from "../core/textures";
import { addShadowStack } from "../core/shadows";
import { label as makeLabel, body as makeBody } from "../core/typography";
import { Button } from "./Button";
import { ACCENT, CHAMFER, MOTION, SIZE, type AccentKey } from "../core/tokens";
import { easeOutCubic } from "../core/easing";

export type ConfirmDialogOpts = {
  w?: number;
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Warnfarbe des Rahmens. */
  tone?: AccentKey;
  accent?: string | number;
  /** Klick auf den Vorhang bricht ab. */
  dismissOnVeil?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export class ConfirmDialog {
  readonly root = new Container();
  readonly size: { w: number; h: number };

  private box = new Container();
  private confirm: Button;
  private cancel: Button;
  private appear = 0;
  private h: number;

  constructor(o: ConfirmDialogOpts) {
    const w = o.w ?? 380;
    const accent = o.accent ?? ACCENT[o.tone ?? "destruction"];

    // Vorhang
    const veil = new Graphics();
    veil.rect(-4000, -4000, 12000, 12000).fill({ color: 0x02040a, alpha: 0.72 });
    veil.eventMode = "static";
    if (o.dismissOnVeil !== false) veil.on("pointerup", () => o.onCancel());
    this.root.addChild(veil);

    const body = makeBody(o.text, SIZE.body, 0xd8e6f6, w - 48);
    const h = 96 + body.height + 20;
    this.h = h;
    this.size = { w, h };

    addShadowStack(this.box, w, h, CHAMFER.dialog, "tr-bl", 1);

    const rim = new Graphics();
    const ladder: [number, number, number][] = [
      [0, 0.5, 22], [2, -0.08, 21], [4, -0.48, 20], [6, -0.7, 19], [8, -0.86, 18],
    ];
    for (const [i, tone, ch] of ladder) {
      cut(rim, i, i, w - i * 2, h - i * 2, ch, shade(accent, tone), 1, "tr-bl");
    }
    rim.eventMode = "none";
    this.box.addChild(rim);

    const face = new Graphics();
    cut(face, 10, 10, w - 20, h - 20, 17, 0x0b0f16, 1, "tr-bl");
    face.rect(18, 10, w - 36, 1).fill({ color: shade(accent, 0.75), alpha: 0.6 });
    face.rect(14, h - 12, w - 28, 2).fill({ color: accent, alpha: 0.4 });
    face.eventMode = "none";
    this.box.addChild(face);

    const wash = new Sprite(radialTexture([[0, rgba(accent, 0.14)], [0.74, "rgba(0,0,0,0)"]]));
    wash.width = w; wash.height = h * 0.6; wash.y = 6;
    wash.eventMode = "none";
    this.box.addChild(wash);

    const t = makeLabel(o.title.toUpperCase(), 10, shade(accent, 0.72), 3);
    t.x = 24; t.y = 24;
    this.box.addChild(t);
    body.x = 24; body.y = 48;
    this.box.addChild(body);

    // Fasen zeigen nach außen: links TL+BR, rechts TR+BL
    const bw = (w - 60) / 2;
    this.cancel = new Button({
      w: bw, h: 34, label: o.cancelLabel ?? "CANCEL", tone: "steel",
      cuts: "tl-br", onClick: o.onCancel,
    });
    this.cancel.root.x = 24;
    this.cancel.root.y = h - 52;
    this.confirm = new Button({
      w: bw, h: 34, label: o.confirmLabel, accent,
      cuts: "tr-bl", sweep: true, onClick: o.onConfirm,
    });
    this.confirm.root.x = 36 + bw;
    this.confirm.root.y = h - 52;
    this.box.addChild(this.cancel.root, this.confirm.root);

    this.box.pivot.set(w / 2, h / 2);
    this.box.x = w / 2;
    this.box.y = h / 2 + 8;
    this.box.scale.set(0.96);
    this.box.alpha = 0;
    this.root.addChild(this.box);
  }

  update(dt: number): void {
    if (this.appear < 1) {
      this.appear = Math.min(1, this.appear + dt / MOTION.dialog);
      const e = easeOutCubic(this.appear);
      this.box.alpha = e;
      this.box.scale.set(0.96 + e * 0.04);
      this.box.y = this.h / 2 + 8 - e * 8;
    }
    this.confirm.update(dt);
    this.cancel.update(dt);
  }

  destroy(): void {
    this.confirm.destroy();
    this.cancel.destroy();
    this.root.destroy({ children: true });
  }
}

export const mount = (o: ConfirmDialogOpts): ConfirmDialog => new ConfirmDialog(o);
export default mount;
