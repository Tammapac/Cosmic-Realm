// ─────────────────────────────────────────────────────────────────────────────
// LandingSmoke — a pooled, self-expiring soft-particle smoke burst for the hangar
// touchdown. When the ship sets down on the pad its thrusters kick up a ring of
// smoke puffs that billow outward, rise a little, expand and fade. Purely visual,
// scene-agnostic, no per-frame allocation.
//
// Design (mirrors CombatLights): a fixed pool of THREE.Sprite puffs sharing one
// soft radial CanvasTexture. burst(worldPos) spawns a ring of live puffs; update(dt)
// advances each (grow + rise + drift + fade) and retires the dead back to the pool.
// Sprites always face the camera, so a handful read as a volumetric cloud cheaply.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from "three";

interface LivePuff {
  sprite: THREE.Sprite;
  age: number;
  ttl: number;
  vel: THREE.Vector3;   // world drift (mostly outward + slightly up)
  startScale: number;
  endScale: number;
  peak: number;         // peak opacity
}

/** Build a soft round smoke blob: bright-ish centre, long transparent tail. */
function makeSmokeTexture(): THREE.Texture {
  const s = 128;
  const cv = document.createElement("canvas");
  cv.width = s; cv.height = s;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, "rgba(210,214,220,0.85)");
  g.addColorStop(0.35, "rgba(180,186,196,0.45)");
  g.addColorStop(0.7, "rgba(150,158,170,0.15)");
  g.addColorStop(1.0, "rgba(140,150,165,0.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class LandingSmoke {
  private scene: THREE.Scene;
  private tex: THREE.Texture;
  private free: THREE.Sprite[] = [];
  private live: LivePuff[] = [];
  private readonly cap: number;

  constructor(scene: THREE.Scene, cap = 24) {
    this.scene = scene;
    this.cap = cap;
    this.tex = makeSmokeTexture();
    for (let i = 0; i < cap; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.tex,
        transparent: true,
        opacity: 0,
        depthWrite: false,        // don't occlude / z-fight against the deck
        depthTest: true,
        blending: THREE.NormalBlending, // smoke is NOT additive (it's opaque-ish)
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      sp.renderOrder = 10;
      scene.add(sp);
      this.free.push(sp);
    }
  }

  get activeCount(): number { return this.live.length; }

  /**
   * Spawn a ring of smoke puffs on the deck around `pos` (the touchdown point).
   * `radius` sizes the ring; `strength` scales puff size/opacity (bigger ship →
   * more smoke). Puffs drift outward + rise, expand, and fade over ~1.2-1.8s.
   */
  burst(pos: THREE.Vector3, radius = 1.2, strength = 1): void {
    const n = Math.min(this.free.length, 12);
    for (let i = 0; i < n; i++) {
      const sp = this.free.pop();
      if (!sp) break;
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const r = radius * (0.6 + Math.random() * 0.6);
      const px = pos.x + Math.cos(a) * r;
      const pz = pos.z + Math.sin(a) * r;
      sp.position.set(px, pos.y + 0.05 + Math.random() * 0.1, pz);
      sp.visible = true;
      const mat = sp.material as THREE.SpriteMaterial;
      const peak = (0.5 + Math.random() * 0.35) * strength;
      mat.opacity = 0;
      const startScale = (0.5 + Math.random() * 0.4) * strength;
      const endScale = (1.6 + Math.random() * 1.0) * strength;
      sp.scale.setScalar(startScale);
      // outward + slight upward drift, a touch of randomness
      const vel = new THREE.Vector3(
        Math.cos(a) * (0.7 + Math.random() * 0.5),
        0.35 + Math.random() * 0.3,
        Math.sin(a) * (0.7 + Math.random() * 0.5),
      );
      this.live.push({
        sprite: sp, age: 0, ttl: 1.2 + Math.random() * 0.6,
        vel, startScale, endScale, peak,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const L = this.live[i];
      L.age += dt;
      const t = L.age / L.ttl;
      if (t >= 1) {
        L.sprite.visible = false;
        (L.sprite.material as THREE.SpriteMaterial).opacity = 0;
        this.free.push(L.sprite);
        this.live.splice(i, 1);
        continue;
      }
      // grow, drift (slowing), fade in fast then out.
      L.sprite.position.addScaledVector(L.vel, dt);
      L.vel.multiplyScalar(1 - 0.9 * dt); // drag
      const scale = L.startScale + (L.endScale - L.startScale) * t;
      L.sprite.scale.setScalar(scale);
      const fade = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8; // quick in, slow out
      (L.sprite.material as THREE.SpriteMaterial).opacity = L.peak * Math.max(0, fade);
    }
  }

  clear(): void {
    for (const L of this.live) {
      L.sprite.visible = false;
      (L.sprite.material as THREE.SpriteMaterial).opacity = 0;
      this.free.push(L.sprite);
    }
    this.live.length = 0;
  }

  dispose(): void {
    this.clear();
    for (const sp of this.free) {
      this.scene.remove(sp);
      (sp.material as THREE.SpriteMaterial).dispose();
    }
    this.free.length = 0;
    this.tex.dispose();
  }
}
