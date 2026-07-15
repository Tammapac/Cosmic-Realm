// PixiJS HUD overlay manager. Owns a root container attached to the game's
// uiLayer, holds each HUD section as a sub-container, and re-lays-them-out each
// frame using the shared 1366×768 transform. Sections are plain objects with a
// `container` and an `update(transform, dt)` method — one section per screenshot
// region (hotbar+circles first, then top bar, minimap, etc.).

import * as PIXI from "pixi.js";
import { getHudLayer, getScreenSize } from "../pixi-renderer-v2-integrated";
import { computeHudTransform, HudTransform } from "./hudLayout";
import { HotbarSection } from "./sections/hotbarSection";

export interface HudSection {
  container: PIXI.Container;
  update(t: HudTransform, dt: number): void;
  destroy(): void;
}

let root: PIXI.Container | null = null;
let sections: HudSection[] = [];
let mounted = false;

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
  sections = [];
  for (const s of sections) root.addChild(s.container);
  mounted = true;
  void HotbarSection;
}

export function updateHud(dt: number): void {
  if (!mounted || !root) return;
  const size = getScreenSize();
  if (!size) return;
  const t = computeHudTransform(size.w, size.h);
  for (const s of sections) s.update(t, dt);
}

export function unmountHud(): void {
  if (!mounted) return;
  for (const s of sections) s.destroy();
  sections = [];
  root?.destroy({ children: true });
  root = null;
  mounted = false;
}

export function isHudMounted(): boolean {
  return mounted;
}
