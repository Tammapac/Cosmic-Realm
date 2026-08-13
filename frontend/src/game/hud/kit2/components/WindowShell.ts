// Fensterhülle: Rahmen, Kopfzeile, Portal-Animation und Schließer in einem.
//
// Jedes Fenster im Kit sitzt darin. Die Hülle liefert die Inhaltsfläche unter
// der Kopfzeile, verwaltet die Öffnungs- und Schließanimation und ruft onClosed,
// wenn das Portal fertig zugelaufen ist.
//
//   const shell = new WindowShell({ w: 1020, h: 592, accent: ACCENT.action,
//     title: "Inventory", note: "24 sockets per page", onClosed });
//   shell.body.addChild(meineInhalte);
//   app.ticker.add((t) => shell.update(t.deltaMS / 1000));

import { Container, Graphics, Sprite } from "pixi.js";
import { PanelFrame } from "./PanelFrame";
import { PrintPortal } from "./PrintPortal";
import { CloseButton } from "./CloseButton";
import { label as makeLabel, display } from "../core/typography";
import { shade } from "../core/color";
import { makeGlow } from "../core/shadows";
import { CHAMFER, MOTION, SIZE } from "../core/tokens";
import type { Cuts } from "../core/geometry";

export const HEADER_H = 38;

export type WindowShellOpts = {
  w: number;
  h: number;
  accent: string | number;
  title: string;
  /** Kurze Erklärzeile neben dem Titel. */
  note?: string;
  /** Marke rechts im Kopf, z. B. "NO CLAN" oder "7 ACTIVE". */
  badge?: { text: string; accent?: string | number };
  chamfer?: number;
  cuts?: Cuts;
  /** Öffnungsdauer in Sekunden. */
  duration?: number;
  /** Sofort öffnen. Standard true. */
  autoplay?: boolean;
  /** Energieverzerrung auf dem Strahlkern. */
  distort?: boolean;
  onOpened?: () => void;
  onClosed?: () => void;
};

export class WindowShell {
  readonly root = new Container();
  /** Inhaltsfläche unter der Kopfzeile. */
  readonly body = new Container();
  readonly bodyW: number;
  readonly bodyH: number;
  readonly frame: PanelFrame;
  readonly portal: PrintPortal;

  private closer: CloseButton;
  private headGlow: Sprite;
  private t = 0;

  constructor(o: WindowShellOpts) {
    const ch = o.chamfer ?? CHAMFER.panel;
    this.frame = new PanelFrame({
      w: o.w, h: o.h, accent: o.accent, chamfer: ch, cuts: o.cuts,
    });
    this.root.addChild(this.frame.root);

    // Kopfzeile: Diamant, Titel, Notiz, Marke, Schließer
    const head = new Container();
    const hg = new Graphics();
    hg.poly([0, 3.5, 3.5, 0, 7, 3.5, 3.5, 7]).fill(o.accent);
    hg.rect(0, HEADER_H - 10, this.frame.inner.w - 30, 1)
      .fill({ color: 0x000000, alpha: 0.55 });
    hg.rect(0, HEADER_H - 9, this.frame.inner.w - 30, 1)
      .fill({ color: o.accent, alpha: 0.16 });
    hg.eventMode = "none";
    head.addChild(hg);

    this.headGlow = makeGlow(o.accent, 18, 18, 0.7);
    this.headGlow.x = -5.5;
    this.headGlow.y = -5.5;
    head.addChildAt(this.headGlow, 0);

    const title = display(o.title.toUpperCase(), SIZE.lead, shade(o.accent, 0.75), 3);
    title.x = 14;
    title.y = -2;
    head.addChild(title);

    let cursor = title.x + title.width + 14;
    if (o.note) {
      const note = makeLabel(o.note, 8.5, 0xa8bdd6, 1.6);
      note.x = cursor;
      note.y = 1;
      head.addChild(note);
      cursor += note.width + 14;
    }
    if (o.badge) {
      const bc = o.badge.accent ?? o.accent;
      const bl = makeLabel(o.badge.text, 7, shade(bc, 0.5), 1.8);
      const bw = bl.width + 16;
      const bg = new Graphics();
      bg.rect(cursor, -2, bw, 16).fill({ color: shade(bc, -0.6), alpha: 0.6 });
      bg.rect(cursor, -2, 2, 16).fill({ color: bc, alpha: 0.9 });
      bg.eventMode = "none";
      head.addChild(bg);
      bl.x = cursor + 9;
      bl.y = 2;
      head.addChild(bl);
    }

    this.portal = new PrintPortal({
      w: o.w, h: o.h, accent: o.accent, chamfer: ch,
      duration: o.duration, distort: o.distort,
      onOpened: o.onOpened, onClosed: o.onClosed,
    });

    this.closer = new CloseButton({ size: 24, onClick: () => this.close() });
    this.closer.root.x = this.frame.inner.w - 44;
    this.closer.root.y = -3;
    head.addChild(this.closer.root);

    head.x = 14;
    head.y = 12;
    this.frame.content.addChild(head);

    this.body.x = 14;
    this.body.y = 12 + HEADER_H;
    this.frame.content.addChild(this.body);

    this.bodyW = this.frame.inner.w - 28;
    this.bodyH = this.frame.inner.h - HEADER_H - 20;

    // Portal maskiert den Rahmen, damit sich das Fenster wirklich aufdruckt
    this.root.addChild(this.portal.reveal);
    this.frame.root.mask = this.portal.reveal;
    this.root.addChild(this.portal.root);

    if (o.autoplay !== false) this.portal.play();
  }

  /** Öffnungsanimation von vorn starten. */
  open(): void { this.portal.play(); }

  /** Schließen mit rückwärts laufender Animation. */
  close(): void { this.portal.close(); }

  get isClosing(): boolean { return this.portal.isClosing; }

  update(dt: number): void {
    this.t += dt;
    this.frame.update(dt);
    this.portal.update(dt);
    this.closer.update(dt);
    this.headGlow.alpha = 0.6 + Math.sin(this.t * 2.2) * 0.2;
    void MOTION;
  }

  destroy(): void {
    this.closer.destroy();
    this.portal.destroy();
    this.frame.destroy();
    this.root.destroy({ children: true });
  }
}

export const mount = (o: WindowShellOpts): WindowShell => new WindowShell(o);
export default mount;
