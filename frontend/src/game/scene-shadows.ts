/**
 * SceneShadows — soft drop shadows under ships and stations so the scene
 * key light (upper right) visibly "grips" the objects: every shadow falls
 * to the LOWER LEFT, opposite the light, anchoring ships to the scene.
 *
 * Two pooled containers:
 *   world  — inside worldLayer near the bottom: enemies, other players,
 *            NPCs and the local player (under the 3D enemy composite and
 *            all sprites, above the background/parallax).
 *   screen — on the stage directly UNDER the station 3D composite, so
 *            station shadows fall onto the background, not onto the
 *            station itself (screen coordinates).
 *
 * Immediate-mode API per frame: beginFrame() → drop()/dropScreen() per
 * entity → endFrame() hides unused pool sprites. No allocations after
 * warm-up.
 */
import * as PIXI from "pixi.js";

// Shadow direction: light comes from the upper right (see scene-lighting
// and the 3D layers' sun), so shadows offset toward the lower left.
const DIR_X = -0.62;
const DIR_Y = 0.62;

let shadowTexCache: PIXI.Texture | null = null;
function shadowTex(): PIXI.Texture {
  if (shadowTexCache) return shadowTexCache;
  const S = 128;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(2,5,12,0.6)");
  g.addColorStop(0.55, "rgba(2,5,12,0.32)");
  g.addColorStop(1, "rgba(2,5,12,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  shadowTexCache = PIXI.Texture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR });
  return shadowTexCache;
}

class ShadowPool {
  readonly container = new PIXI.Container();
  private pool: PIXI.Sprite[] = [];
  private used = 0;

  constructor() {
    this.container.eventMode = "none";
  }

  begin(): void {
    this.used = 0;
  }

  drop(x: number, y: number, size: number, strength: number): void {
    let s = this.pool[this.used];
    if (!s) {
      s = new PIXI.Sprite(shadowTex());
      s.anchor.set(0.5);
      this.pool.push(s);
      this.container.addChild(s);
    }
    this.used++;
    s.visible = true;
    const off = size * 0.4;
    s.position.set(x + DIR_X * off, y + DIR_Y * off);
    s.width = size * 2.2;
    s.height = size * 1.5; // squashed ellipse — reads as a cast shadow
    s.alpha = strength;
  }

  end(): void {
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false;
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.pool = [];
  }
}

export class SceneShadows {
  readonly world = new ShadowPool();
  readonly screen = new ShadowPool();

  beginFrame(): void {
    this.world.begin();
    this.screen.begin();
  }

  endFrame(): void {
    this.world.end();
    this.screen.end();
  }

  destroy(): void {
    this.world.destroy();
    this.screen.destroy();
  }
}
