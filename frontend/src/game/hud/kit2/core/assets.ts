// Asset-Register. Alle Pfade an einer Stelle, damit im Modulcode kein String
// mehr steht und der Bundler alles findet.
//
// Aufruf beim Spielstart:
//
//   import { loadUiAssets } from "./core/assets";
//   await loadUiAssets();            // Manifest + Fonts
//
// Danach liefert texture("items/laser-t10") synchron die geladene Textur.

import { Assets, Texture } from "pixi.js";
import { loadFonts } from "./typography";

/** Wurzel unter public/. Beim Einbau anpassen, falls anders montiert. */
export let ASSET_ROOT = "assets";

export function setAssetRoot(root: string): void { ASSET_ROOT = root.replace(/\/$/, ""); }

/** Item-Icons. */
export const ITEMS = [
  "genshield-t2", "genshield-t3", "genshield-t4",
  "genspeed-t2", "genspeed-t3", "genspeed-t5",
  "laser-t2", "laser-t4", "laser-t5", "laser-t6", "laser-t8", "laser-t9", "laser-t10",
  "mod0-t3", "mod1-t2", "mod2-t3", "mod2-t4", "mod3-t3",
] as const;

/** Oberflächen und Rahmenteile. */
export const ATLAS = [
  "glow-bar", "hex-plate", "oct-panel", "plate-dark", "slot", "strip-notch",
  "ic-clan", "ic-journal", "ic-logout", "ic-map", "ic-quests",
  "ic-send", "ic-settings", "ic-social",
] as const;

/** Rahmen als Nine-Slice. */
export const FRAMES = ["panel-frame", "panel-frame-gold"] as const;

/** Knopfflächen als Nine-Slice. */
export const BUTTONS = ["btn-9s", "btn-9s-hover"] as const;

/** Redesign-Teile: Masterrahmen, Sockel, Knopf, Ecken. */
export const REDESIGN = [
  "master_panel", "master_slot_normal", "master_button_normal",
  "corner_tl", "endcap_bolt", "separator_h",
] as const;

export const ICONS = ["galaxy-map", "inventory", "skills"] as const;
export const FACTIONS = ["eic"] as const;
export const KIT = ["slot_cyan"] as const;

// Kein SHEETS-Eintrag mehr. items-atlas.json / armor-atlas.json wurden hier als
// PixiJS-Spritesheets geladen, sind aber in einem eigenen Format geschrieben
// ({image, size, cell, frames} statt {meta:{image}, frames}). Pixi las meta.image
// als undefined und warf "Cannot read properties of undefined (reading 'image')",
// was loadUiAssets() als Ganzes abbrach — samt aller Icons und Frames, die davor
// schon geladen waren. Kein Aufrufer las jemals den `sheet/`-Alias; die beiden
// JSONs bleiben für Werkzeuge liegen, werden aber nicht mehr über Pixi geladen.

const path = (rel: string): string => `${ASSET_ROOT}/ui/${rel}`;

/** Vollständige Liste aller UI-Texturen als Pfadpaare. */
export function manifest(): { alias: string; src: string }[] {
  const out: { alias: string; src: string }[] = [];
  for (const n of ITEMS) out.push({ alias: `items/${n}`, src: path(`items/${n}.png`) });
  for (const n of ATLAS) out.push({ alias: `atlas/${n}`, src: path(`atlas/${n}.png`) });
  for (const n of FRAMES) out.push({ alias: `frames/${n}`, src: path(`frames/${n}.png`) });
  for (const n of BUTTONS) out.push({ alias: `buttons/${n}`, src: path(`buttons/${n}.png`) });
  for (const n of REDESIGN) out.push({ alias: `redesign/${n}`, src: path(`redesign/${n}.png`) });
  for (const n of ICONS) out.push({ alias: `icons/${n}`, src: path(`icons/${n}.png`) });
  // No rank art here. kit2 used to preload two demo badges (rank_07, rank_11)
  // that nothing ever drew — a dead load path pointing at a stale copy of the
  // rank set. Rank imagery lives in /assets/ui/ranks and is resolved through
  // rankIcon() / rankIconSrcSet() in game/types.ts.
  for (const n of FACTIONS) out.push({ alias: `factions/${n}`, src: path(`factions/${n}.png`) });
  for (const n of KIT) out.push({ alias: `kit/${n}`, src: path(`kit/${n}.png`) });
  return out;
}

let loaded: Promise<void> | null = null;

/**
 * Alle UI-Texturen und Schriften laden. Idempotent.
 * onProgress bekommt 0 … 1 — für den Ladebalken im Spiel.
 */
export function loadUiAssets(onProgress?: (p: number) => void): Promise<void> {
  if (loaded) return loaded;
  const list = manifest();
  loaded = (async () => {
    await loadFonts(`${ASSET_ROOT}/fonts`);
    Assets.addBundle("cosmic-ui", list.reduce<Record<string, string>>((a, e) => {
      a[e.alias] = e.src;
      return a;
    }, {}));
    await Assets.loadBundle("cosmic-ui", onProgress);
  })();
  return loaded;
}

/**
 * Geladene Textur holen. Nach loadUiAssets() synchron.
 * Unbekannte Aliase liefern Texture.EMPTY statt zu werfen — ein fehlendes Icon
 * darf kein Fenster kaputt machen.
 */
export function texture(alias: string): Texture {
  const t = Assets.cache.get(alias) as Texture | undefined;
  if (t) return t;
  const direct = Assets.cache.get(path(alias + ".png")) as Texture | undefined;
  return direct ?? Texture.EMPTY;
}

/** Item-Icon nach Kürzel: itemTexture("laser-t10"). */
export const itemTexture = (name: string): Texture => texture(`items/${name}`);

/** Nine-Slice-Ränder der mitgelieferten Rahmen. */
export const NINE_SLICE = {
  "frames/panel-frame": { left: 34, top: 34, right: 34, bottom: 34 },
  "frames/panel-frame-gold": { left: 34, top: 34, right: 34, bottom: 34 },
  "buttons/btn-9s": { left: 12, top: 12, right: 12, bottom: 12 },
  "buttons/btn-9s-hover": { left: 12, top: 12, right: 12, bottom: 12 },
  "redesign/master_panel": { left: 40, top: 40, right: 40, bottom: 40 },
  "redesign/master_button_normal": { left: 14, top: 14, right: 14, bottom: 14 },
  "redesign/master_slot_normal": { left: 10, top: 10, right: 10, bottom: 10 },
} as const;
