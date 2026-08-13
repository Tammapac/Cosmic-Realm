// Beschleunigungskurven. Die CSS-Kurven aus Cosmic Kit als Funktionen, damit
// Pixi dieselbe Bewegung fährt wie der Prototyp.

/** Eine cubic-bezier(x1,y1,x2,y2) mit Binärsuche auf x auflösen. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bx = (u: number): number => {
    const v = 1 - u;
    return 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u;
  };
  const by = (u: number): number => {
    const v = 1 - u;
    return 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u;
  };
  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0, hi = 1, u = t;
    for (let i = 0; i < 12; i++) {
      u = (lo + hi) / 2;
      if (bx(u) < t) lo = u; else hi = u;
    }
    return by(u);
  };
}

/** cubic-bezier(.2,.9,.25,1) — Hover, Press, Karten. */
export const easeUi = cubicBezier(0.2, 0.9, 0.25, 1);

/** cubic-bezier(.28,.62,.28,1) — der Portal-Lichtstrahl. */
export const easePortal = cubicBezier(0.28, 0.62, 0.28, 1);

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeInOutQuad = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** Sinuswelle für Pulsieren: 0 … 1 … 0. */
export const pulse = (t: number, hz = 1): number => 0.5 + Math.sin(t * hz * Math.PI * 2) * 0.5;

/** Weicher Nachlauf, framerate-unabhängig. */
export const approach = (cur: number, target: number, dt: number, tau: number): number =>
  cur + (target - cur) * Math.min(1, dt / Math.max(0.0001, tau));

/** Kurzer Wert-Tween auf dem Ticker. */
export class Tween {
  private t = 0;
  private running = false;
  constructor(
    private from: number,
    private to: number,
    private dur: number,
    private ease: (t: number) => number,
    private onStep: (v: number) => void,
    private onDone?: () => void,
  ) {}

  start(): this { this.t = 0; this.running = true; return this; }

  retarget(to: number, dur = this.dur): this {
    this.from = this.value;
    this.to = to;
    this.dur = dur;
    this.t = 0;
    this.running = true;
    return this;
  }

  get value(): number {
    const p = this.dur <= 0 ? 1 : Math.min(1, this.t / this.dur);
    return this.from + (this.to - this.from) * this.ease(p);
  }

  update(dt: number): void {
    if (!this.running) return;
    this.t += dt;
    this.onStep(this.value);
    if (this.t >= this.dur) { this.running = false; this.onDone?.(); }
  }

  get done(): boolean { return !this.running; }
}
