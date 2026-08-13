// ─────────────────────────────────────────────────────────────────────────────
// CombatLights — a pooled, self-expiring dynamic-light system for combat FX.
//
// Combat is the one place a PBR scene MUST light itself dynamically: a laser bolt
// should throw a red glow onto the hulls it passes, an explosion should flash the
// whole area orange, a hit should pop a brief white flash on the struck ship. All
// three are short-lived POINT lights that fade out and return to a pool — never a
// per-shot allocation (that would thrash GC and blow the light-uniform budget).
//
// Design:
//   • A fixed pool of THREE.PointLight (default 12). Spawning past the cap recycles
//     the oldest live light (combat is transient; a stolen light is invisible).
//   • Each live light carries {age, ttl, peak, decay} and is driven by update(dt):
//     intensity = peak * falloff(age/ttl). Dead lights go intensity 0, visible=false,
//     back to the free list.
//   • Colours/scales per event type are tuned to read on metal: laser red is a
//     small tight glow; explosion orange is large and bright; hit is a hot white
//     flash with a fast decay.
//
// Scene-agnostic: construct with the target scene; the lights illuminate whatever
// is in it (station, ships, enemies). The world layer and the hangar can each own
// one. Nothing here mutates materials or the environment.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from "three";

export type CombatLightKind = "laser" | "explosion" | "hit";

interface LiveLight {
  light: THREE.PointLight;
  age: number;
  ttl: number;
  peak: number;
  /** decay shape: "flash" = instant-on then ease out; "pulse" = ease in+out. */
  shape: "flash" | "pulse";
}

/** Per-kind defaults, tuned to read as reflections on metallic hulls. */
const PRESETS: Record<
  CombatLightKind,
  { color: number; peak: number; distance: number; ttl: number; shape: "flash" | "pulse" }
> = {
  // Small tight red glow that rides along with a bolt — short range so it only
  // touches nearby hulls, brief ttl because bolts are fast.
  laser: { color: 0xff3322, peak: 6, distance: 14, ttl: 0.18, shape: "pulse" },
  // Big bright orange bloom — large range, higher peak, longer fade.
  explosion: { color: 0xff8a2a, peak: 40, distance: 60, ttl: 0.55, shape: "pulse" },
  // Hot white impact flash — instant on, fast decay, medium range.
  hit: { color: 0xfff2d8, peak: 18, distance: 22, ttl: 0.14, shape: "flash" },
};

export class CombatLights {
  private scene: THREE.Scene;
  private free: THREE.PointLight[] = [];
  private live: LiveLight[] = [];
  private readonly cap: number;

  constructor(scene: THREE.Scene, cap = 12) {
    this.scene = scene;
    this.cap = cap;
    for (let i = 0; i < cap; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2); // decay 2 = physical
      l.visible = false;
      l.castShadow = false; // combat lights never cast shadows (too costly, transient)
      scene.add(l);
      this.free.push(l);
    }
  }

  /** Number of currently-lit combat lights (for the debug overlay). */
  get activeCount(): number {
    return this.live.length;
  }

  /**
   * Spawn a combat light of `kind` at world position `pos`. Optional overrides let
   * a caller tint a specific weapon (e.g. a blue laser) or scale an explosion.
   */
  spawn(
    kind: CombatLightKind,
    pos: THREE.Vector3,
    opts: { color?: number; peakScale?: number; distanceScale?: number } = {},
  ): void {
    const p = PRESETS[kind];
    const light = this.take();
    if (!light) return;
    light.color.setHex(opts.color ?? p.color);
    light.distance = p.distance * (opts.distanceScale ?? 1);
    light.position.copy(pos);
    light.visible = true;
    const peak = p.peak * (opts.peakScale ?? 1);
    light.intensity = p.shape === "flash" ? peak : 0; // flash starts hot
    this.live.push({ light, age: 0, ttl: p.ttl, peak, shape: p.shape });
  }

  /** Advance every live light, fade by its curve, retire the dead. */
  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const L = this.live[i];
      L.age += dt;
      const t = L.age / L.ttl;
      if (t >= 1) {
        L.light.visible = false;
        L.light.intensity = 0;
        this.free.push(L.light);
        this.live.splice(i, 1);
        continue;
      }
      // Falloff: flash = 1→0 ease-out (starts hot); pulse = 0→1→0 ease.
      const k = L.shape === "flash" ? 1 - t * t : Math.sin(Math.PI * t);
      L.light.intensity = L.peak * k;
    }
  }

  private take(): THREE.PointLight | null {
    const f = this.free.pop();
    if (f) return f;
    // Pool exhausted — steal the oldest live light (combat is transient).
    const oldest = this.live.shift();
    if (!oldest) return null;
    return oldest.light;
  }

  /** Kill every live light immediately (e.g. on scene teardown/undock). */
  clear(): void {
    for (const L of this.live) {
      L.light.visible = false;
      L.light.intensity = 0;
      this.free.push(L.light);
    }
    this.live.length = 0;
  }

  dispose(): void {
    this.clear();
    for (const l of this.free) {
      this.scene.remove(l);
      l.dispose();
    }
    this.free.length = 0;
  }
}
