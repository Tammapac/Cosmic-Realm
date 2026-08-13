// CosmicWindow — a window/panel frame built from the procedural atlas as TWO
// nine-sliced layers: the machined-metal base and a separately-tinted emissive
// energy channel on top. This is the reference-quality path (rendered texture,
// not vector Graphics), and the two-layer split is what makes the accent
// independently tintable/animatable per the brief.
//
// The frame border stays crisp at any size (nine-slice margins); only the flat
// centre stretches. A separate recessed content area is exposed so callers can
// place children inside the frame without overlapping the ornament.
import * as PIXI from "pixi.js";
import { UiComponent } from "./UiComponent";
import { FRAME, makeNineSlice } from "../atlas";
import { COLOR } from "../theme";

export interface CosmicWindowOpts {
  w: number;
  h: number;
  /** emissive accent tint (cyan default; gold elite; amber/red warning). */
  accent?: number;
}

export class CosmicWindow extends UiComponent {
  private base: PIXI.NineSlicePlane;
  private glow: PIXI.NineSlicePlane;
  /** Children added here sit inside the recessed content area. */
  readonly content: PIXI.Container;
  private opts: Required<CosmicWindowOpts>;

  constructor(opts: CosmicWindowOpts) {
    super("cosmic-window");
    this.opts = { accent: COLOR.cyan, ...opts };

    this.base = makeNineSlice(FRAME.base, FRAME.slice);
    this.glow = makeNineSlice(FRAME.emissive, FRAME.slice);
    this.glow.tint = this.opts.accent;
    this.glow.blendMode = "add";   // energy adds over metal

    this.content = new PIXI.Container();

    this.container.addChild(this.base, this.glow, this.content);
    this.layout();
  }

  private layout(): void {
    const { w, h } = this.opts;
    this.base.width = w; this.base.height = h;
    this.glow.width = w; this.glow.height = h;
    // content sits inside the frame margins (the recessed surface)
    const m = FRAME.slice;
    this.content.position.set(m.left, m.top);
  }

  /** Inner content rectangle (px), for laying out children. */
  get inner(): { x: number; y: number; w: number; h: number } {
    const m = FRAME.slice;
    return { x: m.left, y: m.top, w: this.opts.w - m.left - m.right, h: this.opts.h - m.top - m.bottom };
  }

  resize(w: number, h: number): void {
    this.opts.w = w; this.opts.h = h;
    this.layout();
  }

  setAccent(color: number): void {
    this.opts.accent = color;
    this.glow.tint = color;
  }

  /** Pulse the emissive channel with the shared anim value (opening/hover). */
  protected redraw(): void {
    // emissive breathes subtly with anim; base stays constant
    const a = 0.75 + 0.25 * this.anim;
    this.glow.alpha = a;
  }
}
