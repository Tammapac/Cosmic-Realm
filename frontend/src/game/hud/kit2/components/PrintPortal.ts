// E-01 Print Portal. Der Öffner jedes Fensters.
//
// Zwei Lichtstrahlen: einer klappt auf der Oberkante von innen nach außen auf,
// der zweite fährt nach unten und druckt das Fenster dabei auf — wie ein
// 3D-Drucker. Am fallenden Strahl sprüht die Funken-Engine in alle Richtungen;
// die Funken bleiben liegen, wo sie entstanden sind, und verglühen dort. Von
// oben nach unten entsteht so eine Spur aus Glut, kein mitgeschleppter Schweif.
//
// Schließen läuft rückwärts: der untere Strahl steigt mit der Panelkante,
// danach schnappt der obere in die Mitte und löst sich in Licht auf.
//
// Emissionsraten wie im Prototyp: 1400 Mikrofunken, 380 Aufsteiger, 170 hohe
// Fahnen, 130 Abtropfer pro Sekunde, mit der Panelbreite skaliert.

import { Container, Graphics, Sprite } from "pixi.js";
import { shade, rgba } from "../core/color";
import { gradientTexture, radialTexture } from "../core/textures";
import { easePortal, easeOutCubic } from "../core/easing";
import { ParticleField } from "../core/particles";
import { CHAMFER, MOTION } from "../core/tokens";
import { EnergyDistortFilter } from "../core/filters";

export type PrintPortalOpts = {
  w: number;
  h: number;
  accent: string | number;
  /** Außenfase des Panels — der obere Strahl endet an der Schräge. */
  chamfer?: number;
  /** Volle Öffnung in Sekunden. */
  duration?: number;
  /** Energieverzerrung auf dem Strahlkern. */
  distort?: boolean;
  onOpened?: () => void;
  onClosed?: () => void;
};

export class PrintPortal {
  /** Lichtebene — über das Panel legen. */
  readonly root = new Container();
  /** Als Maske auf den Panelinhalt setzen: panel.mask = portal.reveal. */
  readonly reveal = new Graphics();

  private w: number;
  private h: number;
  private accent: string | number;
  private ch: number;
  private dur: number;
  private onOpened?: () => void;
  private onClosed?: () => void;

  private topRail: Container;
  private beam: Container;
  private railOrbL: Sprite;
  private railOrbR: Sprite;
  private beamOrbL: Sprite;
  private beamOrbR: Sprite;
  private heat: Sprite;
  private field: ParticleField;
  private distort: EnergyDistortFilter | null = null;

  private dir: 1 | -1 = 1;
  private t = 0;
  private running = false;
  private firedOpen = false;
  private firedClose = false;

  constructor(o: PrintPortalOpts) {
    this.w = o.w;
    this.h = o.h;
    this.accent = o.accent;
    this.ch = o.chamfer ?? CHAMFER.panel;
    this.dur = (o.duration ?? MOTION.portal) * 1000;
    this.onOpened = o.onOpened;
    this.onClosed = o.onClosed;

    this.field = new ParticleField({
      accent: this.accent,
      max: 1100,
      density: Math.max(0.35, Math.min(1.6, this.w / 720)),
    });

    // Wärmeschein, der beim Drucken über die Fläche liegt
    this.heat = new Sprite(radialTexture([
      [0, rgba(shade(this.accent, 0.4), 0.45)],
      [0.72, "rgba(0,0,0,0)"],
    ]));
    this.heat.width = this.w * 1.4;
    this.heat.height = this.h * 0.7;
    this.heat.x = -this.w * 0.2;
    this.heat.blendMode = "add";
    this.heat.alpha = 0;
    this.heat.eventMode = "none";
    this.root.addChild(this.heat);

    this.topRail = this.buildBeam(true, !!o.distort);
    this.beam = this.buildBeam(false, !!o.distort);
    this.railOrbL = this.makeOrb();
    this.railOrbR = this.makeOrb();
    this.beamOrbL = this.makeOrb();
    this.beamOrbR = this.makeOrb();

    this.root.addChild(
      this.topRail, this.beam, this.field.container,
      this.railOrbL, this.railOrbR, this.beamOrbL, this.beamOrbR,
    );
    this.root.eventMode = "none";

    this.frame(0, 14, 0.05, 1);
  }

  /** Lichtkugel an einem Strahlende. */
  private makeOrb(): Sprite {
    const sp = new Sprite(radialTexture([
      [0, "rgba(255,255,255,.95)"],
      [0.12, rgba(shade(this.accent, 0.8), 0.6)],
      [0.3, rgba(this.accent, 0.28)],
      [0.55, rgba(this.accent, 0.08)],
      [1, rgba(this.accent, 0)],
    ], 64));
    sp.width = sp.height = 30;
    sp.anchor.set(0.5);
    sp.blendMode = "add";
    sp.eventMode = "none";
    return sp;
  }

  /** Ein Strahl: Lichtwurf ins Panel, Halo, Kernlinie, Chroma-Enden. */
  private buildBeam(up: boolean, distort: boolean): Container {
    const c = new Container();
    const A = (a: number): string => rgba(this.accent, a);
    const L = (t: number, a: number): string => rgba(shade(this.accent, t), a);

    // Lichtwurf in die Fläche, an der Fase beschnitten
    const washStops: [number, string][] = up
      ? [[0, L(0.85, 0.2)], [0.3, L(0.4, 0.06)], [0.62, A(0.015)], [1, "rgba(0,0,0,0)"]]
      : [[0, "rgba(0,0,0,0)"], [0.38, A(0.015)], [0.7, L(0.4, 0.06)], [1, L(0.85, 0.2)]];
    const wash = new Sprite(gradientTexture(washStops));
    wash.width = this.w;
    wash.height = 84;
    wash.y = up ? 0 : -84;
    wash.blendMode = "add";
    c.addChild(wash);

    const halo = new Sprite(gradientTexture([
      [0, "rgba(0,0,0,0)"], [0.1, A(0.75)], [0.5, L(0.8, 0.95)],
      [0.9, A(0.75)], [1, "rgba(0,0,0,0)"],
    ], false, 256));
    halo.width = this.w; halo.height = 9; halo.y = -4.5;
    halo.blendMode = "add";
    c.addChild(halo);

    const core = new Sprite(gradientTexture([
      [0, "rgba(0,0,0,0)"], [0.06, L(0.55, 1)], [0.28, "#ffffff"],
      [0.72, "#ffffff"], [0.94, L(0.55, 1)], [1, "rgba(0,0,0,0)"],
    ], false, 256));
    core.width = this.w; core.height = 2; core.y = -1;
    core.blendMode = "add";
    c.addChild(core);
    if (distort && !up) {
      this.distort = new EnergyDistortFilter(0.05, 34, 2.2);
      core.filters = [this.distort];
    }

    // Chroma an den Enden — Prismenaufspaltung
    const chroma = new Sprite(gradientTexture([
      [0, "rgba(0,0,0,0)"], [0.08, "rgba(255,120,220,.5)"], [0.22, "rgba(0,0,0,0)"],
      [0.78, "rgba(0,0,0,0)"], [0.92, "rgba(120,255,220,.5)"], [1, "rgba(0,0,0,0)"],
    ], false, 256));
    chroma.width = this.w; chroma.height = 3; chroma.y = -1.5;
    chroma.blendMode = "add";
    chroma.alpha = 0.7;
    c.addChild(chroma);

    c.pivot.x = this.w / 2;
    c.x = this.w / 2;
    c.eventMode = "none";
    return c;
  }

  /** Öffnen starten. */
  play(): void {
    this.dir = 1;
    this.t = 0;
    this.running = true;
    this.firedOpen = false;
    this.firedClose = false;
    this.root.visible = true;
    this.root.alpha = 1;
    this.field.clear();
  }

  /** Schließen starten — läuft die Animation rückwärts. */
  close(): void {
    if (this.dir === -1) return;
    this.dir = -1;
    this.t = 0;
    this.running = true;
    this.firedClose = false;
  }

  get isClosing(): boolean { return this.dir === -1; }
  get isRunning(): boolean { return this.running; }

  update(dt: number): void {
    if (!this.running && this.field.count === 0) return;
    this.t += dt * 1000;
    if (this.distort) this.distort.time = this.t / 1000;

    const travel = this.dur * 0.92;
    const openMs = Math.min(this.dur * 0.34, 460);
    const p = easePortal(Math.min(1, this.t / travel));
    const inward = this.dir > 0;
    const line = (inward ? p : 1 - p) * this.h;

    const revealH = inward ? Math.max(14, line + 4) : Math.max(0, line + 4);
    const railScale = inward
      ? easeOutCubic(Math.min(1, this.t / openMs)) * 0.95 + 0.05
      : 1;
    this.frame(line, revealH, inward ? Math.max(0.34, p) : 1, railScale);

    if (inward) {
      const hp = Math.min(1, this.t / this.dur);
      this.heat.alpha = hp < 0.07 ? hp / 0.07 : Math.max(0, 1 - (hp - 0.07) / 0.93) * 0.9;
    } else this.heat.alpha = 0;

    // Funken solange der Strahl unterwegs ist — in beide Richtungen
    if (this.t < travel && this.running) {
      const w = this.w;
      const at = (inset: number) => (): [number, number] =>
        [inset + Math.random() * (w - inset * 2), line];
      this.field.emit("micro", dt, at(6));
      this.field.emit("rise", dt, at(4));
      this.field.emit("plume", dt, at(4));
      this.field.emit("drip", dt, at(4));
    }
    this.field.update(dt);

    if (inward && this.t >= this.dur && !this.firedOpen) {
      this.firedOpen = true;
      this.onOpened?.();
    }

    // Schlussschnappen: der obere Strahl zieht in die Mitte und verglüht
    if (!inward && this.t >= travel) {
      const snapMs = MOTION.portalSnap * 1000;
      const s = Math.min(1, (this.t - travel) / snapMs);
      const k = s < 0.52 ? 1 - s / 0.52 * 0.9
        : s < 0.78 ? 0.1 - (s - 0.52) / 0.26 * 0.07
          : 0.03 * (1 - (s - 0.78) / 0.22);
      this.topRail.scale.x = Math.max(0, k);
      this.topRail.alpha = s > 0.78 ? 1 - (s - 0.78) / 0.22 : 1;
      const half = this.w / 2;
      this.railOrbL.x = half - half * (1 - s);
      this.railOrbR.x = half + (this.w - this.ch - half) * (1 - s);
      this.railOrbL.alpha = this.railOrbR.alpha = 1 - s;
      this.root.alpha = s > 0.7 ? 1 - (s - 0.7) / 0.3 : 1;
      if (s >= 1 && !this.firedClose) {
        this.firedClose = true;
        this.running = false;
        this.root.visible = false;
        this.onClosed?.();
      }
    }

    if (inward && this.t > this.dur + 400 && this.field.count === 0) this.running = false;
  }

  /** Strahlposition, Reveal-Maske und Kugeln setzen. */
  private frame(line: number, revealH: number, beamScale: number, railScale: number): void {
    this.beam.y = line;
    this.beam.scale.x = beamScale;

    if (this.dir > 0) {
      this.topRail.scale.x = railScale;
      this.topRail.alpha = 0.45 + railScale * 0.55;
      this.root.alpha = 1;
    }

    // Kugeln sitzen auf den äußersten Rahmenecken, rechts vor der Fase
    const railT = this.dir > 0 ? railScale : 1;
    this.railOrbL.x = this.w / 2 - (this.w / 2) * railT;
    this.railOrbR.x = this.w / 2 + (this.w / 2 - this.ch) * railT;
    this.railOrbL.y = this.railOrbR.y = 0;
    this.beamOrbL.x = this.ch * (1 - beamScale);
    this.beamOrbR.x = this.w - this.ch * (1 - beamScale);
    this.beamOrbL.y = this.beamOrbR.y = line;

    this.reveal.clear();
    const hh = Math.max(0, Math.min(this.h + 90, revealH));
    this.reveal.rect(-90, -90, this.w + 180, hh + 90).fill(0xffffff);
  }

  destroy(): void {
    this.field.destroy();
    this.root.destroy({ children: true });
    this.reveal.destroy();
  }
}

export const mount = (o: PrintPortalOpts): PrintPortal => new PrintPortal(o);
export default mount;
