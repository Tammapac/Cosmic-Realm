// Schattenstapel und Leuchten. Pixi hat kein drop-shadow, deshalb wird der
// Stapel aus CLAUDE.md als vier Ebenen gebaut: harter Sitz als gefaste Fläche,
// darüber drei weiche Scheiben mit steigendem Radius.

import { Container, Graphics, Sprite } from "pixi.js";
import { radialTexture, softShadowTexture } from "./textures";
import { rgba } from "./color";
import { SHADOW } from "./tokens";
import { cut, type Cuts } from "./geometry";

/**
 * Vierstufigen Schattenstapel unter ein Element legen.
 * scale skaliert die Wege — kleine Elemente brauchen kürzere Schatten.
 */
export function addShadowStack(
  into: Container, w: number, h: number, chamfer: number,
  cuts: Cuts = "tr-bl", scale = 1,
): void {
  for (const s of SHADOW) {
    if (s.blur <= 0) {
      const g = new Graphics();
      cut(g, 0, s.dy * scale, w, h, chamfer, 0x03050a, s.alpha, cuts);
      g.eventMode = "none";
      into.addChild(g);
      continue;
    }
    const blur = s.blur * scale;
    const sp = new Sprite(softShadowTexture(s.alpha));
    sp.width = w + blur * 2;
    sp.height = h + blur * 1.4;
    sp.x = -blur;
    sp.y = s.dy * scale - blur * 0.5;
    sp.eventMode = "none";
    into.addChild(sp);
  }
}

/**
 * Weiches Leuchten in einer Akzentfarbe.
 * Ersetzt drop-shadow(0 0 N accent) und wird additiv gemischt.
 */
export function makeGlow(
  color: string | number, w: number, h: number, alpha = 0.5,
): Sprite {
  const sp = new Sprite(radialTexture([
    [0, rgba(color, 0.85)],
    [0.45, rgba(color, 0.35)],
    [1, rgba(color, 0)],
  ]));
  sp.width = w;
  sp.height = h;
  sp.alpha = alpha;
  sp.blendMode = "add";
  sp.eventMode = "none";
  return sp;
}

/** Innenschatten oben und Bounce-Linie unten auf einer versenkten Fläche. */
export function addInsetShading(
  into: Container, x: number, y: number, w: number, h: number,
  chamfer: number, accent: string | number, cuts: Cuts = "tr-bl",
): void {
  const g = new Graphics();
  // 1 px Specular am oberen Rand
  g.rect(x + chamfer * 0.5, y, w - chamfer, 1).fill({ color: 0xffffff, alpha: 0.5 });
  // 2 px Akzent-Unterlicht am unteren Rand
  g.rect(x + chamfer * 0.5, y + h - 2, w - chamfer, 2).fill({ color: accent, alpha: 0.35 });
  g.eventMode = "none";
  into.addChild(g);
  void cuts;
}

/** Radialer Lichtwurf von oben in die Fläche. */
export function makeWash(
  color: string | number, w: number, h: number, alpha = 0.16,
): Sprite {
  const sp = new Sprite(radialTexture([
    [0, rgba(color, alpha)],
    [0.74, "rgba(0,0,0,0)"],
  ]));
  sp.width = w;
  sp.height = h;
  sp.eventMode = "none";
  return sp;
}
