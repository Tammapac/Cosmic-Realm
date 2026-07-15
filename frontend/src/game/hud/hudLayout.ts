// Shared HUD layout system — reference design is 1366×768 (UIEXAMPLE2).
// Every HUD component is authored in these design coordinates and positioned by
// the single scale/offset computed here, so the whole HUD scales as ONE unit
// and preserves the screenshot's composition at any resolution.

export const DESIGN_W = 1366;
export const DESIGN_H = 768;

export interface HudTransform {
  scale: number;   // uniform scale (min of the two axis ratios)
  offsetX: number; // px to add after scaling, to center the reference viewport
  offsetY: number;
  vw: number;
  vh: number;
}

/** scale = min(vw/1366, vh/768); reference viewport centered; uniform (no
 *  independent width/height scaling → aspect ratio preserved). */
export function computeHudTransform(vw: number, vh: number): HudTransform {
  const scale = Math.min(vw / DESIGN_W, vh / DESIGN_H);
  const offsetX = (vw - DESIGN_W * scale) / 2;
  const offsetY = (vh - DESIGN_H * scale) / 2;
  return { scale, offsetX, offsetY, vw, vh };
}

/** A component's placement in design coordinates + how it anchors. */
export interface HudRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** anchor within the component that (x,y) refers to. Default top-left. */
  anchor?:
    | "top-left" | "top-center" | "top-right"
    | "center-left" | "center" | "center-right"
    | "bottom-left" | "bottom-center" | "bottom-right";
}

/** Map a design-space point to on-screen pixels. */
export function toScreen(t: HudTransform, dx: number, dy: number): { x: number; y: number } {
  return { x: t.offsetX + dx * t.scale, y: t.offsetY + dy * t.scale };
}

/** Resolve a HudRect's top-left screen position + scaled size. */
export function placeRect(t: HudTransform, r: HudRect) {
  const anchor = r.anchor ?? "top-left";
  let ax = r.x, ay = r.y;
  if (anchor.includes("center") && !anchor.startsWith("center") && !anchor.endsWith("center")) {
    // "center" exactly
    ax = r.x - r.w / 2; ay = r.y - r.h / 2;
  } else {
    if (anchor === "center") { ax = r.x - r.w / 2; ay = r.y - r.h / 2; }
    if (anchor.endsWith("center")) ax = r.x - r.w / 2;               // top/bottom-center
    if (anchor.startsWith("center")) ay = r.y - r.h / 2;             // center-left/right
    if (anchor.endsWith("right")) ax = r.x - r.w;
    if (anchor.startsWith("bottom")) ay = r.y - r.h;
  }
  const p = toScreen(t, ax, ay);
  return { x: p.x, y: p.y, w: r.w * t.scale, h: r.h * t.scale };
}
