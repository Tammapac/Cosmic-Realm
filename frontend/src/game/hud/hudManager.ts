// PixiJS HUD overlay manager. Owns a root container attached to the game's
// uiLayer, holds each HUD section as a sub-container, and re-lays-them-out each
// frame using the shared 1366×768 transform. Sections are plain objects with a
// `container` and an `update(transform, dt)` method — one section per screenshot
// region (hotbar+circles first, then top bar, minimap, etc.).

import * as PIXI from "pixi.js";
import { getHudLayer, getScreenSize } from "../pixi-renderer-v2-integrated";
import { computeHudTransform, HudTransform } from "./hudLayout";
import { HotbarSection } from "./sections/hotbarSection";
import { ENABLE_PIXI_UI } from "../renderer-config";
import { createUiLayers, destroyUiLayers, getUiLayers } from "./layers";
import { COLOR, GEO } from "./theme";
import { createKitHost2 } from "./sections/kitHost2";
import { createLoadoutSection } from "./sections/loadoutSection";

export interface HudSection {
  container: PIXI.Container;
  update(t: HudTransform, dt: number): void;
  destroy(): void;
}

let root: PIXI.Container | null = null;
let sections: HudSection[] = [];
let mounted = false;

// ── Native PixiJS UI (?pixi-ui) ─────────────────────────────────────────────
// A temporary scaffold probe: a themed titanium plate drawn into the hud layer
// so the layer tree can be SEEN working before real components exist. Removed
// once combatHudSection lands. `probeT` drives its border-energy sweep.
let probe: PIXI.Container | null = null;
let probeGfx: PIXI.Graphics | null = null;
let probeT = 0;

function drawProbePlate(g: PIXI.Graphics, w: number, h: number, energy: number): void {
  g.clear();
  const c = GEO.windowCut;
  // 8-point chamfered silhouette (the window language)
  const pts = [
    c, 0, w - c, 0, w, c, w, h - c, w - c, h, c, h, 0, h - c, 0, c,
  ];
  // navy glass body
  g.beginFill(COLOR.navy, 0.55);
  g.drawPolygon(pts);
  g.endFill();
  // titanium rim
  g.lineStyle(GEO.rim, COLOR.steel1, 0.9);
  g.drawPolygon(pts);
  // cyan inner conduit
  g.lineStyle(2, COLOR.cyan, 0.85);
  const i = GEO.inset;
  g.drawPolygon([
    c, i, w - c, i, w - i, c, w - i, h - c, w - c, h - i,
    c, h - i, i, h - c, i, c,
  ]);
  // energy dot travelling the top edge (proof the frame animates per-frame)
  const dotX = i + (w - 2 * i) * energy;
  g.lineStyle(0);
  g.beginFill(COLOR.cyanBright, 1);
  g.drawCircle(dotX, i, 4);
  g.endFill();
  g.beginFill(COLOR.cyan, 0.35);
  g.drawCircle(dotX, i, 9);
  g.endFill();
}

function mountProbe(): void {
  const layers = getUiLayers();
  if (!layers) return;
  probe = new PIXI.Container();
  probe.name = "pixi-ui-probe";
  probeGfx = new PIXI.Graphics();
  probe.addChild(probeGfx);

  const label = new PIXI.Text("PIXI UI LAYER · ONLINE", {
    fontFamily: "monospace",
    fontSize: 13,
    fill: COLOR.textBright,
    letterSpacing: 3,
  });
  label.position.set(18, 16);
  probe.addChild(label);

  layers.hud.addChild(probe);
}

export function mountHud(): void {
  if (mounted) return;
  const layer = getHudLayer();
  if (!layer) return;
  root = new PIXI.Container();
  root.name = "hud-overlay";
  layer.addChild(root);

  // Section 1 is rendered by the React Hotbar (retextured to the UIEXAMPLE2
  // pixel-art assets) so all icons/hover/active/cooldown/dropdown functionality
  // is preserved. The PixiJS HotbarSection is kept for reference but not mounted.
  sections = [createLoadoutSection(), createKitHost2()];
  for (const s of sections) root.addChild(s.container);
  mounted = true;
  void HotbarSection;

  // Native UI layer scaffold — only when opted in.
  if (ENABLE_PIXI_UI) {
    createUiLayers(root);
    mountProbe();
  }
}

export function updateHud(dt: number): void {
  if (!mounted || !root) return;
  const size = getScreenSize();
  if (!size) return;
  const t = computeHudTransform(size.w, size.h);
  for (const s of sections) s.update(t, dt);

  // Probe animation: place near screen centre-bottom, sweep the energy dot.
  if (ENABLE_PIXI_UI && probe && probeGfx) {
    probeT = (probeT + dt / 3) % 1;
    const w = 320, h = 120;
    probe.position.set(Math.round(size.w / 2 - w / 2), Math.round(size.h - h - 24));
    drawProbePlate(probeGfx, w, h, probeT);
  }
}

export function unmountHud(): void {
  if (!mounted) return;
  for (const s of sections) s.destroy();
  sections = [];
  probe = null;
  probeGfx = null;
  destroyUiLayers();
  root?.destroy({ children: true });
  root = null;
  mounted = false;
}

export function isHudMounted(): boolean {
  return mounted;
}
