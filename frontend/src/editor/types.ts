/** Core data model for the HUD editor. Kept framework-agnostic (no React
 * imports) so it can be serialized to JSON and reused by the code exporter
 * later without dragging in component code. */

export type ElementKind =
  | "panel"
  | "box"
  | "text"
  | "group"
  | "hud-hotbar"
  | "hud-player-status"
  | "hud-health-bar"
  | "hud-shield-bar"
  | "polygon";

export type Vec2 = { x: number; y: number };

/** A single editable node on the canvas. Position/size are always stored
 * in absolute canvas pixels (1920x1080 space), never percentages -- the
 * inspector and exporter convert as needed. Rotation is degrees, clockwise. */
export type HudElement = {
  id: string;
  kind: ElementKind;
  name: string;
  parentId: string | null;
  /** Order among siblings; also drives DOM/z paint order within a parent. */
  order: number;

  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Pivot as a 0..1 fraction of the element's own box (0.5,0.5 = center). */
  pivot: Vec2;

  zIndex: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;

  /** Free-form style bag edited via the inspector; applied as inline CSS
   * on export/preview. Kept loose (string values) since it mirrors raw
   * CSS properties (background, border, boxShadow, clipPath, ...). */
  style: Record<string, string>;

  /** Text content, only meaningful when kind === "text". */
  text?: string;

  /** Freely editable outline, only meaningful when kind === "polygon".
   * Each point is a 0..1 fraction of the element's own width/height (NOT
   * absolute canvas px) so the shape scales cleanly when the box is
   * resized -- this is exactly what CSS clip-path: polygon(...) expects
   * once multiplied back out to percentages on export. At least 3 points.
   * Straight-line segments only for the MVP (no bezier handles yet). */
  points?: Vec2[];
};

export function defaultPolygonPoints(): Vec2[] {
  // A simple rectangle to start from -- the user drags corners/edges
  // from here into whatever angled/beveled silhouette they want.
  return [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
}

/** Starting vertex outlines for the real HUD components, as 0..1
 * fractions of each component's native (unscaled) box size -- hand-
 * converted from the actual clip-path coordinates in
 * Hotbar.module.css / HudFrame.tsx (PlayerStatus's `cut={{tl:12,br:12}}`)
 * so the editable outline starts out visually IDENTICAL to the shipped
 * silhouette. Dragging a vertex reshapes the outer contour; the
 * component's own internal content (slots, bar fill, text) keeps
 * rendering unclipped underneath and simply gets cropped by whatever
 * shape results -- it is not itself repositioned by a vertex drag,
 * per the "outline only, not the content" scope. HealthBar/ShieldBar
 * intentionally start as a plain rectangle: their real track shape is a
 * thin strip inset within a taller label+track box, and cloning that
 * inner clip-path onto the whole box would just hide the label/numbers
 * rather than give a useful starting silhouette to reshape. */
export function defaultHudSilhouette(kind: ElementKind): Vec2[] {
  switch (kind) {
    case "hud-hotbar":
      // Hotbar.module.css .console clip-path, converted from its 720x150
      // native box (mixed px/% source values) to 0..1 fractions.
      return [
        { x: 22 / 720, y: 0 },
        { x: 0.25, y: 0 },
        { x: 0.38, y: 14 / 150 },
        { x: 0.62, y: 14 / 150 },
        { x: 0.75, y: 0 },
        { x: (720 - 14) / 720, y: 0 },
        { x: 1, y: 7 / 150 },
        { x: 1, y: (150 - 20) / 150 },
        { x: (720 - 26) / 720, y: 1 },
        { x: 30 / 720, y: 1 },
        { x: 0, y: (150 - 16) / 150 },
        { x: 0, y: 5 / 150 },
      ];
    case "hud-player-status":
      // HudFrame's buildClipPath({tl:12, tr:0, bl:0, br:12}) over
      // PlayerStatus's 340x110 native box -- two beveled corners
      // (top-left, bottom-right), the other two square.
      return [
        { x: 12 / 340, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: (110 - 12) / 110 },
        { x: (340 - 12) / 340, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ];
    default:
      return defaultPolygonPoints();
  }
}

export type HudDocument = {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  elements: Record<string, HudElement>;
  /** Root-level element ids, in paint order. */
  rootOrder: string[];
};

export const DEFAULT_CANVAS_WIDTH = 1920;
export const DEFAULT_CANVAS_HEIGHT = 1080;

export function createEmptyDocument(name = "Untitled HUD"): HudDocument {
  return {
    id: crypto.randomUUID(),
    name,
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
    elements: {},
    rootOrder: [],
  };
}
