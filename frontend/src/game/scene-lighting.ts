/**
 * SceneLighting — screen-space light composition that ties the whole frame
 * together so ships, stations, asteroids and effects read as objects inside
 * ONE lit space instead of layers cut into each other:
 *
 *   1 keyLight  warm sheen falling in from the upper right — the same
 *               direction as the 3D layers' sun, so the 2D world shares
 *               the 3D light source (SCREEN blend, very subtle)
 *   2 ambient   zone-colored atmospheric light, tinted live from the
 *               current map palette (SCREEN, whisper-quiet)
 *   3 vignette  soft darkening toward the corners (MULTIPLY) — pulls the
 *               eye to the play area and grounds the bright HUD edges
 *
 * Three static sprites on one container (above the world, below the UI),
 * resized per frame — effectively free on the GPU.
 */
import * as PIXI from "pixi.js";

function vignetteTex(): PIXI.Texture {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  // MULTIPLY blend: white = neutral, darker = shaded
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.32, S / 2, S / 2, S * 0.72);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(150,160,195,0.72)"); // cool shade, not pure black
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return PIXI.Texture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR });
}

function keyLightTex(): PIXI.Texture {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  // Warm light entering from the upper right — mirrors the 3D sun at
  // position (100, 300, -80) so both worlds share one key light.
  const g = ctx.createRadialGradient(S * 0.92, S * 0.06, 0, S * 0.92, S * 0.06, S * 1.1);
  g.addColorStop(0, "rgba(255,240,214,0.3)");
  g.addColorStop(0.4, "rgba(255,236,200,0.12)");
  g.addColorStop(1, "rgba(255,236,200,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return PIXI.Texture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR });
}

function ambientTex(): PIXI.Texture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  // Soft top-down falloff so the ambient color breathes instead of being flat
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.55, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0.75)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return PIXI.Texture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR });
}

export class SceneLighting {
  readonly container = new PIXI.Container();
  private keyLight: PIXI.Sprite;
  private ambient: PIXI.Sprite;
  private vignette: PIXI.Sprite;

  constructor() {
    this.keyLight = new PIXI.Sprite(keyLightTex());
    this.keyLight.blendMode = PIXI.BLEND_MODES.SCREEN;

    this.ambient = new PIXI.Sprite(ambientTex());
    this.ambient.blendMode = PIXI.BLEND_MODES.SCREEN;
    this.ambient.alpha = 0.09;

    this.vignette = new PIXI.Sprite(vignetteTex());
    this.vignette.blendMode = PIXI.BLEND_MODES.MULTIPLY;
    this.vignette.alpha = 0.85;

    this.container.addChild(this.keyLight, this.ambient, this.vignette);
    this.container.eventMode = "none"; // never intercepts input
  }

  private vignetteOnly = false;

  /** Vignette-only mode: hide the SCREEN key/ambient grade layers (which
   *  flatten 3D contrast) and keep just a mild corner vignette. */
  setVignetteOnly(on: boolean): void {
    this.vignetteOnly = on;
    this.keyLight.visible = !on;
    this.ambient.visible = !on;
    if (on) this.vignette.alpha = 0.55; // gentler than the full 0.85
  }

  /** Per-frame: fit to screen, tint the ambient from the zone palette. */
  update(w: number, h: number, ambientHex: string, tick: number): void {
    for (const s of [this.keyLight, this.ambient, this.vignette]) {
      s.width = w;
      s.height = h;
    }
    if (this.vignetteOnly) return;
    this.ambient.tint = PIXI.utils.string2hex(ambientHex);
    // Barely-there breathing keeps the light alive without being noticed.
    this.keyLight.alpha = 0.9 + 0.1 * Math.sin(tick * 0.11);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
