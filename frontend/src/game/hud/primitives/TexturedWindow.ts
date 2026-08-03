// TexturedWindow — a window frame drawn from a real rendered ATLAS TEXTURE via
// NineSliceSprite, not vector Graphics. This is how the reference-quality metal
// (bevels, milled highlights, painted depth) is achieved: the art is a texture,
// scaled on its 9-slice margins so the corners/title cassette stay crisp while
// the middle stretches to any window size.
//
// The texture is loaded once and shared; the slice margins describe how thick
// the ornamented border is on each edge so only the flat middle stretches.
import * as PIXI from "pixi.js";
import { UiComponent } from "./UiComponent";

export interface TexturedWindowOpts {
  w: number;
  h: number;
  /** atlas texture URL (a rendered frame PNG). */
  texture: string;
  /** 9-slice margins in texture px: how far in the ornament reaches. */
  slice: { left: number; top: number; right: number; bottom: number };
}

export class TexturedWindow extends UiComponent {
  private sprite: PIXI.NineSlicePlane | null = null;
  private opts: TexturedWindowOpts;

  constructor(opts: TexturedWindowOpts) {
    super("textured-window");
    this.opts = opts;
    const tex = PIXI.Texture.from(opts.texture);
    // NineSlicePlane is v7's nine-slice sprite (NineSliceSprite in v8).
    const s = new PIXI.NineSlicePlane(
      tex, opts.slice.left, opts.slice.top, opts.slice.right, opts.slice.bottom,
    );
    s.width = opts.w;
    s.height = opts.h;
    this.sprite = s;
    this.container.addChild(s);

    // If the texture is still loading, size it once it arrives.
    if (!tex.baseTexture.valid) {
      tex.baseTexture.once("loaded", () => {
        if (this.sprite) { this.sprite.width = opts.w; this.sprite.height = opts.h; }
      });
    }
  }

  resize(w: number, h: number): void {
    this.opts.w = w; this.opts.h = h;
    if (this.sprite) { this.sprite.width = w; this.sprite.height = h; }
  }

  protected redraw(): void { /* texture-driven; nothing to redraw per frame */ }
}
