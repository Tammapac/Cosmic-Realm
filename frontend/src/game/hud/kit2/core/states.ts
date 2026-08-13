// Interaktionszustände. Jeder Knopf, Reiter, Chip und Sockel im Kit trägt
// dieselben sieben Zustände (CLAUDE.md): normal, hover, pressed, disabled,
// selected, active, focus. Diese Datei ist die einzige Stelle, an der sie
// definiert werden.

import { Container, Graphics, Sprite } from "pixi.js";
import { radialTexture } from "./textures";
import { easeUi, approach } from "./easing";
import { LIFT, MOTION } from "./tokens";
import { makeGlow } from "./shadows";

export type VisualState =
  | "normal" | "hover" | "pressed" | "disabled" | "selected" | "active" | "focus";

export type StateOpts = {
  /** Hub bei Hover in px. */
  lift?: number;
  /** Senkung bei Press in px. */
  sink?: number;
  /** Waagerechter Schub statt Hub — Listenzeilen. */
  slide?: number;
  /** Skalierung bei Hover statt Hub — Sockel, Schließer. */
  scaleHover?: number;
  /** Skalierung bei Press. */
  scalePress?: number;
  /** Helligkeit bei Hover. */
  brightHover?: number;
  /** Helligkeit bei Press. */
  brightPress?: number;
  /** Aura, deren Deckkraft mit dem Zustand steigt. */
  aura?: Sprite;
  auraBase?: number;
  /** Klickblitz zeichnen. */
  flash?: boolean;
  /** Akzentfarbe für Blitz und Fokusring. */
  accent?: number;
  /** Fokusring zeichnen (Tastaturbedienung). */
  focusRing?: boolean;
  /** Maße für den Fokusring. */
  size?: { w: number; h: number };
  enabled?: boolean;
  selected?: boolean;
  active?: boolean;
  onClick?: () => void;
  onRightClick?: () => void;
  onHover?: (over: boolean) => void;
  onStateChange?: (s: VisualState) => void;
  /** Vorlesetext. */
  aria?: string;
};

export type StateHandle = {
  /** Pro Frame rufen — bewegt Hub, Helligkeit und Aura weich nach. */
  update: (dt: number) => void;
  setEnabled: (on: boolean) => void;
  setSelected: (on: boolean) => void;
  setActive: (on: boolean) => void;
  readonly state: VisualState;
  destroy: () => void;
};

/**
 * Zustände an ein Element hängen.
 * Das Element bewegt sich selbst — der Aufrufer muss nichts nachrechnen.
 */
export function attachStates(node: Container, o: StateOpts = {}): StateHandle {
  const lift = o.lift ?? LIFT.hover;
  const sink = o.sink ?? LIFT.press;
  const slide = o.slide ?? 0;
  const accent = o.accent ?? 0xffffff;
  const x0 = node.x, y0 = node.y;

  let enabled = o.enabled !== false;
  let selected = !!o.selected;
  let active = !!o.active;
  let over = false;
  let down = false;
  let focused = false;

  // Zielwerte, auf die zugelaufen wird
  let offset = 0, bright = 1, auraA = o.auraBase ?? 0;
  let curOffset = 0, curBright = 1, curAura = o.auraBase ?? 0;

  let flash: Sprite | null = null;
  let flashT = 0;
  let ring: Graphics | null = null;

  if (o.focusRing && o.size) {
    ring = new Graphics();
    ring.rect(-2, -2, o.size.w + 4, o.size.h + 4)
      .stroke({ width: 1, color: accent, alpha: 0.8 });
    ring.visible = false;
    ring.eventMode = "none";
    node.addChild(ring);
  }

  const state = (): VisualState =>
    !enabled ? "disabled"
      : down ? "pressed"
        : over ? "hover"
          : focused ? "focus"
            : selected ? "selected"
              : active ? "active" : "normal";

  let last: VisualState = state();

  const apply = (): void => {
    const s = state();
    if (s !== last) { last = s; o.onStateChange?.(s); }
    if (!enabled) {
      offset = 0; bright = 1; auraA = 0;
      node.alpha = 0.42;
      node.tint = 0x8899aa;
      node.cursor = "not-allowed";
      node.eventMode = "none";
      return;
    }
    node.alpha = 1;
    node.eventMode = "static";
    node.cursor = "pointer";
    if (down) {
      offset = sink;
      bright = o.brightPress ?? 1.28;
      auraA = (o.auraBase ?? 0) + 0.34;
      if (o.scalePress) node.scale.set(o.scalePress);
    } else if (over) {
      offset = -lift;
      bright = o.brightHover ?? 1.14;
      auraA = (o.auraBase ?? 0) + 0.2;
      if (o.scaleHover) node.scale.set(o.scaleHover);
    } else {
      offset = 0;
      bright = selected || active ? 1.06 : 1;
      auraA = (o.auraBase ?? 0) + (selected || active ? 0.14 : 0);
      if (o.scaleHover || o.scalePress) node.scale.set(1);
    }
    if (ring) ring.visible = focused && !down;
  };

  const spawnFlash = (): void => {
    if (o.flash === false) return;
    flash?.destroy();
    flash = new Sprite(radialTexture([
      [0, "rgba(255,255,255,.4)"],
      [0.6, "rgba(255,255,255,.12)"],
      [1, "rgba(255,255,255,0)"],
    ]));
    const w = o.size?.w ?? node.width, h = o.size?.h ?? node.height;
    flash.width = w * 1.4;
    flash.height = h * 1.8;
    flash.x = -w * 0.2;
    flash.y = -h * 0.4;
    flash.blendMode = "add";
    flash.eventMode = "none";
    node.addChild(flash);
    flashT = 0;
  };

  node.eventMode = enabled ? "static" : "none";
  node.cursor = enabled ? "pointer" : "not-allowed";
  if (o.aria) node.accessible = true;
  if (o.aria) node.accessibleTitle = o.aria;

  node.on("pointerover", () => { over = true; o.onHover?.(true); apply(); });
  node.on("pointerout", () => { over = false; down = false; o.onHover?.(false); apply(); });
  node.on("pointerdown", () => { down = true; apply(); });
  node.on("pointerupoutside", () => { down = false; apply(); });
  node.on("pointerup", () => {
    if (!down) return;
    down = false;
    apply();
    spawnFlash();
    o.onClick?.();
  });
  if (o.onRightClick) {
    node.on("rightclick", (e) => { e.preventDefault?.(); o.onRightClick?.(); });
  }
  apply();

  return {
    update(dt: number): void {
      curOffset = approach(curOffset, offset, dt, MOTION.hover);
      curBright = approach(curBright, bright, dt, MOTION.hover);
      if (slide) node.x = x0 + curOffset * (slide / Math.max(1, lift));
      else node.y = y0 + curOffset;
      if (Math.abs(curBright - 1) > 0.002) {
        const k = Math.min(255, Math.round(255 * Math.min(1.6, curBright)));
        node.tint = (k << 16) | (k << 8) | k;
      } else node.tint = 0xffffff;
      if (o.aura) {
        curAura = approach(curAura, auraA, dt, MOTION.hover);
        o.aura.alpha = curAura;
      }
      if (flash) {
        flashT += dt / MOTION.flash;
        flash.alpha = Math.max(0, 1 - flashT);
        if (flashT >= 1) { flash.destroy(); flash = null; }
      }
    },
    setEnabled(on: boolean): void { enabled = on; apply(); },
    setSelected(on: boolean): void { selected = on; apply(); },
    setActive(on: boolean): void { active = on; apply(); },
    get state(): VisualState { return state(); },
    destroy(): void {
      node.removeAllListeners();
      flash?.destroy();
      ring?.destroy();
    },
  };
}

/** Fokusreihenfolge für Tastaturbedienung innerhalb eines Fensters. */
export class FocusRing {
  private items: { node: Container; handle: StateHandle; act: () => void }[] = [];
  private idx = -1;

  add(node: Container, handle: StateHandle, act: () => void): void {
    this.items.push({ node, handle, act });
  }

  step(dir: 1 | -1): void {
    if (!this.items.length) return;
    this.idx = (this.idx + dir + this.items.length) % this.items.length;
  }

  activate(): void { this.items[this.idx]?.act(); }

  clear(): void { this.items.length = 0; this.idx = -1; }

  update(dt: number): void { for (const i of this.items) i.handle.update(dt); }
}

export { easeUi };
