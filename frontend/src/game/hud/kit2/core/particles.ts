// Partikelsystem. Ein Pool, ein ParticleContainer, ein Update — alles, was im
// Interface funkt, sprüht oder glitzert, läuft hier durch.
//
// Vier Emitterarten aus Cosmic Kit:
//   micro    allseitige Mikrofunken direkt am Lichtstrahl
//   rise     Aufsteiger wie Feuer
//   plume    hohe, langlebige Fahnen
//   drip     Abtropfer nach unten
// Dazu sparkle (Raritätsglitzer) und burst (Klick- und Trefferstoß).
//
// Die Partikel hängen NICHT am Emitter: sie bleiben, wo sie entstanden sind,
// und verglühen dort. Deshalb zieht der fallende Lichtstrahl eine Spur aus Glut
// statt einen mitgeschleppten Schweif.

import { Container, Sprite, Texture } from "pixi.js";
import { sparkTexture } from "./textures";

export type ParticleKind = "micro" | "rise" | "plume" | "drip" | "sparkle" | "burst";

type P = {
  sp: Sprite;
  x: number; y: number;
  vx: number; vy: number;
  /** Grundradius. */
  r: number;
  /** Höhen-Streckung, macht aus Punkten Striche. */
  stretch: number;
  /** Fallbeschleunigung. */
  gravity: number;
  /** Reibung pro Sekunde. */
  drag: number;
  /** Drehung pro Sekunde. */
  spin: number;
  age: number;
  life: number;
  live: boolean;
};

export type EmitterConfig = {
  /** Partikel pro Sekunde. */
  rate: number;
  kind: ParticleKind;
};

/** Voreinstellungen: die Zahlen aus dem Prototyp. */
export const EMITTER_PRESETS: Record<ParticleKind, EmitterConfig> = {
  micro: { rate: 1400, kind: "micro" },
  rise: { rate: 380, kind: "rise" },
  plume: { rate: 170, kind: "plume" },
  drip: { rate: 130, kind: "drip" },
  sparkle: { rate: 14, kind: "sparkle" },
  burst: { rate: 0, kind: "burst" },
};

export type ParticleFieldOpts = {
  accent: string | number;
  /** Obergrenze lebender Partikel. Bei Überschreitung wird nicht mehr erzeugt. */
  max?: number;
  /** Emissionsdichte skalieren — breite Panels sprühen mehr. */
  density?: number;
  /** Eigene Textur statt des Funkenkorns. */
  texture?: Texture;
};

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

/**
 * Ein Partikelfeld. Container in die Szene hängen, update() pro Frame rufen,
 * emit() so oft wie nötig.
 */
export class ParticleField {
  readonly container: Container;

  private pool: P[] = [];
  private live: P[] = [];
  private free: Sprite[] = [];
  private carry: Record<string, number> = {};
  private tex: Texture;
  private max: number;
  private density: number;

  constructor(o: ParticleFieldOpts) {
    this.container = new Container();
    this.container.eventMode = "none";
    this.tex = o.texture ?? sparkTexture(o.accent);
    this.max = o.max ?? 1100;
    this.density = o.density ?? 1;
  }

  get count(): number { return this.live.length; }

  /** Emissionsdichte ändern — z. B. nach Panelbreite. */
  setDensity(d: number): void { this.density = d; }

  private take(): Sprite {
    const sp = this.free.pop() ?? new Sprite(this.tex);
    sp.anchor.set(0.5);
    sp.blendMode = "add";
    sp.visible = true;
    sp.rotation = 0;
    this.container.addChild(sp);
    return sp;
  }

  private give(sp: Sprite): void {
    sp.visible = false;
    this.container.removeChild(sp);
    if (this.free.length < 512) this.free.push(sp);
  }

  private push(p: Omit<P, "sp" | "age" | "live">): void {
    if (this.live.length >= this.max) return;
    const rec = this.pool.pop() ?? ({} as P);
    Object.assign(rec, p, { sp: this.take(), age: 0, live: true });
    this.live.push(rec);
  }

  /** Ein einzelnes Partikel der gegebenen Art an (x, y). */
  spawn(kind: ParticleKind, x: number, y: number): void {
    switch (kind) {
      case "micro": {
        const a = Math.random() * Math.PI * 2, sp = rnd(20, 80);
        this.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: rnd(0.7, 1.7), stretch: 1, gravity: 0, drag: 0, spin: 0, life: rnd(0.26, 0.6) });
        break;
      }
      case "rise":
        this.push({ x, y, vx: rnd(-16, 16), vy: rnd(-95, -45),
          r: rnd(1.3, 2.6), stretch: 1.9, gravity: 30, drag: 0.2, spin: 0, life: rnd(0.5, 0.95) });
        break;
      case "plume":
        this.push({ x, y, vx: rnd(-12, 12), vy: rnd(-160, -75),
          r: rnd(1, 2), stretch: 1.7, gravity: 5, drag: 0.1, spin: 0, life: rnd(1.4, 2.2) });
        break;
      case "drip":
        this.push({ x, y, vx: rnd(-12, 12), vy: rnd(25, 75),
          r: rnd(1, 1.9), stretch: 1.5, gravity: 45, drag: 0, spin: 0, life: rnd(0.4, 0.8) });
        break;
      case "sparkle":
        this.push({ x: x + rnd(-1, 1), y: y + rnd(-1, 1), vx: rnd(-8, 8), vy: rnd(-14, -4),
          r: rnd(0.8, 1.8), stretch: 1, gravity: -4, drag: 0.6, spin: rnd(-3, 3), life: rnd(0.7, 1.4) });
        break;
      case "burst": {
        const a = Math.random() * Math.PI * 2, sp = rnd(70, 200);
        this.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: rnd(1, 2.4), stretch: 1.3, gravity: 60, drag: 2.2, spin: 0, life: rnd(0.3, 0.62) });
        break;
      }
    }
  }

  /**
   * Über die Zeit emittieren. rate wird mit Dichte und dt verrechnet, der
   * Bruchteil wird gesammelt, damit auch 0,3 Partikel pro Frame ankommen.
   */
  emit(kind: ParticleKind, dt: number, spread: () => [number, number], rate?: number): void {
    const r = (rate ?? EMITTER_PRESETS[kind].rate) * this.density * dt;
    const key = kind;
    this.carry[key] = (this.carry[key] ?? 0) + r;
    while (this.carry[key] >= 1) {
      this.carry[key] -= 1;
      const [x, y] = spread();
      this.spawn(kind, x, y);
    }
  }

  /** Sofortiger Stoß — Klick, Treffer, Levelaufstieg. */
  burst(x: number, y: number, n = 24, kind: ParticleKind = "burst"): void {
    for (let i = 0; i < n; i++) this.spawn(kind, x, y);
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const q = this.live[i];
      q.age += dt;
      if (q.age >= q.life) {
        this.give(q.sp);
        q.live = false;
        this.live[i] = this.live[this.live.length - 1];
        this.live.pop();
        this.pool.push(q);
        continue;
      }
      if (q.drag) {
        const k = Math.max(0, 1 - q.drag * dt);
        q.vx *= k; q.vy *= k;
      }
      q.vy += q.gravity * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const f = q.age / q.life;
      const w = q.r * 4.2;
      q.sp.x = q.x;
      q.sp.y = q.y;
      q.sp.width = w;
      q.sp.height = w * q.stretch;
      if (q.spin) q.sp.rotation += q.spin * dt;
      q.sp.alpha = f < 0.12 ? f / 0.12 : 1 - (f - 0.12) / 0.88;
    }
  }

  /** Alle lebenden Partikel sofort entfernen. */
  clear(): void {
    for (const q of this.live) { this.give(q.sp); this.pool.push(q); }
    this.live.length = 0;
    this.carry = {};
  }

  destroy(): void {
    this.clear();
    for (const sp of this.free) sp.destroy();
    this.free.length = 0;
    this.container.destroy({ children: true });
  }
}
