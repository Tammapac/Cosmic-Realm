// The camera-independent UI root and its six sub-layers, mounted inside the
// renderer's fixed screen-space `uiLayer` (getHudLayer()). Draw order is the
// child order below: world HUD at the bottom, modal scrim on top.
//
// This is pure structure — no game logic. Sections and windows add themselves
// to the appropriate layer via getUiLayers().
import * as PIXI from "pixi.js";

export interface UiLayers {
  /** The single root; everything else nests under it so one detach removes all. */
  root: PIXI.Container;
  /** Always-on combat HUD (bars, hotbar, counters). */
  hud: PIXI.Container;
  /** Draggable/openable game windows (inventory, station, skills…). */
  window: PIXI.Container;
  /** Hover tooltips — above windows, below notifications. */
  tooltip: PIXI.Container;
  /** Transient toasts / alerts. */
  notification: PIXI.Container;
  /** Cursor-follow effects (energy-to-cursor, click flashes). */
  cursorEffects: PIXI.Container;
  /** Full-screen scrim + modal dialogs — always topmost. */
  modalOverlay: PIXI.Container;
}

let layers: UiLayers | null = null;

/** Build the layer tree under `parent` (the renderer's uiLayer). Idempotent —
 *  but if a previous tree was destroyed (HMR, StrictMode double-mount) the
 *  cached root's `destroyed` flag is set; rebuild instead of handing back a
 *  dead container. */
export function createUiLayers(parent: PIXI.Container): UiLayers {
  if (layers && !layers.root.destroyed) return layers;
  layers = null;

  const root = new PIXI.Container();
  root.name = "pixi-ui-root";
  // The root spans the screen and never moves; children position in screen px.
  root.sortableChildren = false; // explicit z via add-order, cheaper than sort

  const make = (name: string): PIXI.Container => {
    const c = new PIXI.Container();
    c.name = name;
    // Layers are pass-through for input by default; interactive leaves opt in
    // with eventMode="static". A container with no hitArea and eventMode
    // "passive"/"auto" still lets children receive events.
    root.addChild(c);
    return c;
  };

  const hud = make("ui-hud");
  const window = make("ui-window");
  const tooltip = make("ui-tooltip");
  const notification = make("ui-notification");
  const cursorEffects = make("ui-cursor-fx");
  const modalOverlay = make("ui-modal");

  // Tooltips and cursor-fx should never eat pointer events themselves.
  tooltip.eventMode = "none";
  cursorEffects.eventMode = "none";

  parent.addChild(root);
  layers = { root, hud, window, tooltip, notification, cursorEffects, modalOverlay };
  return layers;
}

/** The current layer tree, or null before createUiLayers(). */
export function getUiLayers(): UiLayers | null {
  return layers;
}

/** Tear down the whole tree and drop the reference (called from unmountHud). */
export function destroyUiLayers(): void {
  if (!layers) return;
  layers.root.destroy({ children: true });
  layers = null;
}
